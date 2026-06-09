import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { google, type Auth, type gmail_v1 } from 'googleapis'
import { buildRawDraftMessage, parseGmailMessage, type ParsedGmailMessage } from './gmail-message-utils'

export type CentralGmailThread = {
  id: string
  historyId: string | null
  messages: ParsedGmailMessage[]
  subject: string
  snippet: string | null
  latestMessageId: string | null
  firstMessageAt: Date | null
  latestMessageAt: Date | null
  sourceRecipients: string[]
}

export type CreateDraftInput = {
  threadId?: string | null
  to: string[]
  subject: string
  body: string
  inReplyTo?: string | null
  referencesHeader?: string | null
  draftKey: string
}

@Injectable()
export class CentralGmailService {
  private readonly logger = new Logger(CentralGmailService.name)

  constructor(private readonly config: ConfigService) {}

  getMailbox(): string {
    return (this.config.get<string>('INBOUND_EMAIL_MAILBOX') ?? 'aria@symph.co').toLowerCase()
  }

  getAliases(): string[] {
    const configured = this.config.get<string>('INBOUND_EMAIL_ALIASES') ?? 'info@symph.co,sales@symph.co'
    return [this.getMailbox(), ...configured.split(',')]
      .map(value => value.trim().toLowerCase())
      .filter(Boolean)
  }

  buildDefaultQuery(): string {
    const lookback = this.config.get<string>('INBOUND_EMAIL_LOOKBACK_DAYS') ?? '30'
    const aliases = this.getAliases().filter(alias => alias !== this.getMailbox())
    const recipientQuery = aliases.length > 0
      ? aliases.map(alias => `{to:${alias} cc:${alias} deliveredto:${alias}}`).join(' OR ')
      : `to:${this.getMailbox()}`
    return `in:inbox newer_than:${lookback}d (${recipientQuery})`
  }

  private async getAuthClient(): Promise<Auth.OAuth2Client | Auth.JWT> {
    const subject = this.getMailbox()
    const clientEmail = this.config.get<string>('INBOUND_EMAIL_GOOGLE_CLIENT_EMAIL')
    const privateKey = this.config.get<string>('INBOUND_EMAIL_GOOGLE_PRIVATE_KEY')?.replace(/\\n/g, '\n')

    if (clientEmail && privateKey) {
      return new google.auth.JWT({
        email: clientEmail,
        key: privateKey,
        subject,
        scopes: [
          'https://www.googleapis.com/auth/gmail.readonly',
          'https://www.googleapis.com/auth/gmail.compose',
        ],
      })
    }

    const refreshToken = this.config.get<string>('INBOUND_EMAIL_GOOGLE_REFRESH_TOKEN')
      ?? this.config.get<string>('ARIA_GOOGLE_REFRESH_TOKEN')
      ?? this.config.get<string>('GOOGLE_REFRESH_TOKEN')
    const clientId = this.config.get<string>('INBOUND_EMAIL_GOOGLE_CLIENT_ID')
      ?? this.config.get<string>('ARIA_GOOGLE_CLIENT_ID')
      ?? this.config.get<string>('GOOGLE_CLIENT_ID')
    const clientSecret = this.config.get<string>('INBOUND_EMAIL_GOOGLE_CLIENT_SECRET')
      ?? this.config.get<string>('ARIA_GOOGLE_CLIENT_SECRET')
      ?? this.config.get<string>('GOOGLE_CLIENT_SECRET')

    if (!refreshToken || !clientId || !clientSecret) {
      throw new Error('Central Gmail auth is not configured for inbound email ingestion')
    }

    const oauth2 = new google.auth.OAuth2(clientId, clientSecret)
    oauth2.setCredentials({ refresh_token: refreshToken })
    return oauth2
  }

  private async getClient(): Promise<gmail_v1.Gmail> {
    const auth = await this.getAuthClient()
    return google.gmail({ version: 'v1', auth })
  }

  async assertMailboxProfile(): Promise<{ email: string; historyId: string | null }> {
    const gmail = await this.getClient()
    const { data } = await gmail.users.getProfile({ userId: 'me' })
    const email = (data.emailAddress ?? '').toLowerCase()
    const expected = this.getMailbox()

    if (email !== expected) {
      throw new Error(`Central Gmail profile mismatch: expected ${expected}, got ${email || 'unknown'}`)
    }

    return { email, historyId: data.historyId ?? null }
  }

  async listCandidateThreadIds(query?: string, maxResults?: number): Promise<string[]> {
    await this.assertMailboxProfile()
    const gmail = await this.getClient()
    const effectiveMax = maxResults ?? Number(this.config.get<string>('INBOUND_EMAIL_MAX_RESULTS') ?? 20)
    const { data } = await gmail.users.threads.list({
      userId: 'me',
      q: query || this.buildDefaultQuery(),
      maxResults: Math.max(1, Math.min(effectiveMax, 100)),
    })

    return (data.threads ?? []).map(thread => thread.id).filter((id): id is string => Boolean(id))
  }

  async fetchThread(threadId: string): Promise<CentralGmailThread> {
    await this.assertMailboxProfile()
    const gmail = await this.getClient()
    const { data } = await gmail.users.threads.get({
      userId: 'me',
      id: threadId,
      format: 'full',
    })

    const aliases = this.getAliases()
    const messages = (data.messages ?? []).map(message => parseGmailMessage(message, aliases))
    const datedMessages = messages.filter(message => message.sentAt)
    const sortedDates = datedMessages
      .map(message => message.sentAt as Date)
      .sort((a, b) => a.getTime() - b.getTime())
    const latest = messages[messages.length - 1] ?? null

    return {
      id: data.id ?? threadId,
      historyId: data.historyId ?? null,
      messages,
      subject: latest?.subject ?? messages[0]?.subject ?? '(no subject)',
      snippet: latest?.snippet ?? data.snippet ?? null,
      latestMessageId: latest?.gmailMessageId ?? null,
      firstMessageAt: sortedDates[0] ?? null,
      latestMessageAt: sortedDates[sortedDates.length - 1] ?? null,
      sourceRecipients: [...new Set(messages.flatMap(message => message.sourceRecipients))],
    }
  }

  async fetchCandidateThreads(query?: string, maxResults?: number): Promise<CentralGmailThread[]> {
    const threadIds = await this.listCandidateThreadIds(query, maxResults)
    const threads: CentralGmailThread[] = []
    for (const threadId of threadIds) {
      try {
        threads.push(await this.fetchThread(threadId))
      } catch (error) {
        this.logger.warn(`Failed to fetch Gmail thread ${threadId}: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
    return threads
  }

  async createDraft(input: CreateDraftInput): Promise<{ draftId: string; messageId: string | null }> {
    await this.assertMailboxProfile()
    const gmail = await this.getClient()
    const raw = buildRawDraftMessage({
      from: this.getMailbox(),
      to: input.to,
      subject: input.subject,
      body: input.body,
      threadId: input.threadId,
      inReplyTo: input.inReplyTo,
      referencesHeader: input.referencesHeader,
      draftKey: input.draftKey,
    })

    const message: gmail_v1.Schema$Message = input.threadId ? { raw, threadId: input.threadId } : { raw }
    const { data } = await gmail.users.drafts.create({
      userId: 'me',
      requestBody: { message },
    })

    if (!data.id) throw new Error('Gmail draft creation returned no draft id')
    return { draftId: data.id, messageId: data.message?.id ?? null }
  }
}
