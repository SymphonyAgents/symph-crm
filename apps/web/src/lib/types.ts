// ─── API Entity Types ─────────────────────────────────────────────────────────
//
// Canonical types for all API responses. Components import from here —
// never define local ApiXxx types.

// ── Deals ────────────────────────────────────────────────────────────────────

export type ApiDeal = {
  id: string
  companyId: string
  title: string
  stage: string
  value: string | null
  servicesTags: string[] | null
  outreachCategory: string | null
  pricingModel: string | null
  monthlyRecurring: string | null
  contractLength: string | null
  assignedTo: string | null
  lastActivityAt: string | null
  productId: string | null
  tierId: string | null
  closedAt: string | null
  closedReason: string | null
  createdAt: string
  updatedAt?: string
  /** Number of documents attached to this deal (injected by deals.service findAll) */
  documentCount?: number
  /** Display name of the user who created this deal (injected by deals.service findAll) */
  createdByName?: string | null
}

/** Extended deal returned by /deals/:id — includes relations */
export type ApiDealDetail = ApiDeal & {
  closeDate: string | null
  probability: number | null
  isFlagged: boolean | null
  flagReason: string | null
  proposalLink: string | null
  demoLink: string | null
  company: ApiCompanyDetail | null
  activities: Activity[]
}

// ── Companies ────────────────────────────────────────────────────────────────

export type ApiCompany = {
  id: string
  name: string
}

export type ApiCompanyDetail = ApiCompany & {
  domain: string | null
  industry: string | null
  website: string | null
  hqLocation: string | null
  logoUrl: string | null
  createdAt: string
  /** User ID who created this company/brand — returned by the API */
  createdBy?: string | null
}

// ── Users ────────────────────────────────────────────────────────────────────

export type ApiUser = {
  id: string
  name: string
  email: string
  image?: string | null
  firstName?: string | null
  lastName?: string | null
  nickname?: string | null
}

// ── Activities ───────────────────────────────────────────────────────────────

export type Activity = {
  id: string
  type: string
  metadata: Record<string, unknown>
  actorId: string | null
  createdAt: string
}

// ── Documents ────────────────────────────────────────────────────────────────

export type ApiDocument = {
  id: string
  title: string
  type: string
  createdAt: string
  updatedAt?: string
  authorId?: string
  excerpt: string | null
  wordCount: number | null
  dealId?: string | null
  version?: number | null
  parentId?: string | null
  /** Storage bucket path — used to distinguish notes (/notes/) from resources (/resources/) */
  storagePath?: string
  /** Classification tags set on upload (e.g. ['resources', 'pdf'] or ['notes', 'markdown']) */
  tags?: string[] | null
}

// ── Products & Tiers ─────────────────────────────────────────────────────────

export type ApiProduct = { id: string; name: string; slug: string }
export type ApiTier = { id: string; name: string; slug: string }

// ── Pipeline Summary ─────────────────────────────────────────────────────────

export type PipelineSummary = {
  totalDeals: number
  activeDeals: number
  totalPipeline: number
  avgDealSize: number
  winRate: number
  dealsByStage: { stage: string; count: number; totalValue: number }[]
}

// ── Pipeline Funnel ──────────────────────────────────────────────────────────

export type FunnelStage = {
  stage: string
  label: string
  entryCount: number
  conversionRate: number | null   // % conversion to next stage; null for last funnel stage
  isBottleneck: boolean           // true when conversionRate < 40
  color: string
  sortOrder: number
}

export type FunnelResponse = {
  stages: FunnelStage[]   // active (non-terminal) stages ordered by sort_order
  totalEntered: number
  wonCount: number
  lostCount: number
}

// ── Audit Logs ───────────────────────────────────────────────────────────────

export type AuditLogEntry = {
  id: number
  createdAt: string
  action: 'create' | 'update' | 'delete' | 'status_change'
  auditType: string
  entityType: string
  entityId: string | null
  source: string | null
  performedBy: string | null
  details: Record<string, unknown> | null
  performerName: string | null
  performerImage: string | null
}

export type AuditLogsResponse = {
  rows: AuditLogEntry[]
  total: number
}

// ── Calendar ─────────────────────────────────────────────────────────────────

export type ApiCalendarEvent = {
  id: string
  googleEventId: string
  userId: string
  title: string
  description: string | null
  startAt: string
  endAt: string
  location: string | null
  attendeeEmails: string[]
  dealId: string | null
  eventType: 'demo' | 'discovery_call' | 'followup' | 'general'
  /** True if the current user is the organizer. Non-owned events render as outlines. */
  isOwner: boolean
}

export type CalendarStatus = {
  connected: boolean
  googleEmail?: string
  lastSyncedAt?: string
}

export type CalendarView = 'month' | 'week'

export type CreateEventForm = {
  title: string
  startDate: string
  startTime: string
  endDate: string
  endTime: string
  description: string
  location: string
  eventType: 'demo' | 'discovery_call' | 'followup' | 'general'
}

// ── Gmail / Inbox ────────────────────────────────────────────────────────────

export type GmailMessage = {
  id: string
  rfcMessageId: string
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
  contactName: string
  contactEmail: string
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

// ── Notifications ──────────────────────────────────────────────────────────

export type ApiNotification = {
  id: string
  type: 'dormant_deal' | 'deal_won' | 'mention'
  isRead: boolean
  createdAt: string
  dealId: string | null
  dealTitle: string | null
  brandName: string | null
  triggerText: string
}

export type FilterTab = 'all' | 'unread'

export type InboxChannel = 'all' | 'email' | 'messenger' | 'instagram' | 'whatsapp' | 'viber'

// ── Billing ─────────────────────────────────────────────────────────────────

export type ApiBillingMilestone = {
  id: string
  billingId: string
  name: string
  amount: string
  percentage: string | null
  sortOrder: number
  isPaid: boolean
  paidAt: string | null
  createdAt: string
}

export type ApiBilling = {
  id: string
  dealId: string
  billingType: 'annual' | 'monthly' | 'milestone'
  contractStart: string | null
  contractEnd: string | null
  amount: string | null
  monthlyDerived: string | null
  createdAt: string
  updatedAt: string
  milestones: ApiBillingMilestone[]
}

// ── Chat ─────────────────────────────────────────────────────────────────────

export type ActionRecord = {
  tool: string
  input: Record<string, unknown>
  result: Record<string, unknown>
}

export type AttachmentType = 'file' | 'image' | 'voice'

export interface PendingAttachment {
  type: AttachmentType
  filename: string
  blob: Blob
  mimetype: string
  previewUrl?: string
  duration?: number
}

export type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  actionsTaken?: ActionRecord[]
  attachment?: PendingAttachment
}
