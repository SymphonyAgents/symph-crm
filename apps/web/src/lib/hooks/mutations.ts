// Mutation hooks for all write operations.
//
// Rules:
// - Every POST/PUT/PATCH/DELETE goes through a hook here
// - Toast notifications fire on every success and error automatically
// - Callers pass { onSuccess, onError } for invalidation and UI side-effects
// - Toast shows BEFORE caller's onSuccess/onError runs

import { useMutation, type UseMutationOptions } from '@tanstack/react-query'
import { toast } from 'sonner'

// ─── Shared helpers ──────────────────────────────────────────────────────────

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

// Wraps mutation options to inject toast before caller's callbacks
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
    ...withToast('Brand created', options),
  })
}

export function useUpdateCompany(
  options?: UseMutationOptions<unknown, Error, { id: string; data: UpdateCompanyInput }>,
) {
  return useMutation({
    mutationFn: ({ id, data }) => apiPut(`/api/companies/${id}`, data),
    ...withToast('Brand updated', options),
  })
}

export function useDeleteCompany(
  options?: UseMutationOptions<void, Error, string>,
) {
  return useMutation({
    mutationFn: (id: string) => apiDelete(`/api/companies/${id}`),
    ...withToast('Brand deleted', options),
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
  createdBy?: string | null
  closeDate?: string | null
}

export type UpdateDealInput = Partial<Omit<CreateDealInput, 'companyId' | 'productId' | 'tierId'>>

export function useCreateDeal(
  options?: UseMutationOptions<unknown, Error, CreateDealInput>,
) {
  return useMutation({
    mutationFn: (input: CreateDealInput) => apiPost('/api/deals', input),
    ...withToast('Deal created', options),
  })
}

export function useUpdateDeal(
  options?: UseMutationOptions<unknown, Error, { id: string; data: UpdateDealInput }>,
) {
  return useMutation({
    mutationFn: ({ id, data }) => apiPut(`/api/deals/${id}`, data),
    ...withToast('Deal updated', options),
  })
}

export function usePatchDealStage(
  options?: UseMutationOptions<unknown, Error, { id: string; stage: string }>,
) {
  return useMutation({
    mutationFn: ({ id, stage }) => apiPatch(`/api/deals/${id}/stage`, { stage }),
    ...withToast('Stage updated', options),
  })
}

export function useDeleteDeal(
  options?: UseMutationOptions<void, Error, string>,
) {
  return useMutation({
    mutationFn: (id: string) => apiDelete(`/api/deals/${id}`),
    ...withToast('Deal deleted', options),
  })
}
