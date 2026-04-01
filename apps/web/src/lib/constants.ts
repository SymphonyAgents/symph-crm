// ─── API Base URL ─────────────────────────────────────────────────────────────

export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api'

// ─── Pipeline / Deal Stages ──────────────────────────────────────────────────

/** Typed shape for a kanban column entry. `matches` is `readonly string[]` so
 *  that `Array.prototype.includes(dbStage: string)` works without TS errors. */
type KanbanStage = {
  readonly id: string
  readonly label: string
  readonly color: string
  readonly matches: readonly string[]
}

/** 7 consolidated kanban columns — each `matches` array maps DB stage values to this column */
export const KANBAN_STAGES: readonly KanbanStage[] = [
  { id: 'lead',         label: 'Lead',           color: '#94a3b8', matches: ['lead'] },
  { id: 'discovery',    label: 'Discovery',      color: '#2563eb', matches: ['discovery'] },
  { id: 'assessment',   label: 'Assessment',     color: '#7c3aed', matches: ['assessment', 'qualified'] },
  { id: 'demo_prop',    label: 'Demo + Proposal',color: '#d97706', matches: ['demo', 'proposal', 'proposal_demo'] },
  { id: 'followup',     label: 'Follow-up',      color: '#f59e0b', matches: ['negotiation', 'followup'] },
  { id: 'closed_won',   label: 'Won',            color: '#16a34a', matches: ['closed_won'] },
  { id: 'closed_lost',  label: 'Lost',           color: '#dc2626', matches: ['closed_lost'] },
]

// ─── Badge Stage IDs (shorthand) ─────────────────────────────────────────────

/** Compact stage IDs used by the Badge component */
export type StageId = 'lead' | 'disc' | 'asm' | 'prop' | 'fup' | 'won' | 'lost'

const STAGE_DEFS: Record<StageId, { label: string }> = {
  lead: { label: 'Lead' },
  disc: { label: 'Discovery' },
  asm:  { label: 'Assessment' },
  prop: { label: 'Demo + Proposal' },
  fup:  { label: 'Follow-up' },
  won:  { label: 'Won' },
  lost: { label: 'Lost' },
}

export function getStage(id: StageId): { id: StageId; label: string } {
  return { id, ...STAGE_DEFS[id] }
}

/** Maps droppable column id → the primary DB stage value sent to API */
export const COLUMN_TO_STAGE: Record<string, string> = {
  lead: 'lead', discovery: 'discovery', assessment: 'assessment',
  demo_prop: 'proposal_demo', followup: 'followup',
  closed_won: 'closed_won', closed_lost: 'closed_lost',
}

/** Stage ordering for forward-only drag constraint — maps DB stage values to ordinals */
export const STAGE_ORDER: Record<string, number> = {
  lead: 0, discovery: 1, assessment: 2, qualified: 2,
  demo: 3, proposal: 3, proposal_demo: 3,
  negotiation: 4, followup: 4,
  closed_won: 5, closed_lost: 5,
}

/** Maps a DB stage to the next DB stage when advancing */
export const STAGE_ADVANCE_MAP: Record<string, string> = {
  lead: 'discovery', discovery: 'assessment',
  assessment: 'proposal_demo', qualified: 'proposal_demo',
  demo: 'proposal_demo', proposal: 'proposal_demo',
  proposal_demo: 'followup', negotiation: 'followup',
  followup: 'closed_won',
}

export const CLOSED_STAGE_IDS = new Set(['closed_won', 'closed_lost'])

export const STAGE_LABELS: Record<string, string> = {
  lead: 'Lead', discovery: 'Discovery', assessment: 'Assessment',
  qualified: 'Qualified', demo: 'Demo', proposal: 'Proposal',
  proposal_demo: 'Demo + Proposal', negotiation: 'Negotiation',
  followup: 'Follow-up', closed_won: 'Won', closed_lost: 'Lost',
}

