// Read-only hooks — all useQuery wrappers.
//
// Rules:
// - Every GET endpoint is wrapped here, never inlined in components
// - Query keys always come from queryKeys (lib/query-keys.ts)
// - No toast notifications (reads don't trigger toasts)
// - No direct fetch() calls — always use api.get() from lib/api.ts

import { useQuery, type UseQueryOptions } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { queryKeys } from '@/lib/query-keys'
import type {
  ApiDeal,
  ApiDealDetail,
  ApiCompany,
  ApiCompanyDetail,
  ApiUser,
  ApiProduct,
  ApiTier,
  Activity,
  ApiDocument,
  ApiBilling,
  PipelineSummary,
  FunnelResponse,
  AuditLogsResponse,
  ApiCalendarEvent,
  ApiTeamDemoEvent,
  CalendarStatus,
  InboxResponse,
  ApiNotification,
  DealNotesResponse,
  DealSummaryMeta,
  DealSummaryFull,
  ContactNotesResponse,
  NfsDealNote,
} from '@/lib/types'

// ─── Companies ────────────────────────────────────────────────────────────────

export function useGetCompanies(
  options?: Partial<UseQueryOptions<ApiCompanyDetail[]>>,
) {
  return useQuery<ApiCompanyDetail[]>({
    queryKey: queryKeys.companies.all,
    queryFn: () => api.get<ApiCompanyDetail[]>('/companies'),
    ...options,
  })
}

export function useGetCompany(
  id: string | undefined,
  options?: Partial<UseQueryOptions<ApiCompanyDetail>>,
) {
  return useQuery<ApiCompanyDetail>({
    queryKey: queryKeys.companies.detail(id ?? ''),
    queryFn: () => api.get<ApiCompanyDetail>(`/companies/${id}`),
    enabled: !!id,
    ...options,
  })
}

// ─── Contacts ─────────────────────────────────────────────────────────────────

export type ApiContact = {
  id: string
  companyId: string
  name: string
  email: string | null
  phone: string | null
  title: string | null
  linkedinUrl: string | null
  isPrimary: boolean
  createdAt: string
  updatedAt: string
}

export function useGetContactsByCompany(
  companyId: string | undefined,
  options?: Partial<UseQueryOptions<ApiContact[]>>,
) {
  return useQuery<ApiContact[]>({
    queryKey: queryKeys.contacts.byCompany(companyId ?? ''),
    queryFn: () => api.get<ApiContact[]>('/contacts', { companyId }),
    enabled: !!companyId,
    ...options,
  })
}

// ─── Deals ────────────────────────────────────────────────────────────────────

export function useGetDeals(
  options?: Partial<UseQueryOptions<ApiDeal[]>>,
) {
  return useQuery<ApiDeal[]>({
    queryKey: queryKeys.deals.all,
    queryFn: () => api.get<ApiDeal[]>('/deals'),
    ...options,
  })
}

export function useGetDeal(
  id: string,
  options?: Partial<UseQueryOptions<ApiDealDetail>>,
) {
  return useQuery<ApiDealDetail>({
    queryKey: queryKeys.deals.detail(id),
    queryFn: () => api.get<ApiDealDetail>(`/deals/${id}`),
    retry: false,
    ...options,
  })
}

export function useGetDealNotes(
  dealId: string | null,
  options?: Partial<UseQueryOptions<DealNotesResponse>>,
) {
  return useQuery<DealNotesResponse>({
    queryKey: queryKeys.deals.notes(dealId ?? ''),
    queryFn: () => api.get<DealNotesResponse>(`/deals/${dealId}/notes`),
    enabled: !!dealId,
    ...options,
  })
}

export function useGetDealNotesFlat(
  dealId: string | undefined,
  options?: Partial<UseQueryOptions<NfsDealNote[]>>,
) {
  return useQuery<NfsDealNote[]>({
    queryKey: queryKeys.deals.notesFlat(dealId ?? ''),
    queryFn: () => api.get<NfsDealNote[]>(`/deals/${dealId}/notes/flat`),
    enabled: !!dealId,
    ...options,
  })
}

export function useGetDealSummaries(
  dealId: string | undefined,
  options?: Partial<UseQueryOptions<DealSummaryMeta[]>>,
) {
  return useQuery<DealSummaryMeta[]>({
    queryKey: queryKeys.deals.summaries(dealId ?? ''),
    queryFn: () => api.get<DealSummaryMeta[]>(`/deals/${dealId}/summaries`),
    enabled: !!dealId,
    ...options,
  })
}

export function useGetDealSummaryLatest(
  dealId: string | undefined,
  latestFilename: string | undefined,
  options?: Partial<UseQueryOptions<DealSummaryFull>>,
) {
  return useQuery<DealSummaryFull>({
    queryKey: ['deals', dealId, 'summaries', latestFilename] as const,
    queryFn: () => api.get<DealSummaryFull>(`/deals/${dealId}/summaries/${latestFilename}`),
    enabled: !!dealId && !!latestFilename,
    ...options,
  })
}

