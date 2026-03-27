/**
 * Mutation hooks for all write operations.
 *
 * Rules:
 * - Every POST/PUT/PATCH/DELETE goes through a hook here — never raw fetch() in components.
 * - Each hook handles its own error throwing and returns the typed result.
 * - Callers pass { onSuccess, onError } to wire in invalidation and UI side-effects.
 * - Invalidation lives in the caller (e.g. modal or page) — hooks stay reusable.
 *
 * Usage pattern:
 *   const { mutate, isPending } = useCreateCompany({
 *     onSuccess: () => {
 *       qc.invalidateQueries({ queryKey: queryKeys.companies.all })
 *       onClose()
 *     },
 *   })
 */

import { useMutation, type UseMutationOptions } from '@tanstack/react-query'

// ─── Shared types ─────────────────────────────────────────────────────────────

export type ApiError = { message: string; statusCode?: number }

async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string }
    throw new Error(err.message || `POST ${path} failed (${res.status})`)
  }
  return res.json()
}

async function apiPut<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string }
    throw new Error(err.message || `PUT ${path} failed (${res.status})`)
  }
  return res.json()
}

async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string }
    throw new Error(err.message || `PATCH ${path} failed (${res.status})`)
  }
  return res.json()
}

async function apiDelete(path: string): Promise<void> {
  const res = await fetch(path, { method: 'DELETE' })
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string }
    throw new Error(err.message || `DELETE ${path} failed (${res.status})`)
  }
}

// ─── Company mutations ────────────────────────────────────────────────────────

export type CreateCompanyInput = {
  name: string
  domain?: string | null
  industry?: string | null
  website?: string | null
  hqLocation?: string | null
  description?: string | null
}

export type UpdateCompanyInput = Partial<CreateCompanyInput>

export function useCreateCompany(
  options?: UseMutationOptions<unknown, Error, CreateCompanyInput>,
) {
  return useMutation({
    mutationFn: (input: CreateCompanyInput) => apiPost('/api/companies', input),
    ...options,
  })
}

export function useUpdateCompany(
  options?: UseMutationOptions<unknown, Error, { id: string; data: UpdateCompanyInput }>,
) {
  return useMutation({
    mutationFn: ({ id, data }) => apiPut(`/api/companies/${id}`, data),
    ...options,
  })
}

export function useDeleteCompany(
  options?: UseMutationOptions<void, Error, string>,
) {
  return useMutation({
    mutationFn: (id: string) => apiDelete(`/api/companies/${id}`),
    ...options,
  })
}

// ─── Deal mutations ───────────────────────────────────────────────────────────

export type CreateDealInput = {
  title: string
  companyId: string | null
  productId: string
  tierId: string
  stage?: string
  value?: string | null
  outreachCategory?: string | null
  pricingModel?: string | null
  servicesTags?: string[]
  assignedTo?: string | null
  closeDate?: string | null
}

export type UpdateDealInput = Partial<Omit<CreateDealInput, 'companyId' | 'productId' | 'tierId'>>

export function useCreateDeal(
  options?: UseMutationOptions<unknown, Error, CreateDealInput>,
) {
  return useMutation({
    mutationFn: (input: CreateDealInput) => apiPost('/api/deals', input),
    ...options,
  })
}

export function useUpdateDeal(
  options?: UseMutationOptions<unknown, Error, { id: string; data: UpdateDealInput }>,
) {
  return useMutation({
    mutationFn: ({ id, data }) => apiPut(`/api/deals/${id}`, data),
    ...options,
  })
}

export function usePatchDealStage(
  options?: UseMutationOptions<unknown, Error, { id: string; stage: string }>,
) {
  return useMutation({
    mutationFn: ({ id, stage }) => apiPatch(`/api/deals/${id}/stage`, { stage }),
    ...options,
  })
}

export function useDeleteDeal(
  options?: UseMutationOptions<void, Error, string>,
) {
  return useMutation({
    mutationFn: (id: string) => apiDelete(`/api/deals/${id}`),
    ...options,
  })
}