export const STAGE_COLORS: Record<string, string> = {
  lead: '#94a3b8', discovery: '#2563eb', assessment: '#7c3aed',
  qualified: '#0369a1', demo: '#d97706', proposal: '#d97706',
  proposal_demo: '#d97706', negotiation: '#f59e0b', followup: '#f59e0b',
  closed_won: '#16a34a', closed_lost: '#dc2626',
}

export const STAGE_DOT: Record<string, string> = {
  lead: 'bg-slate-400', discovery: 'bg-blue-600', assessment: 'bg-violet-600',
  qualified: 'bg-sky-700', demo: 'bg-amber-600', proposal: 'bg-amber-600',
  proposal_demo: 'bg-amber-600', negotiation: 'bg-yellow-500', followup: 'bg-yellow-500',
  closed_won: 'bg-green-600', closed_lost: 'bg-red-600',
}

export const STAGE_DISPLAY: Record<string, { label: string; bg: string; color: string }> = {
  lead:          { label: 'Lead',            bg: '#f1f5f9',                color: '#475569' },
  discovery:     { label: 'Discovery',       bg: 'rgba(37,99,235,0.08)',  color: '#2563eb' },
  assessment:    { label: 'Assessment',      bg: 'rgba(124,58,237,0.08)', color: '#7c3aed' },
  qualified:     { label: 'Qualified',       bg: 'rgba(14,165,233,0.08)', color: '#0369a1' },
  demo:          { label: 'Demo',            bg: 'rgba(217,119,6,0.08)',  color: '#d97706' },
  proposal:      { label: 'Proposal',        bg: 'rgba(217,119,6,0.08)',  color: '#d97706' },
  proposal_demo: { label: 'Demo + Proposal', bg: 'rgba(217,119,6,0.08)', color: '#d97706' },
  negotiation:   { label: 'Negotiation',     bg: 'rgba(245,158,11,0.08)', color: '#92400e' },
  followup:      { label: 'Follow-up',       bg: 'rgba(245,158,11,0.08)', color: '#92400e' },
  closed_won:    { label: 'Won',             bg: 'rgba(22,163,74,0.08)',  color: '#16a34a' },
  closed_lost:   { label: 'Lost',            bg: 'rgba(220,38,38,0.08)',  color: '#dc2626' },
}

export const STAGE_OPTIONS = [
  { value: 'lead',          label: 'Lead' },
  { value: 'discovery',     label: 'Discovery' },
  { value: 'assessment',    label: 'Assessment' },
  { value: 'proposal_demo', label: 'Demo + Proposal' },
  { value: 'followup',      label: 'Follow-up' },
  { value: 'closed_won',    label: 'Won' },
  { value: 'closed_lost',   label: 'Lost' },
]

export const OUTREACH_OPTIONS = [
  { value: 'inbound',  label: 'Inbound' },
  { value: 'outbound', label: 'Outbound' },
  { value: 'referral', label: 'Referral' },
]

export const PRICING_OPTIONS = [
  { value: 'project_based', label: 'Project-Based' },
  { value: 'monthly',       label: 'Monthly Retainer' },
  { value: 'hourly',        label: 'Hourly' },
  { value: 'tbd',           label: 'TBD' },
]

export const PROGRESS_STAGES = [
  { id: 'lead',        label: 'Lead',            matches: ['lead'] },
  { id: 'discovery',   label: 'Discovery',       matches: ['discovery'] },
  { id: 'assessment',  label: 'Assessment',      matches: ['assessment', 'qualified'] },
  { id: 'demo_prop',   label: 'Demo + Proposal', matches: ['demo', 'proposal', 'proposal_demo'] },
  { id: 'followup',    label: 'Follow-up',       matches: ['negotiation', 'followup'] },
  { id: 'won',         label: 'Won',             matches: ['closed_won'] },
]

// ─── Service Types ───────────────────────────────────────────────────────────

