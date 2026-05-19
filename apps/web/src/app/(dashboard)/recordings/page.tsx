'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import {
  ArrowUpRight,
  Check,
  ExternalLink,
  FileText,
  Loader2,
  Mic,
  MicOff,
  RefreshCw,
  Square,
  Trash2,
  Upload,
} from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useGetMeeting, useGetMeetings, useGetRecordings } from '@/lib/hooks/queries'
import { useAssignMeetingDeal, useCirclebackUpload, useDeleteRecording, useRetryMeetingIngest } from '@/lib/hooks/mutations'
import { useRecorder } from '@/lib/hooks/use-recorder'
import { useUser } from '@/lib/hooks/use-user'
import { formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { queryKeys } from '@/lib/query-keys'
import { api } from '@/lib/api'
import type { ApiMeeting, ApiMeetingStatus, ApiRecording } from '@/lib/types'
import { DataTableSkeleton } from '@/components/ui/data-table'
import { toast } from 'sonner'

// Temporarily hidden per Vins: meeting summary UI is paused until reprioritized.
// type ActiveTab = 'meetings' | 'recordings'
type MeetingFilter = 'all' | ApiMeetingStatus

function fmtDuration(s: number): string {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

function stripFrontmatter(content: string): string {
  return content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '').trim()
}

function statusTone(status: ApiMeetingStatus): string {
  if (status === 'done') return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20'
  if (status === 'failed') return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-300 dark:border-red-500/20'
  return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/20'
}

export default function RecordingsPage() {
  const { isAuthenticated } = useUser()
  // Temporarily hidden per Vins: meeting summary UI is paused until reprioritized.
  // const [activeTab, setActiveTab] = useState<ActiveTab>('meetings')

  if (!isAuthenticated) {
    return <div className="p-6 text-ssm text-slate-600 dark:text-slate-400">Please sign in.</div>
  }

  return (
    <div className="p-4 md:px-6 pb-6 w-full">
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div>
          <h1 className="text-base font-semibold text-slate-900 dark:text-white tracking-tight">Recordings</h1>
          <p className="text-xxs text-slate-500 dark:text-slate-400 mt-0.5">
            Browser recordings for calls and notes.
          </p>
        </div>

        <div className="inline-flex rounded-md border border-black/[.08] dark:border-white/[.1] bg-white dark:bg-[#1e1e21] p-1">
          {/* Temporarily hidden per Vins: meeting summary UI is paused until reprioritized.
          {(['meetings', 'recordings'] as ActiveTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'h-8 px-3 rounded-md text-xs font-semibold capitalize transition-colors',
                activeTab === tab
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white',
              )}
            >
              {tab}
            </button>
          ))}
          */}
          <button
            type="button"
            disabled
            className="h-8 px-3 rounded-md text-xs font-semibold capitalize bg-slate-900 text-white dark:bg-white dark:text-slate-950"
          >
            recordings
          </button>
        </div>
      </div>

      {/* Temporarily hidden per Vins: meeting summary UI is paused until reprioritized.
      {activeTab === 'meetings' ? <MeetingsTab /> : <RecordingsTab />}
      */}
      <RecordingsTab />
    </div>
  )
}

function MeetingsTab() {
  const [filter, setFilter] = useState<MeetingFilter>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const { data: meetings = [], isLoading } = useGetMeetings({
    status: filter === 'all' ? undefined : filter,
    limit: 100,
  })
  const selectedMeeting = meetings.find((meeting) => meeting.id === selectedId) ?? null

  useEffect(() => {
    if (!selectedId && meetings[0]) setSelectedId(meetings[0].id)
    if (selectedId && meetings.length > 0 && !meetings.some((meeting) => meeting.id === selectedId)) {
      setSelectedId(meetings[0].id)
    }
  }, [meetings, selectedId])

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_420px] gap-3">
      <section className="min-w-0">
        <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
          <div className="flex items-center gap-1">
            {(['all', 'pending', 'done', 'failed'] as MeetingFilter[]).map((item) => (
              <button
                key={item}
                onClick={() => setFilter(item)}
                className={cn(
                  'h-8 px-3 rounded-md text-xs font-semibold capitalize transition-colors',
                  filter === item
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950'
                    : 'border border-black/[.06] dark:border-white/[.08] bg-white dark:bg-[#1e1e21] text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white',
                )}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="bg-white dark:bg-[#1e1e21] border border-black/[.06] dark:border-white/[.08] rounded-md overflow-hidden">
            <DataTableSkeleton />
          </div>
        ) : meetings.length === 0 ? (
          <div className="bg-white dark:bg-[#1e1e21] border border-black/[.06] dark:border-white/[.08] rounded-md px-6 py-10 text-center">
            <FileText size={28} strokeWidth={1.4} className="text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <div className="text-ssm font-semibold text-slate-900 dark:text-white">No meetings yet</div>
            <div className="text-xxs text-slate-500 dark:text-slate-400 mt-1">
              Passive Circleback meetings will appear here after CRM ingest.
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {meetings.map((meeting) => (
              <MeetingRow
                key={meeting.id}
                meeting={meeting}
                selected={meeting.id === selectedId}
                onSelect={() => setSelectedId(meeting.id)}
              />
            ))}
          </div>
        )}
      </section>

      <MeetingDetail meeting={selectedMeeting} />
    </div>
  )
}

