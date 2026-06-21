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
