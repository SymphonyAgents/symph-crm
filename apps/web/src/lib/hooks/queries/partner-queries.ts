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

// ─── Partner Groups ─────────────────────────────────────────────────────────

export function useGetPartnerGroups(
  options?: Partial<UseQueryOptions<ApiPartnerGroup[]>>,
) {
  return useQuery<ApiPartnerGroup[]>({
    queryKey: queryKeys.partnerGroups.all,
    queryFn: () => api.get<ApiPartnerGroup[]>('/partner-groups'),
    ...options,
  })
}

export function useGetPartnerDealGroups(
  options?: Partial<UseQueryOptions<ApiPartnerDealGroup[]>>,
) {
  return useQuery<ApiPartnerDealGroup[]>({
    queryKey: queryKeys.partnerDealGroups.all,
    queryFn: () => api.get<ApiPartnerDealGroup[]>('/partner-deal-groups'),
    ...options,
  })
}

export function useGetMyPartnerDealGroups(
  options?: Partial<UseQueryOptions<ApiPartnerDealGroup[]>>,
) {
  return useQuery<ApiPartnerDealGroup[]>({
    queryKey: queryKeys.partnerDealGroups.me,
    queryFn: () => api.get<ApiPartnerDealGroup[]>('/partner-deal-groups/me'),
    ...options,
  })
}
