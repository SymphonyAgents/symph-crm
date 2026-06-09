import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import { eq } from 'drizzle-orm'
import { meetings } from '@symph-crm/database'
import { DB } from '../database/database.module'
import type { Database } from '../database/database.types'
import { DealNotesService } from '../deals/deal-notes.service'
import { DealsService } from '../deals/deals.service'
import { CentralGmailService } from '../gmail/central-gmail.service'
import { FollowUpRemindersService } from '../inbound-email/follow-up-reminders.service'
import { composeMeetingActionPackage, formatMeetingActionNote } from './meeting-action-composer'
import type { CreateMeetingActionPackageBody, CreateMeetingActionPackageOptions, MeetingActionPackage } from './meeting-actions.types'
import { MeetingsService } from './meetings.service'

function stripFrontmatter(content: string | null | undefined): string | null {
  if (!content) return null
  return content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '').trim()
}

function rawString(rawPayload: Record<string, unknown> | null | undefined, key: string): string | null {
  const value = rawPayload?.[key]
  return typeof value === 'string' && value.trim() ? value : null
}

function nestedRawString(rawPayload: Record<string, unknown> | null | undefined, key: string): string | null {
  const nested = rawPayload?.rawPayload
  if (!nested || typeof nested !== 'object') return null
  const value = (nested as Record<string, unknown>)[key]
  return typeof value === 'string' && value.trim() ? value : null
}

function safeSourceId(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'meeting'
}

function defaultReminderAt(): Date {
  const date = new Date()
  date.setDate(date.getDate() + 2)
  return date
}

function parseReminderAt(value: string | null | undefined): Date {
  if (!value) return defaultReminderAt()
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) throw new BadRequestException('Invalid reminderAt value')
  return parsed
}

