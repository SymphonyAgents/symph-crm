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

export function useGetExternalUsers(
  options?: Partial<UseQueryOptions<ApiUser[]>>,
) {
  return useQuery<ApiUser[]>({
    queryKey: queryKeys.users.external,
    queryFn: () => api.get<ApiUser[]>('/users/external'),
    ...options,
  })
}
