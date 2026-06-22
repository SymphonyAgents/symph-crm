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
