import { useMutation, type UseMutationOptions } from '@tanstack/react-query'
import { api } from '@/lib/api'

export function useLogout(
  options?: UseMutationOptions<unknown, Error, void>,
) {
  return useMutation<unknown, Error, void>({
    mutationFn: () => api.post('/auth/logout', {}),
    ...options,
  })
}
