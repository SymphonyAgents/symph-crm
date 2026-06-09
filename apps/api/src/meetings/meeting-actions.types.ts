export type MeetingActionPackageStatus = 'needs_deal_review' | 'attached' | 'failed'

export type MeetingActionCitation = {
  label: string
  url?: string | null
  storagePath?: string | null
}

export type MeetingActionPackage = {
  version: 1
  status: MeetingActionPackageStatus
  generatedAt: string
  generatedBy: string | null
  confirmedDealId: string | null
  suggestedDealIds: string[]
  summary: string
  actionItems: string[]
  followUpDraftSubject: string
  followUpDraftText: string
  draftRecipients: string[]
  citations: MeetingActionCitation[]
  actionNotePath?: string | null
  draftGmailId?: string | null
  reminderId?: string | null
  lastError?: string | null
}

export type CreateMeetingActionPackageBody = {
  dealId?: string | null
  createDraft?: boolean
  createReminder?: boolean
  reminderAt?: string | null
}

export type CreateMeetingActionPackageOptions = {
  authorId?: string | null
}

export function getMeetingActionPackage(rawPayload: Record<string, unknown> | null | undefined): MeetingActionPackage | null {
  const value = rawPayload?.meetingActionPackage
  if (!value || typeof value !== 'object') return null

  const candidate = value as Partial<MeetingActionPackage>
  if (candidate.version !== 1) return null
  if (!candidate.status) return null
  return candidate as MeetingActionPackage
}
