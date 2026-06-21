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

// ─── Billing ─────────────────────────────────────────────────────────────────

export function getBillingByDealQueryOptions(dealId: string | undefined, enabled = !!dealId) {
  return {
    queryKey: queryKeys.billing.byDeal(dealId ?? ''),
    queryFn: async () => {
      const res = await api.get<ApiBilling | { billing: null }>(`/deals/${dealId}/billing`)
      if ('billing' in res && res.billing === null) return null
      return res as ApiBilling
    },
    enabled,
  }
}

export function useGetBillingByDeal(
  dealId: string | undefined,
  options?: Partial<UseQueryOptions<ApiBilling | null>>,
) {
  return useQuery<ApiBilling | null>({
    ...getBillingByDealQueryOptions(dealId),
    ...options,
  })
}
