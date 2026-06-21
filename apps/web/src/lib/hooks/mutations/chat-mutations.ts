import { useMutation, type UseMutationOptions } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/api'

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

// ─── Chat Session mutations ──────────────────────────────────────────────────

export type CreateChatSessionInput = {
  userId: string
  workspaceId: string
  dealId?: string
  title?: string
}

export type ApiChatSessionResult = {
  id: string
  workspaceId: string
  userId: string
  title: string | null
  contextType: string | null
  contextId: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export function useCreateChatSession(
  options?: UseMutationOptions<ApiChatSessionResult, Error, CreateChatSessionInput>,
) {
  return useMutation<ApiChatSessionResult, Error, CreateChatSessionInput>({
    mutationFn: (input) => api.post<ApiChatSessionResult>('/chat/sessions', input),
    ...options,
  })
}

export function useDeleteChatSession(
  options?: UseMutationOptions<void, Error, string>,
) {
  return useMutation<void, Error, string>({
    mutationFn: (sessionId) => api.delete(`/chat/sessions/${sessionId}`),
    ...withToast('Chat deleted', options),
  })
}
