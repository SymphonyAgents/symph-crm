import { useMutation, useQueryClient, type UseMutationOptions } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { queryKeys } from '@/lib/query-keys'
import type { ApiDocument } from '@/lib/types'

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

// ─── Document / Note mutations ────────────────────────────────────────────────

export type AutoSaveInput = {
  id: string
  content: string
  excerpt?: string
  wordCount?: number
}

// Silent auto-save. Debounced background saves use this, such as ProposalEditor.
// Use useUpdateDocument for explicit user-triggered saves that should show a toast.
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
  // Stage tags appended at creation so the document shows a stage badge.
  tags?: string[]
}

export function useCreateDocument(
  options?: UseMutationOptions<ApiDocument, Error, CreateDocumentInput>,
) {
  const qc = useQueryClient()
  return useMutation<ApiDocument, Error, CreateDocumentInput>({
    mutationFn: (input) => api.post<ApiDocument>('/documents', input),
    ...withToast('Document saved', {
      ...options,
      onSuccess: (data, vars, ctx) => {
        if (vars.dealId) qc.invalidateQueries({ queryKey: queryKeys.documents.byDeal(vars.dealId) })
        if (vars.type === 'proposal') qc.invalidateQueries({ queryKey: queryKeys.documents.proposals })
        ;(options?.onSuccess as any)?.(data, vars, ctx)
      },
    }),
  })
}

export function useUpdateDocument(
  options?: UseMutationOptions<ApiDocument, Error, { id: string; content: string; title?: string }>,
) {
  const qc = useQueryClient()
  return useMutation<ApiDocument, Error, { id: string; content: string; title?: string }>({
    mutationFn: ({ id, ...data }) => api.put<ApiDocument>(`/documents/${id}`, data),
    ...withToast('Document updated', {
      ...options,
      onSuccess: (data, vars, ctx) => {
        qc.invalidateQueries({ queryKey: queryKeys.documents.content(vars.id) })
        ;(options?.onSuccess as any)?.(data, vars, ctx)
      },
    }),
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

export function useGetDocumentDownloadUrl(
  options?: UseMutationOptions<{ url: string; filename: string }, Error, string>,
) {
  return useMutation<{ url: string; filename: string }, Error, string>({
    mutationFn: (id: string) => api.get<{ url: string; filename: string }>(`/documents/${id}/download`),
    ...options,
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
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ dealId, type, title, content }: SaveDealNoteInput) =>
      api.post(`/deals/${dealId}/notes`, { type, title, content }),
    ...withToast('Note saved', {
      ...options,
      onSuccess: (data, vars, ctx) => {
        qc.invalidateQueries({ queryKey: queryKeys.deals.notes(vars.dealId) })
        qc.invalidateQueries({ queryKey: queryKeys.deals.notesFlat(vars.dealId) })
        qc.invalidateQueries({ queryKey: queryKeys.deals.all })
        ;(options?.onSuccess as any)?.(data, vars, ctx)
      },
    }),
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
  const qc = useQueryClient()
  return useMutation<void, Error, DeleteDealNoteInput>({
    mutationFn: ({ dealId, category, filename }) =>
      api.delete(`/deals/${dealId}/notes/${category}/${filename}`),
    ...withToast('Note deleted', {
      ...options,
      onSuccess: (data, vars, ctx) => {
        qc.invalidateQueries({ queryKey: queryKeys.deals.notes(vars.dealId) })
        qc.invalidateQueries({ queryKey: queryKeys.deals.notesFlat(vars.dealId) })
        ;(options?.onSuccess as any)?.(data, vars, ctx)
      },
    }),
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
  const qc = useQueryClient()
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
    ...withToast('Files uploaded', {
      ...options,
      onSuccess: (data, vars, ctx) => {
        qc.invalidateQueries({ queryKey: queryKeys.documents.byDeal(vars.dealId) })
        ;(options?.onSuccess as any)?.(data, vars, ctx)
      },
    }),
  })
}