function MeetingRow({
  meeting,
  selected,
  onSelect,
}: {
  meeting: ApiMeeting
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        'w-full text-left bg-white dark:bg-[#1e1e21] border rounded-md px-4 py-3 transition-colors',
        selected
          ? 'border-slate-900/20 dark:border-white/30'
          : 'border-black/[.06] dark:border-white/[.08] hover:border-slate-300 dark:hover:border-white/20',
      )}
    >
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-md bg-slate-100 dark:bg-white/[.06] flex items-center justify-center shrink-0">
          <FileText size={15} strokeWidth={1.7} className="text-slate-500 dark:text-slate-300" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 min-w-0">
            <p className="text-ssm font-semibold text-slate-900 dark:text-white truncate">{meeting.title}</p>
            <span className="shrink-0 border border-indigo-200 dark:border-indigo-500/20 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 rounded-md px-1.5 py-0.5 text-atom font-semibold">
              Circleback
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className={cn('border rounded-md px-1.5 py-0.5 text-atom font-semibold capitalize', statusTone(meeting.status))}>
              {meeting.status}
            </span>
            <span className="text-xxs text-slate-500 dark:text-slate-400">
              {meeting.startedAt ? formatDate(meeting.startedAt) : formatDate(meeting.createdAt)}
            </span>
            {meeting.attendees.length > 0 && (
              <span className="text-xxs text-slate-400 dark:text-slate-500 truncate">
                {meeting.attendees.slice(0, 3).join(', ')}
              </span>
            )}
          </div>
          {meeting.lastError && (
            <p className="text-xxs text-red-600 dark:text-red-400 mt-1 line-clamp-1">{meeting.lastError}</p>
          )}
        </div>
      </div>
    </button>
  )
}

