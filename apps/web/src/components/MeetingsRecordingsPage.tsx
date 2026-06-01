'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import Link from 'next/link'
import {
  Check,
  FileText,
  Loader2,
  Search,
  Mic,
  MicOff,
  Square,
  Trash2,
  Upload,
} from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useGetDeals, useGetMeetings, useGetRecordings } from '@/lib/hooks/queries'
import { useAssignMeetingDeal, useCirclebackUpload, useDeleteMeeting, useDeleteRecording } from '@/lib/hooks/mutations'
import { useRecorder } from '@/lib/hooks/use-recorder'
import { useUser } from '@/lib/hooks/use-user'
import { formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { queryKeys } from '@/lib/query-keys'
import { api } from '@/lib/api'
import type { ApiDeal, ApiMeetingListItem, ApiMeetingStatus, ApiRecording } from '@/lib/types'
import { DataTableSkeleton } from '@/components/ui/data-table'
import { Input } from '@/components/ui/input'
import { Combobox } from '@/components/ui/combobox'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { MeetingAttendeeIdentity, MeetingAttendeesPopover } from '@/components/MeetingAttendeesPopover'
import { toast } from 'sonner'

type ActiveTab = 'meetings' | 'recordings'
type MeetingFilter = 'all' | ApiMeetingStatus

function fmtDuration(s: number): string {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}


function statusTone(status: ApiMeetingStatus): string {
  if (status === 'done') return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20'
  if (status === 'failed') return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-300 dark:border-red-500/20'
  return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/20'
}

function MeetingTabButton({
  active,
  href,
  onClick,
  children,
}: {
  active: boolean
  href: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        'px-3 py-2 text-ssm font-medium border-b-2 -mb-px transition-colors capitalize',
        active
          ? 'border-primary text-primary'
          : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200',
      )}
    >
      {children}
    </Link>
  )
}

function MeetingFilterButton({
  active,
  onClick,
  count,
  children,
}: {
  active: boolean
  onClick: () => void
  count?: number
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'rounded-md px-2.5 py-1 text-xxs font-medium transition-colors inline-flex items-center gap-1.5 active:scale-[0.98] shrink-0 capitalize',
        active
          ? 'bg-primary/10 text-primary'
          : 'bg-white dark:bg-[#1e1e21] border border-black/[.08] dark:border-white/[.08] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[.04]',
      )}
    >
      {children}
      {count !== undefined && (
        <span className={cn('tabular-nums', active ? 'text-primary/70' : 'text-slate-400')}>
          {count}
        </span>
      )}
    </button>
  )
}

export function MeetingsRecordingsPage({ initialTab }: { initialTab: ActiveTab }) {
  const { isAuthenticated } = useUser()
  const [activeTab, setActiveTab] = useState<ActiveTab>(initialTab)

  useEffect(() => {
    setActiveTab(initialTab)
  }, [initialTab])

  if (!isAuthenticated) {
    return <div className="p-6 text-ssm text-slate-600 dark:text-slate-400">Please sign in.</div>
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="shrink-0 px-4 md:px-6 pt-3 pb-0">
        <div className="flex items-center gap-1 border-b border-black/[.06] dark:border-white/[.08]">
          {(['meetings', 'recordings'] as ActiveTab[]).map((tab) => (
            <MeetingTabButton
              key={tab}
              active={activeTab === tab}
              href={tab === 'meetings' ? '/meetings?=all' : '/recordings'}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </MeetingTabButton>
          ))}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto p-4 md:px-6 pb-6">
        {activeTab === 'meetings' ? <MeetingsTab /> : <RecordingsTab />}
      </div>
    </div>
  )
}

function readMeetingFilterFromUrl(): MeetingFilter {
  if (typeof window === 'undefined') return 'all'
  const params = new URLSearchParams(window.location.search)
  const value = params.get('status') ?? params.get('') ?? 'all'
  return value === 'pending' || value === 'done' || value === 'failed' ? value : 'all'
}

