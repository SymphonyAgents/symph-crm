import { useMutation, useQueryClient, type UseMutationOptions } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { queryKeys } from '@/lib/query-keys'
import type { ApiMeeting, ApiMeetingActionResult } from '@/lib/types'

export function useRetryMeetingIngest(
  options?: UseMutationOptions<unknown, Error, string>,
) {
  const qc = useQueryClient()
  return useMutation<unknown, Error, string>({
    mutationFn: (id: string) => api.post(`/meetings/${id}/retry-ingest`, {}),
    ...options,
    onSuccess: (...args) => {
      qc.invalidateQueries({ queryKey: queryKeys.meetings.all })
      toast.success('Meeting ingest retried')
      ;(options?.onSuccess as ((...a: unknown[]) => void) | undefined)?.(...args)
    },
    onError: (error, ...rest) => {
      toast.error(error.message || 'Meeting retry failed')
      ;(options?.onError as ((error: Error, ...a: unknown[]) => void) | undefined)?.(error, ...rest)
    },
  })
}

export function useDeleteMeeting(
  options?: UseMutationOptions<{ ok: boolean }, Error, string>,
) {
  const qc = useQueryClient()
  return useMutation<{ ok: boolean }, Error, string>({
    ...options,
    mutationFn: (id: string) => api.delete<{ ok: boolean }>(`/meetings/${id}`),
    onSuccess: (...args) => {
      const [, id] = args
      qc.invalidateQueries({ queryKey: queryKeys.meetings.all })
      if (typeof id === 'string') qc.invalidateQueries({ queryKey: queryKeys.meetings.detail(id) })
      toast.success('Meeting deleted')
      ;(options?.onSuccess as ((...a: unknown[]) => void) | undefined)?.(...args)
    },
    onError: (error, ...rest) => {
      toast.error(error.message || 'Meeting deletion failed')
      ;(options?.onError as ((error: Error, ...a: unknown[]) => void) | undefined)?.(error, ...rest)
    },
  })
}

export function useAssignMeetingDeal(
  options?: UseMutationOptions<{ ok: boolean; meeting: ApiMeeting }, Error, { id: string; dealId: string }>,
) {
  const qc = useQueryClient()
  return useMutation<{ ok: boolean; meeting: ApiMeeting }, Error, { id: string; dealId: string }>({
    mutationFn: ({ id, dealId }) => api.post<{ ok: boolean; meeting: ApiMeeting }>(`/meetings/${id}/assign-deal`, { dealId }),
    ...options,
    onSuccess: (...args) => {
      const [, variables] = args
      qc.invalidateQueries({ queryKey: queryKeys.meetings.all })
      if (variables && typeof variables === 'object' && 'id' in variables) {
        qc.invalidateQueries({ queryKey: queryKeys.meetings.detail(String(variables.id)) })
      }
      toast.success('Meeting assigned')
      ;(options?.onSuccess as ((...a: unknown[]) => void) | undefined)?.(...args)
    },
    onError: (error, ...rest) => {
      toast.error(error.message || 'Meeting assignment failed')
      ;(options?.onError as ((error: Error, ...a: unknown[]) => void) | undefined)?.(error, ...rest)
    },
  })
}

export type CreateMeetingActionPackageInput = {
  id: string
  dealId?: string | null
  createDraft?: boolean
  createReminder?: boolean
  reminderAt?: string | null
}

export function useCreateMeetingActionPackage(
  options?: UseMutationOptions<ApiMeetingActionResult, Error, CreateMeetingActionPackageInput>,
) {
  const qc = useQueryClient()
  return useMutation<ApiMeetingActionResult, Error, CreateMeetingActionPackageInput>({
    ...options,
    mutationFn: ({ id, ...body }) => api.post<ApiMeetingActionResult>(`/meetings/${id}/action-package`, body),
    onSuccess: (...args) => {
      const [result, variables] = args
      qc.invalidateQueries({ queryKey: queryKeys.meetings.all })
      qc.invalidateQueries({ queryKey: queryKeys.meetings.detail(variables.id) })
      const dealId = result.actionPackage.confirmedDealId ?? variables.dealId
      if (dealId) {
        qc.invalidateQueries({ queryKey: queryKeys.deals.notesFlat(dealId) })
        qc.invalidateQueries({ queryKey: queryKeys.deals.detail(dealId) })
      }
      toast.success(result.status === 'needs_deal_review' ? 'Meeting needs deal review' : 'Meeting action package generated')
      ;(options?.onSuccess as ((...a: unknown[]) => void) | undefined)?.(...args)
    },
    onError: (error, ...rest) => {
      toast.error(error.message || 'Meeting action package failed')
      ;(options?.onError as ((error: Error, ...a: unknown[]) => void) | undefined)?.(error, ...rest)
    },
  })
}
