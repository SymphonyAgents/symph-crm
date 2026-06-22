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
