import { useQuery, type UseQueryOptions } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { queryKeys } from '@/lib/query-keys'
import type {
  ApiDeal,
  ApiDealDetail,
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
  ApiCatalogItem,
  ApiProposalListItem,
  ApiProposalSummary,
  ApiProposalHead,
  ApiProposalVersion,
  ApiProposalShareLink,
  ApiRecording,
  ApiMeetingDetail,
  ApiMeetingListItem,
  ApiPartnerGroup,
  ApiPartnerDealGroup,
} from '@/lib/types'

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

export function useGetDashboardSummary(
  params: { from?: string; to?: string },
  options?: Partial<UseQueryOptions<PipelineSummary>>,
) {
  return useQuery<PipelineSummary>({
    queryKey: queryKeys.pipeline.summaryFiltered(params),
    queryFn: () => api.get<PipelineSummary>('/pipeline/summary', params),
    staleTime: 60_000,
    retry: false,
    ...options,
  })
}

export function useGetDashboardDeals(
  params: { from?: string; to?: string },
  options?: Partial<UseQueryOptions<ApiDeal[]>>,
) {
  return useQuery<ApiDeal[]>({
    queryKey: queryKeys.deals.filtered(params),
    queryFn: () => api.get<ApiDeal[]>('/deals', params),
    retry: false,
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
