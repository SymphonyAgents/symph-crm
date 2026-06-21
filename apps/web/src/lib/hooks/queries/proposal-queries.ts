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

// ─── Proposals ───────────────────────────────────────────────────────────────

// Workspace-wide proposal list for the /proposals index page.
export function useGetAllProposals(
  options?: Partial<UseQueryOptions<ApiProposalSummary[]>>,
) {
  return useQuery<ApiProposalSummary[]>({
    queryKey: queryKeys.proposals.all,
    queryFn: () => api.get<ApiProposalSummary[]>('/proposals'),
    ...options,
  })
}

export function useGetProposalsByDeal(
  dealId: string | undefined,
  options?: Partial<UseQueryOptions<ApiProposalListItem[]>>,
) {
  return useQuery<ApiProposalListItem[]>({
    queryKey: queryKeys.proposals.byDeal(dealId ?? ""),
    queryFn: () => api.get<ApiProposalListItem[]>(`/deals/${dealId}/proposals`),
    enabled: !!dealId,
    ...options,
  })
}

export function useGetProposalHead(
  proposalId: string | undefined,
  options?: Partial<UseQueryOptions<ApiProposalHead>>,
) {
  return useQuery<ApiProposalHead>({
    queryKey: queryKeys.proposals.detail(proposalId ?? ""),
    queryFn: () => api.get<ApiProposalHead>(`/proposals/${proposalId}`),
    enabled: !!proposalId,
    ...options,
  })
}

export function useGetProposalVersions(
  proposalId: string | undefined,
  options?: Partial<UseQueryOptions<ApiProposalVersion[]>>,
) {
  return useQuery<ApiProposalVersion[]>({
    queryKey: queryKeys.proposals.versions(proposalId ?? ""),
    queryFn: () => api.get<ApiProposalVersion[]>(`/proposals/${proposalId}/versions`),
    enabled: !!proposalId,
    ...options,
  })
}

export function useGetProposalVersion(
  proposalId: string | undefined,
  versionId: string | undefined,
  options?: Partial<UseQueryOptions<ApiProposalVersion>>,
) {
  return useQuery<ApiProposalVersion>({
    queryKey: queryKeys.proposals.version(proposalId ?? "", versionId ?? ""),
    queryFn: () => api.get<ApiProposalVersion>(`/proposals/${proposalId}/versions/${versionId}`),
    enabled: !!proposalId && !!versionId,
    ...options,
  })
}

export function useGetProposalShares(
  proposalId: string | undefined,
  options?: Partial<UseQueryOptions<ApiProposalShareLink[]>>,
) {
  return useQuery<ApiProposalShareLink[]>({
    queryKey: queryKeys.proposals.shares(proposalId ?? ""),
    queryFn: () => api.get<ApiProposalShareLink[]>(`/proposals/${proposalId}/shares`),
    enabled: !!proposalId,
    ...options,
  })
}

export type SignedPdfResponse = {
  url: string
  fileName: string | null
  storagePath: string
  dealId: string | null
  proposalId: string
  slug: string | null
}

export function useGetSignedProposalPdf(
  proposalId: string | undefined,
  options?: Partial<UseQueryOptions<SignedPdfResponse>>,
) {
  return useQuery<SignedPdfResponse>({
    queryKey: queryKeys.proposals.signedPdf(proposalId ?? ''),
    queryFn: () => api.get<SignedPdfResponse>(`/proposals/${proposalId}/signed-pdf`),
    enabled: !!proposalId,
    retry: false,
    ...options,
  })
}
