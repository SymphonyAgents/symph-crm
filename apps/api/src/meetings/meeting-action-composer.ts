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
const ACTION_SECTION_PATTERN = /^(action items?|next steps?|follow-?ups?|to do|todos?|open questions?|decisions needed)\b/i
const SUMMARY_SECTION_PATTERN = /^(overview|summary|meeting summary|key points?|discussion|what happened)\b/i
const SECTION_HEADING_PATTERN = /^(overview|summary|meeting summary|key points?|discussion|what happened|why\b.*|context|background|action items?|next steps?|follow-?ups?|to do|todos?|open questions?|decisions needed|transcript)\b/i
const ACTION_VERB_PATTERN = /\b(will|should|needs? to|need to|must|to prepare|prepare|send|share|schedule|confirm|estimate|decide|draft|review|follow up|follow-up|propose|align|finalize|coordinate|provide|create|update)\b/i
const AI_SLOP_PATTERN = /\b(leverage|delve|unlock the power|in today's fast-paced world|pivotal|crucial|foster|showcase|testament|landscape|seamless|robust)\b/i
const SPEAKER_PREFIX_PATTERN = /^([A-Z][\p{L}.'-]*(?:\s+[\p{L}.'-]+){0,4}):\s+(.+)$/u
const WORD_PATTERN = /[A-Za-z\p{L}0-9]+/gu

function stripFrontmatter(content: string | null | undefined): string | null {
  if (!content) return null
  return content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '').trim()
}

