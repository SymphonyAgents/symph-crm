'use client'

import { useQuery } from '@tanstack/react-query'
import { cn } from '@/lib/utils'
import { STAGES } from '@/lib/constants'
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

function DealCard({ deal, onClick }: { deal: ApiDeal; onClick: () => void }) {
  const isWon = deal.stage === 'closed_won'
  const isLost = deal.stage === 'closed_lost'
  const outreach = deal.outreachCategory || 'Outbound'
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
      {/* Stage category + outreach */}
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-[0.05em] text-slate-500">
          {deal.stage.replace(/_/g, ' ')}
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
      <div className="text-[14px] font-bold text-slate-900 leading-snug mb-0.5">
        {deal.title}
      </div>
      <div className="text-[11px] text-slate-400 mb-2.5">
        Company: {deal.companyId.slice(0, 8)}
      </div>

      {/* Services tags */}
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

      {/* Value + AM */}
      <div className="flex items-center justify-between pt-2 border-t border-black/[.05]">
        <span className="text-[15px] font-bold text-primary tabular-nums">
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

// --- Fetch & mapping ---
async function fetchDeals(): Promise<ApiDeal[]> {
  const res = await fetch('/api/deals')
  if (!res.ok) throw new Error('Failed to fetch deals')
  return res.json()
}

const STAGE_MAP: Record<string, string> = {
  lead: 'Lead',
  discovery: 'Discovery',
  assessment: 'Assessment',
  qualified: 'Qualified',
  demo: 'Demo',
  proposal: 'Proposal',
  proposal_demo: 'Proposal & Demo',
  negotiation: 'Negotiation',
  followup: 'Follow-up',
  closed_won: 'Won',
  closed_lost: 'Lost',
}

export function Pipeline({ onOpenDeal }: PipelineProps) {
  const { data: deals = [], isLoading } = useQuery({
    queryKey: queryKeys.deals.all,
    queryFn: fetchDeals,
  })

  const activeDeals = deals.filter(d => !['closed_won', 'closed_lost'].includes(d.stage))
  const totalValue = activeDeals.reduce((s, d) => s + (parseFloat(d.value || '0') || 0), 0)

  // Group deals by their stage
  const dealsByStage = new Map<string, ApiDeal[]>()
  for (const deal of deals) {
    if (!dealsByStage.has(deal.stage)) {
      dealsByStage.set(deal.stage, [])
    }
    dealsByStage.get(deal.stage)!.push(deal)
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Stats + actions */}
      <div className="flex items-center justify-between px-4 py-2.5 shrink-0">
        <span className="text-[13px] font-medium text-slate-900">
          {isLoading ? 'Loading…' : `${activeDeals.length} active deals ${totalValue > 0 ? `· ₱${(totalValue / 1_000_000).toFixed(1)}M` : ''}`}
        </span>
        <div className="flex gap-2">
          <button className="bg-white border border-black/[.08] rounded-lg px-3 py-[5px] text-[12px] font-medium text-slate-700 hover:bg-slate-50 transition-colors duration-150">
            Filter
          </button>
          <button className="hidden sm:block bg-white border border-black/[.08] rounded-lg px-3 py-[5px] text-[12px] font-medium text-slate-700 hover:bg-slate-50 transition-colors duration-150">
            Group by AM
          </button>
        </div>
      </div>

      {/* Board */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <div className="flex gap-2.5 h-full px-4 pb-4" style={{ minWidth: 'max-content' }}>
          {['lead', 'discovery', 'assessment', 'qualified', 'demo', 'proposal', 'proposal_demo', 'negotiation', 'followup', 'closed_won', 'closed_lost'].map(stageId => {
            const stageDeals = dealsByStage.get(stageId) || []
            const total = stageDeals.reduce((a, d) => a + (parseFloat(d.value || '0') || 0), 0)
            const stageLabel = STAGE_MAP[stageId] || stageId

            // Color based on stage
            const stageColors: Record<string, string> = {
              lead: '#94a3b8',
              discovery: '#2563eb',
              assessment: '#7c3aed',
              qualified: '#0369a1',
              demo: '#d97706',
              proposal: '#d97706',
              proposal_demo: '#d97706',
              negotiation: '#f59e0b',
              followup: '#f59e0b',
              closed_won: '#16a34a',
              closed_lost: '#dc2626',
            }

            return (
              <div
                key={stageId}
                className="w-[252px] shrink-0 flex flex-col overflow-hidden rounded-xl border border-black/[.07] bg-[rgba(0,0,0,0.02)]"
              >
                {/* Column header */}
                <div className="px-3.5 py-3 shrink-0 border-b border-black/[.06] bg-white/60">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: stageColors[stageId] }} />
                    <span className="text-[12.5px] font-semibold text-slate-700 flex-1 leading-none">{stageLabel}</span>
                    <span className="bg-white border border-black/[.07] text-slate-500 text-[11px] font-semibold tabular-nums px-2 py-0.5 rounded-full">
                      {stageDeals.length}
                    </span>
                  </div>
                  {total > 0 && (
                    <div className="text-[12px] text-slate-400 tabular-nums mt-1 pl-[18px]">
                      ₱{(total / 1_000_000).toFixed(1)}M
                    </div>
                  )}
                </div>

                {/* Cards */}
                <div className="flex flex-col gap-2 flex-1 overflow-y-auto p-2.5">
                  {stageDeals.length === 0 ? (
                    <div className="py-8 text-center text-[12px] text-slate-300">
                      No deals
                    </div>
                  ) : (
                    stageDeals.map(d => (
                      <DealCard key={d.id} deal={d} onClick={() => onOpenDeal(d.id)} />
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