@Injectable()
export class MeetingActionsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly meetingsService: MeetingsService,
    private readonly dealsService: DealsService,
    private readonly dealNotes: DealNotesService,
    private readonly gmail: CentralGmailService,
    private readonly followUpReminders: FollowUpRemindersService,
  ) {}

  async createActionPackage(
    meetingId: string,
    body: CreateMeetingActionPackageBody = {},
    options: CreateMeetingActionPackageOptions = {},
  ) {
    const loaded = await this.meetingsService.findOneWithArtifacts(meetingId)
    let meeting = loaded.meeting
    const requestedDealId = body.dealId?.trim() || null
    const confirmedDealId = requestedDealId ?? meeting.dealId ?? null

    if (!confirmedDealId) {
      const candidates = await this.meetingsService.findResolverCandidates(
        [meeting.title, ...(meeting.attendees ?? [])].filter(Boolean).join(' '),
      )
      const packagePreview = composeMeetingActionPackage({
        meeting,
        summaryText: this.resolveSummaryText(loaded),
        transcriptText: this.resolveTranscriptText(loaded),
        generatedAt: new Date(),
        generatedBy: options.authorId ?? null,
        suggestedDealIds: candidates.deals.map(deal => deal.id),
      })
      packagePreview.status = 'needs_deal_review'
      await this.persistActionPackage(meeting.id, packagePreview)
      return { ok: true, status: 'needs_deal_review' as const, meeting, actionPackage: packagePreview, candidates }
    }

    const deal = await this.dealsService.findOne(confirmedDealId)
    if (!deal) throw new NotFoundException(`Deal ${confirmedDealId} not found`)

    if (meeting.dealId !== confirmedDealId) {
      await this.meetingsService.assignDeal(meeting.id, confirmedDealId, { authorId: options.authorId ?? null })
      meeting = (await this.meetingsService.findOneWithArtifacts(meeting.id)).meeting
    }

    const refreshed = await this.meetingsService.findOneWithArtifacts(meeting.id)
    meeting = refreshed.meeting
    const summaryText = this.resolveSummaryText(refreshed)
    const transcriptText = this.resolveTranscriptText(refreshed)

    if (!summaryText && !transcriptText) {
      throw new BadRequestException('Meeting summary or transcript is required before generating an action package')
    }

    let actionPackage = composeMeetingActionPackage({
      meeting,
      summaryText,
      transcriptText,
      dealTitle: deal.title,
      generatedAt: new Date(),
      generatedBy: options.authorId ?? null,
      confirmedDealId,
    })

    const sourceId = safeSourceId(meeting.sourceMeetingId)
    const actionNote = await this.dealNotes.upsertNote(
      confirmedDealId,
      'meeting',
      `Meeting Action Package - ${meeting.title}`,
      formatMeetingActionNote(actionPackage),
      options.authorId ?? deal.assignedTo ?? null,
      {
        filename: `circleback-${sourceId}-action-package.md`,
        createdAt: meeting.startedAt ?? new Date(),
        metadata: {
          source: 'meetings.symph.co',
          sourceMeetingId: meeting.sourceMeetingId,
          sourceUrl: meeting.sourceUrl,
          meetingId: meeting.id,
          artifactType: 'action_package',
        },
      },
    )

    actionPackage = { ...actionPackage, actionNotePath: actionNote.storagePath }

    const postNoteErrors: string[] = []

    if (body.createDraft && actionPackage.draftRecipients.length > 0) {
      try {
        const draft = await this.gmail.createDraft({
          to: actionPackage.draftRecipients,
          subject: actionPackage.followUpDraftSubject,
          body: actionPackage.followUpDraftText,
          draftKey: `meeting:${meeting.id}:follow-up`,
        })
        actionPackage = { ...actionPackage, draftGmailId: draft.draftId }
      } catch (error) {
        postNoteErrors.push(`Gmail draft was not created: ${error instanceof Error ? error.message : String(error)}`)
      }
    }

    if (body.createReminder) {
      try {
        const reminder = await this.followUpReminders.upsert({
          workspaceId: meeting.workspaceId,
          dealId: confirmedDealId,
          emailThreadId: null,
          assignedTo: options.authorId ?? deal.assignedTo ?? null,
          remindAt: parseReminderAt(body.reminderAt),
          status: 'pending',
          reason: `Follow up after meeting: ${meeting.title}`,
          idempotencyKey: `meeting:${meeting.id}:action-followup`,
        })
        actionPackage = { ...actionPackage, reminderId: reminder.id }
      } catch (error) {
        postNoteErrors.push(`Follow-up reminder was not created: ${error instanceof Error ? error.message : String(error)}`)
      }
    }

    if (postNoteErrors.length > 0) {
      actionPackage = { ...actionPackage, lastError: postNoteErrors.join(' ') }
    }

    await this.persistActionPackage(meeting.id, actionPackage)
    const updatedMeeting = await this.meetingsService.findOne(meeting.id)
    return { ok: true, status: 'attached' as const, meeting: updatedMeeting, actionPackage }
  }

  private resolveSummaryText(loaded: Awaited<ReturnType<MeetingsService['findOneWithArtifacts']>>): string | null {
    return stripFrontmatter(loaded.summaryNote?.content)
      ?? rawString(loaded.meeting.rawPayload, 'summaryMarkdown')
      ?? nestedRawString(loaded.meeting.rawPayload, 'notes')
  }

  private resolveTranscriptText(loaded: Awaited<ReturnType<MeetingsService['findOneWithArtifacts']>>): string | null {
    return stripFrontmatter(loaded.transcriptNote?.content)
      ?? rawString(loaded.meeting.rawPayload, 'transcriptMarkdown')
  }

  private async persistActionPackage(meetingId: string, actionPackage: MeetingActionPackage) {
    const [meeting] = await this.db.select().from(meetings).where(eq(meetings.id, meetingId)).limit(1)
    if (!meeting) throw new NotFoundException(`Meeting ${meetingId} not found`)
    const rawPayload = { ...(meeting.rawPayload ?? {}), meetingActionPackage: actionPackage }
    await this.db.update(meetings).set({ rawPayload, updatedAt: new Date() }).where(eq(meetings.id, meetingId))
  }
}
