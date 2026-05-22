'use client'

import { useMemo, useState } from 'react'
import { ArrowLeft, ExternalLink, FileText, Trash2 } from 'lucide-react'
import { useAssignMeetingDeal, useDeleteMeeting } from '@/lib/hooks/mutations'
import { useGetDeals, useGetMeeting } from '@/lib/hooks/queries'
import { formatDate, cn } from '@/lib/utils'
import type { ApiMeeting, ApiMeetingRawPayload, ApiMeetingStatus } from '@/lib/types'
import { DataTableSkeleton } from '@/components/ui/data-table'
import { Combobox } from '@/components/ui/combobox'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { MeetingAttendeeIdentity, MeetingAttendeesPopover } from '@/components/MeetingAttendeesPopover'

function stripFrontmatter(content: string): string {
  return content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '').trim()
}

function statusTone(status: ApiMeetingStatus): string {
  if (status === 'done') return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20'
  if (status === 'failed') return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-300 dark:border-red-500/20'
  return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/20'
}

function formatTranscriptFallback(lines: ApiMeetingRawPayload['rawPayload'] extends infer Raw
  ? Raw extends { transcript?: infer Lines } ? Lines | undefined : never
  : never): string | null {
  if (!Array.isArray(lines) || lines.length === 0) return null
  const transcript = lines
    .map((line) => {
      if (!line || typeof line !== 'object') return null
      const speaker = 'speaker' in line && typeof line.speaker === 'string' ? line.speaker : 'Speaker'
      const text = 'text' in line && typeof line.text === 'string' ? line.text : ''
      return text ? `${speaker}: ${text}` : null
    })
    .filter((line): line is string => Boolean(line))
    .join('\n\n')
  return transcript || null
}

function getRawPayloadFallback(rawPayload: ApiMeetingRawPayload | null | undefined) {
  return {
    summary: rawPayload?.summaryMarkdown ?? rawPayload?.rawPayload?.notes ?? null,
    transcript: rawPayload?.transcriptMarkdown ?? formatTranscriptFallback(rawPayload?.rawPayload?.transcript),
  }
}