function MeetingDetail({ meeting }: { meeting: ApiMeeting | null }) {
  const { data, isLoading } = useGetMeeting(meeting?.id)
  const retryMeeting = useRetryMeetingIngest()
  const assignMeeting = useAssignMeetingDeal()
  const [dealId, setDealId] = useState('')

  useEffect(() => {
    setDealId(meeting?.dealId ?? '')
  }, [meeting?.dealId])

  if (!meeting) {
    return (
      <aside className="bg-white dark:bg-[#1e1e21] border border-black/[.06] dark:border-white/[.08] rounded-md px-5 py-8 text-center">
        <FileText size={24} strokeWidth={1.4} className="text-slate-300 dark:text-slate-600 mx-auto mb-3" />
        <p className="text-ssm font-semibold text-slate-900 dark:text-white">Select a meeting</p>
        <p className="text-xxs text-slate-500 dark:text-slate-400 mt-1">Summary, transcript, and source link will show here.</p>
      </aside>
    )
  }

  const detail = data?.meeting ?? meeting
  const summary = data?.summaryNote?.content ? stripFrontmatter(data.summaryNote.content) : null
  const transcript = data?.transcriptNote?.content ? stripFrontmatter(data.transcriptNote.content) : null

  return (
    <aside className="bg-white dark:bg-[#1e1e21] border border-black/[.06] dark:border-white/[.08] rounded-md overflow-hidden h-fit">
      <div className="px-4 py-3 border-b border-black/[.06] dark:border-white/[.08]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{detail.title}</p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className={cn('border rounded-md px-1.5 py-0.5 text-atom font-semibold capitalize', statusTone(detail.status))}>
                {detail.status}
              </span>
              <span className="border border-indigo-200 dark:border-indigo-500/20 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 rounded-md px-1.5 py-0.5 text-atom font-semibold">
                Circleback
              </span>
            </div>
          </div>
          <a
            href={detail.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="w-8 h-8 rounded-lg border border-black/[.08] dark:border-white/[.1] flex items-center justify-center text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white shrink-0"
            title="Open original meeting"
          >
            <ExternalLink size={14} strokeWidth={1.8} />
          </a>
        </div>
      </div>

      <div className="px-4 py-3 space-y-3">
        <div className="grid grid-cols-2 gap-2 text-xxs">
          <div>
            <p className="text-slate-400 dark:text-slate-500">Started</p>
            <p className="font-medium text-slate-700 dark:text-slate-300 mt-0.5">{detail.startedAt ? formatDate(detail.startedAt) : 'Not set'}</p>
          </div>
          <div>
            <p className="text-slate-400 dark:text-slate-500">Retries</p>
            <p className="font-medium text-slate-700 dark:text-slate-300 mt-0.5">{detail.retryCount}</p>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => retryMeeting.mutate(detail.id)}
            disabled={retryMeeting.isPending}
            className="h-8 px-3 rounded-lg bg-slate-900 text-white dark:bg-white dark:text-slate-950 text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50"
          >
            {retryMeeting.isPending ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
            Retry
          </button>
          {detail.dealId && (
            <Link
              href={`/deals/${detail.dealId}`}
              className="h-8 px-3 rounded-lg border border-black/[.08] dark:border-white/[.1] text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center gap-1.5"
            >
              Deal <ArrowUpRight size={13} />
            </Link>
          )}
        </div>

        {!detail.dealId && (
          <div className="border border-black/[.06] dark:border-white/[.08] rounded-md p-3">
            <p className="text-xs font-semibold text-slate-900 dark:text-white">Assign to deal</p>
            <div className="flex gap-2 mt-2">
              <input
                value={dealId}
                onChange={(event) => setDealId(event.target.value)}
                placeholder="Deal ID"
                className="min-w-0 flex-1 h-8 rounded-lg border border-black/[.08] dark:border-white/[.1] bg-transparent px-2 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none"
              />
              <button
                onClick={() => assignMeeting.mutate({ id: detail.id, dealId })}
                disabled={!dealId || assignMeeting.isPending}
                className="h-8 px-3 rounded-lg bg-slate-900 text-white dark:bg-white dark:text-slate-950 text-xs font-semibold disabled:opacity-50"
              >
                Assign
              </button>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="h-32 rounded-md bg-slate-100 dark:bg-white/[.06] animate-pulse" />
        ) : (
          <>
            <ArtifactBlock title="Summary" content={summary} fallbackPath={detail.summaryNotePath} />
            <ArtifactBlock title="Transcript" content={transcript} fallbackPath={detail.transcriptNotePath} />
          </>
        )}

        {detail.lastError && (
          <div className="rounded-md border border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/10 px-3 py-2 text-xs text-red-700 dark:text-red-300">
            {detail.lastError}
          </div>
        )}
      </div>
    </aside>
  )
}

function ArtifactBlock({
  title,
  content,
  fallbackPath,
}: {
  title: string
  content: string | null
  fallbackPath: string | null
}) {
  return (
    <section className="border border-black/[.06] dark:border-white/[.08] rounded-md overflow-hidden">
      <div className="px-3 py-2 bg-slate-50 dark:bg-white/[.04] border-b border-black/[.06] dark:border-white/[.08]">
        <p className="text-xs font-semibold text-slate-900 dark:text-white">{title}</p>
      </div>
      <div className="px-3 py-3">
        {content ? (
          <div className="max-h-80 overflow-auto whitespace-pre-wrap text-xs leading-5 text-slate-700 dark:text-slate-300">
            {content}
          </div>
        ) : (
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {fallbackPath ? `Saved at ${fallbackPath}. Content will load when the NFS file is available.` : 'Not saved yet.'}
          </div>
        )}
      </div>
    </section>
  )
}

function RecordingsTab() {
  const qc = useQueryClient()
  const { data: recordings = [], isLoading } = useGetRecordings()
  const recorder = useRecorder()
  const deleteRecording = useDeleteRecording()

  const [title, setTitle] = useState('')
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const frozenDuration = useRef(0)

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
        // Keep polling.
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

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h2 className="text-sbase font-semibold text-slate-900 dark:text-white tracking-tight">Recordings</h2>
          <p className="text-xxs text-slate-500 dark:text-slate-400 mt-0.5">Capture meetings and calls in the browser.</p>
        </div>

        <div className="flex items-center gap-2">
          {(isRecording || isPaused) && (
            <div className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold tabular-nums',
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
              className="bg-[#6c63ff] hover:bg-[#5b52e8] text-white text-xs font-semibold rounded-lg px-3 py-1.5 flex items-center gap-1.5 transition-colors active:scale-[0.98]">
              <Mic size={14} strokeWidth={2} /> New Recording
            </button>
          )}

          {isRecording && (
            <button onClick={handleStop}
              className="bg-red-500 hover:bg-red-600 text-white text-xs font-semibold rounded-lg px-3 py-1.5 flex items-center gap-1.5 transition-colors active:scale-[0.98]">
              <Square size={12} strokeWidth={2} fill="currentColor" /> Stop
            </button>
          )}

          {isPaused && (
            <>
              <button onClick={() => recorder.resume()}
                className="bg-white dark:bg-white/[.06] border border-black/[.08] dark:border-white/[.1] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[.1] text-xs font-semibold rounded-lg px-3 py-1.5 flex items-center gap-1.5 transition-colors active:scale-[0.98]">
                <Mic size={13} strokeWidth={2} /> Resume
              </button>
              <button onClick={handleDone}
                className="bg-[#6c63ff] hover:bg-[#5b52e8] text-white text-xs font-semibold rounded-lg px-3 py-1.5 flex items-center gap-1.5 transition-colors active:scale-[0.98]">
                <Check size={13} strokeWidth={2.5} /> Done
              </button>
              <button onClick={handleCancel}
                className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 px-2 py-1.5 transition-colors">
                Cancel
              </button>
            </>
          )}

          {isUploading && (
            <div className="flex items-center gap-2 bg-slate-100 dark:bg-white/[.06] text-slate-600 dark:text-slate-300 text-xs font-medium rounded-lg px-3 py-1.5">
              <Loader2 size={13} strokeWidth={2} className="animate-spin" /> Saving...
            </div>
          )}
        </div>
      </div>

      <div className="mb-4 bg-white dark:bg-[#1e1e21] border border-black/[.06] dark:border-white/[.08] rounded-md px-4 py-3 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-[rgba(108,99,255,0.08)] dark:bg-primary/[.12] flex items-center justify-center shrink-0">
          <Upload size={14} strokeWidth={1.6} className="text-[#6c63ff] dark:text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-ssm font-semibold text-slate-900 dark:text-white">Import recording to Circleback</div>
          <div className="text-xxs text-slate-500 dark:text-slate-400 mt-0.5">
            Upload an audio/video file. Circleback will transcribe and generate notes.
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
          className="bg-[#6c63ff] hover:bg-[#5b52e8] text-white text-xs font-semibold rounded-lg px-3 py-1.5 flex items-center gap-1.5 transition-colors active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
        >
          {cbStatus === 'uploading' || cbStatus === 'processing' ? (
            <>
              <Loader2 size={13} strokeWidth={2} className="animate-spin" />
              {cbStatus === 'processing' ? 'Processing...' : 'Uploading...'}
            </>
          ) : (
            <>
              <Upload size={13} strokeWidth={2} /> Upload
            </>
          )}
        </button>
      </div>

      {(isRecording || isPaused) && (
        <div className="mb-4 bg-white dark:bg-[#1e1e21] border border-black/[.06] dark:border-white/[.08] rounded-md px-4 py-3">
          <label className="text-atom font-semibold uppercase tracking-[0.06em] text-slate-400">Recording title</label>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="Give this recording a name (optional)"
            className="mt-1 w-full bg-transparent text-ssm font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none" />
        </div>
      )}

      {recorder.error && (
        <div className="mb-4 bg-white dark:bg-[#1e1e21] border border-red-200 dark:border-red-500/20 rounded-md px-4 py-3 flex items-center gap-2">
          <MicOff size={14} className="text-red-500 shrink-0" />
          <div className="text-xs text-red-600 dark:text-red-400">{recorder.error}</div>
        </div>
      )}

      {uploadError && (
        <div className="mb-4 bg-white dark:bg-[#1e1e21] border border-red-200 dark:border-red-500/20 rounded-md px-4 py-3 text-xs text-red-600 dark:text-red-400">
          {uploadError}
        </div>
      )}

      {isLoading ? (
        <div className="bg-white dark:bg-[#1e1e21] border border-black/[.06] dark:border-white/[.08] rounded-md overflow-hidden">
          <DataTableSkeleton />
        </div>
      ) : recordings.length === 0 ? (
        <div className="bg-white dark:bg-[#1e1e21] border border-black/[.06] dark:border-white/[.08] rounded-md px-6 py-10 text-center">
          <Mic size={28} strokeWidth={1.4} className="text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <div className="text-ssm font-semibold text-slate-900 dark:text-white">No recordings yet</div>
          <div className="text-xxs text-slate-500 dark:text-slate-400 mt-1">Hit Record to capture your first meeting.</div>
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
    <div className="bg-white dark:bg-[#1e1e21] border border-black/[.06] dark:border-white/[.08] rounded-md px-4 py-3 flex items-center gap-3">
      <div className="w-8 h-8 rounded-lg bg-[rgba(108,99,255,0.08)] dark:bg-primary/[.12] flex items-center justify-center shrink-0">
        <Mic size={14} strokeWidth={1.6} className="text-[#6c63ff] dark:text-primary" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-ssm font-semibold text-slate-900 dark:text-white truncate">{recording.title}</div>
        <div className="text-xxs text-slate-500 dark:text-slate-400 tabular-nums mt-0.5">
          {formatDate(recording.createdAt)}
          {recording.duration !== null && <span className="ml-2">{fmtDuration(recording.duration)}</span>}
        </div>
      </div>
      <div className="hidden sm:flex flex-1 max-w-[400px] min-w-[180px]">
        {recording.playbackUrl
          ? <audio controls src={recording.playbackUrl} className="w-full h-8" preload="metadata" />
          : <span className="text-xxs text-slate-400 italic">Audio unavailable</span>}
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
