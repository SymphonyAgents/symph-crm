import { useQuery, type UseQueryOptions } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { queryKeys } from '@/lib/query-keys'
import type { ApiDeal, ApiDealDetail, DealNotesResponse, DealSummaryMeta, DealSummaryFull, NfsDealNote } from '@/lib/types'


// ─── Deals ────────────────────────────────────────────────────────────────────

export function useGetDeals(
  params?: { dealType?: string },
  options?: Partial<UseQueryOptions<ApiDeal[]>>,
) {
  const { dealType } = params ?? {}
  return useQuery<ApiDeal[]>({
    queryKey: dealType ? queryKeys.deals.byType(dealType) : queryKeys.deals.all,
    queryFn: () => api.get<ApiDeal[]>('/deals', dealType ? { dealType } : undefined),
    ...options,
  })
}

export function useGetTrashedDeals(
  options?: Partial<UseQueryOptions<ApiDeal[]>>,
) {
  return useQuery<ApiDeal[]>({
    queryKey: queryKeys.deals.trash,
    queryFn: () => api.get<ApiDeal[]>('/deals/trash'),
    ...options,
  })
}

export function useGetDeal(
  id: string,
  options?: Partial<UseQueryOptions<ApiDealDetail>>,
) {
  return useQuery<ApiDealDetail>({
    queryKey: queryKeys.deals.detail(id),
    queryFn: () => api.get<ApiDealDetail>(`/deals/${id}`),
    retry: false,
    ...options,
  })
}

export function getDealNotesQueryOptions(dealId: string | null, enabled = !!dealId) {
  return {
    queryKey: queryKeys.deals.notes(dealId ?? ''),
    queryFn: () => api.get<DealNotesResponse>(`/deals/${dealId}/notes`),
    enabled,
  }
}

export function useGetDealNotes(
  dealId: string | null,
  options?: Partial<UseQueryOptions<DealNotesResponse>>,
) {
  return useQuery<DealNotesResponse>({
    ...getDealNotesQueryOptions(dealId),
    ...options,
  })
}

export function useGetDealNotesFlat(
  dealId: string | undefined,
  options?: Partial<UseQueryOptions<NfsDealNote[]>>,
) {
  return useQuery<NfsDealNote[]>({
    queryKey: queryKeys.deals.notesFlat(dealId ?? ''),
    queryFn: () => api.get<NfsDealNote[]>(`/deals/${dealId}/notes/flat`),
    enabled: !!dealId,
    ...options,
  })
}

export function useGetDealSummaries(
  dealId: string | undefined,
  options?: Partial<UseQueryOptions<DealSummaryMeta[]>>,
) {
  return useQuery<DealSummaryMeta[]>({
    queryKey: queryKeys.deals.summaries(dealId ?? ''),
    queryFn: () => api.get<DealSummaryMeta[]>(`/deals/${dealId}/summaries`),
    enabled: !!dealId,
    ...options,
  })
}

export function useGetDealSummaryLatest(
  dealId: string | undefined,
  latestFilename: string | undefined,
  options?: Partial<UseQueryOptions<DealSummaryFull>>,
) {
  return useQuery<DealSummaryFull>({
    queryKey: ['deals', dealId, 'summaries', latestFilename] as const,
    queryFn: () => api.get<DealSummaryFull>(`/deals/${dealId}/summaries/${latestFilename}`),
    enabled: !!dealId && !!latestFilename,
    ...options,
  })
}
