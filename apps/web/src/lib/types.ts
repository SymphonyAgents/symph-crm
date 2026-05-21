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
  /** One-time setup/onboarding fee */
  oneTimeFee: string | null
  /** Monthly recurring revenue */
  mrr: string | null
  /** Contract duration in months, used with mrr to auto-compute value */
  contractLength: number | null
  /** Per-month revenue overrides: { "2026-05": 500000, "2026-06": 300000 } */
  monthlyRevenue: Record<string, number> | null
  servicesTags: string[] | null
  outreachCategory: string | null
  pricingModel: string | null
  monthlyRecurring: string | null
  assignedTo: string | null
  /** Optional secondary AM (single user) */
  subAccountManagerId: string | null
  /** User IDs of builders/engineers assigned (any role) */
  builders: string[] | null
  /** Catalog row this deal points at — NOT NULL since the 011 backfill. */
  catalogItemId: string | null
  /** Catalog row name, joined by deals.service (e.g. "HireAI", "The Agency", "GWS"). */
  catalogItemName: string | null
  /** Catalog row's product_type — drives the pipeline tabs (internal | service | reseller | partnership). */
  catalogItemType: ProductType | null
  lastActivityAt: string | null
  deletedAt: string | null
  deletedBy: string | null
  deleteAfter: string | null
  tierId: string | null
  closedAt: string | null
  closedReason: string | null
  createdAt: string
  updatedAt?: string
  /** Number of documents attached to this deal (injected by deals.service findAll) */
  documentCount?: number
  /** Display name of the user who created this deal (injected by deals.service findAll) */
  createdByName?: string | null
  /** Display name of the company/brand attached to this deal (injected by deals.service findAll) */
  brandName?: string | null
  /** Pipeline type: 'agency' (default) | 'reseller' */
  dealType: string
  /** Reseller: what Symph pays the vendor (GWS/GCP/Josys) */
  costPrice: string | null
  /** Reseller: gross margin % (0-100). value = costPrice / (1 - marginPercent/100) */
  marginPercent: string | null
}

/** Extended deal returned by /deals/:id — includes relations */
export type ApiDealDetail = ApiDeal & {
  closeDate: string | null
  probability: number | null
  isFlagged: boolean | null
  flagReason: string | null
  proposalLink: string | null
  demoLink: string | null
  clientBrandColor: string | null
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
  role?: 'SALES' | 'BUILD'
  firstName?: string | null
  lastName?: string | null
  nickname?: string | null
  discordId: string | null
}

// ── Catalog Items ────────────────────────────────────────────────────────────

export type ProductType = 'internal' | 'service' | 'reseller' | 'partnership'

