import { useMutation, useQueryClient, type UseMutationOptions } from '@tanstack/react-query'
import { CrmUserRole } from '@symph-crm/shared'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { queryKeys } from '@/lib/query-keys'
import type { ApiPartnerDealGroup } from '@/lib/types'

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

// ─── User management ─────────────────────────────────────────────────────────

export function useApproveExternalUser(
  options?: UseMutationOptions<void, Error, { id: string; partnerGroupIds?: string[]; partnerDealGroupIds?: string[] }>,
) {
  const qc = useQueryClient()
  return useMutation<void, Error, { id: string; partnerGroupIds?: string[]; partnerDealGroupIds?: string[] }>({
    mutationFn: ({ id, partnerGroupIds = [], partnerDealGroupIds = [] }) => api.patch<void>(`/users/external/${id}/approve`, { partnerGroupIds, partnerDealGroupIds }),
    ...withToast('User approved', {
      ...options,
      onSuccess: (data, vars, ctx) => {
        qc.invalidateQueries({ queryKey: queryKeys.users.external })
        qc.invalidateQueries({ queryKey: queryKeys.partnerGroups.all })
        qc.invalidateQueries({ queryKey: queryKeys.partnerDealGroups.all })
        ;(options?.onSuccess as any)?.(data, vars, ctx)
      },
    }),
  })
}

export function useRejectExternalUser(
  options?: UseMutationOptions<void, Error, string>,
) {
  const qc = useQueryClient()
  return useMutation<void, Error, string>({
    mutationFn: (id: string) => api.patch<void>(`/users/external/${id}/reject`, {}),
    ...withToast('User rejected', {
      ...options,
      onSuccess: (data, vars, ctx) => {
        qc.invalidateQueries({ queryKey: queryKeys.users.external })
        ;(options?.onSuccess as any)?.(data, vars, ctx)
      },
    }),
  })
}

export function useUpdateExternalUserRole(
  options?: UseMutationOptions<void, Error, { id: string; role: CrmUserRole.Partner }>,
) {
  const qc = useQueryClient()
  return useMutation<void, Error, { id: string; role: CrmUserRole.Partner }>({
    mutationFn: ({ id, role }) => api.patch<void>(`/users/external/${id}/role`, { role }),
    ...withToast('Role updated', {
      ...options,
      onSuccess: (data, vars, ctx) => {
        qc.invalidateQueries({ queryKey: queryKeys.users.external })
        ;(options?.onSuccess as any)?.(data, vars, ctx)
      },
    }),
  })
}

export function useRemoveExternalUser(
  options?: UseMutationOptions<void, Error, string>,
) {
  const qc = useQueryClient()
  return useMutation<void, Error, string>({
    mutationFn: (id: string) => api.delete(`/users/external/${id}`),
    ...withToast('User removed', {
      ...options,
      onSuccess: (data, vars, ctx) => {
        qc.invalidateQueries({ queryKey: queryKeys.users.external })
        ;(options?.onSuccess as any)?.(data, vars, ctx)
      },
    }),
  })
}

export function useUpdatePartnerGroupMembers(
  options?: UseMutationOptions<void, Error, { id: string; memberUserIds: string[] }>,
) {
  const qc = useQueryClient()
  return useMutation<void, Error, { id: string; memberUserIds: string[] }>({
    mutationFn: ({ id, memberUserIds }) => api.patch<void>(`/partner-groups/${id}`, { memberUserIds }),
    ...withToast('Partner group updated', {
      ...options,
      onSuccess: (data, vars, ctx) => {
        qc.invalidateQueries({ queryKey: queryKeys.partnerGroups.all })
        qc.invalidateQueries({ queryKey: queryKeys.partnerGroups.detail(vars.id) })
        ;(options?.onSuccess as any)?.(data, vars, ctx)
      },
    }),
  })
}

export type UpsertPartnerDealGroupInput = {
  name: string
  slug?: string
  description?: string | null
  memberUserIds?: string[]
}

export function useCreatePartnerDealGroup(
  options?: UseMutationOptions<ApiPartnerDealGroup, Error, UpsertPartnerDealGroupInput>,
) {
  const qc = useQueryClient()
  return useMutation<ApiPartnerDealGroup, Error, UpsertPartnerDealGroupInput>({
    mutationFn: (input) => api.post<ApiPartnerDealGroup>('/partner-deal-groups', input),
    ...withToast('Partner deal group created', {
      ...options,
      onSuccess: (data, vars, ctx) => {
        qc.invalidateQueries({ queryKey: queryKeys.partnerDealGroups.all })
        ;(options?.onSuccess as any)?.(data, vars, ctx)
      },
    }),
  })
}

export function useUpdatePartnerDealGroup(
  options?: UseMutationOptions<ApiPartnerDealGroup, Error, { id: string; input: Partial<UpsertPartnerDealGroupInput> & { isActive?: boolean } }>,
) {
  const qc = useQueryClient()
  return useMutation<ApiPartnerDealGroup, Error, { id: string; input: Partial<UpsertPartnerDealGroupInput> & { isActive?: boolean } }>({
    mutationFn: ({ id, input }) => api.patch<ApiPartnerDealGroup>(`/partner-deal-groups/${id}`, input),
    ...withToast('Partner deal group updated', {
      ...options,
      onSuccess: (data, vars, ctx) => {
        qc.invalidateQueries({ queryKey: queryKeys.partnerDealGroups.all })
        qc.invalidateQueries({ queryKey: queryKeys.partnerDealGroups.detail(vars.id) })
        ;(options?.onSuccess as any)?.(data, vars, ctx)
      },
    }),
  })
}

export function useArchivePartnerDealGroup(
  options?: UseMutationOptions<{ id: string }, Error, string>,
) {
  const qc = useQueryClient()
  return useMutation<{ id: string }, Error, string>({
    mutationFn: (id) => api.delete<{ id: string }>(`/partner-deal-groups/${id}`),
    ...withToast('Partner deal group archived', {
      ...options,
      onSuccess: (data, vars, ctx) => {
        qc.invalidateQueries({ queryKey: queryKeys.partnerDealGroups.all })
        qc.invalidateQueries({ queryKey: queryKeys.partnerDealGroups.detail(vars) })
        ;(options?.onSuccess as any)?.(data, vars, ctx)
      },
    }),
  })
}
