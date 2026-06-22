import { useQuery, type UseQueryOptions } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { queryKeys } from '@/lib/query-keys'
import type { ContactNotesResponse } from '@/lib/types'


// ─── Contacts ─────────────────────────────────────────────────────────────────

export type ApiContact = {
  id: string
  companyId: string
  name: string
  email: string | null
  phone: string | null
  title: string | null
  linkedinUrl: string | null
  isPrimary: boolean
  createdAt: string
  updatedAt: string
}

export function useGetContactsByCompany(
  companyId: string | undefined,
  options?: Partial<UseQueryOptions<ApiContact[]>>,
) {
  return useQuery<ApiContact[]>({
    queryKey: queryKeys.contacts.byCompany(companyId ?? ''),
    queryFn: () => api.get<ApiContact[]>('/contacts', { companyId }),
    enabled: !!companyId,
    ...options,
  })
}

export function useGetContactNotes(
  contactId: string | null,
  options?: Partial<UseQueryOptions<ContactNotesResponse>>,
) {
  return useQuery<ContactNotesResponse>({
    queryKey: queryKeys.contacts.notes(contactId ?? ''),
    queryFn: () => api.get<ContactNotesResponse>(`/contacts/${contactId}/notes`),
    enabled: !!contactId,
    ...options,
  })
}
