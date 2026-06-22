import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { useCirclebackUpload, type CirclebackUploadInput } from '@/lib/hooks/mutations'

type CirclebackProcessingStatus = 'idle' | 'uploading' | 'processing' | 'done' | 'failed'

type CirclebackProcessingOptions = {
  uploadSuccessMessage: string
  doneMessage: string
  failedMessage: string
  uploadFailedPrefix?: string
  onDone?: () => void
}

export function useCirclebackProcessing({
  uploadSuccessMessage,
  doneMessage,
  failedMessage,
  uploadFailedPrefix = 'Upload failed',
  onDone,
}: CirclebackProcessingOptions) {
  const [correlationKey, setCorrelationKey] = useState<string | null>(null)
  const [uploadDocId, setUploadDocId] = useState<string | null>(null)
  const [status, setStatus] = useState<CirclebackProcessingStatus>('idle')
  const onDoneRef = useRef(onDone)

  useEffect(() => {
    onDoneRef.current = onDone
  }, [onDone])

  const upload = useCirclebackUpload({
    onSuccess: (data) => {
      setCorrelationKey(data.correlationKey)
      setUploadDocId(data.uploadDocId)
      setStatus('processing')
      toast.success(uploadSuccessMessage)
    },
    onError: (err) => {
      setStatus('failed')
      toast.error(`${uploadFailedPrefix}: ${err.message}`)
    },
  })

  useEffect(() => {
    if (!correlationKey || status !== 'processing') return
    const interval = setInterval(async () => {
      try {
        const result = await api.get<{ status: string; crmPushStatus?: string; uploadDocId?: string }>(
          `/recordings/circleback-status?correlationKey=${encodeURIComponent(correlationKey)}`,
        )
        if (result.uploadDocId) setUploadDocId(result.uploadDocId)
        if (result.crmPushStatus === 'done') {
          setStatus('done')
          setCorrelationKey(null)
          onDoneRef.current?.()
          toast.success(doneMessage)
          clearInterval(interval)
        } else if (result.crmPushStatus === 'failed') {
          setStatus('failed')
          clearInterval(interval)
          toast.error(failedMessage)
        }
      } catch {
        // Keep polling through transient status check failures.
      }
    }, 15000)
    return () => clearInterval(interval)
  }, [correlationKey, doneMessage, failedMessage, status])

  function uploadToCircleback(input: CirclebackUploadInput) {
    upload.mutate(input)
  }

  return {
    status,
    uploadDocId,
    uploadToCircleback,
    setStatus,
    isUploading: upload.isPending,
  }
}

export type { CirclebackProcessingStatus }
