import { useMutation, type UseMutationOptions } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/api'

export type SendEmailInput = {
  to: string[]
  cc?: string[]
  subject: string
  body: string
  threadId?: string
  inReplyTo?: string
}

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

export function useSendEmail(
  options?: UseMutationOptions<{ messageId: string; threadId: string }, Error, SendEmailInput>,
) {
  return useMutation<{ messageId: string; threadId: string }, Error, SendEmailInput>({
    mutationFn: (dto) => api.post<{ messageId: string; threadId: string }>('/gmail/send', dto),
    ...withToast('Email sent', options),
  })
}

export function useMarkThreadRead() {
  return useMutation<unknown, Error, string>({
    mutationFn: (threadId: string) => api.post(`/gmail/threads/${threadId}/read`, {}),
  })
}

export function useArchiveEmailThread(
  options?: UseMutationOptions<void, Error, string>,
) {
  return useMutation<void, Error, string>({
    mutationFn: (threadId: string) => api.post<void>(`/gmail/threads/${threadId}/archive`, {}),
    ...withToast('Archived', options),
  })
}

export function useDeleteEmailThread(
  options?: UseMutationOptions<void, Error, string>,
) {
  return useMutation<void, Error, string>({
    mutationFn: (threadId: string) => api.delete<void>(`/gmail/threads/${threadId}`),
    ...withToast('Moved to trash', options),
  })
}
