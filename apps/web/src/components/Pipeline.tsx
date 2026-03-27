'use client'

import { useQuery } from '@tanstack/react-query'
import { cn } from '@/lib/utils'
import { formatPeso } from '@/lib/utils'
import { Avatar } from './Avatar'
import { queryKeys } from '@/lib/query-keys'

// --- Types ---
type ApiDeal = {
  id: string
  companyId: string
  title: string
  stage: string
  value: string | null
  servicesTags: string[] | null
  outreachCategory: string | null
  assignedTo: string | null
  lastActivityAt: string | null
}

type PipelineProps = {
  onOpenDeal: (id: string) => void
}

/**
 * 7 consolidated stages — mirrors PipelineBar in Dashboard.
 * Granular DB stages are grouped so the board isn't 11 columns wide.
 */
const KANBAN_STAGES = [
  { id: 'lead',         label: 'Lead',           color: '#94a3b8', matches: ['lead'] },
  { id: 'discovery',   label: 'Discovery',       color: '#2563eb', matches: ['discovery'] },
  { id: 'assessment',  label: 'Assessment',      color: '#7c3aed', matches: ['assessment', 'qualified'] },
  { id: 'demo_prop',   label: 'Demo + Proposal', color: '#d97706', matches: ['demo', 'proposal', 'proposal_demo'] },
  { id: 'followup',    label: 'Follow-up',       color: '#f59e0b', matches: ['negotiation', 'followup'] },
  { id: 'closed_won',  label: 'Won',             color: '#16a34a', matches: ['closed_won'] },
  { id: 'closed_lost', label: 'Lost',            color: '#dc2626', matches: ['closed_lost'] },
]

const CLOSED_IDS = new Set(['closed_won', 'closed_lost'])

// Sub-stage label for individual deal cards (show granular stage inside grouped column)
const SUB_STAGE_LABEL: Record<string, string> = {
  lead: 'Lead', discovery: 'Discovery', assessment: 'Assessment',
  qualified: 'Qualified', demo: 'Demo', proposal: 'Proposal',
  proposal_demo: 'Demo + Proposal', negotiation: 'Negotiation',
  followup: 'Follow-up', closed_won: 'Won', closed_lost: 'Lost',
}

function DealCard({ deal, colColor, onClick }: { deal: ApiDeal; colColor: string; onClick: () => void }) {
  const isWon = deal.stage === 'closed_won'
  const isLost = deal.stage === 'closed_lost'
  const outreach = deal.outreachCategory || 'outbound'
  const services = deal.servicesTags || []
  const amName = deal.assignedTo || 'Unassigned'

  return (
    <div
      onClick={onClick}
      className={cn(
        'rounded-xl p-3.5 cursor-pointer transition-all duration-150',
        isWon
          ? 'bg-[rgba(22,163,74,0.05)] border border-[rgba(22,163,74,0.22)]'
          : isLost
          ? 'bg-white border border-[rgba(220,38,38,0.15)] opacity-70'
          : 'bg-white border border-black/[.08] hover:border-primary hover:shadow-[0_0_0_3px_var(--color-primary-dim)]'
      )}
    >
      {/* Sub-stage label + outreach badge */}
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-[0.05em] text-slate-400">
          {SUB_STAGE_LABEL[deal.stage] ?? deal.stage.replace(/_/g, ' ')}
        </span>
        <span className={cn(
          'text-[10px] font-semibold px-2 py-0.5 rounded-full',
          outreach === 'inbound'
            ? 'bg-success-dim text-success'
            : 'bg-primary/10 text-primary'
        )}>
          {outreach === 'inbound' ? 'Inbound' : 'Outbound'}
        </span>
      </div>

      {/* Deal title */}
      <div className="text-[14px] font-bold text-slate-900 leading-snug mb-2.5">
        {deal.title}
      </div>

      {/* Services tags */}
      {services.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2.5">
          {services.slice(0, 3).map(s => (
            <span key={s} className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary-dim text-primary">
              {s}
            </span>
          ))}
          {services.length > 3 && (
            <span className="text-[10px] text-slate-400">+{services.length - 3}</span>
          )}
        </div>
      )}

      {/* Value + AM */}
      <div className="flex items-center justify-between pt-2 border-t border-black/[.05]">
        <span className="text-[15px] font-bold tabular-nums" style={{ color: colColor }}>
          {deal.value ? formatPeso(parseFloat(deal.value)) : '—'}
        </span>
        <div className="flex items-center gap-1">
          <Avatar name={amName} size={20} />
          <span className="text-[11px] font-medium text-slate-600">{amName}</span>
        </div>
      </div>
    </div>
  )
}

// --- Fetch ---
async function fetchDeals(): Promise<ApiDeal[]> {
  const res = await fetch('/api/deals')
  if (!res.ok) throw new Error('Failed to fetch deals')
  return res.json()
}

