import type { MeetingActionCitation, MeetingActionPackage } from './meeting-actions.types'

type MeetingActionComposeInput = {
  meeting: {
    id: string
    title: string
    sourceUrl: string
    attendees: string[]
    summaryNotePath: string | null
    transcriptNotePath: string | null
  }
  summaryText: string | null
  transcriptText: string | null
  dealTitle?: string | null
  generatedAt: Date
  generatedBy?: string | null
  confirmedDealId?: string | null
  suggestedDealIds?: string[]
  actionNotePath?: string | null
  draftGmailId?: string | null
  reminderId?: string | null
}

const INTERNAL_EMAIL_DOMAINS = ['symph.co', 'symph.ai']
const ACTION_LINE_PATTERN = /\b(action|next step|follow up|follow-up|todo|to do|send|share|schedule|confirm|prepare|draft|proposal|deck|quote|pricing)\b/i

function stripFrontmatter(content: string | null | undefined): string | null {
  if (!content) return null
  return content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '').trim()
}

function cleanLine(line: string): string {
  return line
    .replace(/^[-*•\d.)\s]+/, '')
    .replace(/^#+\s*/, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\r?\n+/)
    .map(cleanLine)
    .filter(line => line.length > 12)
}

export function getMeetingContentSummary(summaryText: string | null, transcriptText: string | null): string {
  const summary = stripFrontmatter(summaryText)
  if (summary) {
    const lines = summary
      .split(/\r?\n/)
      .map(cleanLine)
      .filter(line => line.length > 0 && !/^transcript$/i.test(line))
      .slice(0, 8)
    if (lines.length > 0) return lines.join('\n')
  }

  const transcript = stripFrontmatter(transcriptText)
  if (!transcript) return 'Meeting content is available, but no concise summary was saved yet.'
  return splitSentences(transcript).slice(0, 5).join('\n') || 'Meeting transcript is available for review.'
}

export function extractMeetingActionItems(summaryText: string | null, transcriptText: string | null): string[] {
  const source = [stripFrontmatter(summaryText), stripFrontmatter(transcriptText)].filter(Boolean).join('\n')
  const candidates = source
    .split(/\r?\n/)
    .map(cleanLine)
    .filter(line => line.length >= 8 && line.length <= 180 && ACTION_LINE_PATTERN.test(line))

  const unique = [...new Set(candidates)]
  if (unique.length > 0) return unique.slice(0, 6)

  return ['Review the meeting notes and confirm the next step with the client.']
}

export function getExternalMeetingRecipients(attendees: string[]): string[] {
  return [...new Set(attendees
    .map(email => email.trim().toLowerCase())
    .filter(email => email.includes('@'))
    .filter(email => !INTERNAL_EMAIL_DOMAINS.some(domain => email.endsWith(`@${domain}`))))]
}

function formatDraftBody(params: {
  meetingTitle: string
  summary: string
  actionItems: string[]
  dealTitle?: string | null
}): string {
  const contextLine = params.dealTitle
    ? `Following up on our meeting about ${params.dealTitle}.`
    : `Following up on our meeting, ${params.meetingTitle}.`

  const actionLines = params.actionItems.map(item => `- ${item}`).join('\n')
  return [
    'Hi,',
    '',
    contextLine,
    '',
    'Here is the quick recap:',
    params.summary,
    '',
    'Next steps:',
    actionLines,
    '',
    'Please confirm if this matches your understanding, and I can move the next step forward.',
    '',
    'Best,',
    'Dave',
  ].join('\n')
}

export function buildMeetingActionCitations(meeting: MeetingActionComposeInput['meeting']): MeetingActionCitation[] {
  return [
    { label: 'Original meeting', url: meeting.sourceUrl },
    { label: 'Meeting summary note', storagePath: meeting.summaryNotePath },
    { label: 'Meeting transcript note', storagePath: meeting.transcriptNotePath },
  ].filter(citation => citation.url || citation.storagePath)
}

export function composeMeetingActionPackage(input: MeetingActionComposeInput): MeetingActionPackage {
  const summary = getMeetingContentSummary(input.summaryText, input.transcriptText)
  const actionItems = extractMeetingActionItems(input.summaryText, input.transcriptText)
  const draftRecipients = getExternalMeetingRecipients(input.meeting.attendees)
  const followUpDraftSubject = `Follow-up: ${input.meeting.title}`
  const followUpDraftText = formatDraftBody({
    meetingTitle: input.meeting.title,
    summary,
    actionItems,
    dealTitle: input.dealTitle,
  })

  return {
    version: 1,
    status: input.confirmedDealId ? 'attached' : 'needs_deal_review',
    generatedAt: input.generatedAt.toISOString(),
    generatedBy: input.generatedBy ?? null,
    confirmedDealId: input.confirmedDealId ?? null,
    suggestedDealIds: input.suggestedDealIds ?? [],
    summary,
    actionItems,
    followUpDraftSubject,
    followUpDraftText,
    draftRecipients,
    citations: buildMeetingActionCitations(input.meeting),
    actionNotePath: input.actionNotePath ?? null,
    draftGmailId: input.draftGmailId ?? null,
    reminderId: input.reminderId ?? null,
    lastError: null,
  }
}

export function formatMeetingActionNote(actionPackage: MeetingActionPackage): string {
  const citations = actionPackage.citations
    .map(citation => {
      if (citation.url) return `- ${citation.label}: ${citation.url}`
      if (citation.storagePath) return `- ${citation.label}: ${citation.storagePath}`
      return null
    })
    .filter((line): line is string => Boolean(line))
    .join('\n')

  return [
    '## Summary',
    actionPackage.summary,
    '',
    '## Action Items',
    ...actionPackage.actionItems.map(item => `- ${item}`),
    '',
    '## Draft Follow-Up Email',
    `Subject: ${actionPackage.followUpDraftSubject}`,
    '',
    actionPackage.followUpDraftText,
    '',
    '## Source Citations',
    citations || '- Source meeting attached in CRM.',
    '',
    '## Safety Boundary',
    'This is a draft-only package. No email was sent automatically.',
  ].join('\n')
}
