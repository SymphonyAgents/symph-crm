import { useMutation, useQueryClient, type UseMutationOptions } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { queryKeys } from '@/lib/query-keys'
import type { ApiRecording } from '@/lib/types'

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

export function useUploadRecordingFile(
  options?: UseMutationOptions<unknown, Error, FormData>,
) {
  const qc = useQueryClient()
  return useMutation<unknown, Error, FormData>({
    mutationFn: (formData) => api.upload('/recordings/upload', formData),
    ...options,
    onSuccess: (...args) => {
      qc.invalidateQueries({ queryKey: queryKeys.recordings.all })
      ;(options?.onSuccess as ((...a: unknown[]) => void) | undefined)?.(...args)
    },
  })
}

export function useRetryCirclebackUpload(
  options?: UseMutationOptions<unknown, Error, { uploadDocId: string }>,
) {
  return useMutation<unknown, Error, { uploadDocId: string }>({
    mutationFn: (body) => api.post('/recordings/circleback-retry', body),
    ...options,
  })
}

export function useGetCirclebackPlayback(
  options?: UseMutationOptions<{ playbackUrl: string }, Error, string>,
) {
  return useMutation<{ playbackUrl: string }, Error, string>({
    mutationFn: (fileName: string) => api.get<{ playbackUrl: string }>(
      `/recordings/circleback-play?fileName=${encodeURIComponent(fileName)}`,
    ),
    ...options,
  })
}

export function useCreateRecording(
  options?: UseMutationOptions<ApiRecording, Error, CreateRecordingInput>,
) {
  const qc = useQueryClient()
  return useMutation<ApiRecording, Error, CreateRecordingInput>({
    mutationFn: (body) => api.post<ApiRecording>('/recordings', body),
    ...options,
    onSuccess: (...args) => {
      qc.invalidateQueries({ queryKey: queryKeys.recordings.all })
      ;(options?.onSuccess as ((...a: unknown[]) => void) | undefined)?.(...args)
    },
  })
}

export function useDeleteRecording(
  options?: UseMutationOptions<void, Error, string>,
) {
  const qc = useQueryClient()
  return useMutation<void, Error, string>({
    mutationFn: (id: string) => api.delete(`/recordings/${id}`),
    ...options,
    onSuccess: (...args) => {
      qc.invalidateQueries({ queryKey: queryKeys.recordings.all })
      ;(options?.onSuccess as ((...a: unknown[]) => void) | undefined)?.(...args)
    },
  })
}

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
