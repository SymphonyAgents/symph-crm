'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ArrowUpRight, ExternalLink, FileText, Loader2, RefreshCw } from 'lucide-react'
import { useAssignMeetingDeal, useRetryMeetingIngest } from '@/lib/hooks/mutations'
import { useGetMeeting } from '@/lib/hooks/queries'
import { formatDate, cn } from '@/lib/utils'
import type { ApiMeetingRawPayload, ApiMeetingStatus } from '@/lib/types'
import { DataTableSkeleton } from '@/components/ui/data-table'

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
  const retryMeeting = useRetryMeetingIngest()
  const assignMeeting = useAssignMeetingDeal()
  const [dealId, setDealId] = useState('')

  const detail = data?.meeting ?? null
  const rawFallback = getRawPayloadFallback(detail?.rawPayload)
  const summary = data?.summaryNote?.content ? stripFrontmatter(data.summaryNote.content) : rawFallback.summary
  const transcript = data?.transcriptNote?.content ? stripFrontmatter(data.transcriptNote.content) : rawFallback.transcript

  useEffect(() => {
    setDealId(detail?.dealId ?? '')
  }, [detail?.dealId])

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
        <section className="bg-white dark:bg-[#1e1e21] border border-black/[.06] dark:border-white/[.08] rounded-md overflow-hidden">
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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xxs">
              <DetailMeta label="Started" value={detail.startedAt ? formatDate(detail.startedAt) : 'Not set'} />
              <DetailMeta label="Created" value={formatDate(detail.createdAt)} />
              <DetailMeta label="Retries" value={String(detail.retryCount)} />
            </div>

            {detail.attendees.length > 0 && (
              <section className="border border-black/[.06] dark:border-white/[.08] rounded-md px-3 py-2">
                <p className="text-xs font-semibold text-slate-900 dark:text-white">Attendees</p>
                <p className="text-xs leading-5 text-slate-600 dark:text-slate-300 mt-1">{detail.attendees.join(', ')}</p>
              </section>
            )}

            <div className="flex gap-2 flex-wrap">
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
    </div>
  )
}

function DetailMeta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-slate-400 dark:text-slate-500">{label}</p>
      <p className="font-medium text-slate-700 dark:text-slate-300 mt-0.5">{value}</p>
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