function stripMarkdown(line: string): string {
  return line
    .replace(/\*\*/g, '')
    .replace(/`/g, '')
    .replace(/\[([^\]]+)]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, '')
}

function cleanLine(line: string): string {
  return stripMarkdown(line)
    .replace(/^[-*\d.)\s]+/, '')
    .replace(/^#+\s*/, '')
    .replace(/^\[[0-9:.\s-]+]\s*/, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeDashVariants(line: string): string {
  return [...line]
    .map(char => {
      const code = char.charCodeAt(0)
      return code === 0x2013 || code === 0x2014 ? '-' : char
    })
    .join('')
}

function normalizeSentence(line: string): string {
  return normalizeDashVariants(cleanLine(line))
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/\.$/, '')
    .trim()
}

function wordCount(line: string): number {
  return [...line.matchAll(WORD_PATTERN)].length
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\r?\n+/)
    .map(normalizeSentence)
    .filter(line => line.length > 12)
}

function getCleanLines(content: string | null): string[] {
  const stripped = stripFrontmatter(content)
  if (!stripped) return []
  return stripped
    .split(/\r?\n/)
    .map(normalizeSentence)
    .filter(Boolean)
}

function isLikelyHeading(line: string): boolean {
  if (line.length > 80) return false
  if (line.endsWith('.')) return false
  return SECTION_HEADING_PATTERN.test(line)
}

function isMeetingTitleLine(line: string): boolean {
  return /^meeting summary\s*-/i.test(line) || /^meeting\s*-/i.test(line)
}

function getSummaryCandidateLines(summaryText: string | null, transcriptText: string | null): string[] {
  const summaryLines = getCleanLines(summaryText)
  if (summaryLines.length > 0) {
    const nonHeadingLines = summaryLines.filter(line => !isMeetingTitleLine(line) && !isLikelyHeading(line))
    if (nonHeadingLines.length > 0) return nonHeadingLines
  }

  const transcript = stripFrontmatter(transcriptText)
  if (!transcript) return []
  return splitSentences(transcript)
}

function sentenceCase(line: string): string {
  const trimmed = line.trim()
  if (!trimmed) return trimmed
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1)
}

function getImportantTokens(line: string): Set<string> {
  const stopwords = new Set([
    'the', 'and', 'that', 'with', 'this', 'from', 'will', 'should', 'needs', 'need', 'about',
    'into', 'for', 'can', 'our', 'their', 'meeting', 'team', 'client', 'show', 'real', 'help',
    'inform', 'decision', 'dave', 'overton', 'ems', 'oriel', 'raven', 'duran', 'paul', 'gonia',
  ])
  return new Set(
    [...line.toLowerCase().matchAll(/[a-z0-9]+/g)]
      .map(match => match[0])
      .map(token => token.length > 4 && token.endsWith('s') ? token.slice(0, -1) : token)
      .filter(token => token.length >= 4 && !stopwords.has(token)),
  )
}

function hasMeaningfulOverlap(a: string, b: string): boolean {
  const aTokens = getImportantTokens(a)
  const bTokens = getImportantTokens(b)
  let overlap = 0
  for (const token of aTokens) {
    if (bTokens.has(token)) overlap += 1
  }
  return overlap >= 3
}

function dedupeLines(lines: string[], options: { fuzzy?: boolean } = {}): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const line of lines) {
    const key = line.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
    if (!key || seen.has(key)) continue
    if (options.fuzzy && result.some(existing => hasMeaningfulOverlap(existing, line))) continue
    seen.add(key)
    result.push(line)
  }
  return result
}

function isFragment(line: string): boolean {
  const normalized = line.trim()
  const words = wordCount(normalized)
  if (words < 6) return true
  if (normalized.length < 28) return true
  if (/^(and|but|so|then|also|it|this|that|yeah|yes|no|okay|ok)\b/i.test(normalized)) return true
  if (/\b(ka nga|anna|dyan|naman|lang|sige|ano|yun|ito)\b/i.test(normalized)) return true
  if (/^(send|share|confirm)\s+[A-Z]?[a-z]+\.?$/i.test(normalized)) return true
  return false
}

function actionTextFromLine(line: string): string | null {
  const speakerMatch = line.match(SPEAKER_PREFIX_PATTERN)
  const speaker = speakerMatch?.[1]
  const text = speakerMatch ? speakerMatch[2] : line
  let cleaned = normalizeSentence(text)

  if (speaker) {
    if (!/^(I\s+will|I'll|I\s+can|I\s+should|We\s+should|We\s+need|Need\s+to|Please\s+|Can\s+you\s+)/i.test(cleaned)) {
      return null
    }
    cleaned = cleaned
      .replace(/^I\s+will\b/i, `${speaker} will`)
      .replace(/^I'll\b/i, `${speaker} will`)
      .replace(/^I\s+can\b/i, `${speaker} can`)
      .replace(/^I\s+should\b/i, `${speaker} should`)
      .replace(/^We\s+should\b/i, 'We should')
  }

  if (cleaned.length > 220) return null
  if (/^option\s+\d+\b/i.test(cleaned)) return null
  if (isFragment(cleaned)) return null
  if (!ACTION_VERB_PATTERN.test(cleaned)) return null
  if (AI_SLOP_PATTERN.test(cleaned)) return null
  if (/\?\s*$/.test(cleaned) && !/decide|confirm|clarify/i.test(cleaned)) return null

  return sentenceCase(cleaned)
}

function linesUnderActionSections(lines: string[]): string[] {
  const items: string[] = []
  let inActionSection = false

  for (const line of lines) {
    if (ACTION_SECTION_PATTERN.test(line)) {
      inActionSection = true
      continue
    }
    if (inActionSection && isLikelyHeading(line)) {
      inActionSection = false
      continue
    }
    if (!inActionSection) continue

    const item = actionTextFromLine(line)
    if (item) items.push(item)
  }

  return items
}

function inferActionLines(lines: string[]): string[] {
  return lines
    .map(actionTextFromLine)
    .filter((line): line is string => Boolean(line))
}

function inferOptionActionLine(line: string): string | null {
  if (!/\b(presenting|present|lay out|layout|show)\b/i.test(line)) return null
  if (!/\boptions?\b/i.test(line)) return null

  const subjectMatch = line.match(/\b([A-Z][A-Za-z0-9&.'-]{1,24})\b(?=\s+with\b|\s+the\b|\s+options?\b)/)
  const subject = subjectMatch?.[1] && !/^(The|Symph|GCP|Azure|BigQuery)$/i.test(subjectMatch[1])
    ? subjectMatch[1]
    : 'the client'

  return `Prepare the ${subject} options note with the choices, costs, migration risks, and recommended path`
}

function inferSummaryActionLines(lines: string[]): string[] {
  return [
    ...inferActionLines(lines)
      .filter(line => /^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\s+will\b/.test(line)),
    ...lines
      .map(inferOptionActionLine)
      .filter((line): line is string => Boolean(line)),
  ]
}

export function getMeetingContentSummary(summaryText: string | null, transcriptText: string | null): string {
  const lines = getSummaryCandidateLines(summaryText, transcriptText)
    .filter(line => !ACTION_SECTION_PATTERN.test(line))
    .filter(line => !AI_SLOP_PATTERN.test(line))
    .filter(line => wordCount(line) >= 7)

  const summaryLines = dedupeLines(lines).slice(0, 4)
  if (summaryLines.length > 0) return summaryLines.join('\n')

  if (stripFrontmatter(transcriptText)) return 'Meeting transcript is available for review, but no clean summary was saved yet.'
  return 'Meeting content is available, but no clean summary was saved yet.'
}

export function extractMeetingActionItems(summaryText: string | null, transcriptText: string | null): string[] {
  const summaryLines = getCleanLines(summaryText)
  const transcriptLines = getCleanLines(transcriptText)

  const structured = linesUnderActionSections(summaryLines)
  const inferredFromSummary = inferSummaryActionLines(summaryLines)
  const inferredFromTranscript = inferActionLines(transcriptLines)

  const actions = dedupeLines([
    ...structured,
    ...inferredFromSummary,
    ...inferredFromTranscript,
  ], { fuzzy: true })
    .filter(line => !isFragment(line))
    .slice(0, 5)

  if (actions.length > 0) return actions

  return ['Review the meeting notes and confirm the clearest next step before sending a follow-up.']
}

export function getExternalMeetingRecipients(attendees: string[]): string[] {
  return [...new Set(attendees
    .map(email => email.trim().toLowerCase())
    .filter(email => email.includes('@'))
    .filter(email => !INTERNAL_EMAIL_DOMAINS.some(domain => email.endsWith(`@${domain}`))))]
}

function cleanMeetingSubject(title: string): string {
  return title
    .replace(/^meeting\s*[-:]/i, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function isPlaceholderDealTitle(dealTitle: string | null | undefined): boolean {
  if (!dealTitle) return true
  return /^test\s+lead\b/i.test(dealTitle) || /^untitled\b/i.test(dealTitle)
}

function formatDraftBody(params: {
  meetingTitle: string
  summary: string
  actionItems: string[]
  dealTitle?: string | null
}): string {
  const meetingSubject = cleanMeetingSubject(params.meetingTitle)
  const contextSubject = isPlaceholderDealTitle(params.dealTitle) ? meetingSubject : params.dealTitle?.trim() || meetingSubject
  const summaryLines = params.summary.split('\n').map(line => `- ${line}`).join('\n')
  const actionLines = params.actionItems.map(item => `- ${item}`).join('\n')

  return [
    'Hi,',
    '',
    `Following up on ${contextSubject}.`,
    '',
    'What I have from the meeting:',
    summaryLines,
    '',
    'Proposed next steps:',
    actionLines,
    '',
    'If this matches your read, I can turn this into the next client-facing note.',
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