export type ServiceOption = {
  readonly value: string
  readonly label: string
  readonly children?: readonly ServiceOption[]
}

export const SERVICE_TYPES: readonly ServiceOption[] = [
  { value: 'agency',            label: 'The Agency' },
  { value: 'consulting',        label: 'Consulting' },
  { value: 'staff_augmenting',  label: 'Staff Augmenting' },
  { value: 'internal_products', label: 'Internal Products' },
  {
    value: 'reseller',
    label: 'Reseller',
    children: [
      { value: 'reseller_josys',    label: 'Josys' },
      { value: 'reseller_gcp',      label: 'Google SCC - GCP' },
      { value: 'reseller_apigee',   label: 'Google Apigee' },
      { value: 'reseller_gws',      label: 'GWS' },
    ],
  },
]

/** Flat list of all service values (top-level + children) for validation */
export const ALL_SERVICE_VALUES = SERVICE_TYPES.flatMap(s =>
  s.children ? [s.value, ...s.children.map(c => c.value)] : [s.value],
)

// ─── Industry Options ────────────────────────────────────────────────────────

export const INDUSTRY_OPTIONS = [
  'Agriculture',
  'Automotive',
  'Banking & Finance',
  'BPO / Outsourcing',
  'Construction',
  'Consumer Goods / FMCG',
  'E-commerce',
  'Education',
  'Energy & Utilities',
  'Entertainment & Media',
  'F&B / Food Service',
  'Fintech',
  'Government',
  'Healthcare',
  'Hospitality & Tourism',
  'Insurance',
  'Legal',
  'Logistics & Supply Chain',
  'Manufacturing',
  'Mining',
  'Non-Profit / NGO',
  'Pharmaceuticals',
  'Real Estate',
  'Retail',
  'SaaS / Software',
  'Telecommunications',
  'Transportation',
] as const

// ─── Deal Detail Display Maps ────────────────────────────────────────────────

export const ACTIVITY_LABELS: Record<string, string> = {
  deal_created: 'Deal created', deal_stage_changed: 'Stage changed',
  deal_updated: 'Deal updated', deal_value_changed: 'Value updated',
  note_added: 'Note added', note_updated: 'Note updated',
  file_uploaded: 'File uploaded', contact_added: 'Contact added',
  company_created: 'Company created', company_updated: 'Company updated',
  deal_won: 'Deal won', deal_lost: 'Deal lost',
  proposal_created: 'Proposal created', proposal_sent: 'Proposal sent',
  am_assigned: 'AM assigned', deal_flagged: 'Deal flagged',
  deal_unflagged: 'Flag cleared', attachment_added: 'Attachment added',
}

export const DOC_TYPE_LABELS: Record<string, string> = {
  context: 'Context', discovery: 'Discovery', transcript_raw: 'Transcript',
  transcript_clean: 'Transcript', meeting: 'Meeting', proposal: 'Proposal',
  summary: 'Summary', email_thread: 'Email', company_profile: 'Profile',
  weekly_digest: 'Digest', general: 'Note',
}

// ─── Calendar ────────────────────────────────────────────────────────────────

export const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]

export const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
export const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

export const EVENT_TYPE_COLORS: Record<string, string> = {
  demo:           'bg-violet-500',
  discovery_call: 'bg-blue-500',
  followup:       'bg-amber-500',
  general:        'bg-slate-400',
}

export const EVENT_TYPE_BADGE: Record<string, string> = {
  demo:           'bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-300',
  discovery_call: 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300',
  followup:       'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300',
  general:        'bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300',
}

/** Hex colors matching EVENT_TYPE_COLORS — used for inline styles (outline/fill variants) */
export const EVENT_TYPE_HEX: Record<string, string> = {
  demo:           '#8b5cf6',   // violet-500
  discovery_call: '#3b82f6',   // blue-500
  followup:       '#f59e0b',   // amber-500
  general:        '#94a3b8',   // slate-400
}

