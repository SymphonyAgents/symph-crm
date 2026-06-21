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

// ─── Documents ────────────────────────────────────────────────────────────────

export function getDocumentsByDealQueryOptions(dealId: string | undefined, enabled = !!dealId) {
  return {
    queryKey: queryKeys.documents.byDeal(dealId ?? ''),
    queryFn: () => api.get<ApiDocument[]>('/documents', { dealId }),
    enabled,
  }
}

export function useGetDocumentsByDeal(
  dealId: string | undefined,
  options?: Partial<UseQueryOptions<ApiDocument[]>>,
) {
  return useQuery<ApiDocument[]>({
    ...getDocumentsByDealQueryOptions(dealId),
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