export function useGetContactNotes(
  contactId: string | null,
  options?: Partial<UseQueryOptions<ContactNotesResponse>>,
) {
  return useQuery<ContactNotesResponse>({
    queryKey: queryKeys.contacts.notes(contactId ?? ''),
    queryFn: () => api.get<ContactNotesResponse>(`/contacts/${contactId}/notes`),
    enabled: !!contactId,
    ...options,
  })
}

// ─── Users ────────────────────────────────────────────────────────────────────

export function useGetUsers(
  options?: Partial<UseQueryOptions<ApiUser[]>>,
) {
  return useQuery<ApiUser[]>({
    queryKey: queryKeys.users.all,
    queryFn: () => api.get<ApiUser[]>('/users'),
    ...options,
  })
}

// ─── Pipeline ────────────────────────────────────────────────────────────────

export function useGetPipelineSummary(
  options?: Partial<UseQueryOptions<PipelineSummary>>,
) {
  return useQuery<PipelineSummary>({
    queryKey: queryKeys.pipeline.summary,
    queryFn: () => api.get<PipelineSummary>('/pipeline/summary'),
    ...options,
  })
}

export function useGetFunnel(
  params?: { from?: string; to?: string },
  options?: Partial<UseQueryOptions<FunnelResponse>>,
) {
  const hasFilter = params?.from || params?.to
  return useQuery<FunnelResponse>({
    queryKey: hasFilter
      ? queryKeys.pipeline.funnelFiltered(params!)
      : queryKeys.pipeline.funnel,
    queryFn: () => api.get<FunnelResponse>('/pipeline/funnel', params ?? {}),
    ...options,
  })
}

// ─── Activities ───────────────────────────────────────────────────────────────

export function useGetActivitiesByDeal(
  dealId: string,
  options?: Partial<UseQueryOptions<Activity[]>>,
) {
  return useQuery<Activity[]>({
    queryKey: queryKeys.activities.byDeal(dealId),
    queryFn: () => api.get<Activity[]>('/activities', { dealId, limit: 30 }),
    enabled: !!dealId,
    ...options,
  })
}

export function useGetActivitiesByCompany(
  companyId: string,
  options?: Partial<UseQueryOptions<Activity[]>>,
) {
  return useQuery<Activity[]>({
    queryKey: queryKeys.activities.byCompany(companyId),
    queryFn: () => api.get<Activity[]>('/activities', { companyId, limit: 30 }),
    enabled: !!companyId,
    ...options,
  })
}

// ─── Billing ─────────────────────────────────────────────────────────────────

export function useGetBillingByDeal(
  dealId: string | undefined,
  options?: Partial<UseQueryOptions<ApiBilling | null>>,
) {
  return useQuery<ApiBilling | null>({
    queryKey: queryKeys.billing.byDeal(dealId ?? ''),
    queryFn: async () => {
      const res = await api.get<ApiBilling | { billing: null }>(`/deals/${dealId}/billing`)
      if ('billing' in res && res.billing === null) return null
      return res as ApiBilling
    },
    enabled: !!dealId,
    ...options,
  })
}

// ─── Documents ────────────────────────────────────────────────────────────────

export function useGetDocumentsByDeal(
  dealId: string | undefined,
  options?: Partial<UseQueryOptions<ApiDocument[]>>,
) {
  return useQuery<ApiDocument[]>({
    queryKey: queryKeys.documents.byDeal(dealId ?? ''),
    queryFn: () => api.get<ApiDocument[]>('/documents', { dealId }),
    enabled: !!dealId,
    ...options,
  })
}

export function useGetProposals(
  options?: Partial<UseQueryOptions<ApiDocument[]>>,
) {
  return useQuery<ApiDocument[]>({
    queryKey: queryKeys.documents.proposals,
    queryFn: () => api.get<ApiDocument[]>('/documents', { type: 'proposal' }),
    ...options,
  })
}

export function useGetDocumentContent(
  id: string | null,
  options?: Partial<UseQueryOptions<{ content: string }>>,
) {
  return useQuery<{ content: string }>({
    queryKey: queryKeys.documents.content(id ?? ''),
    queryFn: () => api.get<{ content: string }>(`/documents/${id}/content`),
    enabled: !!id,
    ...options,
  })
}

export function useGetDocumentPreview(
  id: string | null,
  options?: Partial<UseQueryOptions<{ url: string; mimeType: string }>>,
) {
  return useQuery<{ url: string; mimeType: string }>({
    queryKey: queryKeys.documents.preview(id ?? ''),
    queryFn: () => api.get<{ url: string; mimeType: string }>(`/documents/${id}/preview`),
    enabled: !!id,
    // URL expires in 60 min — re-fetch after 50 min
    staleTime: 50 * 60 * 1000,
    ...options,
  })
}

// ─── Audit Logs ───────────────────────────────────────────────────────────────

export type AuditFilterParams = {
  entityType?: string
  action?: string
  performedBy?: string
  limit: number
  offset: number
}

