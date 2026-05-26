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
import type { CreateEventForm, ApiDocument, ApiBilling, ApiBillingMilestone, ApiCompany, ApiCatalogItem, ApiProposalHead, ApiProposalType, ApiProposalVersion, ApiProposalShareLink, ApiRecording, ApiMeeting } from '@/lib/types'

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
  options?: UseMutationOptions<ApiCompany, Error, CreateCompanyInput>,
) {
  return useMutation<ApiCompany, Error, CreateCompanyInput>({
    mutationFn: (input: CreateCompanyInput) => api.post<ApiCompany>('/companies', input),
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
  subAccountManagerId?: string | null
  builders?: string[]
  catalogItemId?: string | null
  createdBy?: string | null
  closeDate?: string | null
  /** 'agency' (default) | 'reseller' */
  dealType?: string
  /** Reseller: vendor cost price */
  costPrice?: string | null
  /** Reseller: gross margin % (0-100) */
  marginPercent?: string | null
}

export type UpdateDealInput = Partial<Omit<CreateDealInput, 'companyId' | 'productId' | 'tierId'>> & {
  companyId?: string | null
}

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
    ...withToast('Deal moved to trash', options),
  })
}

export function useRestoreDeal(
  options?: UseMutationOptions<unknown, Error, string>,
) {
  return useMutation({
    mutationFn: (id: string) => api.post(`/deals/${id}/restore`, {}),
    ...withToast('Deal restored', options),
  })
}

