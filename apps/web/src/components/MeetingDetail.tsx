'use client'

import { useMemo, useState } from 'react'
import { ArrowLeft, CheckCircle, Copy, ExternalLink, FileText, Mail, Trash2 } from 'lucide-react'
import { useAssignMeetingDeal, useCreateMeetingActionPackage, useDeleteMeeting } from '@/lib/hooks/mutations'
import { useGetDeals, useGetMeeting } from '@/lib/hooks/queries'
import { formatDate, cn } from '@/lib/utils'
import type { ApiMeeting, ApiMeetingActionPackage, ApiMeetingRawPayload, ApiMeetingStatus } from '@/lib/types'
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
  const createActionPackage = useCreateMeetingActionPackage()
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [createDraft, setCreateDraft] = useState(true)
  const [createReminder, setCreateReminder] = useState(false)
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null)

  const detail = data?.meeting ?? null
  const rawFallback = getRawPayloadFallback(detail?.rawPayload)
  const summary = data?.summaryNote?.content ? stripFrontmatter(data.summaryNote.content) : rawFallback.summary
  const transcript = data?.transcriptNote?.content ? stripFrontmatter(data.transcriptNote.content) : rawFallback.transcript
  const actionPackage = detail?.actionPackage ?? detail?.rawPayload?.meetingActionPackage ?? null

  if (isLoading && !detail) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <div className="shrink-0 px-4 md:px-6 pt-3 pb-0">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 hover:text-foreground mb-3"
          >
            <ArrowLeft size={14} strokeWidth={1.8} /> Back to Meetings
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-auto p-4 md:px-6 pb-6">
          <div className="bg-card border border-border rounded-md overflow-hidden">
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
          <div className="bg-card border border-border rounded-md px-6 py-10 text-center">
            <FileText size={28} strokeWidth={1.4} className="text-text-faint mx-auto mb-3" />
            <p className="text-ssm font-semibold text-foreground">Meeting not found</p>
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
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 hover:text-foreground mb-3"
        >
          <ArrowLeft size={14} strokeWidth={1.8} /> Back to Meetings
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-auto p-4 md:px-6 pb-6">
        <section className="relative bg-card border border-border rounded-md overflow-visible">
          <span className={cn('absolute right-0 -top-10 border rounded-md px-1.5 py-0.5 text-atom font-semibold capitalize', statusTone(detail.status))}>
            {detail.status}
          </span>
          <div className="px-4 py-3 border-b border-border">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{detail.title}</p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap lg:justify-end">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xxs text-muted-foreground tabular-nums">
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
                    className="h-8 w-8 rounded-lg border border-border flex items-center justify-center text-slate-500 hover:text-slate-900 hover:text-foreground shrink-0"
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
            <MeetingActionPackageBlock
              detail={detail}
              deals={deals}
              actionPackage={actionPackage}
              selectedDealId={selectedDealId ?? detail.dealId ?? ''}
              onSelectedDealIdChange={setSelectedDealId}
              createDraft={createDraft}
              onCreateDraftChange={setCreateDraft}
              createReminder={createReminder}
              onCreateReminderChange={setCreateReminder}
              candidateDeals={createActionPackage.data?.candidates?.deals ?? []}
              isPending={createActionPackage.isPending}
              onGenerate={() => createActionPackage.mutate({
                id: detail.id,
                dealId: selectedDealId ?? detail.dealId ?? null,
                createDraft,
                createReminder,
              })}
            />

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
          <DialogTitle className="text-sm font-semibold text-slate-950">Delete meeting?</DialogTitle>
          <DialogDescription className="mt-1 text-ssm leading-relaxed text-muted-foreground">
            This will permanently delete <span className="font-semibold text-foreground">{detail.title}</span> from CRM meetings. This cannot be undone.
          </DialogDescription>
          <div className="mt-4 flex gap-2.5">
            <button
              type="button"
              onClick={() => setShowDeleteDialog(false)}
              className="h-8 flex-1 rounded-lg border border-border text-xs font-semibold text-slate-700 transition-colors hover:bg-surface-alt active:scale-[0.96]"
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

