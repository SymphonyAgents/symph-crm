'use client'

import { useState, useRef, useEffect } from 'react'
import { Mic, MicOff, Square, Check, Trash2, Loader2, Upload } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useGetRecordings } from '@/lib/hooks/queries'
import { useDeleteRecording, useCirclebackUpload } from '@/lib/hooks/mutations'
import { useRecorder } from '@/lib/hooks/use-recorder'
import { useUser } from '@/lib/hooks/use-user'
import { formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { queryKeys } from '@/lib/query-keys'
import { api } from '@/lib/api'
import type { ApiRecording } from '@/lib/types'
import { DataTableSkeleton } from '@/components/ui/data-table'
import { toast } from 'sonner'

function fmtDuration(s: number): string {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

export default function RecordingsPage() {
  const { isAuthenticated } = useUser()
  const qc = useQueryClient()
  const { data: recordings = [], isLoading } = useGetRecordings()
  const recorder = useRecorder()
  const deleteRecording = useDeleteRecording()

  const [title, setTitle] = useState('')
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const frozenDuration = useRef(0)

  // Circleback import state
  const cbFileInputRef = useRef<HTMLInputElement>(null)
  const [cbCorrelationKey, setCbCorrelationKey] = useState<string | null>(null)
  const [cbStatus, setCbStatus] = useState<'idle' | 'uploading' | 'processing' | 'done' | 'failed'>('idle')

  const { mutate: uploadToCircleback, isPending: cbUploading } = useCirclebackUpload({
    onSuccess: (data) => {
      setCbCorrelationKey(data.correlationKey)
      setCbStatus('processing')
      toast.success('Recording uploaded, Circleback is processing it. Notes will appear in the deal once attached.')
    },
    onError: (err) => {
      setCbStatus('failed')
      toast.error(`Upload failed: ${err.message}`)
    },
  })

  // Poll Circleback processing status
  useEffect(() => {
    if (!cbCorrelationKey || cbStatus !== 'processing') return
    const interval = setInterval(async () => {
      try {
        const result = await api.get<{ status: string; crmPushStatus?: string }>(
          `/recordings/circleback-status?correlationKey=${encodeURIComponent(cbCorrelationKey)}`,
        )
        if (result.crmPushStatus === 'done') {
          setCbStatus('done')
          setCbCorrelationKey(null)
          toast.success('Meeting transcript and notes are ready!')
          clearInterval(interval)
        } else if (result.crmPushStatus === 'failed') {
          setCbStatus('failed')
          clearInterval(interval)
          toast.error('Circleback processing failed.')
        }
      } catch {
        // Keep polling
      }
    }, 15000)
    return () => clearInterval(interval)
  }, [cbCorrelationKey, cbStatus])

  async function handleDone() {
    setUploadError(null)
    const dur = frozenDuration.current
    try {
      const { blob, mimeType } = await recorder.finalize()
      const ext = mimeType.includes('mp4') ? 'm4a' : mimeType.includes('ogg') ? 'ogg' : 'webm'
      const form = new FormData()
      form.append('file', blob, `recording.${ext}`)
      form.append('title', title.trim() || `Recording ${new Date().toLocaleString('en-PH')}`)
      form.append('duration', String(dur))
      const sessionRes = await fetch('/api/auth/session')
      const session = await sessionRes.json()
      const userId: string = session?.user?.id ?? ''
      const res = await fetch('/api/recordings/upload', {
        method: 'POST',
        headers: userId ? { 'x-user-id': userId } : {},
        body: form,
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { message?: string }
        throw new Error(err.message || `Upload failed: ${res.status}`)
      }
      await qc.invalidateQueries({ queryKey: queryKeys.recordings.all })
      recorder.reset()
      setTitle('')
      frozenDuration.current = 0
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed')
      recorder.cancel()
    }
  }

  function handleStop() {
    frozenDuration.current = recorder.duration
    recorder.pause()
  }

  function handleCancel() {
    recorder.cancel()
    setTitle('')
    setUploadError(null)
    frozenDuration.current = 0
  }

  async function handleDelete(id: string) {
    if (pendingDeleteId !== id) {
      setPendingDeleteId(id)
      setTimeout(() => setPendingDeleteId((c) => (c === id ? null : c)), 4000)
      return
    }
    setPendingDeleteId(null)
    await deleteRecording.mutateAsync(id)
  }

  const isRecording = recorder.state === 'recording'
  const isPaused = recorder.state === 'paused'
  const isUploading = recorder.state === 'uploading'
  const isIdle = recorder.state === 'idle'

  if (!isAuthenticated) {
    return <div className="p-6 text-[13px] text-slate-600 dark:text-slate-400">Please sign in.</div>
  }

  return (
    <div className="p-4 md:px-6 pb-6 w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h1 className="text-[18px] font-semibold text-slate-900 dark:text-white tracking-tight">Recordings</h1>
          <p className="text-[11px] text-slate-400 mt-0.5">Capture meetings and calls in the browser.</p>
        </div>

        <div className="flex items-center gap-2">
          {(isRecording || isPaused) && (
            <div className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[12px] font-semibold tabular-nums',
              isRecording
                ? 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400'
                : 'bg-slate-50 dark:bg-white/[.06] border-black/[.06] dark:border-white/[.08] text-slate-500',
            )}>
              <span className={cn('w-2 h-2 rounded-full', isRecording ? 'bg-red-500 animate-pulse' : 'bg-slate-400')} />
              {fmtDuration(isRecording ? recorder.duration : frozenDuration.current)}
            </div>
          )}

          {isIdle && (
            <button onClick={() => recorder.start()}
              className="bg-[#6c63ff] hover:bg-[#5b52e8] text-white text-[12px] font-semibold rounded-lg px-3 py-1.5 flex items-center gap-1.5 transition-colors active:scale-[0.98]">
              <Mic size={14} strokeWidth={2} /> New Recording
            </button>
          )}

          {isRecording && (
            <button onClick={handleStop}
              className="bg-red-500 hover:bg-red-600 text-white text-[12px] font-semibold rounded-lg px-3 py-1.5 flex items-center gap-1.5 transition-colors active:scale-[0.98]">
              <Square size={12} strokeWidth={2} fill="currentColor" /> Stop
            </button>
          )}

          {isPaused && (
            <>
              <button onClick={() => recorder.resume()}
                className="bg-white dark:bg-white/[.06] border border-black/[.08] dark:border-white/[.1] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[.1] text-[12px] font-semibold rounded-lg px-3 py-1.5 flex items-center gap-1.5 transition-colors active:scale-[0.98]">
                <Mic size={13} strokeWidth={2} /> Resume
              </button>
              <button onClick={handleDone}
                className="bg-[#6c63ff] hover:bg-[#5b52e8] text-white text-[12px] font-semibold rounded-lg px-3 py-1.5 flex items-center gap-1.5 transition-colors active:scale-[0.98]">
                <Check size={13} strokeWidth={2.5} /> Done
              </button>
              <button onClick={handleCancel}
                className="text-[12px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 px-2 py-1.5 transition-colors">
                Cancel
              </button>
            </>
          )}

          {isUploading && (
            <div className="flex items-center gap-2 bg-slate-100 dark:bg-white/[.06] text-slate-600 dark:text-slate-300 text-[12px] font-medium rounded-lg px-3 py-1.5">
              <Loader2 size={13} strokeWidth={2} className="animate-spin" /> Saving...
            </div>
          )}
        </div>
      </div>

      {/* Circleback Import section */}
      <div className="mb-4 bg-white dark:bg-[#1e1e21] border border-black/[.06] dark:border-white/[.08] rounded-xl px-4 py-3 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-[rgba(108,99,255,0.08)] dark:bg-primary/[.12] flex items-center justify-center shrink-0">
          <Upload size={14} strokeWidth={1.6} className="text-[#6c63ff] dark:text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-semibold text-slate-900 dark:text-white">Import recording to Circleback</div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            Upload an audio/video file. Circleback will transcribe and generate notes. You can attach to a deal later from the deal view.
          </div>
        </div>
        <input
          ref={cbFileInputRef}
          type="file"
          accept=".mp3,.mp4,.wav,.m4a,.mov"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (!file) return
            setCbStatus('uploading')
            uploadToCircleback({ file })
            e.target.value = ''
          }}
        />
        <button
          onClick={() => cbFileInputRef.current?.click()}
          disabled={cbUploading || cbStatus === 'processing'}
          className="bg-[#6c63ff] hover:bg-[#5b52e8] text-white text-[12px] font-semibold rounded-lg px-3 py-1.5 flex items-center gap-1.5 transition-colors active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
        >
          {cbStatus === 'uploading' || cbStatus === 'processing' ? (
            <>
              <Loader2 size={13} strokeWidth={2} className="animate-spin" />
              {cbStatus === 'processing' ? 'Processing…' : 'Uploading…'}
            </>
          ) : (
            <>
              <Upload size={13} strokeWidth={2} /> Upload
            </>
          )}
        </button>
      </div>

      {/* Title input while active */}
      {(isRecording || isPaused) && (
        <div className="mb-4 bg-white dark:bg-[#1e1e21] border border-black/[.06] dark:border-white/[.08] rounded-xl px-4 py-3">
          <label className="text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-400">Recording title</label>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="Give this recording a name (optional)"
            className="mt-1 w-full bg-transparent text-[13px] font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none" />
        </div>
      )}

      {recorder.error && (
        <div className="mb-4 bg-white dark:bg-[#1e1e21] border border-red-200 dark:border-red-500/20 rounded-xl px-4 py-3 flex items-center gap-2">
          <MicOff size={14} className="text-red-500 shrink-0" />
          <div className="text-[12px] text-red-600 dark:text-red-400">{recorder.error}</div>
        </div>
      )}

      {uploadError && (
        <div className="mb-4 bg-white dark:bg-[#1e1e21] border border-red-200 dark:border-red-500/20 rounded-xl px-4 py-3 text-[12px] text-red-600 dark:text-red-400">
          {uploadError}
        </div>
      )}

      {isLoading ? (
        <div className="bg-white dark:bg-[#1e1e21] border border-black/[.06] dark:border-white/[.08] rounded-xl shadow-[0_1px_4px_rgba(0,0,0,0.04)] overflow-hidden">
          <DataTableSkeleton />
        </div>
      ) : recordings.length === 0 ? (
        <div className="bg-white dark:bg-[#1e1e21] border border-black/[.06] dark:border-white/[.08] rounded-xl px-6 py-10 text-center">
          <Mic size={28} strokeWidth={1.4} className="text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <div className="text-[13px] font-semibold text-slate-900 dark:text-white">No recordings yet</div>
          <div className="text-[11px] text-slate-400 mt-1">Hit Record to capture your first meeting.</div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {recordings.map((r) => (
            <RecordingRow key={r.id} recording={r} pendingDelete={pendingDeleteId === r.id} onDelete={() => handleDelete(r.id)} />
          ))}
        </div>
      )}
    </div>
  )
}

