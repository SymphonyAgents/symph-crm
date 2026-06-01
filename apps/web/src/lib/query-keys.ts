/**
 * Centralized TanStack Query key factory.
 *
 * Rules:
 * - ALWAYS import from here — never hardcode string arrays in components.
 * - Key hierarchy: [entity] → [entity, id] → [entity, id, relation]
 * - Invalidating a parent key invalidates ALL child keys automatically.
 *   e.g. invalidate(queryKeys.companies.all) also invalidates .detail() and .deals()
 */

type DealsFilterParams = {
  stage?: string
  companyId?: string
  limit?: number
  dealType?: string
}

type AuditFilterParams = {
  entityType?: string
  action?: string
  performedBy?: string
  limit: number
  offset: number
}

type MeetingsFilterParams = {
  workspaceId?: string
  status?: 'pending' | 'done' | 'failed'
  dealId?: string
  limit?: number
}

export const queryKeys = {
  companies: {
    all: ['companies'] as const,
    search: (q: string) => ['companies', 'search', q] as const,
    detail: (id: string) => ['companies', id] as const,
    deals: (id: string) => ['companies', id, 'deals'] as const,
    contacts: (id: string) => ['companies', id, 'contacts'] as const,
  },
  deals: {
    all: ['deals'] as const,
    byType: (dealType: string) => ['deals', { dealType }] as const,
    trash: ['deals', 'trash'] as const,
    filtered: (params: DealsFilterParams) => ['deals', params] as const,
    detail: (id: string) => ['deals', id] as const,
    notes: (id: string) => ['deals', id, 'notes'] as const,
    notesFlat: (id: string) => ['deals', id, 'notes', 'flat'] as const,
    summaries: (id: string) => ['deals', id, 'summaries'] as const,
    summaryCheck: (id: string) => ['deals', id, 'summaries', 'check'] as const,
  },
  pipeline: {
    summary: ['pipeline', 'summary'] as const,
    summaryFiltered: (params: { from?: string; to?: string }) => ['pipeline', 'summary', params] as const,
    funnel: ['pipeline', 'funnel'] as const,
    funnelFiltered: (params: { from?: string; to?: string }) => ['pipeline', 'funnel', params] as const,
  },
  products: {
    all: ['products'] as const,
  },
  catalogItems: {
    all: ['catalog-items'] as const,
    activeOnly: ['catalog-items', 'active'] as const,
    detail: (id: string) => ['catalog-items', id] as const,
  },
  tiers: {
    all: ['tiers'] as const,
  },
  contacts: {
    all: ['contacts'] as const,
    byCompany: (companyId: string) => ['contacts', 'company', companyId] as const,
    notes: (id: string) => ['contacts', id, 'notes'] as const,
  },
  activities: {
    byDeal: (dealId: string) => ['activities', 'deal', dealId] as const,
    byCompany: (companyId: string) => ['activities', 'company', companyId] as const,
  },
  calendar: {
    status: ['calendar', 'status'] as const,
    events: (params: { from?: string; to?: string; dealId?: string }) =>
      ['calendar', 'events', params] as const,
    teamDemos: (params: { from?: string; to?: string }) =>
      ['calendar', 'team-demos', params] as const,
  },
  gmail: {
    inbox: ['gmail', 'inbox'] as const,
    user: ['gmail', 'user'] as const,
  },
  users: {
    all: ['users'] as const,
    external: ['users', 'external'] as const,
    detail: (id: string) => ['users', id] as const,
  },
  audit: {
    all: ['audit-logs'] as const,
    filtered: (params: AuditFilterParams) => ['audit-logs', params] as const,
  },
  billing: {
    byDeal: (dealId: string) => ['billing', 'deal', dealId] as const,
  },
  documents: {
    all: ['documents'] as const,
    byDeal: (dealId: string) => ['documents', 'deal', dealId] as const,
    byType: (type: string) => ['documents', type] as const,
    proposals: ['documents', 'proposals'] as const,
    content: (id: string) => ['document-content', id] as const,
    preview: (id: string) => ['document-preview', id] as const,
  },
  proposals: {
    all: ['proposals'] as const,
    byDeal: (dealId: string) => ['proposals', 'deal', dealId] as const,
    detail: (id: string) => ['proposals', id] as const,
    versions: (id: string) => ['proposals', id, 'versions'] as const,
    version: (id: string, vid: string) => ['proposals', id, 'versions', vid] as const,
    shares: (id: string) => ['proposals', id, 'shares'] as const,
  },
  notifications: {
    all: ['notifications'] as const,
  },
  chatSessions: {
    all: ['chat-sessions'] as const,
    byUser: (userId: string) => ['chat-sessions', userId] as const,
    history: (sessionId: string) => ['chat-sessions', 'history', sessionId] as const,
  },
  recordings: {
    all: ['recordings'] as const,
  },
  meetings: {
    all: ['meetings'] as const,
    filtered: (params: MeetingsFilterParams) => ['meetings', params] as const,
    detail: (id: string) => ['meetings', id] as const,
  },
} as const
