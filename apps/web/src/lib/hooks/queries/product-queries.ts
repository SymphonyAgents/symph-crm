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
