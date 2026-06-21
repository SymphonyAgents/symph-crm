import { useMutation, useQueryClient, type UseMutationOptions } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { queryKeys } from '@/lib/query-keys'
import type { ApiCompany } from '@/lib/types'

export type CreateCompanyInput = {
  name: string
  domain?: string | null
  industry?: string | null
  website?: string | null
  hqLocation?: string | null
  description?: string | null
}

export type UpdateCompanyInput = Partial<CreateCompanyInput>

// Wraps mutation options to inject toast before caller callbacks.
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

export function useCreateCompany(
  options?: UseMutationOptions<ApiCompany, Error, CreateCompanyInput>,
) {
  const qc = useQueryClient()
  return useMutation<ApiCompany, Error, CreateCompanyInput>({
    mutationFn: (input: CreateCompanyInput) => api.post<ApiCompany>('/companies', input),
    ...withToast('Brand created', {
      ...options,
      onSuccess: (data, vars, ctx) => {
        qc.invalidateQueries({ queryKey: queryKeys.companies.all })
        ;(options?.onSuccess as any)?.(data, vars, ctx)
      },
    }),
  })
}

export function useUpdateCompany(
  options?: UseMutationOptions<unknown, Error, { id: string; data: UpdateCompanyInput }>,
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }) => api.put(`/companies/${id}`, data),
    ...withToast('Brand updated', {
      ...options,
      onSuccess: (data, vars, ctx) => {
        qc.invalidateQueries({ queryKey: queryKeys.companies.all })
        qc.invalidateQueries({ queryKey: queryKeys.deals.all })
        ;(options?.onSuccess as any)?.(data, vars, ctx)
      },
    }),
  })
}

export function useDeleteCompany(
  options?: UseMutationOptions<void, Error, string>,
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/companies/${id}`),
    ...withToast('Brand deleted', {
      ...options,
      onSuccess: (data, vars, ctx) => {
        qc.invalidateQueries({ queryKey: queryKeys.companies.all })
        qc.invalidateQueries({ queryKey: queryKeys.deals.all })
        ;(options?.onSuccess as any)?.(data, vars, ctx)
      },
    }),
  })
}