export function usePermanentlyDeleteDeal(
  options?: UseMutationOptions<void, Error, string>,
) {
  return useMutation({
    mutationFn: (id: string) => api.delete(`/deals/${id}/permanent`),
    ...withToast('Deal permanently deleted', options),
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

// ─── NFS Deal Note mutations ─────────────────────────────────────────────────

export type SaveDealNoteInput = {
  dealId: string
  type: string
  title: string
  content: string
}

export function useSaveDealNote(
  options?: UseMutationOptions<unknown, Error, SaveDealNoteInput>,
) {
  return useMutation({
    mutationFn: ({ dealId, type, title, content }: SaveDealNoteInput) =>
      api.post(`/deals/${dealId}/notes`, { type, title, content }),
    ...withToast('Note saved', options),
  })
}

export type DeleteDealNoteInput = {
  dealId: string
  category: string
  filename: string
}

export function useDeleteDealNote(
  options?: UseMutationOptions<void, Error, DeleteDealNoteInput>,
) {
  return useMutation<void, Error, DeleteDealNoteInput>({
    mutationFn: ({ dealId, category, filename }) =>
      api.delete(`/deals/${dealId}/notes/${category}/${filename}`),
    ...withToast('Note deleted', options),
  })
}

// ─── Deal Summary mutations ─────────────────────────────────────────────────

export function useGenerateDealSummary(
  options?: UseMutationOptions<{ status: string; triggeredAt: string }, Error, string>,
) {
  return useMutation({
    mutationFn: (dealId: string) =>
      api.post<{ status: string; triggeredAt: string }>(`/deals/${dealId}/summaries/generate`, {}),
    ...options,
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

export type UpdateContactInput = {
  id: string
  name?: string
  phone?: string | null
  email?: string | null
  title?: string | null
}

export function useUpdateContact(
  options?: UseMutationOptions<unknown, Error, UpdateContactInput>,
) {
  return useMutation({
    mutationFn: ({ id, ...data }: UpdateContactInput) => api.put(`/contacts/${id}`, data),
    ...withToast('Contact updated', options),
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
    ...withToast('Chat deleted', options),
  })
}

// ─── Catalog Item mutations ──────────────────────────────────────────────────

export type CreateCatalogItemInput = {
  productType?: 'internal' | 'service' | 'reseller' | 'partnership'
  slug?: string | null
  name: string
  industry?: string | null
  landingPageLink?: string | null
  iconUrl?: string | null
  isActive?: boolean
}

export type UpdateCatalogItemInput = Partial<CreateCatalogItemInput>

export function useCreateCatalogItem(
  options?: UseMutationOptions<ApiCatalogItem, Error, CreateCatalogItemInput>,
) {
  return useMutation<ApiCatalogItem, Error, CreateCatalogItemInput>({
    mutationFn: (input) => api.post<ApiCatalogItem>('/catalog-items', input),
    ...withToast('Product created', options),
  })
}

export function useUpdateCatalogItem(
  options?: UseMutationOptions<ApiCatalogItem, Error, { id: string; data: UpdateCatalogItemInput }>,
) {
  return useMutation<ApiCatalogItem, Error, { id: string; data: UpdateCatalogItemInput }>({
    mutationFn: ({ id, data }) => api.patch<ApiCatalogItem>(`/catalog-items/${id}`, data),
    ...withToast('Product updated', options),
  })
}

export function useDeleteCatalogItem(
  options?: UseMutationOptions<void, Error, string>,
) {
  return useMutation<void, Error, string>({
    mutationFn: (id: string) => api.delete(`/catalog-items/${id}`),
    ...withToast('Product deleted', options),
  })
}

export function useUploadCatalogItemIcon(
  options?: UseMutationOptions<ApiCatalogItem, Error, { id: string; file: File }>,
) {
  const qc = useQueryClient()
  return useMutation<ApiCatalogItem, Error, { id: string; file: File }>({
    mutationFn: async ({ id, file }) => {
      const fd = new FormData()
      fd.append('icon', file)
      return api.upload<ApiCatalogItem>(`/catalog-items/${id}/icon`, fd)
    },
    ...withToast('Icon uploaded', {
      ...options,
      onSuccess: (data, vars, ctx) => {
        // Refresh both the list (catalog page) and any single-row caches so
        // the new public icon URL renders immediately.
        qc.invalidateQueries({ queryKey: queryKeys.catalogItems.all })
        ;(options?.onSuccess as any)?.(data, vars, ctx)
      },
    }),
  })
}

// ─── Proposals ───────────────────────────────────────────────────────────────

export type CreateProposalInput = {
  dealId: string
  title: string
  type?: ApiProposalType
  html: string
  changeNote?: string
}

export function useCreateProposal(
  options?: UseMutationOptions<ApiProposalHead, Error, CreateProposalInput>,
) {
  const qc = useQueryClient()
  return useMutation<ApiProposalHead, Error, CreateProposalInput>({
    mutationFn: ({ dealId, ...body }) => api.post<ApiProposalHead>(`/deals/${dealId}/proposals`, body),
    ...withToast('Proposal created', {
      ...options,
      onSuccess: (data, vars, ctx) => {
        qc.invalidateQueries({ queryKey: queryKeys.proposals.byDeal(vars.dealId) })
        ;(options?.onSuccess as any)?.(data, vars, ctx)
      },
    }),
  })
}

export type SaveVersionInput = {
  proposalId: string
  html: string
  changeNote?: string
}

export function useSaveProposalVersion(
  options?: UseMutationOptions<ApiProposalVersion, Error, SaveVersionInput>,
) {
  const qc = useQueryClient()
  return useMutation<ApiProposalVersion, Error, SaveVersionInput>({
    mutationFn: ({ proposalId, ...body }) =>
      api.post<ApiProposalVersion>(`/proposals/${proposalId}/versions`, body),
    ...withToast('Version saved', {
      ...options,
      onSuccess: (data, vars, ctx) => {
        qc.invalidateQueries({ queryKey: queryKeys.proposals.detail(vars.proposalId) })
        qc.invalidateQueries({ queryKey: queryKeys.proposals.versions(vars.proposalId) })
        qc.invalidateQueries({ queryKey: queryKeys.proposals.all })
        ;(options?.onSuccess as any)?.(data, vars, ctx)
      },
    }),
  })
}

export type UpdateProposalMetaInput = {
  proposalId: string
  title?: string
  type?: ApiProposalType
  isPinned?: boolean
}

export function useUpdateProposalMeta(
  options?: UseMutationOptions<ApiProposalHead, Error, UpdateProposalMetaInput>,
) {
  const qc = useQueryClient()
  return useMutation<ApiProposalHead, Error, UpdateProposalMetaInput>({
    mutationFn: ({ proposalId, ...body }) =>
      api.put<ApiProposalHead>(`/proposals/${proposalId}`, body),
    ...withToast('Proposal updated', {
      ...options,
      onSuccess: (data, vars, ctx) => {
        qc.invalidateQueries({ queryKey: queryKeys.proposals.detail(vars.proposalId) })
        qc.invalidateQueries({ queryKey: queryKeys.proposals.all })
        ;(options?.onSuccess as any)?.(data, vars, ctx)
      },
    }),
  })
}

export function useDeleteProposal(
  options?: UseMutationOptions<void, Error, { proposalId: string; dealId?: string }>,
) {
  const qc = useQueryClient()
  return useMutation<void, Error, { proposalId: string; dealId?: string }>({
    mutationFn: ({ proposalId }) => api.delete(`/proposals/${proposalId}`),
    ...withToast('Proposal deleted', {
      ...options,
      onSuccess: (data, vars, ctx) => {
        if (vars.dealId) qc.invalidateQueries({ queryKey: queryKeys.proposals.byDeal(vars.dealId) })
        qc.invalidateQueries({ queryKey: queryKeys.proposals.all })
        ;(options?.onSuccess as any)?.(data, vars, ctx)
      },
    }),
  })
}

export type CreateShareLinkInput = {
  proposalId: string
  versionId?: string
  expiresAt?: string
}

export function useCreateProposalShareLink(
  options?: UseMutationOptions<ApiProposalShareLink, Error, CreateShareLinkInput>,
) {
  const qc = useQueryClient()
  return useMutation<ApiProposalShareLink, Error, CreateShareLinkInput>({
    mutationFn: ({ proposalId, ...body }) =>
      api.post<ApiProposalShareLink>(`/proposals/${proposalId}/share`, body),
    ...withToast('Share link created', {
      ...options,
      onSuccess: (data, vars, ctx) => {
        qc.invalidateQueries({ queryKey: queryKeys.proposals.shares(vars.proposalId) })
        ;(options?.onSuccess as any)?.(data, vars, ctx)
      },
    }),
  })
}

export function useRevokeProposalShareLink(
  options?: UseMutationOptions<void, Error, { linkId: string; proposalId?: string }>,
) {
  const qc = useQueryClient()
  return useMutation<void, Error, { linkId: string; proposalId?: string }>({
    mutationFn: ({ linkId }) => api.delete(`/share-links/${linkId}`),
    ...withToast('Share link revoked', {
      ...options,
      onSuccess: (data, vars, ctx) => {
        if (vars.proposalId) qc.invalidateQueries({ queryKey: queryKeys.proposals.shares(vars.proposalId) })
        ;(options?.onSuccess as any)?.(data, vars, ctx)
      },
    }),
  })
}

// ─── Recordings ───────────────────────────────────────────────────────────────

export type CreateRecordingInput = {
  title: string
  duration: number | null
  storageKey: string
  mimeType: string
  sizeBytes: number | null
  workspaceId: string
}

export function usePresignRecording() {
  return useMutation({
    mutationFn: (body: { filename: string; mimeType: string }) =>
      api.post<{ uploadUrl: string; storageKey: string }>('/recordings/presign', body),
  })
}

export function useCreateRecording(
  options?: UseMutationOptions<ApiRecording, Error, CreateRecordingInput>,
) {
  const qc = useQueryClient()
  return useMutation<ApiRecording, Error, CreateRecordingInput>({
    mutationFn: (body) => api.post<ApiRecording>('/recordings', body),
    onSuccess: (...args) => {
      qc.invalidateQueries({ queryKey: queryKeys.recordings.all })
      ;(options?.onSuccess as ((...a: unknown[]) => void) | undefined)?.(...args)
    },
    ...options,
  })
}

export function useDeleteRecording(
  options?: UseMutationOptions<void, Error, string>,
) {
  const qc = useQueryClient()
  return useMutation<void, Error, string>({
    mutationFn: (id: string) => api.delete(`/recordings/${id}`),
    onSuccess: (...args) => {
      qc.invalidateQueries({ queryKey: queryKeys.recordings.all })
      ;(options?.onSuccess as ((...a: unknown[]) => void) | undefined)?.(...args)
    },
    ...options,
  })
}

// ─── Circleback recording upload ──────────────────────────────────────────────

export type CirclebackUploadInput = { file: File; dealId?: string }
export type CirclebackUploadResult = {
  ok: boolean
  correlationKey: string
  uploadDocId: string
  dealId?: string
}

export function useCirclebackUpload(
  options?: UseMutationOptions<CirclebackUploadResult, Error, CirclebackUploadInput>,
) {
  return useMutation<CirclebackUploadResult, Error, CirclebackUploadInput>({
    mutationFn: async ({ file, dealId }) => {
      const formData = new FormData()
      formData.append('file', file)
      if (dealId) formData.append('dealId', dealId)
      return api.upload<CirclebackUploadResult>('/recordings/circleback-upload', formData)
    },
    ...options,
  })
}

// ─── Meetings ────────────────────────────────────────────────────────────────

export function useRetryMeetingIngest(
  options?: UseMutationOptions<unknown, Error, string>,
) {
  const qc = useQueryClient()
  return useMutation<unknown, Error, string>({
    mutationFn: (id: string) => api.post(`/meetings/${id}/retry-ingest`, {}),
    onSuccess: (...args) => {
      qc.invalidateQueries({ queryKey: queryKeys.meetings.all })
      toast.success('Meeting ingest retried')
      ;(options?.onSuccess as ((...a: unknown[]) => void) | undefined)?.(...args)
    },
    onError: (error, ...rest) => {
      toast.error(error.message || 'Meeting retry failed')
      ;(options?.onError as ((error: Error, ...a: unknown[]) => void) | undefined)?.(error, ...rest)
    },
    ...options,
  })
}

export function useDeleteMeeting(
  options?: UseMutationOptions<{ ok: boolean }, Error, string>,
) {
  const qc = useQueryClient()
  return useMutation<{ ok: boolean }, Error, string>({
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
    ...options,
  })
}

export function useAssignMeetingDeal(
  options?: UseMutationOptions<{ ok: boolean; meeting: ApiMeeting }, Error, { id: string; dealId: string }>,
) {
  const qc = useQueryClient()
  return useMutation<{ ok: boolean; meeting: ApiMeeting }, Error, { id: string; dealId: string }>({
    mutationFn: ({ id, dealId }) => api.post<{ ok: boolean; meeting: ApiMeeting }>(`/meetings/${id}/assign-deal`, { dealId }),
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
    ...options,
  })
}
