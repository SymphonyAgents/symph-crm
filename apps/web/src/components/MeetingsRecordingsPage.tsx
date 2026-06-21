'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Check,
  FileText,
  Loader2,
  Mic,
  MicOff,
  Square,
  Trash2,
  Upload,
} from 'lucide-react'
import { useGetDeals, useGetMeetings, useGetRecordings } from '@/lib/hooks/queries'
import { useAssignMeetingDeal, useDeleteMeeting, useDeleteRecording, useUploadRecordingFile } from '@/lib/hooks/mutations'
import { useRecorder } from '@/lib/hooks/use-recorder'
import { useUser } from '@/lib/hooks/use-user'
import { useCirclebackProcessing } from '@/lib/hooks/use-circleback-processing'
import { formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'
import type { ApiDeal, ApiMeetingListItem, ApiMeetingStatus, ApiRecording } from '@/lib/types'
import { DataTableSkeleton } from '@/components/ui/data-table'
import { TabFilter, type TabFilterItem } from '@/components/ui/tab-filter'
import { SearchInput } from '@/components/ui/search-input'
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

export function MeetingsRecordingsPage({ initialTab }: { initialTab: ActiveTab }) {
  const router = useRouter()
  const { isAuthenticated } = useUser()
  const [activeTab, setActiveTab] = useState<ActiveTab>(initialTab)
  const { data: meetings = [] } = useGetMeetings({ limit: 100 })
  const { data: recordings = [] } = useGetRecordings()

  useEffect(() => {
    setActiveTab(initialTab)
  }, [initialTab])

  const tabItems = useMemo<TabFilterItem<ActiveTab>[]>(() => [
    { id: 'meetings', label: 'Meetings', count: meetings.length },
    { id: 'recordings', label: 'Recordings', count: recordings.length },
  ], [meetings.length, recordings.length])

  function handleTabChange(tab: ActiveTab) {
    setActiveTab(tab)
    router.push(tab === 'meetings' ? '/meetings?=all' : '/recordings', { scroll: false })
  }

  if (!isAuthenticated) {
    return <div className="p-6 text-ssm text-muted-foreground">Please sign in.</div>
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="shrink-0 px-4 md:px-6 pt-3 pb-0">
        <div className="mb-3 flex flex-col gap-1">
          <div className="text-ssm font-medium text-foreground">Meetings</div>
          <div className="text-xxs text-slate-400 tabular-nums">
            {meetings.length} meeting{meetings.length !== 1 ? 's' : ''} · {recordings.length} recording{recordings.length !== 1 ? 's' : ''} · Review call notes and browser recordings
          </div>
        </div>
        <TabFilter items={tabItems} value={activeTab} onChange={handleTabChange} />
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
  const statusItems = useMemo<TabFilterItem<MeetingFilter>[]>(() => [
    { id: 'all', label: 'All', count: counts.all },
    { id: 'pending', label: 'Pending', count: counts.pending },
    { id: 'done', label: 'Done', count: counts.done },
    { id: 'failed', label: 'Failed', count: counts.failed },
  ], [counts])

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
        <TabFilter items={statusItems} value={filter} onChange={handleFilterChange} />
        <SearchInput
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          onClear={() => setSearch('')}
          placeholder="Search meetings"
          containerClassName="w-full md:w-[280px] h-8"
        />
      </div>

      {isLoading ? (
        <div className="bg-card border border-border rounded-md overflow-hidden">
          <DataTableSkeleton />
        </div>
      ) : filteredMeetings.length === 0 ? (
        <div className="bg-card border border-border rounded-md px-6 py-10 text-center">
          <FileText size={28} strokeWidth={1.4} className="text-text-faint mx-auto mb-3" />
          <div className="text-ssm font-medium text-foreground">{search ? 'No meetings found' : 'No meetings yet'}</div>
          <div className="text-xxs text-muted-foreground mt-1">
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
    <div className="w-full bg-card border border-border rounded-md px-4 py-3 transition-colors hover:border-border dark:hover:border-white/20">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <Link href={`/meetings/${meeting.id}`} className="flex min-w-0 flex-1 items-center gap-3 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/30">
          <div className="w-9 h-9 rounded-md bg-secondary flex items-center justify-center shrink-0">
            <FileText size={15} strokeWidth={1.7} className="text-muted-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="min-w-0 truncate text-ssm font-medium text-foreground">{meeting.title}</p>
            {meeting.lastError && (
              <p className="text-xxs text-red-600 dark:text-red-400 mt-1 line-clamp-1">{meeting.lastError}</p>
            )}
          </div>
        </Link>

        <div className="flex w-full flex-wrap items-center gap-2 md:w-auto md:justify-end">
          <span className={cn('border rounded-md px-1.5 py-0.5 text-atom font-medium capitalize', statusTone(meeting.status))}>
            {meeting.status}
          </span>
          {meeting.actionPackageStatus && (
            <span className="border border-primary/20 bg-primary/10 rounded-md px-1.5 py-0.5 text-atom font-medium text-primary capitalize">
              {meeting.actionPackageStatus.replaceAll('_', ' ')}
            </span>
          )}
          <span className="text-xxs text-muted-foreground tabular-nums">
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
        <DialogTitle className="text-sm font-medium text-slate-950">Delete meeting?</DialogTitle>
        <DialogDescription className="mt-1 text-ssm leading-relaxed text-muted-foreground">
          This will permanently delete <span className="font-medium text-foreground">{meetingTitle}</span> from CRM meetings. This cannot be undone.
        </DialogDescription>
        <div className="mt-4 flex gap-2.5">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="h-8 flex-1 rounded-lg border border-border text-xs font-medium text-slate-700 transition-colors hover:bg-surface-alt active:scale-[0.96]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className="h-8 flex-1 rounded-lg bg-red-600 text-xs font-medium text-white transition-colors hover:bg-red-700 active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? 'Deleting...' : 'Delete permanently'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function RecordingsTab() {
  const { data: recordings = [], isLoading } = useGetRecordings()
  const recorder = useRecorder()
  const deleteRecording = useDeleteRecording()
  const uploadRecording = useUploadRecordingFile()

  const [title, setTitle] = useState('')
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const frozenDuration = useRef(0)

  const cbFileInputRef = useRef<HTMLInputElement>(null)
  const {
    status: cbStatus,
    uploadToCircleback,
    setStatus: setCbStatus,
    isUploading: cbUploading,
  } = useCirclebackProcessing({
    uploadSuccessMessage: 'Recording uploaded, Circleback is processing it. Notes will appear in the deal once attached.',
    doneMessage: 'Meeting transcript and notes are ready!',
    failedMessage: 'Circleback processing failed.',
  })

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
      await uploadRecording.mutateAsync(form)
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
          <h2 className="text-sbase font-medium text-foreground tracking-tight">Recordings</h2>
          <p className="text-xxs text-muted-foreground mt-0.5">Capture meetings and calls in the browser.</p>
        </div>

        <div className="flex items-center gap-2">
          {(isRecording || isPaused) && (
            <div className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium tabular-nums',
              isRecording
                ? 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400'
                : 'bg-surface-alt border-border text-slate-500',
            )}>
              <span className={cn('w-2 h-2 rounded-full', isRecording ? 'bg-red-500 animate-pulse' : 'bg-slate-400')} />
              {fmtDuration(isRecording ? recorder.duration : frozenDuration.current)}
            </div>
          )}

          {isIdle && (
            <button onClick={() => recorder.start()}
              className="bg-[#6c63ff] hover:bg-[#5b52e8] text-white text-xs font-medium rounded-lg px-3 py-1.5 flex items-center gap-1.5 transition-colors active:scale-[0.98]">
              <Mic size={14} strokeWidth={2} /> New Recording
            </button>
          )}

          {isRecording && (
            <button onClick={handleStop}
              className="bg-red-500 hover:bg-red-600 text-white text-xs font-medium rounded-lg px-3 py-1.5 flex items-center gap-1.5 transition-colors active:scale-[0.98]">
              <Square size={12} strokeWidth={2} fill="currentColor" /> Stop
            </button>
          )}

          {isPaused && (
            <>
              <button onClick={() => recorder.resume()}
                className="bg-card border border-border text-muted-foreground hover:bg-surface-hover text-xs font-medium rounded-lg px-3 py-1.5 flex items-center gap-1.5 transition-colors active:scale-[0.98]">
                <Mic size={13} strokeWidth={2} /> Resume
              </button>
              <button onClick={handleDone}
                className="bg-[#6c63ff] hover:bg-[#5b52e8] text-white text-xs font-medium rounded-lg px-3 py-1.5 flex items-center gap-1.5 transition-colors active:scale-[0.98]">
                <Check size={13} strokeWidth={2.5} /> Done
              </button>
              <button onClick={handleCancel}
                className="text-xs text-slate-400 hover:text-slate-600 hover:text-foreground px-2 py-1.5 transition-colors">
                Cancel
              </button>
            </>
          )}

          {isUploading && (
            <div className="flex items-center gap-2 bg-secondary text-muted-foreground text-xs font-medium rounded-lg px-3 py-1.5">
              <Loader2 size={13} strokeWidth={2} className="animate-spin" /> Saving...
            </div>
          )}
        </div>
      </div>

      <div className="mb-4 bg-card border border-border rounded-md px-4 py-3 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-[rgba(108,99,255,0.08)] dark:bg-primary/[.12] flex items-center justify-center shrink-0">
          <Upload size={14} strokeWidth={1.6} className="text-[#6c63ff] dark:text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-ssm font-medium text-foreground">Import recording to Circleback</div>
          <div className="text-xxs text-muted-foreground mt-0.5">
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
          className="bg-[#6c63ff] hover:bg-[#5b52e8] text-white text-xs font-medium rounded-lg px-3 py-1.5 flex items-center gap-1.5 transition-colors active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
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
        <div className="mb-4 bg-card border border-border rounded-md px-4 py-3">
          <label className="eyebrow-label">Recording title</label>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="Give this recording a name (optional)"
            className="mt-1 w-full bg-transparent text-ssm font-medium text-foreground placeholder:text-slate-400 focus:outline-none" />
        </div>
      )}

      {recorder.error && (
        <div className="mb-4 bg-card border border-red-200 dark:border-red-500/20 rounded-md px-4 py-3 flex items-center gap-2">
          <MicOff size={14} className="text-red-500 shrink-0" />
          <div className="text-xs text-red-600 dark:text-red-400">{recorder.error}</div>
        </div>
      )}

      {uploadError && (
        <div className="mb-4 bg-card border border-red-200 dark:border-red-500/20 rounded-md px-4 py-3 text-xs text-red-600 dark:text-red-400">
          {uploadError}
        </div>
      )}

      {isLoading ? (
        <div className="bg-card border border-border rounded-md overflow-hidden">
          <DataTableSkeleton />
        </div>
      ) : recordings.length === 0 ? (
        <div className="bg-card border border-border rounded-md px-6 py-10 text-center">
          <Mic size={28} strokeWidth={1.4} className="text-text-faint mx-auto mb-3" />
          <div className="text-ssm font-medium text-foreground">No recordings yet</div>
          <div className="text-xxs text-muted-foreground mt-1">Hit Record to capture your first meeting.</div>
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
    <div className="bg-card border border-border rounded-md px-4 py-3 flex items-center gap-3">
      <div className="w-8 h-8 rounded-lg bg-[rgba(108,99,255,0.08)] dark:bg-primary/[.12] flex items-center justify-center shrink-0">
        <Mic size={14} strokeWidth={1.6} className="text-[#6c63ff] dark:text-primary" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-ssm font-medium text-foreground truncate">{recording.title}</div>
        <div className="text-xxs text-muted-foreground tabular-nums mt-0.5">
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
