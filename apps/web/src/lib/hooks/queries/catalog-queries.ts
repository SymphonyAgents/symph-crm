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

// ─── Catalog Items ───────────────────────────────────────────────────────────

export function useGetCatalogItems(
  opts: { activeOnly?: boolean; type?: 'internal' | 'service' | 'reseller' | 'partnership' } | boolean = false,
  options?: Partial<UseQueryOptions<ApiCatalogItem[]>>,
) {
  // Backwards-compat: callers passing `true` => activeOnly
  const normalized = typeof opts === 'boolean' ? { activeOnly: opts } : opts
  const { activeOnly, type } = normalized
  const params: Record<string, string> = {}
  if (activeOnly) params.active = 'true'
  if (type) params.type = type
  return useQuery<ApiCatalogItem[]>({
    queryKey: type
      ? [...queryKeys.catalogItems.all, { type, activeOnly: !!activeOnly }] as const
      : (activeOnly ? queryKeys.catalogItems.activeOnly : queryKeys.catalogItems.all),
    queryFn: () => api.get<ApiCatalogItem[]>('/catalog-items', Object.keys(params).length ? params : undefined),
    retry: false,
    ...options,
  })
}

export function useGetDocumentContent(
  id: string | null,
  options?: Partial<UseQueryOptions<{ content: string }>>,
) {
  return useQuery<{ content: string }>({
    queryKey: queryKeys.documents.content(id ?? ''),
    queryFn: () => api.get<{ content: string }>(`/documents/${id}/content`),
    enabled: !!id,
    ...options,
  })
}

export function useGetDocumentPreview(
  id: string | null,
  options?: Partial<UseQueryOptions<{ url: string; mimeType: string }>>,
) {
  return useQuery<{ url: string; mimeType: string }>({
    queryKey: queryKeys.documents.preview(id ?? ''),
    queryFn: () => api.get<{ url: string; mimeType: string }>(`/documents/${id}/preview`),
    enabled: !!id,
    // URL expires in 60 min — re-fetch after 50 min
    staleTime: 50 * 60 * 1000,
    ...options,
  })
}
