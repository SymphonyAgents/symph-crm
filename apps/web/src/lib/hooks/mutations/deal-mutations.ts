import { useMutation, useQueryClient, type UseMutationOptions } from '@tanstack/react-query'
import { PartnerCommissionStatus } from '@symph-crm/shared'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { queryKeys } from '@/lib/query-keys'
import type { DealCurrency } from '@/lib/types'

export type CreateDealInput = {
  title: string
  companyId: string | null
  productId?: string | null
  tierId?: string | null
  stage?: string
  value?: string | null
  currency?: DealCurrency
  outreachCategory?: string | null
  pricingModel?: string | null
  servicesTags?: string[]
  assignedTo?: string | null
  subAccountManagerId?: string | null
  builders?: string[]
  partnerGroupIds?: string[]
  partnerDealGroupIds?: string[]
  catalogItemId?: string | null
  createdBy?: string | null
  closeDate?: string | null
  dealType?: string
  costPrice?: string | null
  marginPercent?: string | null
}

export type UpdateDealInput = Partial<Omit<CreateDealInput, 'companyId' | 'productId' | 'tierId'>> & {
  companyId?: string | null
  partnerGroupIds?: string[]
  partnerDealGroupIds?: string[]
}

export type UpdatePartnerDealCommissionInput = {
  dealId: string
  partnerDealGroupId: string
  commissionAmount: string | null
  commissionStatus: PartnerCommissionStatus
  notes?: string | null
}

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

export function useCreateDeal(
  options?: UseMutationOptions<unknown, Error, CreateDealInput>,
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateDealInput) => api.post('/deals', input),
    ...withToast('Deal created', {
      ...options,
      onSuccess: (data, vars, ctx) => {
        qc.invalidateQueries({ queryKey: queryKeys.deals.all })
        ;(options?.onSuccess as any)?.(data, vars, ctx)
      },
    }),
  })
}

export function useUpdateDeal(
  options?: UseMutationOptions<unknown, Error, { id: string; data: UpdateDealInput }>,
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }) => api.put(`/deals/${id}`, data),
    ...withToast('Deal updated', {
      ...options,
      onSuccess: (data, vars, ctx) => {
        qc.invalidateQueries({ queryKey: queryKeys.deals.all })
        qc.invalidateQueries({ queryKey: queryKeys.deals.detail(vars.id) })
        qc.invalidateQueries({ queryKey: queryKeys.pipeline.summary })
        ;(options?.onSuccess as any)?.(data, vars, ctx)
      },
    }),
  })
}

export function useUpdatePartnerDealCommission(
  options?: UseMutationOptions<unknown, Error, UpdatePartnerDealCommissionInput>,
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ dealId, partnerDealGroupId, ...data }: UpdatePartnerDealCommissionInput) => (
      api.patch(`/deals/${dealId}/partner-commissions/${partnerDealGroupId}`, data)
    ),
    ...withToast('Commission updated', {
      ...options,
      onSuccess: (data, vars, ctx) => {
        qc.invalidateQueries({ queryKey: queryKeys.deals.all })
        qc.invalidateQueries({ queryKey: queryKeys.deals.detail(vars.dealId) })
        ;(options?.onSuccess as any)?.(data, vars, ctx)
      },
    }),
  })
}

// No static toast; callers provide deal-specific stage transition text.
export function usePatchDealStage(
  options?: UseMutationOptions<unknown, Error, { id: string; stage: string }>,
) {
  return useMutation({
    mutationFn: ({ id, stage }) => api.patch(`/deals/${id}/stage`, { stage }),
    ...options,
    onError: (error: Error, vars: { id: string; stage: string }, ctx: unknown) => {
      toast.error(error.message || 'Stage update failed')
      ;(options?.onError as (e: Error, v: { id: string; stage: string }, c: unknown) => void)?.(error, vars, ctx)
    },
  })
}

export function useDeleteDeal(
  options?: UseMutationOptions<void, Error, string>,
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/deals/${id}`),
    ...withToast('Deal moved to trash', {
      ...options,
      onSuccess: (data, vars, ctx) => {
        qc.invalidateQueries({ queryKey: queryKeys.deals.all })
        qc.invalidateQueries({ queryKey: queryKeys.deals.trash })
        qc.invalidateQueries({ queryKey: queryKeys.pipeline.summary })
        ;(options?.onSuccess as any)?.(data, vars, ctx)
      },
    }),
  })
}

export function useRestoreDeal(
  options?: UseMutationOptions<unknown, Error, string>,
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.post(`/deals/${id}/restore`, {}),
    ...withToast('Deal restored', {
      ...options,
      onSuccess: (data, vars, ctx) => {
        qc.invalidateQueries({ queryKey: queryKeys.deals.all })
        qc.invalidateQueries({ queryKey: queryKeys.deals.trash })
        qc.invalidateQueries({ queryKey: queryKeys.pipeline.summary })
        ;(options?.onSuccess as any)?.(data, vars, ctx)
      },
    }),
  })
}

export function usePermanentlyDeleteDeal(
  options?: UseMutationOptions<void, Error, string>,
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/deals/${id}/permanent`),
    ...withToast('Deal permanently deleted', {
      ...options,
      onSuccess: (data, vars, ctx) => {
        qc.invalidateQueries({ queryKey: queryKeys.deals.all })
        qc.invalidateQueries({ queryKey: queryKeys.deals.trash })
        qc.invalidateQueries({ queryKey: queryKeys.pipeline.summary })
        ;(options?.onSuccess as any)?.(data, vars, ctx)
      },
    }),
  })
}

export function useAssignDealBrand(
  options?: UseMutationOptions<unknown, Error, { id: string; companyId: string | null }>,
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, companyId }) => api.put(`/deals/${id}`, { companyId }),
    ...withToast('Brand assigned', {
      ...options,
      onSuccess: (data, vars, ctx) => {
        qc.invalidateQueries({ queryKey: queryKeys.deals.all })
        qc.invalidateQueries({ queryKey: queryKeys.deals.detail(vars.id) })
        qc.invalidateQueries({ queryKey: queryKeys.pipeline.summary })
        qc.invalidateQueries({ queryKey: queryKeys.companies.all })
        if (vars.companyId) qc.invalidateQueries({ queryKey: queryKeys.companies.deals(vars.companyId) })
        ;(options?.onSuccess as any)?.(data, vars, ctx)
      },
    }),
  })
}
