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