function RecordingRow({ recording, pendingDelete, onDelete }: {
  recording: ApiRecording; pendingDelete: boolean; onDelete: () => void
}) {
  return (
    <div className="bg-white dark:bg-[#1e1e21] border border-black/[.06] dark:border-white/[.08] rounded-xl px-4 py-3 flex items-center gap-3">
      <div className="w-8 h-8 rounded-lg bg-[rgba(108,99,255,0.08)] dark:bg-primary/[.12] flex items-center justify-center shrink-0">
        <Mic size={14} strokeWidth={1.6} className="text-[#6c63ff] dark:text-primary" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-semibold text-slate-900 dark:text-white truncate">{recording.title}</div>
        <div className="text-[11px] text-slate-400 tabular-nums mt-0.5">
          {formatDate(recording.createdAt)}
          {recording.duration !== null && <span className="ml-2">{fmtDuration(recording.duration)}</span>}
        </div>
      </div>
      <div className="hidden sm:flex flex-1 max-w-[400px] min-w-[180px]">
        {recording.playbackUrl
          ? <audio controls src={recording.playbackUrl} className="w-full h-8" preload="metadata" />
          : <span className="text-[11px] text-slate-400 italic">Audio unavailable</span>}
      </div>
      <button onClick={onDelete}
        className={cn(
          'w-7 h-7 rounded-lg flex items-center justify-center transition-colors active:scale-[0.98] shrink-0',
          pendingDelete ? 'bg-red-500 text-white hover:bg-red-600' : 'text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10',
        )}
        title={pendingDelete ? 'Click again to confirm' : 'Delete'}>
        <Trash2 size={13} strokeWidth={1.6} />
      </button>
    </div>
  )
}
