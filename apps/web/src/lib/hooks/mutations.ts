// Mutation hooks for all write operations.
//
// Rules:
// - Every POST/PUT/PATCH/DELETE goes through a hook here
// - Toast notifications fire on every success and error automatically
// - Callers pass { onSuccess, onError } for component-specific side effects
// - Toast fires BEFORE caller's onSuccess/onError
// - No direct fetch() calls — always use api.post/put/patch/delete from lib/api.ts

import { useMutation, useQueryClient, type UseMutationOptions } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { queryKeys } from '@/lib/query-keys'
import type { CreateEventForm, ApiDocument, ApiBilling, ApiBillingMilestone } from '@/lib/types'

// ─── Shared ───────────────────────────────────────────────────────────────────

export type ApiError = { message: string; statusCode?: number }

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
    mutationFn: (input: CreateCompanyInput) => api.post('/companies', input),
    ...withToast('Brand created', options),
  })
}

export function useUpdateCompany(
  options?: UseMutationOptions<unknown, Error, { id: string; data: UpdateCompanyInput }>,
) {
  return useMutation({
    mutationFn: ({ id, data }) => api.put(`/companies/${id}`, data),
    ...withToast('Brand updated', options),
  })
}

export function useDeleteCompany(
  options?: UseMutationOptions<void, Error, string>,
) {
  return useMutation({
    mutationFn: (id: string) => api.delete(`/companies/${id}`),
    ...withToast('Brand deleted', options),
  })
}

// ─── Deal mutations ───────────────────────────────────────────────────────────

export type CreateDealInput = {
  title: string
  companyId: string | null
  productId?: string | null
  tierId?: string | null
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
    mutationFn: (input: CreateDealInput) => api.post('/deals', input),
    ...withToast('Deal created', options),
  })
}

export function useUpdateDeal(
  options?: UseMutationOptions<unknown, Error, { id: string; data: UpdateDealInput }>,
) {
  return useMutation({
    mutationFn: ({ id, data }) => api.put(`/deals/${id}`, data),
    ...withToast('Deal updated', options),
  })
}

// No static toast — callers provide deal-specific toast with stage transition info
export function usePatchDealStage(
  options?: UseMutationOptions<unknown, Error, { id: string; stage: string }>,
) {
  return useMutation({
    mutationFn: ({ id, stage }) => api.patch(`/deals/${id}/stage`, { stage }),
    ...options,
    onError: (error: Error, vars: { id: string; stage: string }, ctx: unknown) => {
      toast.error(error.message || 'Stage update failed')
      ;(options?.onError as (e: Error, v: { id: string; stage: string }, c: unknown) => void)?.(error, vars, ctx)
    },
  })
}

export function useDeleteDeal(
  options?: UseMutationOptions<void, Error, string>,
) {
  return useMutation({
    mutationFn: (id: string) => api.delete(`/deals/${id}`),
    ...withToast('Deal deleted', options),
  })
}

// ─── Document / Note mutations ────────────────────────────────────────────────

export type AutoSaveInput = {
  id: string
  content: string
  excerpt?: string
  wordCount?: number
}

/**
 * Silent auto-save — no toast. For debounced background saves (e.g. ProposalEditor).
 * Use useUpdateDocument for explicit user-triggered saves that should show a toast.
 */
export function useAutoSaveDocument(
  options?: UseMutationOptions<ApiDocument, Error, AutoSaveInput>,
) {
  return useMutation<ApiDocument, Error, AutoSaveInput>({
    mutationFn: ({ id, ...data }) => api.put<ApiDocument>(`/documents/${id}`, data),
    ...options, // No withToast — auto-save is a silent background operation
  })
}

export type CreateDocumentInput = {
  dealId?: string | null
  type: string
  title: string
  content: string
  authorId: string
  parentId?: string | null
  version?: number
  excerpt?: string
  /** Stage tags appended at time of creation so the document shows a stage badge */
  tags?: string[]
}

export function useCreateDocument(
  options?: UseMutationOptions<ApiDocument, Error, CreateDocumentInput>,
) {
  return useMutation<ApiDocument, Error, CreateDocumentInput>({
    mutationFn: (input) => api.post<ApiDocument>('/documents', input),
    ...withToast('Document saved', options),
  })
}

export function useUpdateDocument(
  options?: UseMutationOptions<ApiDocument, Error, { id: string; content: string; title?: string }>,
) {
  return useMutation<ApiDocument, Error, { id: string; content: string; title?: string }>({
    mutationFn: ({ id, ...data }) => api.put<ApiDocument>(`/documents/${id}`, data),
    ...withToast('Document updated', options),
  })
}

export function useDeleteDocument(
  options?: UseMutationOptions<void, Error, string>,
) {
  return useMutation<void, Error, string>({
    mutationFn: (id: string) => api.delete(`/documents/${id}`),
    ...withToast('Document deleted', options),
  })
}

export function useUploadDocumentFile(
  options?: UseMutationOptions<ApiDocument[], Error, { dealId: string; authorId: string; files: File[]; dealStage?: string }>,
) {
  return useMutation<ApiDocument[], Error, { dealId: string; authorId: string; files: File[]; dealStage?: string }>({
    mutationFn: async ({ dealId, authorId, files, dealStage }) => {
      const results: ApiDocument[] = []
      for (const file of files) {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('dealId', dealId)
        formData.append('authorId', authorId)
        if (dealStage) formData.append('dealStage', dealStage)
        const doc = await api.upload<ApiDocument>('/documents/upload', formData)
        results.push(doc)
      }
      return results
    },
    ...withToast('Files uploaded', options),
  })
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

// ─── Calendar mutations ───────────────────────────────────────────────────────

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

// ─── Gmail mutations ──────────────────────────────────────────────────────────

export type SendEmailInput = {
  to: string[]
  cc?: string[]
  subject: string
  body: string
  threadId?: string
  inReplyTo?: string
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

// ─── Notification mutations ──────────────────────────────────────────────────

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.patch('/notifications/read-all', {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.notifications.all })
    },
  })
}

export function useMarkNotificationRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.patch(`/notifications/${id}/read`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.notifications.all })
    },
  })
}

// ─── Brand assignment ─────────────────────────────────────────────────────────

/** Assign (or unassign) a brand/company to an existing deal. */
export function useAssignDealBrand(
  options?: UseMutationOptions<unknown, Error, { id: string; companyId: string | null }>,
) {
  return useMutation({
    mutationFn: ({ id, companyId }) => api.put(`/deals/${id}`, { companyId }),
    ...withToast('Brand assigned', options),
  })
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
  return useMutation({
    mutationFn: (input: CreateContactInput) => api.post('/contacts', input),
    ...withToast('Contact added', options),
  })
}

// ─── Brand deletion ───────────────────────────────────────────────────────────

export function useDeleteBrand(
  options?: UseMutationOptions<void, Error, string>,
) {
  return useMutation({
    mutationFn: (id: string) => api.delete(`/companies/${id}`),
    ...withToast('Brand deleted', options),
  })
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
    ...options,
  })
}
