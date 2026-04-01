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
  AuditLogsResponse,
  ApiCalendarEvent,
  CalendarStatus,
  InboxResponse,
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