export function useGetAuditLogs(
  params: AuditFilterParams,
  options?: Partial<UseQueryOptions<AuditLogsResponse>>,
) {
  return useQuery<AuditLogsResponse>({
    queryKey: queryKeys.audit.filtered(params),
    queryFn: () => api.get<AuditLogsResponse>('/audit-logs', params as Record<string, string | number>),
    ...options,
  })
}

// ─── Calendar ─────────────────────────────────────────────────────────────────

export function useGetCalendarStatus(
  options?: Partial<UseQueryOptions<CalendarStatus>>,
) {
  return useQuery<CalendarStatus>({
    queryKey: queryKeys.calendar.status,
    queryFn: () => api.get<CalendarStatus>('/auth/google-calendar/status'),
    ...options,
  })
}

export function useGetCalendarEvents(
  params: { from: string; to: string; dealId?: string },
  options?: Partial<UseQueryOptions<ApiCalendarEvent[]>>,
) {
  return useQuery<ApiCalendarEvent[]>({
    queryKey: queryKeys.calendar.events(params),
    queryFn: () => api.get<ApiCalendarEvent[]>('/calendar/events', params),
    ...options,
  })
}

export function useGetTeamDemos(
  params: { from?: string; to?: string },
  options?: Partial<UseQueryOptions<ApiTeamDemoEvent[]>>,
) {
  return useQuery<ApiTeamDemoEvent[]>({
    queryKey: queryKeys.calendar.teamDemos(params),
    queryFn: () => api.get<ApiTeamDemoEvent[]>('/calendar/team-demos', params),
    ...options,
  })
}

// ─── Gmail / Inbox ────────────────────────────────────────────────────────────

export function useGetInbox(
  userId: string | null | undefined,
  options?: Partial<UseQueryOptions<InboxResponse>>,
) {
  return useQuery<InboxResponse>({
    queryKey: [...queryKeys.gmail.inbox, userId],
    queryFn: () => api.get<InboxResponse>('/gmail/inbox'),
    staleTime: 5 * 60 * 1000,
    retry: false,
    enabled: !!userId,
    ...options,
  })
}

export function useGetGmailUser(
  userId: string | null | undefined,
  options?: Partial<UseQueryOptions<{ email: string | null; needsReconnect?: boolean }>>,
) {
  return useQuery<{ email: string | null; needsReconnect?: boolean }>({
    queryKey: [...queryKeys.gmail.user, userId],
    queryFn: () => api.get<{ email: string | null; needsReconnect?: boolean }>('/gmail/user'),
    staleTime: 60 * 60 * 1000, // 1 hour
    retry: false,
    enabled: !!userId,
    ...options,
  })
}

// ─── Products & Tiers ─────────────────────────────────────────────────────────

export function useGetProducts(
  options?: Partial<UseQueryOptions<ApiProduct[]>>,
) {
  return useQuery<ApiProduct[]>({
    queryKey: queryKeys.products.all,
    queryFn: () => api.get<ApiProduct[]>('/products'),
    staleTime: Infinity,
    ...options,
  })
}

export function useGetTiers(
  options?: Partial<UseQueryOptions<ApiTier[]>>,
) {
  return useQuery<ApiTier[]>({
    queryKey: queryKeys.tiers.all,
    queryFn: () => api.get<ApiTier[]>('/tiers'),
    staleTime: Infinity,
    ...options,
  })
}

// ─── Notifications ───────────────────────────────────────────────────────────

export function useGetNotifications(
  options?: Partial<UseQueryOptions<ApiNotification[]>>,
) {
  return useQuery<ApiNotification[]>({
    queryKey: queryKeys.notifications.all,
    queryFn: () => api.get<ApiNotification[]>('/notifications'),
    refetchInterval: 30_000,
    ...options,
  })
}

// ─── Chat Sessions ───────────────────────────────────────────────────────────

export type ApiChatSession = {
  id: string
  workspaceId: string
  userId: string
  title: string | null
  contextType: string | null
  contextId: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export function useGetChatSessions(
  userId: string | null | undefined,
  options?: Partial<UseQueryOptions<ApiChatSession[]>>,
) {
  return useQuery<ApiChatSession[]>({
    queryKey: queryKeys.chatSessions.byUser(userId ?? ''),
    queryFn: () => api.get<ApiChatSession[]>('/chat/sessions', { userId: userId! }),
    enabled: !!userId,
    refetchInterval: 30_000,
    ...options,
  })
}

export type ApiChatMessage = {
  id: string
  sessionId: string
  userId: string
  role: 'user' | 'assistant'
  content: string
  actionsTaken: unknown[]
  createdAt: string
}

export function useGetChatHistory(
  sessionId: string | null | undefined,
  options?: Partial<UseQueryOptions<ApiChatMessage[]>>,
) {
  return useQuery<ApiChatMessage[]>({
    queryKey: queryKeys.chatSessions.history(sessionId ?? ''),
    queryFn: () => api.get<ApiChatMessage[]>(`/chat/sessions/${sessionId}/history`),
    enabled: !!sessionId,
    ...options,
  })
}
