'use client'

import { useState } from 'react'
import { Mic, MicOff, Square, Trash2, Loader2 } from 'lucide-react'
import {
  useGetRecordings,
} from '@/lib/hooks/queries'
import {
  usePresignRecording,
  useCreateRecording,
  useDeleteRecording,
} from '@/lib/hooks/mutations'
import { useRecorder } from '@/lib/hooks/use-recorder'
import { useUser } from '@/lib/hooks/use-user'
import { formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'
import type { ApiRecording } from '@/lib/types'

const DEFAULT_WORKSPACE_ID = '60f84f03-283e-4c1a-8c88-b8330dc71d32'

function fmtDuration(s: number): string {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

function pickExtension(mimeType: string): string {
  if (mimeType.includes('mp4')) return 'm4a'
  if (mimeType.includes('ogg')) return 'ogg'
  return 'webm'
}

export default function RecordingsPage() {
  const { isAuthenticated } = useUser()
  const { data: recordings = [], isLoading } = useGetRecordings()
  const recorder = useRecorder()
  const presign = usePresignRecording()
  const createRecording = useCreateRecording()
  const deleteRecording = useDeleteRecording()

  const [recordingTitle, setRecordingTitle] = useState('')
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  async function handleStart() {
    await recorder.start()
  }

  async function handleStop() {
    const capturedDuration = recorder.duration
    const titleToUse = recordingTitle.trim() || `Recording ${new Date().toLocaleString('en-PH')}`

    try {
      const { blob, mimeType } = await recorder.stop()
      const ext = pickExtension(mimeType)
      const filename = `recording.${ext}`

      const { uploadUrl, storageKey } = await presign.mutateAsync({ filename, mimeType })

      const putRes = await fetch(uploadUrl, {
        method: 'PUT',
        body: blob,
        headers: { 'Content-Type': mimeType },
      })
      if (!putRes.ok) throw new Error(`Upload failed: ${putRes.status}`)

      await createRecording.mutateAsync({
        title: titleToUse,
        duration: capturedDuration,
        storageKey,
        mimeType,
        sizeBytes: blob.size,
        workspaceId: DEFAULT_WORKSPACE_ID,
      })

      setRecordingTitle('')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Recording upload failed'
      console.error('[recordings] upload failed:', message)
    } finally {
      recorder.setState('idle')
    }
  }

  async function handleDelete(id: string) {
    if (pendingDeleteId !== id) {
      setPendingDeleteId(id)
      window.setTimeout(() => {
        setPendingDeleteId((cur) => (cur === id ? null : cur))
      }, 4000)
      return
    }
    setPendingDeleteId(null)
    await deleteRecording.mutateAsync(id)
  }

  const isUploading = recorder.state === 'uploading' || presign.isPending || createRecording.isPending
  const isRecording = recorder.state === 'recording'

  if (!isAuthenticated) {
    return (
      <div className="p-6">
        <div className="text-[13px] text-slate-600 dark:text-slate-400">Please sign in to view recordings.</div>
      </div>
    )
  }

  return (
    <div className="p-4 md:px-6 pb-6 max-w-[1200px] mx-auto w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[18px] font-semibold text-slate-900 dark:text-white tracking-tight">Recordings</h1>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Capture meetings and calls in the browser. Audio is stored securely.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isRecording && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-[12px] font-semibold text-red-600 dark:text-red-400 tabular-nums">
                {fmtDuration(recorder.duration)}
              </span>
            </div>
          )}

          {!isRecording && !isUploading && (
            <button
              onClick={handleStart}
              className="bg-[#6c63ff] hover:bg-[#5b52e8] text-white text-[12px] font-semibold rounded-lg px-3 py-1.5 transition-colors duration-150 active:scale-[0.98] flex items-center gap-1.5"
            >
              <Mic size={14} strokeWidth={2} />
              New Recording
            </button>
          )}

          {isRecording && (
            <button
              onClick={handleStop}
              className="bg-red-500 hover:bg-red-600 text-white text-[12px] font-semibold rounded-lg px-3 py-1.5 transition-colors duration-150 active:scale-[0.98] flex items-center gap-1.5 animate-pulse"
            >
              <Square size={14} strokeWidth={2} fill="currentColor" />
              Stop
            </button>
          )}

          {isUploading && (
            <div className="flex items-center gap-2 bg-slate-100 dark:bg-white/[.06] text-slate-600 dark:text-slate-300 text-[12px] font-medium rounded-lg px-3 py-1.5">
              <Loader2 size={14} strokeWidth={2} className="animate-spin" />
              Saving...
            </div>
          )}
        </div>
      </div>

      {/* Title input, only shown while recording or about to record */}
      {isRecording && (
        <div className="mb-4 bg-white dark:bg-[#1e1e21] border border-black/[.06] dark:border-white/[.08] rounded-xl shadow-[var(--shadow-card)] px-4 py-3">
          <label className="text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-400">
            Recording title
          </label>
          <input
            type="text"
            value={recordingTitle}
            onChange={(e) => setRecordingTitle(e.target.value)}
            placeholder="Give this recording a name"
            autoFocus
            className="mt-1 w-full bg-transparent text-[13px] font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none"
          />
        </div>
      )}

      {/* Mic permission error */}
      {recorder.error && !isRecording && (
        <div className="mb-4 bg-white dark:bg-[#1e1e21] border border-red-200 dark:border-red-500/20 rounded-xl shadow-[var(--shadow-card)] px-4 py-3 flex items-center gap-2">
          <MicOff size={14} strokeWidth={2} className="text-red-500 shrink-0" />
          <div className="text-[12px] text-red-600 dark:text-red-400">{recorder.error}</div>
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <div className="bg-white dark:bg-[#1e1e21] border border-black/[.06] dark:border-white/[.08] rounded-xl shadow-[var(--shadow-card)] px-4 py-6 text-center">
          <Loader2 size={16} strokeWidth={2} className="animate-spin text-slate-400 mx-auto" />
        </div>
      ) : recordings.length === 0 ? (
        <div className="bg-white dark:bg-[#1e1e21] border border-black/[.06] dark:border-white/[.08] rounded-xl shadow-[var(--shadow-card)] px-6 py-10 text-center">
          <Mic size={28} strokeWidth={1.4} className="text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <div className="text-[13px] font-semibold text-slate-900 dark:text-white">No recordings yet</div>
          <div className="text-[11px] text-slate-400 mt-1">
            Hit Record to capture your first meeting.
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {recordings.map((r) => (
            <RecordingRow
              key={r.id}
              recording={r}
              pendingDelete={pendingDeleteId === r.id}
              onDelete={() => handleDelete(r.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function RecordingRow({
  recording,
  pendingDelete,
  onDelete,
}: {
  recording: ApiRecording
  pendingDelete: boolean
  onDelete: () => void
}) {
  return (
    <div className="bg-white dark:bg-[#1e1e21] border border-black/[.06] dark:border-white/[.08] rounded-xl shadow-[var(--shadow-card)] px-4 py-3 flex items-center gap-3">
      {/* Left: icon + title + date */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="w-8 h-8 rounded-lg bg-[rgba(108,99,255,0.08)] dark:bg-primary/[.12] flex items-center justify-center shrink-0">
          <Mic size={14} strokeWidth={1.6} className="text-[#6c63ff] dark:text-primary" />
        </div>
        <div className="min-w-0">
          <div className="text-[13px] font-semibold text-slate-900 dark:text-white truncate">
            {recording.title}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5 tabular-nums">
            {formatDate(recording.createdAt)}
          </div>
        </div>
      </div>

      {/* Middle: audio player */}
      <div className="hidden sm:flex flex-1 max-w-[420px] min-w-[200px]">
        {recording.playbackUrl ? (
          <audio
            controls
            src={recording.playbackUrl}
            className="w-full h-8"
            preload="none"
          />
        ) : (
          <div className="text-[11px] text-slate-400 italic">Audio file missing</div>
        )}
      </div>

      {/* Right: duration + delete */}
      <div className="flex items-center gap-2 shrink-0">
        {recording.duration !== null && (
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-white/[.06] rounded-full px-2 py-0.5 tabular-nums">
            {fmtDuration(recording.duration)}
          </span>
        )}
        <button
          onClick={onDelete}
          className={cn(
            'w-7 h-7 rounded-lg flex items-center justify-center transition-colors duration-150 active:scale-[0.98]',
            pendingDelete
              ? 'bg-red-500 text-white hover:bg-red-600'
              : 'text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10',
          )}
          title={pendingDelete ? 'Click again to confirm delete' : 'Delete recording'}
        >
          <Trash2 size={13} strokeWidth={1.6} />
        </button>
      </div>
    </div>
  )
}
