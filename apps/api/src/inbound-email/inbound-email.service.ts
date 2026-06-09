import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { and, desc, eq, isNull, sql } from 'drizzle-orm'
import { companies, contacts, deals, emailMessages, emailThreads, gmailMailboxStates } from '@symph-crm/database'
import { DB } from '../database/database.module'
import type { Database } from '../database/database.types'
import { CentralGmailService, type CentralGmailThread } from '../gmail/central-gmail.service'
import { EmailLeadClassifierService, type ClassifiedEmailThread } from './email-lead-classifier.service'
import { FollowUpRemindersService } from './follow-up-reminders.service'
import { CompaniesService } from '../companies/companies.service'
import { ContactsService } from '../contacts/contacts.service'
import { DealsService } from '../deals/deals.service'
import { DealNotesService } from '../deals/deal-notes.service'
import { ActivitiesService } from '../activities/activities.service'

export type EmailIngestBody = {
  dryRun?: boolean
  query?: string
  maxResults?: number
  createDrafts?: boolean
  mailbox?: string
  workspaceId?: string
}

export type EmailThreadListParams = {
  status?: string
  classification?: string
  dealId?: string
  companyId?: string
  contactId?: string
  limit?: number
}

type ExistingMatch = {
  contact: typeof contacts.$inferSelect | null
  company: typeof companies.$inferSelect | null
  activeDeals: Array<typeof deals.$inferSelect>
}

type ProcessedThreadResult = {
  gmailThreadId: string
  persisted: boolean
  skippedSideEffects: boolean
  classification: ClassifiedEmailThread
  emailThreadId?: string
  dealId?: string | null
  companyId?: string | null
  contactId?: string | null
  draftId?: string | null
  status: string
}

const DEFAULT_WORKSPACE_ID = '60f84f03-283e-4c1a-8c88-b8330dc71d32'

function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function safeId(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 90) || 'email-thread'
}

function sourceRecipientLabel(recipients: string[]): string {
  if (recipients.includes('sales@symph.co')) return 'sales@symph.co'
  if (recipients.includes('info@symph.co')) return 'info@symph.co'
  return recipients[0] ?? 'shared inbox'
}

