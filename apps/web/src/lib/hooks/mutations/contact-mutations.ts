import { useMutation, useQueryClient, type UseMutationOptions } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { queryKeys } from '@/lib/query-keys'

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

// ─── Contact mutations ────────────────────────────────────────────────────────

export type CreateContactInput = {
  companyId: string
  name: string
  phone?: string | null
  title?: string | null
  email?: string | null
}

export function useCreateContact(
  options?: UseMutationOptions<unknown, Error, CreateContactInput>,
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateContactInput) => api.post('/contacts', input),
    ...withToast('Contact added', {
      ...options,
      onSuccess: (data, vars, ctx) => {
        qc.invalidateQueries({ queryKey: queryKeys.contacts.byCompany(vars.companyId) })
        ;(options?.onSuccess as any)?.(data, vars, ctx)
      },
    }),
  })
}

export type UpdateContactInput = {
  id: string
  name?: string
  phone?: string | null
  email?: string | null
  title?: string | null
  companyId?: string
}

export function useUpdateContact(
  options?: UseMutationOptions<unknown, Error, UpdateContactInput>,
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, companyId, ...data }: UpdateContactInput) => api.put(`/contacts/${id}`, data),
    ...withToast('Contact updated', {
      ...options,
      onSuccess: (data, vars, ctx) => {
        if (vars.companyId) qc.invalidateQueries({ queryKey: queryKeys.contacts.byCompany(vars.companyId) })
        ;(options?.onSuccess as any)?.(data, vars, ctx)
      },
    }),
  })
}

export function useDeleteContact(
  options?: UseMutationOptions<unknown, Error, string>,
) {
  return useMutation({
    mutationFn: (id: string) => api.delete(`/contacts/${id}`),
    ...withToast('Contact removed', options),
  })
}
