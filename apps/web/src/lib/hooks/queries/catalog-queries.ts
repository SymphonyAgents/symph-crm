import { useQuery, type UseQueryOptions } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { queryKeys } from '@/lib/query-keys'
import type { ApiCatalogItem } from '@/lib/types'


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