export type ApiCatalogItem = {
  id: string
  productType: ProductType
  slug: string | null
  name: string
  industry: string | null
  landingPageLink: string | null
  iconUrl: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
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

// ── Proposals ────────────────────────────────────────────────────────────────

export type ApiProposalListItem = {
  id: string
  title: string
  dealId: string | null
  isPinned: boolean
  currentVersion: number
  currentVersionId: string | null
  changeNote: string | null
  excerpt: string | null
  wordCount: number | null
  authorId: string | null
  createdBy: string
  createdAt: string
  updatedAt: string
}

/** Workspace-wide list row — adds deal + brand context joined server-side. */
export type ApiProposalSummary = ApiProposalListItem & {
  dealTitle: string | null
  brandId: string | null
  brandName: string | null
}

export type ApiProposalVersion = {
  id: string
  version: number
  changeNote: string | null
  excerpt: string | null
  wordCount: number | null
  authorId: string
  createdAt: string
  /** Present only when fetched as a detail/single-version endpoint. */
  html?: string
}

export type ApiProposalHead = {
  id: string
  title: string
  dealId: string | null
  isPinned: boolean
  currentVersion: number
  versionCount: number
  createdAt: string
  updatedAt: string
  version: ApiProposalVersion & { html: string }
}

export type ApiProposalShareLink = {
  id: string
  token: string
  proposalVersionId: string
  version: number
  expiresAt: string | null
  viewCount: number
  lastViewedAt: string | null
  createdBy: string | null
  createdAt: string
}

// ── Products & Tiers ─────────────────────────────────────────────────────────

export type ApiProduct = { id: string; name: string; industry?: string | null; isActive?: boolean }
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
  entityName: string | null
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

export type ApiTeamDemoEvent = {
  id: string
  googleEventId: string
  title: string
  startAt: string
  endAt: string
  location: string | null
  attendeeEmails: string[]
  dealId: string | null
  userId: string
  userName: string | null
  eventType: string
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

// ── Deal Notes (NFS flat) ──────────────────────────────────────────────────

/** Flat NFS note returned by GET /deals/:id/notes/flat */
export type NfsDealNote = {
  id: string
  title: string
  type: string
  excerpt: string | null
  content: string
  createdAt: string
  updatedAt: string
  wordCount: number
  authorId: string | null
  storagePath: string
  tags: string[]
  filename: string
  category: string
}

// ── Deal Notes (NFS) ────────────────────────────────────────────────────────

export type DealNoteFile = {
  filename: string
  content: string
  createdAt: number
}

export type DealNotesResponse = {
  categories: {
    general: DealNoteFile[]
    meeting: DealNoteFile[]
    notes: DealNoteFile[]
    discovery: DealNoteFile[]
    transcript: DealNoteFile[]
    proposal: DealNoteFile[]
  }
  resources: Array<{ filename: string; size: number; ext: string }>
  log: string | null
}

// ── Deal Summaries (NFS) ────────────────────────────────────────────────────

export type DealSummaryMeta = {
  filename: string
  generatedAt: string
  notesIncluded: number
  generatedBy: string
  storagePath: string
}

export type DealSummaryFull = {
  meta: DealSummaryMeta
  content: string
}

export type DealSummaryCheck = {
  hasNew: boolean
  noteCount: number
  latestSummaryAt: string | null
}

// ── Contact Notes (NFS) ─────────────────────────────────────────────────────

export type ContactNoteFile = {
  filename: string
  content: string
  createdAt: number
}

export type ContactNotesResponse = {
  categories: {
    general: ContactNoteFile[]
    meeting: ContactNoteFile[]
    log: ContactNoteFile[]
  }
  resources: Array<{ filename: string; size: number; ext: string }>
}

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

// ── Recordings ───────────────────────────────────────────────────────────────

export type ApiRecording = {
  id: string
  userId: string
  dealId: string | null
  workspaceId: string | null
  title: string
  duration: number | null   // seconds
  storageKey: string
  mimeType: string
  sizeBytes: number | null
  playbackUrl: string
  createdAt: string
}

// ── Meetings ────────────────────────────────────────────────────────────────

export type ApiMeetingStatus = 'pending' | 'done' | 'failed'

export type ApiMeetingRawPayload = {
  summaryMarkdown?: string | null
  transcriptMarkdown?: string | null
  rawPayload?: {
    notes?: string | null
    transcript?: Array<{ speaker?: string; text?: string; timestamp?: number }>
  } | null
}

export type ApiMeeting = {
  id: string
  workspaceId: string
  dealId: string | null
  sourceMeetingId: string
  sourceUrl: string
  title: string
  startedAt: string | null
  endedAt: string | null
  attendees: string[]
  status: ApiMeetingStatus
  lastError: string | null
  retryCount: number
  summaryNotePath: string | null
  transcriptNotePath: string | null
  ingestedAt: string | null
  rawPayload: ApiMeetingRawPayload | null
  createdAt: string
  updatedAt: string
}

export type ApiMeetingResolverContact = {
  id: string
  companyId: string
  name: string
  email: string | null
  phone: string | null
  title: string | null
}

export type ApiMeetingResolverCandidates = {
  deals: ApiDeal[]
  companies: ApiCompanyDetail[]
  contacts: ApiMeetingResolverContact[]
  dealsByCompany: ApiDeal[]
}

export type ApiMeetingDetail = {
  meeting: ApiMeeting
  summaryNote: NfsDealNote | null
  transcriptNote: NfsDealNote | null
}
