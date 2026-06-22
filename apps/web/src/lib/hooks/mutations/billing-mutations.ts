import { useMutation, type UseMutationOptions } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import type { ApiBilling, ApiBillingMilestone } from '@/lib/types'

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

// ─── Billing mutations ───────────────────────────────────────────────────────

export type UpsertBillingInput = {
  billingType: 'annual' | 'monthly' | 'milestone'
  contractStart?: string | null
  contractEnd?: string | null
  amount?: string | null
}

export function useUpsertBilling(
  options?: UseMutationOptions<ApiBilling, Error, { dealId: string; data: UpsertBillingInput }>,
) {
  return useMutation<ApiBilling, Error, { dealId: string; data: UpsertBillingInput }>({
    mutationFn: ({ dealId, data }) => api.put<ApiBilling>(`/deals/${dealId}/billing`, data),
    ...withToast('Billing saved', options),
  })
}

export function useAddMilestone(
  options?: UseMutationOptions<ApiBillingMilestone, Error, { dealId: string; data: { name: string; amount: string; sortOrder?: number } }>,
) {
  return useMutation<ApiBillingMilestone, Error, { dealId: string; data: { name: string; amount: string; sortOrder?: number } }>({
    mutationFn: ({ dealId, data }) => api.post<ApiBillingMilestone>(`/deals/${dealId}/billing/milestones`, data),
    ...withToast('Milestone added', options),
  })
}

export function useUpdateMilestone(
  options?: UseMutationOptions<ApiBillingMilestone, Error, { dealId: string; milestoneId: string; data: Record<string, unknown> }>,
) {
  return useMutation<ApiBillingMilestone, Error, { dealId: string; milestoneId: string; data: Record<string, unknown> }>({
    mutationFn: ({ dealId, milestoneId, data }) =>
      api.put<ApiBillingMilestone>(`/deals/${dealId}/billing/milestones/${milestoneId}`, data),
    ...withToast('Milestone updated', options),
  })
}

export function useDeleteBilling(
  options?: UseMutationOptions<void, Error, string>,
) {
  return useMutation<void, Error, string>({
    mutationFn: (dealId: string) => api.delete<void>(`/deals/${dealId}/billing`),
    ...withToast('Billing deleted', options),
  })
}

export function useDeleteMilestone(
  options?: UseMutationOptions<void, Error, { dealId: string; milestoneId: string }>,
) {
  return useMutation<void, Error, { dealId: string; milestoneId: string }>({
    mutationFn: ({ dealId, milestoneId }) =>
      api.delete<void>(`/deals/${dealId}/billing/milestones/${milestoneId}`),
    ...withToast('Milestone removed', options),
  })
}
