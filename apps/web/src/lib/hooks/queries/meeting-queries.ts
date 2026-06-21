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

// ─── Meetings ────────────────────────────────────────────────────────────────

export function useGetMeetings(params?: { status?: 'pending' | 'done' | 'failed'; dealId?: string; limit?: number }) {
  const query = params ?? {}
  return useQuery<ApiMeetingListItem[]>({
    queryKey: queryKeys.meetings.filtered(query),
    queryFn: () => api.get<ApiMeetingListItem[]>('/meetings', query),
    staleTime: 30_000,
  })
}

export function useGetMeeting(id: string | null | undefined) {
  return useQuery<ApiMeetingDetail>({
    queryKey: queryKeys.meetings.detail(id ?? ''),
    queryFn: () => api.get<ApiMeetingDetail>(`/meetings/${id}`),
    enabled: !!id,
    staleTime: 30_000,
  })
}
