import { useQuery, type UseQueryOptions } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { queryKeys } from '@/lib/query-keys'
import type { ApiDocument } from '@/lib/types'


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