export function Pipeline({ onOpenDeal }: PipelineProps) {
  const { data: deals = [], isLoading } = useQuery({
    queryKey: queryKeys.deals.all,
    queryFn: fetchDeals,
  })

  const activeDeals = deals.filter(d => !CLOSED_IDS.has(d.stage))
  const totalValue = activeDeals.reduce((s, d) => s + (parseFloat(d.value || '0') || 0), 0)

  // Group deals into 7 consolidated columns
  const columnDeals = KANBAN_STAGES.map(col => ({
    ...col,
    deals: deals.filter(d => col.matches.includes(d.stage)),
    total: deals
      .filter(d => col.matches.includes(d.stage))
      .reduce((s, d) => s + (parseFloat(d.value || '0') || 0), 0),
  }))

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Stats + actions */}
      <div className="flex items-center justify-between px-4 py-2.5 shrink-0">
        {isLoading ? (
          <div className="h-4 w-40 bg-slate-100 rounded animate-pulse" />
        ) : (
          <span className="text-[13px] font-medium text-slate-900">
            {activeDeals.length} active deals
            {totalValue > 0 && (
              <> &middot; <span className="tabular-nums">P{(totalValue / 1_000_000).toFixed(1)}M</span></>
            )}
          </span>
        )}
        <div className="flex gap-2">
          <button className="bg-white border border-black/[.08] rounded-lg px-3 py-[5px] text-[12px] font-medium text-slate-700 hover:bg-slate-50 transition-colors duration-150 cursor-pointer">
            Filter
          </button>
          <button className="hidden sm:block bg-white border border-black/[.08] rounded-lg px-3 py-[5px] text-[12px] font-medium text-slate-700 hover:bg-slate-50 transition-colors duration-150 cursor-pointer">
            Group by AM
          </button>
        </div>
      </div>

      {/* Board */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <div className="flex gap-2.5 h-full px-4 pb-4" style={{ minWidth: 'max-content' }}>
          {isLoading
            ? KANBAN_STAGES.map(col => (
                <div
                  key={col.id}
                  className="w-[252px] shrink-0 flex flex-col overflow-hidden rounded-xl border border-black/[.07] bg-[rgba(0,0,0,0.02)]"
                >
                  {/* Column header skeleton */}
                  <div className="px-3.5 py-3 shrink-0 border-b border-black/[.06] bg-white/60">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0 animate-pulse bg-slate-200" />
                      <div className="h-3 w-20 bg-slate-100 rounded animate-pulse flex-1" />
                      <div className="h-5 w-6 bg-slate-100 rounded-full animate-pulse" />
                    </div>
                  </div>
                  {/* Card skeletons */}
                  <div className="flex flex-col gap-2 flex-1 overflow-y-auto p-2.5">
                    {[1, 2].map(i => (
                      <div key={i} className="rounded-xl p-3.5 bg-white border border-black/[.06] animate-pulse">
                        <div className="h-2.5 w-16 bg-slate-100 rounded mb-2" />
                        <div className="h-4 w-full bg-slate-100 rounded mb-1" />
                        <div className="h-3 w-3/4 bg-slate-100 rounded mb-3" />
                        <div className="flex gap-1.5 mb-3">
                          <div className="h-4 w-12 bg-slate-100 rounded-full" />
                          <div className="h-4 w-16 bg-slate-100 rounded-full" />
                        </div>
                        <div className="flex items-center justify-between pt-2 border-t border-black/[.04]">
                          <div className="h-4 w-16 bg-slate-100 rounded" />
                          <div className="h-5 w-5 bg-slate-100 rounded-full" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            : columnDeals.map(col => (
                <div
                  key={col.id}
                  className="w-[252px] shrink-0 flex flex-col overflow-hidden rounded-xl border border-black/[.07] bg-[rgba(0,0,0,0.02)]"
                >
                  {/* Column header */}
                  <div className="px-3.5 py-3 shrink-0 border-b border-black/[.06] bg-white/60">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: col.color }} />
                      <span className="text-[12.5px] font-semibold text-slate-700 flex-1 leading-none">{col.label}</span>
                      <span className="bg-white border border-black/[.07] text-slate-500 text-[11px] font-semibold tabular-nums px-2 py-0.5 rounded-full">
                        {col.deals.length}
                      </span>
                    </div>
                    {col.total > 0 && (
                      <div className="text-[12px] text-slate-400 tabular-nums mt-1 pl-[18px]">
                        P{(col.total / 1_000_000).toFixed(1)}M
                      </div>
                    )}
                  </div>

                  {/* Cards */}
                  <div className="flex flex-col gap-2 flex-1 overflow-y-auto p-2.5">
                    {col.deals.length === 0 ? (
                      <div className="py-8 text-center text-[12px] text-slate-300">
                        No deals
                      </div>
                    ) : (
                      col.deals.map(d => (
                        <DealCard
                          key={d.id}
                          deal={d}
                          colColor={col.color}
                          onClick={() => onOpenDeal(d.id)}
                        />
                      ))
                    )}
                  </div>
                </div>
              ))
          }
        </div>
      </div>
    </div>
  )
}
