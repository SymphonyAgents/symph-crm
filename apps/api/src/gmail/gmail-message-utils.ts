import type { gmail_v1 } from 'googleapis'

export type EmailAddress = { display: string; email: string }

export type ParsedGmailMessage = {
  gmailMessageId: string
  gmailThreadId: string
  rfcMessageId: string | null
  inReplyTo: string | null
  referencesHeader: string | null
  subject: string
  fromName: string | null
  fromEmail: string | null
  toEmails: string[]
  ccEmails: string[]
  deliveredToEmails: string[]
  sourceRecipients: string[]
  bodyText: string | null
  bodyHtml: string | null
  snippet: string | null
  labels: string[]
  rawHeaders: Record<string, string>
  sentAt: Date | null
}

export function getHeader(
  headers: gmail_v1.Schema$MessagePartHeader[] | undefined,
  name: string,
): string {
  return headers?.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value ?? ''
}

export function headersToRecord(headers: gmail_v1.Schema$MessagePartHeader[] | undefined): Record<string, string> {
  const record: Record<string, string> = {}
  for (const header of headers ?? []) {
    if (header.name && header.value) record[header.name] = header.value
  }
  return record
}

export function parseEmailAddress(raw: string): EmailAddress {
  const trimmed = raw.trim()
  const match = trimmed.match(/^(.+?)\s*<([^<>]+)>$/)
  if (match) {
    return {
      display: match[1].trim().replace(/^["']|["']$/g, ''),
      email: match[2].trim().toLowerCase(),
    }
  }
  const bareMatch = trimmed.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)
  const email = (bareMatch?.[0] ?? trimmed).toLowerCase()
  return { display: trimmed === email ? '' : trimmed, email }
}

export function parseEmailList(raw: string): string[] {
  if (!raw?.trim()) return []
  return raw
    .split(',')
    .map(part => parseEmailAddress(part).email)
    .filter(Boolean)
}

function decodeBodyData(data: string | null | undefined): string | null {
  if (!data) return null
  return Buffer.from(data, 'base64url').toString('utf-8')
}

export function extractMessageBody(payload: gmail_v1.Schema$MessagePart | undefined): { html: string | null; text: string | null } {
  if (!payload) return { html: null, text: null }

  if (payload.mimeType === 'text/html') {
    return { html: decodeBodyData(payload.body?.data), text: null }
  }

  if (payload.mimeType === 'text/plain') {
    return { html: null, text: decodeBodyData(payload.body?.data) }
  }

  let html: string | null = null
  let text: string | null = null
  for (const part of payload.parts ?? []) {
    const extracted = extractMessageBody(part)
    if (!html && extracted.html) html = extracted.html
    if (!text && extracted.text) text = extracted.text
  }

  return { html, text }
}

export function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

export function extractRecipientSignals(headers: Record<string, string>, aliases: string[]): string[] {
  const lowerAliases = new Set(aliases.map(alias => alias.toLowerCase()))
  const candidates = [
    ...parseEmailList(headers.To ?? headers.to ?? ''),
    ...parseEmailList(headers.Cc ?? headers.cc ?? ''),
    ...parseEmailList(headers['Delivered-To'] ?? headers['delivered-to'] ?? ''),
    ...parseEmailList(headers['X-Original-To'] ?? headers['x-original-to'] ?? ''),
  ]

  return [...new Set(candidates.filter(email => lowerAliases.has(email.toLowerCase())))]
}

export function parseGmailMessage(message: gmail_v1.Schema$Message, sourceAliases: string[]): ParsedGmailMessage {
  if (!message.id || !message.threadId) {
    throw new Error('Gmail message is missing id or threadId')
  }

  const headers = message.payload?.headers ?? []
  const headerRecord = headersToRecord(headers)
  const from = parseEmailAddress(getHeader(headers, 'From'))
  const body = extractMessageBody(message.payload ?? undefined)
  const dateHeader = getHeader(headers, 'Date')
  const sentAt = dateHeader ? new Date(dateHeader) : null
  const normalizedSentAt = sentAt && !Number.isNaN(sentAt.getTime()) ? sentAt : null
  const bodyText = body.text ?? (body.html ? stripHtml(body.html) : null)

  return {
    gmailMessageId: message.id,
    gmailThreadId: message.threadId,
    rfcMessageId: getHeader(headers, 'Message-ID') || null,
    inReplyTo: getHeader(headers, 'In-Reply-To') || null,
    referencesHeader: getHeader(headers, 'References') || null,
    subject: getHeader(headers, 'Subject'),
    fromName: from.display || null,
    fromEmail: from.email || null,
    toEmails: parseEmailList(getHeader(headers, 'To')),
    ccEmails: parseEmailList(getHeader(headers, 'Cc')),
    deliveredToEmails: [
      ...parseEmailList(getHeader(headers, 'Delivered-To')),
      ...parseEmailList(getHeader(headers, 'X-Original-To')),
    ],
    sourceRecipients: extractRecipientSignals(headerRecord, sourceAliases),
    bodyText,
    bodyHtml: body.html,
    snippet: message.snippet ?? null,
    labels: message.labelIds ?? [],
    rawHeaders: headerRecord,
    sentAt: normalizedSentAt,
  }
}

export function buildRawDraftMessage(params: {
  from: string
  to: string[]
  subject: string
  body: string
  threadId?: string | null
  inReplyTo?: string | null
  referencesHeader?: string | null
  draftKey: string
}): string {
  const lines = [
    `From: ${params.from}`,
    `To: ${params.to.join(', ')}`,
    `Subject: ${params.subject}`,
    `X-Symph-Crm-Draft-Key: ${params.draftKey}`,
  ]

  if (params.inReplyTo) lines.push(`In-Reply-To: ${params.inReplyTo}`)
  if (params.referencesHeader || params.inReplyTo) {
    lines.push(`References: ${params.referencesHeader ?? params.inReplyTo}`)
  }

  lines.push(
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    '',
    params.body,
  )

  return Buffer.from(lines.join('\r\n')).toString('base64url')
}
