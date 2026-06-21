import { useMutation, useQueryClient, type UseMutationOptions } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { queryKeys } from '@/lib/query-keys'
import type { ApiCatalogItem } from '@/lib/types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function withToast(
  label: string,
  options?: UseMutationOptions<any, Error, any>,
): Partial<UseMutationOptions<any, Error, any>> {
  return {
    ...options,
    onSuccess: (...args: any[]) => {
      toast.success(label)
      ;(options?.onSuccess as any)?.(...args)
    },
    onError: (error: Error, ...rest: any[]) => {
      toast.error(error.message || `${label} failed`)
      ;(options?.onError as any)?.(error, ...rest)
    },
  }
}

// ─── Catalog Item mutations ──────────────────────────────────────────────────

export type CreateCatalogItemInput = {
  productType?: 'internal' | 'service' | 'reseller' | 'partnership'
  slug?: string | null
  name: string
  industry?: string | null
  landingPageLink?: string | null
  iconUrl?: string | null
  isActive?: boolean
}

export type UpdateCatalogItemInput = Partial<CreateCatalogItemInput>

export function useCreateCatalogItem(
  options?: UseMutationOptions<ApiCatalogItem, Error, CreateCatalogItemInput>,
) {
  return useMutation<ApiCatalogItem, Error, CreateCatalogItemInput>({
    mutationFn: (input) => api.post<ApiCatalogItem>('/catalog-items', input),
    ...withToast('Product created', options),
  })
}

export function useUpdateCatalogItem(
  options?: UseMutationOptions<ApiCatalogItem, Error, { id: string; data: UpdateCatalogItemInput }>,
) {
  return useMutation<ApiCatalogItem, Error, { id: string; data: UpdateCatalogItemInput }>({
    mutationFn: ({ id, data }) => api.patch<ApiCatalogItem>(`/catalog-items/${id}`, data),
    ...withToast('Product updated', options),
  })
}

export function useDeleteCatalogItem(
  options?: UseMutationOptions<void, Error, string>,
) {
  return useMutation<void, Error, string>({
    mutationFn: (id: string) => api.delete(`/catalog-items/${id}`),
    ...withToast('Product deleted', options),
  })
}

export function useUploadCatalogItemIcon(
  options?: UseMutationOptions<ApiCatalogItem, Error, { id: string; file: File }>,
) {
  const qc = useQueryClient()
  return useMutation<ApiCatalogItem, Error, { id: string; file: File }>({
    mutationFn: async ({ id, file }) => {
      const fd = new FormData()
      fd.append('icon', file)
      return api.upload<ApiCatalogItem>(`/catalog-items/${id}/icon`, fd)
    },
    ...withToast('Icon uploaded', {
      ...options,
      onSuccess: (data, vars, ctx) => {
        // Refresh both the list (catalog page) and any single-row caches so
        // the new public icon URL renders immediately.
        qc.invalidateQueries({ queryKey: queryKeys.catalogItems.all })
        ;(options?.onSuccess as any)?.(data, vars, ctx)
      },
    }),
  })
}