export function MeetingDetail({ meetingId, onBack }: { meetingId: string; onBack: () => void }) {
  const { data, isLoading } = useGetMeeting(meetingId)
  const { data: deals = [] } = useGetDeals()
  const deleteMeeting = useDeleteMeeting({ onSuccess: onBack })
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  const detail = data?.meeting ?? null
  const rawFallback = getRawPayloadFallback(detail?.rawPayload)
  const summary = data?.summaryNote?.content ? stripFrontmatter(data.summaryNote.content) : rawFallback.summary
  const transcript = data?.transcriptNote?.content ? stripFrontmatter(data.transcriptNote.content) : rawFallback.transcript

  if (isLoading && !detail) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <div className="shrink-0 px-4 md:px-6 pt-3 pb-0">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white mb-3"
          >
            <ArrowLeft size={14} strokeWidth={1.8} /> Back to Meetings
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-auto p-4 md:px-6 pb-6">
          <div className="bg-white dark:bg-[#1e1e21] border border-black/[.06] dark:border-white/[.08] rounded-md overflow-hidden">
            <DataTableSkeleton />
          </div>
        </div>
      </div>
    )
  }

  if (!detail) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <div className="flex-1 min-h-0 overflow-auto p-4 md:px-6 pb-6">
          <div className="bg-white dark:bg-[#1e1e21] border border-black/[.06] dark:border-white/[.08] rounded-md px-6 py-10 text-center">
            <FileText size={28} strokeWidth={1.4} className="text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <p className="text-ssm font-semibold text-slate-900 dark:text-white">Meeting not found</p>
            <button onClick={onBack} className="text-xs font-semibold text-primary mt-2">Back to Meetings</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="shrink-0 px-4 md:px-6 pt-3 pb-0">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white mb-3"
        >
          <ArrowLeft size={14} strokeWidth={1.8} /> Back to Meetings
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-auto p-4 md:px-6 pb-6">
        <section className="relative bg-white dark:bg-[#1e1e21] border border-black/[.06] dark:border-white/[.08] rounded-md overflow-visible">
          <span className={cn('absolute right-0 -top-10 border rounded-md px-1.5 py-0.5 text-atom font-semibold capitalize', statusTone(detail.status))}>
            {detail.status}
          </span>
          <div className="px-4 py-3 border-b border-black/[.06] dark:border-white/[.08]">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{detail.title}</p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap lg:justify-end">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xxs text-slate-500 dark:text-slate-400 tabular-nums">
                    {detail.startedAt ? formatDate(detail.startedAt) : formatDate(detail.createdAt)}
                  </span>
                  {detail.attendeeDetails[0] && <MeetingAttendeeIdentity attendee={detail.attendeeDetails[0]} compact />}
                  <MeetingAttendeesPopover attendees={detail.attendeeDetails} />
                </div>
                <MeetingDetailDealSelect detail={detail} deals={deals} />
                <div className="flex gap-2">
                  <a
                    href={detail.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="h-8 w-8 rounded-lg border border-black/[.08] dark:border-white/[.1] flex items-center justify-center text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white shrink-0"
                    title="Open original meeting"
                  >
                    <ExternalLink className="h-4 w-4" strokeWidth={1.8} />
                  </a>
                  <button
                    type="button"
                    onClick={() => setShowDeleteDialog(true)}
                    className="h-8 w-8 rounded-lg border border-red-200 text-red-600 flex items-center justify-center transition-colors hover:bg-red-50 active:scale-[0.96] dark:border-red-500/20 dark:text-red-300 dark:hover:bg-red-500/10"
                    title="Delete meeting"
                  >
                    <Trash2 className="h-4 w-4" strokeWidth={1.8} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="px-4 py-3 space-y-3">
            <ArtifactBlock title="Summary" content={summary} fallbackPath={detail.summaryNotePath} />
            <ArtifactBlock title="Transcript" content={transcript} fallbackPath={detail.transcriptNotePath} />

            {detail.lastError && (
              <div className="rounded-md border border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/10 px-3 py-2 text-xs text-red-700 dark:text-red-300">
                {detail.lastError}
              </div>
            )}
          </div>
        </section>
      </div>

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="mx-4 w-full max-w-sm rounded-lg p-4">
          <DialogTitle className="text-sm font-semibold text-slate-950 dark:text-white">Delete meeting?</DialogTitle>
          <DialogDescription className="mt-1 text-ssm leading-relaxed text-slate-500 dark:text-slate-400">
            This will permanently delete <span className="font-semibold text-slate-700 dark:text-slate-200">{detail.title}</span> from CRM meetings. This cannot be undone.
          </DialogDescription>
          <div className="mt-4 flex gap-2.5">
            <button
              type="button"
              onClick={() => setShowDeleteDialog(false)}
              className="h-8 flex-1 rounded-lg border border-black/[.1] text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 active:scale-[0.96] dark:border-white/[.12] dark:text-slate-300 dark:hover:bg-white/[.06]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => deleteMeeting.mutate(detail.id)}
              disabled={deleteMeeting.isPending}
              className="h-8 flex-1 rounded-lg bg-red-600 text-xs font-semibold text-white transition-colors hover:bg-red-700 active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {deleteMeeting.isPending ? 'Deleting...' : 'Delete permanently'}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function MeetingDetailDealSelect({
  detail,
  deals,
}: {
  detail: ApiMeeting
  deals: Array<{ id: string; title: string }>
}) {
  const assignMeeting = useAssignMeetingDeal()
  const options = useMemo(() => deals.map((deal) => ({ value: deal.id, label: deal.title })), [deals])

  if (deals.length === 0) return null

  return (
    <div className="w-full sm:w-[260px]">
      <Combobox
        options={options}
        value={detail.dealId ?? ''}
        onValueChange={(value) => {
          if (!value || value === detail.dealId) return
          assignMeeting.mutate({ id: detail.id, dealId: value })
        }}
        placeholder={assignMeeting.isPending ? 'Assigning...' : 'Assign deal'}
        className="h-8 rounded-lg text-xxs shadow-none"
      />
    </div>
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
          <div className="max-h-[520px] overflow-auto whitespace-pre-wrap text-xs leading-5 text-slate-700 dark:text-slate-300">
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
