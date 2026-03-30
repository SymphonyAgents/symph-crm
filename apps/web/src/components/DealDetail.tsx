'use client'

import { useState, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { queryKeys } from '@/lib/query-keys'
import { usePatchDealStage } from '@/lib/hooks/mutations'
import { useUser } from '@/lib/hooks/use-user'
import { EmptyState } from './EmptyState'
import { Avatar } from './Avatar'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api'

// ─── Types ────────────────────────────────────────────────────────────────────

type ApiDealDetail = {
  id: string
  companyId: string
  title: string
  stage: string
  value: string | null
  servicesTags: string[] | null
  outreachCategory: string | null
  pricingModel: string | null
  assignedTo: string | null
  lastActivityAt: string | null
  closeDate: string | null
  probability: number | null
  isFlagged: boolean | null
  flagReason: string | null
  proposalLink: string | null
  demoLink: string | null
  createdAt: string
}

type ApiCompany = {
  id: string
  name: string
  domain: string | null
  industry: string | null
  website: string | null
}

type ApiDocument = {
  id: string
  title: string
  type: string
  createdAt: string
  authorId: string
  excerpt: string | null
  wordCount: number | null
}

type Activity = {
  id: string
  type: string
  metadata: Record<string, unknown>
  actorId: string | null
  createdAt: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STAGE_LABELS: Record<string, string> = {
  lead: 'Lead', discovery: 'Discovery', assessment: 'Assessment',
  qualified: 'Qualified', demo: 'Demo', proposal: 'Proposal',
  proposal_demo: 'Demo + Proposal', negotiation: 'Negotiation',
  followup: 'Follow-up', closed_won: 'Won', closed_lost: 'Lost',
}

const STAGE_COLORS: Record<string, string> = {
  lead: '#94a3b8', discovery: '#2563eb', assessment: '#7c3aed',
  qualified: '#0369a1', demo: '#d97706', proposal: '#d97706',
  proposal_demo: '#d97706', negotiation: '#f59e0b', followup: '#f59e0b',
  closed_won: '#16a34a', closed_lost: '#dc2626',
}

const STAGE_ADVANCE_MAP: Record<string, string> = {
  lead: 'discovery', discovery: 'assessment',
  assessment: 'proposal_demo', qualified: 'proposal_demo',
  demo: 'proposal_demo', proposal: 'proposal_demo',
  proposal_demo: 'followup', negotiation: 'followup',
  followup: 'closed_won',
}

const PROGRESS_STAGES = [
  { id: 'lead',        label: 'Lead',           matches: ['lead'] },
  { id: 'discovery',   label: 'Discovery',       matches: ['discovery'] },
  { id: 'assessment',  label: 'Assessment',      matches: ['assessment', 'qualified'] },
  { id: 'demo_prop',   label: 'Demo + Proposal', matches: ['demo', 'proposal', 'proposal_demo'] },
  { id: 'followup',    label: 'Follow-up',       matches: ['negotiation', 'followup'] },
  { id: 'won',         label: 'Won',             matches: ['closed_won'] },
]

const ACTIVITY_LABELS: Record<string, string> = {
  deal_created: 'Deal created', deal_stage_changed: 'Stage changed',
  deal_updated: 'Deal updated', deal_value_changed: 'Value updated',
  note_added: 'Note added', note_updated: 'Note updated',
  file_uploaded: 'File uploaded', contact_added: 'Contact added',
  company_created: 'Company created', company_updated: 'Company updated',
  deal_won: 'Deal won', deal_lost: 'Deal lost',
  proposal_created: 'Proposal created', proposal_sent: 'Proposal sent',
  am_assigned: 'AM assigned', deal_flagged: 'Deal flagged',
  deal_unflagged: 'Flag cleared', attachment_added: 'Attachment added',
}

const DOC_TYPE_LABELS: Record<string, string> = {
  context: 'Context', discovery: 'Discovery', transcript_raw: 'Transcript',
  transcript_clean: 'Transcript', meeting: 'Meeting', proposal: 'Proposal',
  summary: 'Summary', email_thread: 'Email', company_profile: 'Profile',
  weekly_digest: 'Digest', general: 'Note',
}

// Matches any stage to its progress bar index (0–5)
function getStageProgressIndex(stage: string): number {
  return PROGRESS_STAGES.findIndex(ps => ps.matches.includes(stage))
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(v: string | null): string {
  if (!v) return '—'
  const n = parseFloat(v)
  if (isNaN(n)) return '—'
  if (n >= 1_000_000) return '₱' + (n / 1_000_000).toFixed(2) + 'M'
  if (n >= 1_000) return '₱' + (n / 1_000).toFixed(0) + 'K'
  return '₱' + new Intl.NumberFormat('en-PH').format(n)
}

function formatCurrencyFull(v: string | null): string {
  if (!v) return '—'
  const n = parseFloat(v)
  if (isNaN(n)) return '—'
  return '₱' + new Intl.NumberFormat('en-PH').format(n)
}

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
}

function getDaysInStage(activities: Activity[], createdAt: string): number {
  const lastChange = activities
    .filter(a => a.type === 'deal_stage_changed')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
  const since = lastChange ? lastChange.createdAt : createdAt
  return Math.max(0, Math.floor((Date.now() - new Date(since).getTime()) / (1000 * 60 * 60 * 24)))
}

const BRAND_PALETTE = ['#2563eb', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16']
function getBrandColor(name: string | null | undefined): string {
  const str = name || 'default'
  let h = 0
  for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h)
  return BRAND_PALETTE[Math.abs(h) % BRAND_PALETTE.length]
}

function getInitials(name: string): string {
  return name.split(/\s+/).map(w => w[0] || '').join('').slice(0, 2).toUpperCase()
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StageProgress({ currentStage }: { currentStage: string }) {
  const isLost = currentStage === 'closed_lost'
  const currentIdx = isLost ? -1 : getStageProgressIndex(currentStage)

  return (
    <div className="flex items-start mt-5 px-1">
      {PROGRESS_STAGES.map((stage, i) => {
        const isCompleted = i < currentIdx
        const isCurrent = i === currentIdx
        return (
          <div key={stage.id} className="flex items-center flex-1 last:flex-none">
            {/* Connector before (skip first) */}
            {i > 0 && (
              <div
                className="flex-1 h-[2px] -mt-5"
                style={{ background: i <= currentIdx ? 'var(--primary)' : '#e2e8f0' }}
              />
            )}
            {/* Step */}
            <div className="flex flex-col items-center gap-1 shrink-0">
              <div
                className={cn(
                  'w-[28px] h-[28px] rounded-full flex items-center justify-center text-[11px] font-semibold transition-all',
                  isCompleted
                    ? 'bg-primary text-white'
                    : isCurrent
                    ? 'bg-white border-2 border-primary text-primary shadow-sm'
                    : 'bg-white border border-slate-200 text-slate-400'
                )}
              >
                {isCompleted ? (
                  <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  i + 1
                )}
              </div>
              <span
                className={cn(
                  'text-[10px] font-medium whitespace-nowrap',
                  isCurrent ? 'text-primary font-semibold' : isCompleted ? 'text-slate-500' : 'text-slate-300'
                )}
              >
                {stage.label}
              </span>
            </div>
          </div>
        )
      })}
      {isLost && (
        <div className="ml-3 flex items-center">
          <span className="text-[11px] font-semibold text-red-500 bg-red-50 px-2.5 py-0.5 rounded-full border border-red-100">
            Closed Lost
          </span>
        </div>
      )}
    </div>
  )
}

function SidebarSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-[#1e1e21] rounded-xl border border-black/[.06] dark:border-white/[.08] shadow-[0_1px_4px_rgba(0,0,0,0.04)] p-4">
      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-3">{title}</p>
      {children}
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-2 py-1.5 border-b border-black/[.04] dark:border-white/[.05] last:border-0">
      <span className="text-[12px] text-slate-400 shrink-0">{label}</span>
      <span className="text-[12px] font-medium text-slate-800 dark:text-white text-right">{value}</span>
    </div>
  )
}

function QuickActionRow({
  icon,
  label,
  onClick,
  variant = 'default',
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
  variant?: 'default' | 'success' | 'danger'
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-2.5 w-full px-2 py-2 text-[12.5px] rounded-lg transition-colors text-left',
        variant === 'success'
          ? 'text-[#16a34a] hover:bg-[rgba(22,163,74,0.06)]'
          : variant === 'danger'
          ? 'text-red-600 hover:bg-red-50 dark:hover:bg-red-500/[.08]'
          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[.04]'
      )}
    >
      <span className="w-5 h-5 flex items-center justify-center shrink-0 text-slate-400">
        {icon}
      </span>
      {label}
    </button>
  )
}

