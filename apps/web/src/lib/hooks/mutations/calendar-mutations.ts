import { useMutation, useQueryClient, type UseMutationOptions } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { queryKeys } from '@/lib/query-keys'
import type { CreateEventForm } from '@/lib/types'

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

export function useDisconnectGoogleCalendar(
  options?: UseMutationOptions<void, Error, void>,
) {
  const qc = useQueryClient()
  return useMutation<void, Error, void>({
    mutationFn: () => api.delete<void>('/auth/google-calendar/disconnect'),
    ...options,
    onSuccess: (...args) => {
      qc.invalidateQueries({ queryKey: queryKeys.calendar.status })
      ;(options?.onSuccess as ((...a: unknown[]) => void) | undefined)?.(...args)
    },
  })
}

export function useCreateCalendarEvent(
  options?: UseMutationOptions<unknown, Error, CreateEventForm>,
) {
  return useMutation({
    mutationFn: (data: CreateEventForm) => {
      const startAt = new Date(`${data.startDate}T${data.startTime}`).toISOString()
      const endAt = new Date(`${data.endDate}T${data.endTime}`).toISOString()
      return api.post('/calendar/events', {
        title: data.title,
        description: data.description || undefined,
        location: data.location || undefined,
        eventType: data.eventType,
        startAt,
        endAt,
      })
    },
    ...withToast('Event created', options),
  })
}