function MeetingActionPackageBlock({
  detail,
  deals,
  actionPackage,
  selectedDealId,
  onSelectedDealIdChange,
  createDraft,
  onCreateDraftChange,
  createReminder,
  onCreateReminderChange,
  candidateDeals,
  isPending,
  onGenerate,
}: {
  detail: ApiMeeting
  deals: Array<{ id: string; title: string }>
  actionPackage: ApiMeetingActionPackage | null
  selectedDealId: string
  onSelectedDealIdChange: (dealId: string | null) => void
  createDraft: boolean
  onCreateDraftChange: (value: boolean) => void
  createReminder: boolean
  onCreateReminderChange: (value: boolean) => void
  candidateDeals: Array<{ id: string; title: string }>
  isPending: boolean
  onGenerate: () => void
}) {
  const options = useMemo(() => deals.map((deal) => ({ value: deal.id, label: deal.title })), [deals])

  return (
    <section className="border border-border rounded-md overflow-hidden">
      <div className="px-3 py-2 bg-surface-alt border-b border-border flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-foreground">Action package</p>
          <p className="text-xxs text-muted-foreground">Draft-only follow-up, CRM actions, and source citations.</p>
        </div>
        {actionPackage?.status && (
          <span className="w-fit rounded-md border border-border px-1.5 py-0.5 text-atom font-semibold capitalize text-muted-foreground">
            {actionPackage.status.replaceAll('_', ' ')}
          </span>
        )}
      </div>

      <div className="space-y-3 px-3 py-3">
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
          Draft-only safety boundary: this feature can create a Gmail draft, but it never sends email automatically.
        </div>

        <div className="grid gap-2 lg:grid-cols-[1fr_auto] lg:items-center">
          <Combobox
            options={options}
            value={selectedDealId}
            onValueChange={(value) => onSelectedDealIdChange(value || null)}
            placeholder="Confirm deal before attaching"
            className="h-8 rounded-lg text-xxs shadow-none"
          />
          <button
            type="button"
            onClick={onGenerate}
            disabled={isPending}
            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground transition-colors hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Mail className="h-3.5 w-3.5" strokeWidth={1.8} />
            {isPending ? 'Generating...' : 'Generate follow-up'}
          </button>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={createDraft}
              onChange={(event) => onCreateDraftChange(event.target.checked)}
              className="h-3.5 w-3.5 rounded border-border"
            />
            Create Gmail draft only
          </label>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={createReminder}
              onChange={(event) => onCreateReminderChange(event.target.checked)}
              className="h-3.5 w-3.5 rounded border-border"
            />
            Create follow-up reminder
          </label>
        </div>

        {!actionPackage && (
          <div className="text-xs text-muted-foreground">
            Generate an action package after reviewing the summary and transcript. If no deal is confirmed, CRM will return a review state instead of attaching blindly.
          </div>
        )}

        {candidateDeals.length > 0 && (
          <div className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
            <p className="font-semibold text-foreground">Suggested deal matches</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {candidateDeals.map((deal) => (
                <button
                  key={deal.id}
                  type="button"
                  onClick={() => onSelectedDealIdChange(deal.id)}
                  className="rounded-md border border-primary/20 bg-card px-2 py-1 text-xxs font-semibold text-primary transition-colors hover:bg-primary/10"
                >
                  {deal.title}
                </button>
              ))}
            </div>
          </div>
        )}

        {actionPackage?.lastError && (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
            {actionPackage.lastError}
          </div>
        )}

        {actionPackage && (
          <div className="space-y-3">
            <div className="rounded-md border border-border p-3">
              <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <CheckCircle className="h-3.5 w-3.5" strokeWidth={1.8} /> Summary
              </div>
              <p className="whitespace-pre-wrap text-xs leading-5 text-muted-foreground">{actionPackage.summary}</p>
            </div>

            <div className="rounded-md border border-border p-3">
              <p className="mb-2 text-xs font-semibold text-foreground">Action items</p>
              <ul className="space-y-1 text-xs leading-5 text-muted-foreground">
                {actionPackage.actionItems.map((item, index) => <li key={`${item}-${index}`}>- {item}</li>)}
              </ul>
            </div>

            <div className="rounded-md border border-border p-3">
              <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-semibold text-foreground">Draft email</p>
                  <p className="text-xxs text-muted-foreground">
                    {actionPackage.draftGmailId ? `Gmail draft created: ${actionPackage.draftGmailId}` : 'Copy or regenerate with draft creation enabled.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => navigator.clipboard?.writeText(`Subject: ${actionPackage.followUpDraftSubject}\n\n${actionPackage.followUpDraftText}`)}
                  className="inline-flex h-7 items-center justify-center gap-1.5 rounded-md border border-border px-2 text-xxs font-semibold text-slate-600 hover:bg-surface-alt"
                >
                  <Copy className="h-3.5 w-3.5" strokeWidth={1.8} /> Copy draft
                </button>
              </div>
              <div className="rounded-md bg-surface-alt p-3 text-xs leading-5 text-muted-foreground">
                <p className="font-semibold">Subject: {actionPackage.followUpDraftSubject}</p>
                <pre className="mt-2 whitespace-pre-wrap font-sans">{actionPackage.followUpDraftText}</pre>
              </div>
            </div>

            <div className="rounded-md border border-border p-3">
              <p className="mb-2 text-xs font-semibold text-foreground">Sources</p>
              <ul className="space-y-1 text-xs leading-5 text-muted-foreground">
                {actionPackage.citations.map((citation, index) => (
                  <li key={`${citation.label}-${index}`}>
                    - {citation.url ? <a className="text-primary underline-offset-2 hover:underline" href={citation.url} target="_blank" rel="noreferrer">{citation.label}</a> : citation.label}
                    {citation.storagePath ? `: ${citation.storagePath}` : ''}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {detail.sourceUrl && (
          <a href={detail.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary underline-offset-2 hover:underline">
            <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.8} /> Open source meeting
          </a>
        )}
      </div>
    </section>
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
    <section className="border border-border rounded-md overflow-hidden">
      <div className="px-3 py-2 bg-surface-alt border-b border-border">
        <p className="text-xs font-semibold text-foreground">{title}</p>
      </div>
      <div className="px-3 py-3">
        {content ? (
          <div className="max-h-[520px] overflow-auto whitespace-pre-wrap text-xs leading-5 text-muted-foreground">
            {content}
          </div>
        ) : (
          <div className="text-xs text-muted-foreground">
            {fallbackPath ? `Saved at ${fallbackPath}. Content will load when the NFS file is available.` : 'Not saved yet.'}
          </div>
        )}
      </div>
    </section>
  )
}
