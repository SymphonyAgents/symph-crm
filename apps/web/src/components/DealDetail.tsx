'use client'

import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'
import { EmptyState } from './EmptyState'
import { Avatar } from './Avatar'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api'

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

type Activity = {
  id: string
  type: string
  metadata: Record<string, unknown>
  actorId: string | null
  createdAt: string
}

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

const ACTIVITY_LABELS: Record<string, string> = {
  deal_created: 'Deal created',
  deal_stage_changed: 'Stage changed',
  deal_updated: 'Deal updated',
  deal_value_changed: 'Value updated',
  note_added: 'Note added',
  note_updated: 'Note updated',
  file_uploaded: 'File uploaded',
  contact_added: 'Contact added',
  company_created: 'Company created',
  company_updated: 'Company updated',
  deal_won: 'Deal won',
  deal_lost: 'Deal lost',
  proposal_created: 'Proposal created',
  proposal_sent: 'Proposal sent',
  am_assigned: 'AM assigned',
  deal_flagged: 'Deal flagged',
  deal_unflagged: 'Flag cleared',
  attachment_added: 'Attachment added',
}

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
}

function formatCurrency(v: string | null): string {
  if (!v) return '—'
  const n = parseFloat(v)
  if (isNaN(n)) return '—'
  if (n >= 1_000_000) return '₱' + (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return '₱' + Math.round(n / 1_000) + 'K'
  return '₱' + new Intl.NumberFormat('en-PH').format(n)
}

type DealDetailProps = {
  dealId: string
  onBack: () => void
  onOpenDeal: (id: string) => void
}

export function DealDetail({ dealId, onBack }: DealDetailProps) {
  const { data: deal, isLoading, isError } = useQuery<ApiDealDetail>({
    queryKey: queryKeys.deals.detail(dealId),
    queryFn: () =>
      fetch(`${API}/deals/${dealId}`).then(r => {
        if (!r.ok) throw new Error('Deal not found')
        return r.json()
      }),
    retry: false,
  })

  const { data: activities = [], isLoading: loadingActivities } = useQuery<Activity[]>({
    queryKey: queryKeys.activities.byDeal(dealId),
    queryFn: () =>
      fetch(`${API}/activities?dealId=${dealId}&limit=20`).then(r => r.json()),
    enabled: !!deal,
  })

  const stageColor = deal ? (STAGE_COLORS[deal.stage] ?? '#94a3b8') : '#94a3b8'
  const stageLabel = deal ? (STAGE_LABELS[deal.stage] ?? deal.stage) : ''

  return (
    <div className="p-4 md:p-6 h-full flex flex-col overflow-hidden">
      {/* Back */}
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary-hover mb-3 transition-colors duration-150 w-fit"
      >
        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.2}>
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Back to Pipeline
      </button>

      {/* Loading */}
      {isLoading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-6 h-6 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
            <p className="text-[12px] text-slate-400">Loading deal…</p>
          </div>
        </div>
      )}

      {/* Not found */}
      {(isError || (!isLoading && !deal)) && (
        <div className="flex-1 flex items-center justify-center">
          <EmptyState
            title="Deal not found"
            description="This deal may have been deleted or the link is invalid."
            action={
              <button
                onClick={onBack}
                className="px-4 py-2 rounded-lg bg-primary hover:bg-primary-hover text-white text-[12px] font-semibold transition-colors duration-150"
              >
                Back to Pipeline
              </button>
            }
          />
        </div>
      )}

      {/* Deal content */}
      {deal && (
        <div className="flex-1 overflow-y-auto flex flex-col gap-4 pb-4">

          {/* Deal header card */}
          <div className="bg-white border border-black/[.06] rounded-xl p-5 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="min-w-0">
                <h1 className="text-[18px] font-bold text-slate-900 leading-tight mb-2">{deal.title}</h1>
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: `${stageColor}18`, color: stageColor }}
                  >
                    {stageLabel}
                  </span>
                  {deal.outreachCategory && (
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 capitalize">
                      {deal.outreachCategory}
                    </span>
                  )}
                  {deal.isFlagged && (
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-red-50 text-red-500">
                      ⚑ {deal.flagReason || 'Flagged'}
                    </span>
                  )}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-[24px] font-bold tabular-nums text-primary">
                  {formatCurrency(deal.value)}
                </div>
                {deal.probability != null && (
                  <div className="text-[11px] text-slate-400">{deal.probability}% probability</div>
                )}
              </div>
            </div>

            {/* Meta grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-black/[.05]">
              <div>
                <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-0.5">Assigned To</div>
                <div className="flex items-center gap-1.5">
                  <Avatar name={deal.assignedTo || 'U'} size={18} />
                  <span className="text-[12px] font-medium text-slate-700">{deal.assignedTo || 'Unassigned'}</span>
                </div>
              </div>
              <div>
                <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-0.5">Pricing</div>
                <div className="text-[12px] font-medium text-slate-700 capitalize">{deal.pricingModel || '—'}</div>
              </div>
              {deal.closeDate && (
                <div>
                  <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-0.5">Close Date</div>
                  <div className="text-[12px] font-medium text-slate-700">
                    {new Date(deal.closeDate).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </div>
                </div>
              )}
              <div>
                <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-0.5">Created</div>
                <div className="text-[12px] font-medium text-slate-700">
                  {new Date(deal.createdAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                </div>
              </div>
            </div>

            {/* Services tags */}
            {deal.servicesTags && deal.servicesTags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-black/[.05]">
                {deal.servicesTags.map(s => (
                  <span key={s} className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                    {s}
                  </span>
                ))}
              </div>
            )}

            {/* Links */}
            {(deal.proposalLink || deal.demoLink) && (
              <div className="flex gap-3 mt-3 pt-3 border-t border-black/[.05]">
                {deal.proposalLink && (
                  <a
                    href={deal.proposalLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[12px] font-medium text-primary hover:underline flex items-center gap-1"
                  >
                    View Proposal
                  </a>
                )}
                {deal.demoLink && (
                  <a
                    href={deal.demoLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[12px] font-medium text-primary hover:underline flex items-center gap-1"
                  >
                    Demo Recording
                  </a>
                )}
              </div>
            )}
          </div>

          {/* Activity feed */}
          <div className="bg-white border border-black/[.06] rounded-xl p-5 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
            <div className="text-[13px] font-semibold text-slate-900 mb-3.5">Activity</div>
            {loadingActivities ? (
              <div className="flex items-center justify-center py-8">
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
              <div className="flex flex-col">
                {activities.map((a, i) => (
                  <div
                    key={a.id}
                    className={`flex items-start gap-3 py-2.5 ${i < activities.length - 1 ? 'border-b border-black/[.04]' : ''}`}
                  >
                    <div className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 bg-primary/40" />
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] font-medium text-slate-800">
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

        </div>
      )}
    </div>
  )
}