function MeetingsTab() {
  const [filter, setFilter] = useState<MeetingFilter>('all')
  const [search, setSearch] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<ApiMeetingListItem | null>(null)
  const { data: meetings = [], isLoading } = useGetMeetings({ limit: 100 })
  const { data: deals = [] } = useGetDeals()
  const deleteMeeting = useDeleteMeeting({ onSuccess: () => setDeleteTarget(null) })

  useEffect(() => {
    setFilter(readMeetingFilterFromUrl())
  }, [])

  function handleFilterChange(item: MeetingFilter) {
    setFilter(item)
    if (typeof window === 'undefined') return
    const url = new URL(window.location.href)
    window.history.replaceState(null, '', `${url.pathname}?=${item}`)
  }

  const dealById = useMemo(() => new Map(deals.map((deal) => [deal.id, deal])), [deals])
  const counts = useMemo(() => ({
    all: meetings.length,
    pending: meetings.filter((meeting) => meeting.status === 'pending').length,
    done: meetings.filter((meeting) => meeting.status === 'done').length,
    failed: meetings.filter((meeting) => meeting.status === 'failed').length,
  }), [meetings])
  const filteredMeetings = useMemo(() => {
    const statusMatches = filter === 'all' ? meetings : meetings.filter((meeting) => meeting.status === filter)
    const query = search.trim().toLowerCase()
    if (!query) return statusMatches
    return statusMatches.filter((meeting) => {
      const dealTitle = meeting.dealId ? dealById.get(meeting.dealId)?.title ?? '' : ''
      const attendeeText = (meeting.attendeeDetails.length ? meeting.attendeeDetails : meeting.attendees.map((email) => ({ email, name: null, avatarUrl: null })))
        .map((attendee) => `${attendee.name ?? ''} ${attendee.email ?? ''}`)
        .join(' ')
      return `${meeting.title} ${dealTitle} ${attendeeText}`.toLowerCase().includes(query)
    })
  }, [dealById, filter, meetings, search])

  return (
    <section className="min-w-0">
      <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          {(['all', 'pending', 'done', 'failed'] as MeetingFilter[]).map((item) => (
            <MeetingFilterButton
              key={item}
              active={filter === item}
              onClick={() => handleFilterChange(item)}
              count={counts[item]}
            >
              {item}
            </MeetingFilterButton>
          ))}
        </div>
        <div className="relative w-full md:w-[280px]">
          <Search size={14} strokeWidth={1.7} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search meetings"
            className="h-8 rounded-lg pl-8 text-xs"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="bg-white dark:bg-[#1e1e21] border border-black/[.06] dark:border-white/[.08] rounded-md overflow-hidden">
          <DataTableSkeleton />
        </div>
      ) : filteredMeetings.length === 0 ? (
        <div className="bg-white dark:bg-[#1e1e21] border border-black/[.06] dark:border-white/[.08] rounded-md px-6 py-10 text-center">
          <FileText size={28} strokeWidth={1.4} className="text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <div className="text-ssm font-semibold text-slate-900 dark:text-white">{search ? 'No meetings found' : 'No meetings yet'}</div>
          <div className="text-xxs text-slate-500 dark:text-slate-400 mt-1">
            {search ? 'Try another attendee, deal, or meeting title.' : 'Passive Circleback meetings will appear here after CRM ingest.'}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filteredMeetings.map((meeting) => (
            <MeetingRow key={meeting.id} meeting={meeting} deals={deals} onDelete={() => setDeleteTarget(meeting)} />
          ))}
        </div>
      )}

      <DeleteMeetingDialog
        meetingTitle={deleteTarget?.title ?? ''}
        open={!!deleteTarget}
        isPending={deleteMeeting.isPending}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}
        onConfirm={() => deleteTarget && deleteMeeting.mutate(deleteTarget.id)}
      />
    </section>
  )
}