export const TIME_SLOTS = Array.from({ length: (22 - 7) * 4 + 1 }, (_, i) => {
  const totalMinutes = 7 * 60 + i * 15
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h
  const label = `${h12}:${String(m).padStart(2, '0')} ${ampm}`
  const value = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  return { label, value }
})

export const HOURS = Array.from({ length: 16 }, (_, i) => i + 7)
export const HOUR_PX = 64

// ─── Audit Log ───────────────────────────────────────────────────────────────

export const AUDIT_ACTION_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  create:        { label: 'Created',  color: '#16a34a', bg: 'rgba(22,163,74,0.08)',  icon: '+' },
  update:        { label: 'Updated',  color: '#2563eb', bg: 'rgba(37,99,235,0.08)',  icon: '✎' },
  delete:        { label: 'Deleted',  color: '#dc2626', bg: 'rgba(220,38,38,0.08)',  icon: '×' },
  status_change: { label: 'Status',   color: '#d97706', bg: 'rgba(217,119,6,0.08)',  icon: '→' },
}

export const ENTITY_LABEL: Record<string, string> = {
  deal: 'Deal', company: 'Company', contact: 'Contact',
  activity: 'Activity', document: 'Document', proposal: 'Proposal', user: 'User',
}

export const AUDIT_PAGE_SIZE = 50

// ─── Chat ────────────────────────────────────────────────────────────────────

export const DEFAULT_WORKSPACE_ID = '60f84f03-283e-4c1a-8c88-b8330dc71d32'

export const SUGGESTED_PROMPTS = [
  { label: 'Pipeline summary', prompt: 'Give me a pipeline summary' },
  { label: 'Log a call',       prompt: 'I just had a call with a prospect — help me log it' },
  { label: 'Create a deal',    prompt: 'Create a new deal' },
  { label: 'Draft email',      prompt: 'Draft a follow-up email for a prospect' },
]

export const TOOL_LABELS: Record<string, string> = {
  search_companies:       'Searched companies',
  create_company:         'Created company',
  list_products_and_tiers:'Listed products',
  create_deal:            'Created deal',
  update_deal:            'Updated deal',
  get_deal:               'Fetched deal',
  list_deals:             'Listed deals',
  write_deal_context:     'Updated deal context',
  read_deal_context:      'Read deal context',
  log_activity:           'Logged activity',
  add_contact:            'Added contact',
}

/** Comma-separated MIME accept string for file inputs */
export const ACCEPTED_FILE_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
].join(',')

// ─── Color Palettes ──────────────────────────────────────────────────────────

export const BRAND_PALETTE = [
  '#2563eb', '#0ea5e9', '#10b981', '#f59e0b',
  '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16',
]

export const AVATAR_COLORS = [
  '#6c63ff', '#0ea5e9', '#10b981', '#f59e0b',
  '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16',
]

// ─── Command Palette Routes ──────────────────────────────────────────────────

export const COMMAND_ROUTES = [
  { label: 'Dashboard',  path: '/dashboard',  keywords: ['home', 'overview'] },
  { label: 'Pipeline',   path: '/pipeline',   keywords: ['kanban', 'stages', 'deals'] },
  { label: 'Deals',      path: '/deals',      keywords: ['list', 'brand', 'opportunities'] },
  { label: 'Calendar',   path: '/calendar',   keywords: ['events', 'schedule', 'meetings'] },
  { label: 'Reports',    path: '/reports',     keywords: ['analytics', 'charts', 'metrics'] },
  { label: 'Inbox',      path: '/inbox',       keywords: ['email', 'messages', 'gmail'] },
  { label: 'Proposals',  path: '/proposals',   keywords: ['documents', 'proposal', 'builder'] },
  { label: 'Audit Log',  path: '/audit-logs',  keywords: ['history', 'changes', 'logs'] },
]
