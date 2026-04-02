import { Injectable, Logger } from '@nestjs/common'
import { google } from 'googleapis'
import { CalendarConnectionsService } from '../calendar/calendar-connections.service'

/**
 * GmailService — inbox fetch + email send via Gmail API.
 *
 * Inbox filter rules:
 *   1. From one of INBOX_SENDERS (the 8 Symph team addresses)
 *   2. Sent after the 1st of the current calendar month
 *   3. CC must be non-empty — emails with no CC are excluded always
 *
 * Auth: reuses the OAuth2 token stored during Google Calendar connection.
 * Requires gmail.readonly + gmail.send scopes.
 */

export const INBOX_SENDERS = [
  'mary.amora@symph.co',
  'gee@symph.co',
  'gee.quidet@symph.co',
  'chelle@symph.co',
  'chelle.gray@symph.co',
  'lyra.gemparo@symph.co',
  'kate.labra@symph.co',
  'vince.tapdasan@symph.co',
]

export interface SendEmailDto {
  to: string[]
  cc?: string[]
  subject: string
  body: string
  threadId?: string    // Gmail thread ID — keeps reply in same thread
  inReplyTo?: string   // RFC 2822 Message-ID of parent message
}

export type GmailMessage = {
  id: string           // Gmail message ID
  rfcMessageId: string // RFC 2822 Message-ID header (for In-Reply-To)
  subject: string
  from: string
  fromEmail: string
  to: string
  cc: string[]
  date: string
  snippet: string
  unread: boolean
  bodyHtml?: string
  bodyText?: string
}

export type GmailThread = {
  id: string
  subject: string
  from: string
  fromEmail: string
  latestDate: string
  snippet: string
  unread: boolean
  messageCount: number
  cc: string[]
  messages: GmailMessage[]
}