function MeetingDealSelect({ meeting, deals }: { meeting: ApiMeetingListItem; deals: ApiDeal[] }) {
  const assignMeeting = useAssignMeetingDeal()
  const options = useMemo(() => deals.map((deal) => ({ value: deal.id, label: deal.title })), [deals])

  return (
    <div onClick={(event) => event.stopPropagation()} className="w-full sm:w-[260px]">
      <Combobox
        options={options}
        value={meeting.dealId ?? ''}
        onValueChange={(value) => {
          if (!value || value === meeting.dealId) return
          assignMeeting.mutate({ id: meeting.id, dealId: value })
        }}
        placeholder={assignMeeting.isPending ? 'Assigning...' : 'Assign deal'}
        className="h-8 rounded-lg text-xxs shadow-none"
      />
    </div>
  )
}

function MeetingRow({ meeting, deals, onDelete }: { meeting: ApiMeetingListItem; deals: ApiDeal[]; onDelete: () => void }) {
  const primaryAttendee = meeting.attendeeDetails[0] ?? (meeting.attendees[0] ? { email: meeting.attendees[0], name: null, avatarUrl: null } : null)

  return (
    <div className="w-full bg-white dark:bg-[#1e1e21] border border-black/[.06] dark:border-white/[.08] rounded-md px-4 py-3 transition-colors hover:border-slate-300 dark:hover:border-white/20">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <Link href={`/meetings/${meeting.id}`} className="flex min-w-0 flex-1 items-center gap-3 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/30">
          <div className="w-9 h-9 rounded-md bg-slate-100 dark:bg-white/[.06] flex items-center justify-center shrink-0">
            <FileText size={15} strokeWidth={1.7} className="text-slate-500 dark:text-slate-300" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="min-w-0 truncate text-ssm font-semibold text-slate-900 dark:text-white">{meeting.title}</p>
            {meeting.lastError && (
              <p className="text-xxs text-red-600 dark:text-red-400 mt-1 line-clamp-1">{meeting.lastError}</p>
            )}
          </div>
        </Link>

        <div className="flex w-full flex-wrap items-center gap-2 md:w-auto md:justify-end">
          <span className={cn('border rounded-md px-1.5 py-0.5 text-atom font-semibold capitalize', statusTone(meeting.status))}>
            {meeting.status}
          </span>
          <span className="text-xxs text-slate-500 dark:text-slate-400 tabular-nums">
            {meeting.startedAt ? formatDate(meeting.startedAt) : formatDate(meeting.createdAt)}
          </span>
          {primaryAttendee && <MeetingAttendeeIdentity attendee={primaryAttendee} compact />}
          <MeetingAttendeesPopover attendees={meeting.attendeeDetails} />
          <MeetingDealSelect meeting={meeting} deals={deals} />
          <button
            type="button"
            onClick={onDelete}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-red-200 text-red-600 transition-colors duration-150 hover:bg-red-50 active:scale-[0.96] dark:border-red-500/20 dark:text-red-300 dark:hover:bg-red-500/10"
            title="Delete meeting"
          >
            <Trash2 size={13} strokeWidth={1.7} />
          </button>
        </div>
      </div>
    </div>
  )
}

function DeleteMeetingDialog({
  meetingTitle,
  open,
  isPending,
  onOpenChange,
  onConfirm,
}: {
  meetingTitle: string
  open: boolean
  isPending: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="mx-4 w-full max-w-sm rounded-lg p-4">
        <DialogTitle className="text-sm font-semibold text-slate-950 dark:text-white">Delete meeting?</DialogTitle>
        <DialogDescription className="mt-1 text-ssm leading-relaxed text-slate-500 dark:text-slate-400">
          This will permanently delete <span className="font-semibold text-slate-700 dark:text-slate-200">{meetingTitle}</span> from CRM meetings. This cannot be undone.
        </DialogDescription>
        <div className="mt-4 flex gap-2.5">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="h-8 flex-1 rounded-lg border border-black/[.1] text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 active:scale-[0.96] dark:border-white/[.12] dark:text-slate-300 dark:hover:bg-white/[.06]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className="h-8 flex-1 rounded-lg bg-red-600 text-xs font-semibold text-white transition-colors hover:bg-red-700 active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? 'Deleting...' : 'Delete permanently'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
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
      const res = await fetch('/api/backend/recordings/upload', {
        method: 'POST',
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
