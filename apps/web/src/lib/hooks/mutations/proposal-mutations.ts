import { useMutation, useQueryClient, type UseMutationOptions } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { queryKeys } from '@/lib/query-keys'
import type { ApiProposalHead, ApiProposalStatus, ApiProposalType, ApiProposalVersion, ApiProposalShareLink } from '@/lib/types'

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
        qc.invalidateQueries({ queryKey: queryKeys.proposals.all })
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
  status?: ApiProposalStatus
  isPinned?: boolean
}

export type UploadSignedProposalPdfInput = {
  proposalId: string
  file: File
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

export function useDownloadProposalHtml(
  options?: UseMutationOptions<ApiProposalHead, Error, string>,
) {
  return useMutation<ApiProposalHead, Error, string>({
    mutationFn: (proposalId) => api.get<ApiProposalHead>(`/proposals/${proposalId}`),
    ...options,
  })
}

export function useUploadSignedProposalPdf(
  options?: UseMutationOptions<ApiProposalHead, Error, UploadSignedProposalPdfInput>,
) {
  const qc = useQueryClient()
  return useMutation<ApiProposalHead, Error, UploadSignedProposalPdfInput>({
    mutationFn: ({ proposalId, file }) => {
      const formData = new FormData()
      formData.append('file', file)
      return api.upload<ApiProposalHead>(`/proposals/${proposalId}/signed-pdf`, formData)
    },
    ...withToast('Signed PDF uploaded', {
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