@Injectable()
export class InboundEmailService {
  private readonly logger = new Logger(InboundEmailService.name)

  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly config: ConfigService,
    private readonly gmail: CentralGmailService,
    private readonly classifier: EmailLeadClassifierService,
    private readonly reminders: FollowUpRemindersService,
    private readonly companiesService: CompaniesService,
    private readonly contactsService: ContactsService,
    private readonly dealsService: DealsService,
    private readonly dealNotes: DealNotesService,
    private readonly activitiesService: ActivitiesService,
  ) {}

  private isEnabled(): boolean {
    return this.config.get<string>('INBOUND_EMAIL_ENABLED') === 'true'
  }

  private shouldCreateDrafts(requested?: boolean): boolean {
    return requested === true && this.config.get<string>('INBOUND_EMAIL_CREATE_DRAFTS') === 'true'
  }

  private workspaceId(input?: string): string {
    return input || this.config.get<string>('INBOUND_EMAIL_WORKSPACE_ID') || this.config.get<string>('DEFAULT_WORKSPACE_ID') || DEFAULT_WORKSPACE_ID
  }

  private assertMailbox(mailbox?: string) {
    const expected = this.gmail.getMailbox()
    if (mailbox && mailbox.toLowerCase() !== expected) {
      throw new BadRequestException(`Mailbox override must match configured mailbox ${expected}`)
    }
  }

  async ingest(body: EmailIngestBody = {}) {
    this.assertMailbox(body.mailbox)
    if (!this.isEnabled() && !body.dryRun) {
      throw new BadRequestException('Inbound email ingestion is disabled. Set INBOUND_EMAIL_ENABLED=true before persisting.')
    }

    const workspaceId = this.workspaceId(body.workspaceId)
    const profile = await this.gmail.assertMailboxProfile()
    const threads = await this.gmail.fetchCandidateThreads(body.query, body.maxResults)
    const results: ProcessedThreadResult[] = []

    for (const thread of threads) {
      results.push(await this.processThread(thread, {
        dryRun: body.dryRun === true,
        createDrafts: this.shouldCreateDrafts(body.createDrafts),
        workspaceId,
      }))
    }

    if (!body.dryRun) {
      await this.upsertMailboxState(workspaceId, profile.historyId, null)
    }

    return {
      ok: true,
      dryRun: body.dryRun === true,
      mailbox: profile.email,
      query: body.query || this.gmail.buildDefaultQuery(),
      count: results.length,
      results,
    }
  }

  async listThreads(params: EmailThreadListParams = {}) {
    const conditions = []
    if (params.status) conditions.push(eq(emailThreads.status, params.status as typeof emailThreads.$inferSelect.status))
    if (params.classification) conditions.push(eq(emailThreads.classification, params.classification as typeof emailThreads.$inferSelect.classification))
    if (params.dealId) conditions.push(eq(emailThreads.dealId, params.dealId))
    if (params.companyId) conditions.push(eq(emailThreads.companyId, params.companyId))
    if (params.contactId) conditions.push(eq(emailThreads.contactId, params.contactId))

    const limit = Math.max(1, Math.min(params.limit ?? 100, 500))
    const base = this.db.select().from(emailThreads)
    return conditions.length > 0
      ? base.where(and(...conditions)).orderBy(desc(emailThreads.latestMessageAt)).limit(limit)
      : base.orderBy(desc(emailThreads.latestMessageAt)).limit(limit)
  }

  async getThread(id: string) {
    const [thread] = await this.db.select().from(emailThreads).where(eq(emailThreads.id, id)).limit(1)
    if (!thread) throw new NotFoundException(`Email thread ${id} not found`)

    const messages = await this.db
      .select()
      .from(emailMessages)
      .where(eq(emailMessages.emailThreadId, id))
      .orderBy(emailMessages.sentAt)

    const [deal, company, contact, reminders] = await Promise.all([
      thread.dealId ? this.dealsService.findOne(thread.dealId).catch(() => null) : null,
      thread.companyId ? this.companiesService.findOne(thread.companyId).catch(() => null) : null,
      thread.contactId ? this.contactsService.findOne(thread.contactId).catch(() => null) : null,
      this.reminders.list({ emailThreadId: id, limit: 20 }),
    ])

    return { thread, messages, deal, company, contact, reminders }
  }

  async reclassify(id: string) {
    const existing = await this.getThread(id)
    const thread = await this.gmail.fetchThread(existing.thread.gmailThreadId)
    const match = await this.findExistingMatch(thread)
    const classification = this.classifier.classify(thread, match.activeDeals.length)

    const [updated] = await this.db
      .update(emailThreads)
      .set({
        classification: classification.classification,
        confidence: classification.confidence,
        summary: classification.summary,
        rawClassification: classification,
        status: classification.classification === 'needs_review' ? 'needs_review' : existing.thread.status,
        updatedAt: new Date(),
      })
      .where(eq(emailThreads.id, id))
      .returning()

    return { ok: true, thread: updated, classification }
  }

  async createDraft(id: string) {
    const existing = await this.getThread(id)
    if (!existing.thread.draftForGmailMessageId) {
      const thread = await this.gmail.fetchThread(existing.thread.gmailThreadId)
      const match = await this.findExistingMatch(thread)
      const classification = this.classifier.classify(thread, match.activeDeals.length)
      if (!classification.draftReplyText) throw new BadRequestException('Classifier did not produce draft reply text for this thread')
      return this.createDraftForPersistedThread(existing.thread.id, thread, classification)
    }

    const thread = await this.gmail.fetchThread(existing.thread.gmailThreadId)
    const match = await this.findExistingMatch(thread)
    const classification = this.classifier.classify(thread, match.activeDeals.length)
    return this.createDraftForPersistedThread(existing.thread.id, thread, classification)
  }

  private async processThread(thread: CentralGmailThread, options: { dryRun: boolean; createDrafts: boolean; workspaceId: string }): Promise<ProcessedThreadResult> {
    const match = await this.findExistingMatch(thread)
    const classification = this.classifier.classify(thread, match.activeDeals.length)

    if (options.dryRun) {
      return {
        gmailThreadId: thread.id,
        persisted: false,
        skippedSideEffects: true,
        classification,
        status: 'dry_run',
      }
    }

    const persistedThread = await this.upsertThread(thread, classification, options.workspaceId)
    await this.upsertMessages(persistedThread.id, thread, options.workspaceId)

    if (persistedThread.latestProcessedGmailMessageId === thread.latestMessageId) {
      return {
        gmailThreadId: thread.id,
        persisted: true,
        skippedSideEffects: true,
        classification,
        emailThreadId: persistedThread.id,
        dealId: persistedThread.dealId,
        companyId: persistedThread.companyId,
        contactId: persistedThread.contactId,
        draftId: persistedThread.draftGmailId,
        status: persistedThread.status,
      }
    }

    const linked = await this.applySideEffects(persistedThread.id, thread, classification, match, options.workspaceId)
    let draftId: string | null = null
    if (options.createDrafts && classification.draftReplyText && linked.status === 'processed') {
      const draft = await this.createDraftForPersistedThread(persistedThread.id, thread, classification)
      draftId = draft.draftId
    }

    await this.db
      .update(emailThreads)
      .set({ latestProcessedGmailMessageId: thread.latestMessageId, updatedAt: new Date() })
      .where(eq(emailThreads.id, persistedThread.id))

    return {
      gmailThreadId: thread.id,
      persisted: true,
      skippedSideEffects: false,
      classification,
      emailThreadId: persistedThread.id,
      dealId: linked.dealId,
      companyId: linked.companyId,
      contactId: linked.contactId,
      draftId,
      status: linked.status,
    }
  }

  private async upsertThread(thread: CentralGmailThread, classification: ClassifiedEmailThread, workspaceId: string) {
    const [row] = await this.db
      .insert(emailThreads)
      .values({
        workspaceId,
        mailbox: this.gmail.getMailbox(),
        gmailThreadId: thread.id,
        sourceRecipients: thread.sourceRecipients,
        latestGmailMessageId: thread.latestMessageId,
        subject: thread.subject,
        snippet: thread.snippet,
        classification: classification.classification,
        confidence: classification.confidence,
        summary: classification.summary,
        status: classification.classification === 'needs_review' ? 'needs_review' : 'new',
        rawClassification: classification,
        firstMessageAt: thread.firstMessageAt,
        latestMessageAt: thread.latestMessageAt,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [emailThreads.mailbox, emailThreads.gmailThreadId],
        set: {
          sourceRecipients: thread.sourceRecipients,
          latestGmailMessageId: thread.latestMessageId,
          subject: thread.subject,
          snippet: thread.snippet,
          classification: classification.classification,
          confidence: classification.confidence,
          summary: classification.summary,
          rawClassification: classification,
          firstMessageAt: thread.firstMessageAt,
          latestMessageAt: thread.latestMessageAt,
          updatedAt: new Date(),
        },
      })
      .returning()
    return row
  }

  private async upsertMessages(emailThreadId: string, thread: CentralGmailThread, workspaceId: string) {
    for (const message of thread.messages) {
      const direction = this.messageDirection(message.fromEmail)
      await this.db
        .insert(emailMessages)
        .values({
          workspaceId,
          emailThreadId,
          mailbox: this.gmail.getMailbox(),
          gmailThreadId: thread.id,
          gmailMessageId: message.gmailMessageId,
          rfcMessageId: message.rfcMessageId,
          inReplyTo: message.inReplyTo,
          referencesHeader: message.referencesHeader,
          subject: message.subject,
          fromName: message.fromName,
          fromEmail: message.fromEmail,
          toEmails: message.toEmails,
          ccEmails: message.ccEmails,
          deliveredToEmails: message.deliveredToEmails,
          sourceRecipients: message.sourceRecipients,
          direction,
          bodyText: message.bodyText,
          bodyHtml: message.bodyHtml,
          snippet: message.snippet,
          labels: message.labels,
          rawHeaders: message.rawHeaders,
          sentAt: message.sentAt,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [emailMessages.mailbox, emailMessages.gmailMessageId],
          set: {
            emailThreadId,
            sourceRecipients: message.sourceRecipients,
            bodyText: message.bodyText,
            bodyHtml: message.bodyHtml,
            snippet: message.snippet,
            labels: message.labels,
            rawHeaders: message.rawHeaders,
            sentAt: message.sentAt,
            updatedAt: new Date(),
          },
        })
    }
  }

  private messageDirection(fromEmail: string | null): 'inbound' | 'outbound' | 'internal' {
    const domain = fromEmail?.split('@')[1]?.toLowerCase()
    if (domain === 'symph.co') return fromEmail?.toLowerCase() === this.gmail.getMailbox() ? 'outbound' : 'internal'
    return 'inbound'
  }

  private async applySideEffects(
    emailThreadId: string,
    thread: CentralGmailThread,
    classification: ClassifiedEmailThread,
    match: ExistingMatch,
    workspaceId: string,
  ) {
    if (['internal_only', 'vendor_sales', 'newsletter_or_automation', 'job_or_recruiting', 'billing_or_admin'].includes(classification.classification)) {
      await this.updateThreadLinks(emailThreadId, { status: 'ignored' })
      return { status: 'ignored', dealId: null, companyId: null, contactId: null }
    }

    if (classification.classification === 'needs_review') {
      await this.updateThreadLinks(emailThreadId, { status: 'needs_review' })
      return { status: 'needs_review', dealId: null, companyId: null, contactId: null }
    }

    if (classification.classification === 'existing_deal_update') {
      const deal = match.activeDeals[0]
      if (!deal || !match.company || !match.contact) {
        await this.updateThreadLinks(emailThreadId, { status: 'needs_review', lastError: 'Existing deal update did not resolve to exactly one active deal.' })
        return { status: 'needs_review', dealId: null, companyId: null, contactId: null }
      }
      await this.persistEmailArtifact(emailThreadId, thread, classification, deal.id, deal.assignedTo ?? null)
      await this.activitiesService.create({
        workspaceId,
        companyId: match.company.id,
        dealId: deal.id,
        actorId: deal.assignedTo ?? undefined,
        type: 'note_added',
        metadata: { source: 'email', emailThreadId, gmailThreadId: thread.id, classification: classification.classification },
      })
      await this.createReminderIfNeeded(emailThreadId, deal.id, deal.assignedTo ?? null, classification, workspaceId, thread)
      await this.updateThreadLinks(emailThreadId, { status: 'processed', dealId: deal.id, companyId: match.company.id, contactId: match.contact.id })
      return { status: 'processed', dealId: deal.id, companyId: match.company.id, contactId: match.contact.id }
    }

    const companyResult = await this.companiesService.findOrCreate({
      workspaceId,
      name: classification.companyName ?? classification.companyDomain ?? 'Unknown inbound company',
      domain: classification.companyDomain,
      createdBy: undefined,
      tags: ['inbound-email', sourceRecipientLabel(thread.sourceRecipients)],
    })
    const company = companyResult.company
    const contact = match.contact ?? await this.contactsService.create({
      companyId: company.id,
      name: classification.contactName || classification.contactEmail || 'Unknown contact',
      email: classification.contactEmail,
      isPrimary: true,
    })
    const deal = await this.dealsService.create({
      workspaceId,
      companyId: company.id,
      catalogItemId: undefined,
      title: classification.suggestedDealTitle ?? `${company.name} - Inbound inquiry`,
      outreachCategory: 'inbound',
      dateCaptured: thread.latestMessageAt ?? new Date(),
      servicesTags: classification.serviceHints.length > 0 ? classification.serviceHints : ['agency'],
      probability: classification.confidence === 'high' ? 30 : 10,
    } as any)

    await this.persistEmailArtifact(emailThreadId, thread, classification, deal.id, deal.assignedTo ?? null)
    await this.activitiesService.create({
      workspaceId,
      companyId: company.id,
      dealId: deal.id,
      actorId: deal.assignedTo ?? undefined,
      type: 'note_added',
      metadata: { source: 'email', emailThreadId, gmailThreadId: thread.id, classification: classification.classification },
    })
    await this.createReminderIfNeeded(emailThreadId, deal.id, deal.assignedTo ?? null, classification, workspaceId, thread)
    await this.updateThreadLinks(emailThreadId, { status: 'processed', dealId: deal.id, companyId: company.id, contactId: contact.id })
    return { status: 'processed', dealId: deal.id, companyId: company.id, contactId: contact.id }
  }

  private async updateThreadLinks(id: string, data: Partial<typeof emailThreads.$inferInsert>) {
    await this.db.update(emailThreads).set({ ...data, updatedAt: new Date() }).where(eq(emailThreads.id, id))
  }

  private async persistEmailArtifact(
    emailThreadId: string,
    thread: CentralGmailThread,
    classification: ClassifiedEmailThread,
    dealId: string,
    authorId: string | null,
  ) {
    const filename = `email-${safeId(thread.id)}.md`
    const latest = thread.messages[thread.messages.length - 1]
    const participants = [...new Set(thread.messages.flatMap(message => [message.fromEmail, ...message.toEmails, ...message.ccEmails]).filter(Boolean))]
    const fullThread = thread.messages.map((message, index) => [
      `## Message ${index + 1}`,
      `- From: ${message.fromEmail ?? 'unknown'}`,
      `- To: ${message.toEmails.join(', ') || 'unknown'}`,
      `- Cc: ${message.ccEmails.join(', ') || 'none'}`,
      `- Sent: ${message.sentAt?.toISOString() ?? 'unknown'}`,
      '',
      message.bodyText ?? message.snippet ?? '(no body text)',
    ].join('\n')).join('\n\n')

    const content = [
      `**Source**: ${sourceRecipientLabel(thread.sourceRecipients)}`,
      `**Gmail thread ID**: ${thread.id}`,
      `**Latest message ID**: ${latest?.gmailMessageId ?? 'unknown'}`,
      `**Classification**: ${classification.classification} (${classification.confidence})`,
      `**Participants**: ${participants.join(', ') || 'unknown'}`,
      '',
      '## Summary',
      classification.summary,
      '',
      '## Full Email Thread Context',
      fullThread,
    ].join('\n')

    const note = await this.dealNotes.upsertNote(
      dealId,
      'general',
      `Email thread - ${thread.subject}`,
      content,
      authorId,
      {
        filename,
        createdAt: thread.latestMessageAt ?? new Date(),
        metadata: {
          source: 'email',
          emailThreadId,
          gmailThreadId: thread.id,
          latestGmailMessageId: latest?.gmailMessageId ?? null,
          artifactType: 'email_thread',
        },
      },
    )

    return note
  }

  private async createReminderIfNeeded(
    emailThreadId: string,
    dealId: string,
    assignedTo: string | null,
    classification: ClassifiedEmailThread,
    workspaceId: string,
    thread: CentralGmailThread,
  ) {
    if (!classification.reminderReason || !classification.reminderDays) return null
    const latestMessageId = thread.latestMessageId ?? 'unknown'
    return this.reminders.upsert({
      workspaceId,
      dealId,
      emailThreadId,
      assignedTo: assignedTo ?? undefined,
      remindAt: addDays(thread.latestMessageAt ?? new Date(), classification.reminderDays),
      status: 'pending',
      reason: classification.reminderReason,
      idempotencyKey: `${this.gmail.getMailbox()}:${thread.id}:${latestMessageId}:followup`,
    })
  }

  private async createDraftForPersistedThread(emailThreadId: string, thread: CentralGmailThread, classification: ClassifiedEmailThread) {
    if (!this.shouldCreateDrafts(true)) {
      throw new BadRequestException('Draft creation is disabled. Set INBOUND_EMAIL_CREATE_DRAFTS=true and pass createDrafts=true.')
    }
    if (!classification.draftReplyText) throw new BadRequestException('No draft reply text available for this thread')

    const latest = thread.messages[thread.messages.length - 1]
    if (!latest?.fromEmail) throw new BadRequestException('Latest email has no sender address')

    const draftKey = `${this.gmail.getMailbox()}:${thread.id}:${latest.gmailMessageId}:draft`
    const lockUntil = addDays(new Date(), 1)
    const [locked] = await this.db
      .update(emailThreads)
      .set({ draftStatus: 'creating', draftLockUntil: lockUntil, updatedAt: new Date() })
      .where(eq(emailThreads.id, emailThreadId))
      .returning()

    if (!locked) throw new NotFoundException(`Email thread ${emailThreadId} not found`)
    if (locked.draftStatus === 'created' && locked.draftForGmailMessageId === latest.gmailMessageId && locked.draftGmailId) {
      return { draftId: locked.draftGmailId, reused: true }
    }

    try {
      const draft = await this.gmail.createDraft({
        threadId: thread.id,
        to: [latest.fromEmail],
        subject: thread.subject.toLowerCase().startsWith('re:') ? thread.subject : `Re: ${thread.subject}`,
        body: classification.draftReplyText,
        inReplyTo: latest.rfcMessageId,
        referencesHeader: latest.referencesHeader,
        draftKey,
      })

      await this.db
        .update(emailThreads)
        .set({
          draftStatus: 'created',
          draftGmailId: draft.draftId,
          draftForGmailMessageId: latest.gmailMessageId,
          draftLockUntil: null,
          updatedAt: new Date(),
        })
        .where(eq(emailThreads.id, emailThreadId))

      return { draftId: draft.draftId, reused: false }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Draft creation failed'
      await this.db
        .update(emailThreads)
        .set({ draftStatus: 'failed', draftLockUntil: null, lastError: message, updatedAt: new Date() })
        .where(eq(emailThreads.id, emailThreadId))
      throw error
    }
  }

  private async findExistingMatch(thread: CentralGmailThread): Promise<ExistingMatch> {
    const external = thread.messages.find(message => this.messageDirection(message.fromEmail) === 'inbound')
    const email = external?.fromEmail?.toLowerCase()
    if (!email) return { contact: null, company: null, activeDeals: [] }

    const [contact] = await this.db
      .select()
      .from(contacts)
      .where(sql`lower(${contacts.email}) = ${email}`)
      .limit(1)

    if (!contact) return { contact: null, company: null, activeDeals: [] }

    const [company] = await this.db.select().from(companies).where(eq(companies.id, contact.companyId)).limit(1)
    const activeDeals = await this.db
      .select()
      .from(deals)
      .where(and(eq(deals.companyId, contact.companyId), isNull(deals.deletedAt)))
      .orderBy(desc(deals.updatedAt))

    return { contact, company: company ?? null, activeDeals }
  }

  private async upsertMailboxState(workspaceId: string, historyId: string | null, lastError: string | null) {
    await this.db
      .insert(gmailMailboxStates)
      .values({
        workspaceId,
        mailbox: this.gmail.getMailbox(),
        historyId,
        lastSyncedAt: new Date(),
        lastError,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: gmailMailboxStates.mailbox,
        set: { historyId, lastSyncedAt: new Date(), lastError, updatedAt: new Date() },
      })
  }
}