export type InboxResponse = {
  threads: GmailThread[]
  fetchedAt: string
  needsReconnect?: boolean
  error?: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseEmailAddress(raw: string): { display: string; email: string } {
  const match = raw.match(/^(.+?)\s*<(.+?)>$/)
  if (match) {
    return {
      display: match[1].trim().replace(/^["']|["']$/g, ''),
      email: match[2].trim().toLowerCase(),
    }
  }
  return { display: raw.trim(), email: raw.trim().toLowerCase() }
}

function parseEmailList(raw: string): string[] {
  if (!raw?.trim()) return []
  return raw.split(',').map(s => s.trim()).filter(Boolean)
}

function getHeader(
  headers: { name?: string | null; value?: string | null }[],
  name: string,
): string {
  return headers.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value ?? ''
}

function extractBody(payload: any): { html?: string; text?: string } {
  if (!payload) return {}

  if (payload.mimeType === 'text/html' && payload.body?.data) {
    return { html: Buffer.from(payload.body.data, 'base64url').toString('utf-8') }
  }

  if (payload.mimeType === 'text/plain' && payload.body?.data) {
    return { text: Buffer.from(payload.body.data, 'base64url').toString('utf-8') }
  }

  if (payload.parts?.length) {
    let html: string | undefined
    let text: string | undefined
    for (const part of payload.parts) {
      const result = extractBody(part)
      if (result.html) html = result.html
      if (result.text && !text) text = result.text
    }
    return { html, text }
  }

  return {}
}

/**
 * Build a base64url-encoded RFC 2822 email message for gmail.users.messages.send.
 */
function buildRawMessage(from: string, dto: SendEmailDto): string {
  const lines: string[] = [`From: ${from}`, `To: ${dto.to.join(', ')}`]

  if (dto.cc?.length) lines.push(`Cc: ${dto.cc.join(', ')}`)
  if (dto.inReplyTo) {
    lines.push(`In-Reply-To: ${dto.inReplyTo}`)
    lines.push(`References: ${dto.inReplyTo}`)
  }

  lines.push(
    `Subject: ${dto.subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/plain; charset=UTF-8`,
    ``,
    dto.body,
  )

  return Buffer.from(lines.join('\r\n')).toString('base64url')
}

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class GmailService {
  private readonly logger = new Logger(GmailService.name)

  constructor(private connections: CalendarConnectionsService) {}

  /**
   * Returns the Google email for the connected account.
   * Frontend uses this to determine which side of the chat to render messages on.
   */
  async getGoogleEmail(userId: string): Promise<{ email: string } | null> {
    if (!userId) return null

    const oauth2 = await this.connections.getAuthedOAuth2Client(userId)
    if (!oauth2) return null

    try {
      const gmail = google.gmail({ version: 'v1', auth: oauth2 })
      const { data } = await gmail.users.getProfile({ userId: 'me' })
      return { email: data.emailAddress ?? '' }
    } catch (err) {
      this.logger.warn(`getGoogleEmail failed for ${userId}: ${(err as Error).message}`)
      return null
    }
  }

  /**
   * Send an email via Gmail API using the stored OAuth2 token.
   */
  async sendEmail(
    userId: string,
    dto: SendEmailDto,
  ): Promise<{ messageId: string; threadId: string }> {
    if (!userId) throw new Error('Not authenticated')

    const oauth2 = await this.connections.getAuthedOAuth2Client(userId)
    if (!oauth2) throw new Error('Google account not connected. Please reconnect.')

    const gmail = google.gmail({ version: 'v1', auth: oauth2 })

    // Fetch the sender's actual email from Google profile
    const { data: profile } = await gmail.users.getProfile({ userId: 'me' })
    const fromEmail = profile.emailAddress!

    const raw = buildRawMessage(fromEmail, dto)

    const { data } = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw,
        ...(dto.threadId ? { threadId: dto.threadId } : {}),
      },
    })

    return { messageId: data.id!, threadId: data.threadId! }
  }

  /**
   * Archive a thread — removes INBOX label so it leaves the inbox but is not deleted.
   */
  async archiveThread(userId: string, threadId: string): Promise<void> {
    if (!userId) throw new Error('Not authenticated')
    const oauth2 = await this.connections.getAuthedOAuth2Client(userId)
    if (!oauth2) throw new Error('Google account not connected.')
    const gmail = google.gmail({ version: 'v1', auth: oauth2 })
    await gmail.users.threads.modify({
      userId: 'me',
      id: threadId,
      requestBody: { removeLabelIds: ['INBOX'] },
    })
  }

  /**
   * Trash a thread — moves it to Gmail Trash.
   */
  async trashThread(userId: string, threadId: string): Promise<void> {
    if (!userId) throw new Error('Not authenticated')
    const oauth2 = await this.connections.getAuthedOAuth2Client(userId)
    if (!oauth2) throw new Error('Google account not connected.')
    const gmail = google.gmail({ version: 'v1', auth: oauth2 })
    await gmail.users.threads.trash({
      userId: 'me',
      id: threadId,
    })
  }

  /**
   * Fetch this month's filtered inbox threads.
   */
  async getInbox(userId: string): Promise<InboxResponse> {
    const oauth2 = await this.connections.getAuthedOAuth2Client(userId)

    if (!oauth2) {
      return {
        threads: [],
        fetchedAt: new Date().toISOString(),
        needsReconnect: true,
        error: 'Google account not connected. Connect via Calendar settings.',
      }
    }

    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    // Use whichever is earlier — start of month OR 7 days ago
    const windowStart = sevenDaysAgo < monthStart ? sevenDaysAgo : monthStart
    // Gmail query date format: YYYY/M/D (no leading zeros)
    const afterDate = `${windowStart.getFullYear()}/${windowStart.getMonth() + 1}/${windowStart.getDate()}`
    const fromQuery = INBOX_SENDERS.map(e => `from:${e}`).join(' OR ')
    const query = `(${fromQuery}) after:${afterDate}`

    this.logger.log(`Gmail query: "${query}"`)

    try {
      const gmail = google.gmail({ version: 'v1', auth: oauth2 })

      const listRes = await gmail.users.threads.list({
        userId: 'me',
        q: query,
        maxResults: 100,
      })

      this.logger.log(`Gmail thread list returned ${listRes.data.threads?.length ?? 0} threads`)

      const threadItems = listRes.data.threads ?? []
      if (threadItems.length === 0) {
        this.logger.log('No threads found in query results')
        return { threads: [], fetchedAt: new Date().toISOString() }
      }

      this.logger.log(`Processing ${threadItems.length} threads...`)
      const threads: GmailThread[] = []
      let processedCount = 0
      let filteredOutCount = 0

      await Promise.allSettled(
        threadItems.map(async (item) => {
          try {
            const threadRes = await gmail.users.threads.get({
              userId: 'me',
              id: item.id!,
              format: 'full',
            })

            const rawMessages = threadRes.data.messages ?? []
            if (rawMessages.length === 0) {
              this.logger.debug(`Thread ${item.id}: no messages`)
              return
            }

            this.logger.debug(`Thread ${item.id}: ${rawMessages.length} messages`)

            const messages: GmailMessage[] = []

            for (const msg of rawMessages) {
              const headers: { name?: string | null; value?: string | null }[] =
                msg.payload?.headers ?? []

              const ccRaw = getHeader(headers, 'Cc')
              const ccList = parseEmailList(ccRaw)

              // Exclude message if no CC
              if (ccList.length === 0) {
                this.logger.debug(`Message ${msg.id}: filtered out (no CC)`)
                filteredOutCount++
                continue
              }

              const fromRaw = getHeader(headers, 'From')
              const fromParsed = parseEmailAddress(fromRaw)
              const subject = getHeader(headers, 'Subject') || '(no subject)'
              const toRaw = getHeader(headers, 'To')
              const dateRaw = getHeader(headers, 'Date')
              const rfcMessageId = getHeader(headers, 'Message-ID')
              const isUnread = (msg.labelIds ?? []).includes('UNREAD')
              const { html, text } = extractBody(msg.payload)

              messages.push({
                id: msg.id!,
                rfcMessageId,
                subject,
                from: fromParsed.display,
                fromEmail: fromParsed.email,
                to: toRaw,
                cc: ccList,
                date: dateRaw ? new Date(dateRaw).toISOString() : new Date().toISOString(),
                snippet: msg.snippet ?? '',
                unread: isUnread,
                bodyHtml: html,
                bodyText: text,
              })
            }

            if (messages.length === 0) return

            const first = messages[0]
            const last = messages[messages.length - 1]

            threads.push({
              id: item.id!,
              subject: first.subject,
              from: first.from,
              fromEmail: first.fromEmail,
              latestDate: last.date,
              snippet: last.snippet,
              unread: messages.some(m => m.unread),
              messageCount: messages.length,
              cc: [...new Set(messages.flatMap(m => m.cc))],
              messages,
            })
          } catch (err) {
            this.logger.warn(
              `Failed to fetch thread ${item.id}: ${(err as Error).message}`,
            )
          }
        }),
      )

      threads.sort(
        (a, b) => new Date(b.latestDate).getTime() - new Date(a.latestDate).getTime(),
      )

      this.logger.log(`Inbox: ${threads.length} threads returned (filtered ${filteredOutCount} messages)`)
      return { threads, fetchedAt: new Date().toISOString() }
    } catch (err: any) {
      const message = err?.message ?? String(err)
      const isInsufficientScope =
        message.includes('insufficient_scope') ||
        message.includes('Request had insufficient authentication scopes') ||
        err?.code === 403

      if (isInsufficientScope) {
        this.logger.warn(
          `User ${userId} needs to reconnect Google (insufficient gmail scope)`,
        )
        return {
          threads: [],
          fetchedAt: new Date().toISOString(),
          needsReconnect: true,
          error:
            'Gmail access not granted. Please reconnect your Google account to enable inbox.',
        }
      }

      this.logger.error(`Gmail inbox fetch failed for ${userId}: ${message}`)
      return {
        threads: [],
        fetchedAt: new Date().toISOString(),
        error: `Failed to load inbox: ${message}`,
      }
    }
  }
}
