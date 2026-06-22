export enum LeadStatus {
  ToContact = 'to_contact',
  Contacted = 'contacted',
  FollowedUp = 'followed_up',
  Lost = 'lost',
  Converted = 'converted',
}

export const LEAD_STATUSES = [
  LeadStatus.ToContact,
  LeadStatus.Contacted,
  LeadStatus.FollowedUp,
  LeadStatus.Lost,
  LeadStatus.Converted,
] as const

export const LEGACY_LEAD_STATUS_MAP: Record<string, LeadStatus> = {
  new: LeadStatus.ToContact,
  reviewing: LeadStatus.ToContact,
  interested: LeadStatus.Contacted,
  not_fit: LeadStatus.Lost,
  duplicate: LeadStatus.Lost,
}