type DealDetailProps = {
  dealId: string
  onBack: () => void
  onOpenDeal: (id: string) => void
}

// ─── Main component ───────────────────────────────────────────────────────────

export function DealDetail({ dealId, onBack }: DealDetailProps) {
  const [activeTab, setActiveTab] = useState<'notes' | 'resources' | 'timeline'>('notes')
  const [noteText, setNoteText] = useState('')
  const [noteType, setNoteType] = useState<string>('general')
  const [addingNote, setAddingNote] = useState(false)

  const queryClient = useQueryClient()
  const router = useRouter()
  const { userId, isSales } = useUser()
  const patchStage = usePatchDealStage()

  // ── Queries ──────────────────────────────────────────────────────────────

  const { data: deal, isLoading, isError } = useQuery<ApiDealDetail>({
    queryKey: queryKeys.deals.detail(dealId),
    queryFn: () =>
      fetch(`${API}/deals/${dealId}`).then(r => {
        if (!r.ok) throw new Error('Deal not found')
        return r.json()
      }),
    retry: false,
  })

  const { data: company } = useQuery<ApiCompany>({
    queryKey: queryKeys.companies.detail(deal?.companyId ?? ''),
    queryFn: () =>
      fetch(`${API}/companies/${deal!.companyId}`).then(r => r.json()),
    enabled: !!deal?.companyId,
  })

  const { data: activities = [], isLoading: loadingActivities } = useQuery<Activity[]>({
    queryKey: queryKeys.activities.byDeal(dealId),
    queryFn: () =>
      fetch(`${API}/activities?dealId=${dealId}&limit=30`).then(r => r.json()),
    enabled: !!deal,
  })

  const { data: documents = [], isLoading: loadingDocs, refetch: refetchDocs } = useQuery<ApiDocument[]>({
    queryKey: ['documents', 'deal', dealId],
    queryFn: () =>
      fetch(`${API}/documents?dealId=${dealId}`).then(r => r.json()),
    enabled: !!deal,
  })

  // ── Derived values ───────────────────────────────────────────────────────

  const stageColor = deal ? (STAGE_COLORS[deal.stage] ?? '#94a3b8') : '#94a3b8'
  const stageLabel = deal ? (STAGE_LABELS[deal.stage] ?? deal.stage) : ''
  const nextStage = deal ? STAGE_ADVANCE_MAP[deal.stage] : undefined
  const isTerminal = deal ? (deal.stage === 'closed_won' || deal.stage === 'closed_lost') : false
  const daysInStage = deal ? getDaysInStage(activities, deal.createdAt) : 0
  const brandColor = getBrandColor(company?.name ?? deal?.companyId)

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleAdvance = useCallback(() => {
    if (!deal || !nextStage) return
    const prev = queryClient.getQueryData(queryKeys.deals.detail(dealId))
    patchStage.mutate({ id: dealId, stage: nextStage }, {
      onError: () => queryClient.setQueryData(queryKeys.deals.detail(dealId), prev),
      onSettled: () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.deals.detail(dealId) })
        queryClient.invalidateQueries({ queryKey: queryKeys.deals.all })
      },
    })
  }, [deal, nextStage, dealId, patchStage, queryClient])

  const handleMarkWon = useCallback(() => {
    if (!confirm('Mark this deal as Won?')) return
    patchStage.mutate({ id: dealId, stage: 'closed_won' }, {
      onSettled: () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.deals.detail(dealId) })
        queryClient.invalidateQueries({ queryKey: queryKeys.deals.all })
      },
    })
  }, [dealId, patchStage, queryClient])

  const handleMarkLost = useCallback(() => {
    if (!confirm('Close this deal as Lost?')) return
    patchStage.mutate({ id: dealId, stage: 'closed_lost' }, {
      onSettled: () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.deals.detail(dealId) })
        queryClient.invalidateQueries({ queryKey: queryKeys.deals.all })
      },
    })
  }, [dealId, patchStage, queryClient])

  const handleAddNote = useCallback(async () => {
    if (!noteText.trim() || !deal) return
    if (!userId) { toast.error('Not authenticated'); return }
    setAddingNote(true)
    try {
      const title = noteText.trim().split('\n')[0].slice(0, 100) || 'Note'
      const res = await fetch(`${API}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
        body: JSON.stringify({
          dealId,
          type: noteType,
          title,
          content: noteText.trim(),
          authorId: userId,
        }),
      })
      if (!res.ok) throw new Error('Failed to save note')
      setNoteText('')
      refetchDocs()
      toast.success('Note saved')
    } catch {
      toast.error('Failed to save note')
    } finally {
      setAddingNote(false)
    }
  }, [noteText, noteType, deal, dealId, userId, refetchDocs])

  // ── Render: loading / error ───────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
          <p className="text-[12px] text-slate-400">Loading deal…</p>
        </div>
      </div>
    )
  }

  if (isError || !deal) {
    return (
      <div className="p-4 md:p-6 h-full flex flex-col">
        <button onClick={onBack} className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 mb-3 w-fit">
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><polyline points="15 18 9 12 15 6" /></svg>
          Back to Pipeline
        </button>
        <div className="flex-1 flex items-center justify-center">
          <EmptyState
            title="Deal not found"
            description="This deal may have been deleted or the link is invalid."
            action={
              <button onClick={onBack} className="px-4 py-2 rounded-lg bg-primary text-white text-[12px] font-semibold">
                Back to Pipeline
              </button>
            }
          />
        </div>
      </div>
    )
  }

  // ── Render: deal content ──────────────────────────────────────────────────

  return (
    <div className="p-4 md:p-6">
      {/* Back */}
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-[12px] font-medium text-slate-500 dark:text-slate-300 hover:text-primary dark:hover:text-primary transition-colors mb-4 w-fit"
      >
        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><polyline points="15 18 9 12 15 6" /></svg>
        Back to Pipeline
      </button>

      {/* ── Header card ─────────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-[#1e1e21] rounded-xl border border-black/[.06] dark:border-white/[.08] shadow-[0_1px_4px_rgba(0,0,0,0.04)] p-5 mb-4">
        <div className="flex items-start justify-between gap-4">
          {/* Left: Brand + deal info */}
          <div className="flex items-center gap-3.5 min-w-0">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center text-[15px] font-bold shrink-0"
              style={{ background: `${brandColor}18`, color: brandColor }}
            >
              {getInitials(company?.name ?? 'No Brand')}
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide leading-none mb-1">
                {company?.name ?? 'No Brand'}
              </p>
              <h1 className="text-[20px] font-bold text-slate-900 dark:text-white leading-tight truncate">
                {deal.title}
              </h1>
              <p className="text-[12px] text-slate-400 mt-0.5">
                {[company?.name, company?.industry].filter(Boolean).join(' · ') || 'No brand assigned'}
              </p>
            </div>
          </div>

          {/* Right: Value + stage + advance */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right">
              <div className="text-[26px] font-bold tabular-nums text-primary leading-tight">
                {formatCurrencyFull(deal.value)}
              </div>
              <div className="mt-0.5">
                <span
                  className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: `${stageColor}18`, color: stageColor }}
                >
                  {stageLabel}
                </span>
              </div>
            </div>
            {nextStage && (
              <button
                onClick={handleAdvance}
                disabled={patchStage.isPending}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg font-semibold text-[13px] text-white transition-opacity disabled:opacity-60"
                style={{ background: `linear-gradient(135deg, var(--primary), ${stageColor})` }}
              >
                Advance
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            )}
            {isTerminal && (
              <span className={cn(
                'text-[12px] font-semibold px-3 py-1.5 rounded-lg',
                deal.stage === 'closed_won'
                  ? 'bg-[rgba(22,163,74,0.1)] text-[#16a34a]'
                  : 'bg-red-50 text-red-500'
              )}>
                {deal.stage === 'closed_won' ? '✓ Won' : '✕ Lost'}
              </span>
            )}
          </div>
        </div>

        {/* Stage progress */}
        <StageProgress currentStage={deal.stage} />
      </div>

      {/* ── Body: left content + right sidebar ──────────────────────────────── */}
      <div className="flex gap-4 items-start">

        {/* Left: tabs + content */}
        <div className="flex-1 min-w-0 bg-white dark:bg-[#1e1e21] rounded-xl border border-black/[.06] dark:border-white/[.08] shadow-[0_1px_4px_rgba(0,0,0,0.04)] overflow-hidden">
          {/* Tab bar */}
          <div className="flex border-b border-black/[.06] dark:border-white/[.08]">
            {([
              { id: 'notes', label: 'Notes', count: documents.length },
              { id: 'resources', label: 'Resources', count: null },
              { id: 'timeline', label: 'Timeline', count: activities.length },
            ] as const).map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-1.5 px-4 py-3 text-[13px] font-medium border-b-2 -mb-px transition-colors',
                  activeTab === tab.id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                )}
              >
                {tab.label}
                {tab.count !== null && tab.count > 0 && (
                  <span className={cn(
                    'text-[10px] font-semibold px-1.5 py-0.5 rounded-full min-w-[18px] text-center',
                    activeTab === tab.id
                      ? 'bg-primary text-white'
                      : 'bg-slate-100 dark:bg-white/[.08] text-slate-500'
                  )}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* ── Notes tab ─────────────────────────────────────────────────── */}
          {activeTab === 'notes' && (
            <div>
              {/* Note input */}
              <div className="p-4 border-b border-black/[.05] dark:border-white/[.06]">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Add Note</p>
                <textarea
                  value={noteText}
                  onChange={e => setNoteText(e.target.value)}
                  placeholder="Add notes, paste a transcript, drop a link…"
                  rows={3}
                  className="w-full text-[13px] text-slate-800 dark:text-white bg-slate-50 dark:bg-white/[.04] border border-black/[.06] dark:border-white/[.08] rounded-lg px-3 py-2.5 placeholder:text-slate-400 resize-none outline-none focus:outline-none focus:border-primary/40 transition-colors"
                />
                <div className="flex items-center justify-between mt-2">
                  <select
                    value={noteType}
                    onChange={e => setNoteType(e.target.value)}
                    className="text-[12px] text-slate-600 dark:text-slate-400 bg-white dark:bg-[#1e1e21] border border-black/[.08] dark:border-white/[.08] rounded-lg px-2.5 py-1.5 outline-none focus:outline-none"
                  >
                    <option value="general">Note</option>
                    <option value="discovery">Discovery</option>
                    <option value="meeting">Meeting Notes</option>
                    <option value="transcript_raw">Transcript</option>
                    <option value="proposal">Proposal</option>
                  </select>
                  <button
                    onClick={handleAddNote}
                    disabled={!noteText.trim() || addingNote}
                    className="px-4 py-1.5 rounded-lg bg-primary text-white text-[12px] font-semibold disabled:opacity-40 hover:bg-primary/90 transition-colors"
                  >
                    {addingNote ? 'Saving…' : 'Add'}
                  </button>
                </div>
              </div>

              {/* Notes list */}
              {loadingDocs ? (
                <div className="p-8 flex items-center justify-center">
                  <div className="w-5 h-5 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
                </div>
              ) : documents.length === 0 ? (
                <div className="py-10 text-center">
                  <p className="text-[13px] text-slate-400">No notes yet</p>
                  <p className="text-[11px] text-slate-300 mt-0.5">Add the first note above</p>
                </div>
              ) : (
                <div>
                  {documents.map(doc => (
                    <div
                      key={doc.id}
                      className="flex items-start gap-3 px-4 py-3 border-b border-black/[.04] dark:border-white/[.05] last:border-0 hover:bg-slate-50 dark:hover:bg-white/[.02] transition-colors"
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-primary/50 mt-2 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium text-slate-800 dark:text-white truncate">{doc.title}</p>
                        {doc.excerpt && (
                          <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-2">{doc.excerpt}</p>
                        )}
                        <p className="text-[11px] text-slate-400 mt-0.5">{doc.authorId}</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 text-[10px] text-slate-400">
                        <span>{DOC_TYPE_LABELS[doc.type] ?? doc.type}</span>
                        <span>·</span>
                        <span>
                          {new Date(doc.createdAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Resources tab ─────────────────────────────────────────────── */}
          {activeTab === 'resources' && (
            <div className="py-12">
              <EmptyState
                title="No resources yet"
                description="Proposal links, attachments, and demo recordings will appear here"
                compact
              />
              {/* Quick links from deal fields */}
              {(deal.proposalLink || deal.demoLink) && (
                <div className="flex flex-col gap-2 px-6 mt-4">
                  {deal.proposalLink && (
                    <a
                      href={deal.proposalLink.startsWith('http') ? deal.proposalLink : `https://${deal.proposalLink}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-[13px] text-primary hover:underline font-medium"
                    >
                      <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                      View Proposal
                    </a>
                  )}
                  {deal.demoLink && (
                    <a
                      href={deal.demoLink.startsWith('http') ? deal.demoLink : `https://${deal.demoLink}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-[13px] text-primary hover:underline font-medium"
                    >
                      <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" /></svg>
                      Demo Recording
                    </a>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Timeline tab ──────────────────────────────────────────────── */}
          {activeTab === 'timeline' && (
            <div>
              {loadingActivities ? (
                <div className="p-8 flex items-center justify-center">
                  <div className="w-5 h-5 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
                </div>
              ) : activities.length === 0 ? (
                <EmptyState
                  icon="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  title="No activity yet"
                  description="Actions on this deal will appear here"
                  compact
                />
              ) : (
                <div className="divide-y divide-black/[.04] dark:divide-white/[.05]">
                  {activities.map(a => (
                    <div key={a.id} className="flex items-start gap-3 px-4 py-3">
                      <div className="w-1.5 h-1.5 rounded-full mt-2 shrink-0 bg-primary/40" />
                      <div className="flex-1 min-w-0">
                        <div className="text-[12px] font-medium text-slate-800 dark:text-white">
                          {ACTIVITY_LABELS[a.type] ?? a.type.replace(/_/g, ' ')}
                        </div>
                        {a.actorId && (
                          <div className="text-[10px] text-slate-400 mt-0.5">by {a.actorId}</div>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 shrink-0">{timeAgo(a.createdAt)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Right sidebar ──────────────────────────────────────────────────── */}
        <div className="w-[260px] shrink-0 flex flex-col gap-3">

          {/* Deal Info */}
          <SidebarSection title="Deal Info">
            <InfoRow
              label="Deal Size"
              value={
                <span className="text-primary font-bold">{formatCurrencyFull(deal.value)}</span>
              }
            />
            {deal.outreachCategory && (
              <InfoRow
                label="Category"
                value={
                  <span
                    className={cn(
                      'text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize',
                      deal.outreachCategory === 'inbound'
                        ? 'bg-[rgba(22,163,74,0.1)] text-[#16a34a]'
                        : 'bg-slate-100 dark:bg-white/[.06] text-slate-500'
                    )}
                  >
                    {deal.outreachCategory}
                  </span>
                }
              />
            )}
            {company?.industry && (
              <InfoRow label="Industry" value={company.industry} />
            )}
            <InfoRow label="Date Captured" value={formatDate(deal.createdAt)} />
            <InfoRow label="Days in Stage" value={`${daysInStage}d`} />
            {deal.pricingModel && (
              <InfoRow label="Pricing" value={<span className="capitalize">{deal.pricingModel}</span>} />
            )}
            {deal.servicesTags && deal.servicesTags.length > 0 && (
              <div className="pt-2">
                <span className="text-[10px] text-slate-400 block mb-1.5">Services</span>
                <div className="flex flex-wrap gap-1">
                  {deal.servicesTags.map(s => (
                    <span key={s} className="text-[10px] font-medium px-1.5 py-0.5 rounded-lg bg-primary/10 text-primary">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </SidebarSection>

          {/* Account Manager */}
          <SidebarSection title="Account Manager">
            {deal.assignedTo ? (
              <div className="flex items-center gap-2.5">
                <Avatar name={deal.assignedTo} size={36} />
                <div>
                  <p className="text-[13px] font-semibold text-slate-800 dark:text-white">{deal.assignedTo}</p>
                  <p className="text-[11px] text-slate-400">Account Manager</p>
                </div>
              </div>
            ) : (
              <p className="text-[12px] text-slate-400 italic">Unassigned</p>
            )}
          </SidebarSection>

          {/* Quick Actions */}
          <SidebarSection title="Quick Actions">
            <div className="flex flex-col -mx-2">
              <QuickActionRow
                icon={<svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>}
                label="Schedule Demo"
                onClick={() => toast.info('Schedule Demo — coming soon')}
              />
              <QuickActionRow
                icon={<svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>}
                label="Build Proposal"
                onClick={() => router.push('/proposals')}
              />
              <QuickActionRow
                icon={<svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>}
                label="Send Contract"
                onClick={() => toast.info('Send Contract — coming soon')}
              />
              {!isTerminal && isSales && (
                <>
                  <div className="border-t border-black/[.04] dark:border-white/[.06] my-1" />
                  <QuickActionRow
                    icon={<svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><polyline points="20 6 9 17 4 12" /></svg>}
                    label="Mark as Won"
                    onClick={handleMarkWon}
                    variant="success"
                  />
                  <QuickActionRow
                    icon={<svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>}
                    label="Close as Lost"
                    onClick={handleMarkLost}
                    variant="danger"
                  />
                </>
              )}
            </div>
          </SidebarSection>

          {/* Deal flags */}
          {deal.isFlagged && (
            <div className="bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 rounded-xl p-4">
              <p className="text-[10px] font-semibold text-red-600 uppercase tracking-wide mb-1">⚑ Flagged</p>
              <p className="text-[12px] text-red-700 dark:text-red-400">{deal.flagReason || 'No reason specified'}</p>
            </div>
          )}

          {/* Probability */}
          {deal.probability != null && (
            <div className="bg-white dark:bg-[#1e1e21] rounded-xl border border-black/[.06] dark:border-white/[.08] shadow-[0_1px_4px_rgba(0,0,0,0.04)] p-4">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Win Probability</p>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 bg-slate-100 dark:bg-white/[.08] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${deal.probability}%`, background: 'var(--primary)' }}
                  />
                </div>
                <span className="text-[13px] font-bold text-primary tabular-nums">{deal.probability}%</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
