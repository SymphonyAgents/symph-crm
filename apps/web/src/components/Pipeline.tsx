'use client'

import { cn } from '@/lib/utils'
import type { Deal } from '@/lib/constants'
import { STAGES } from '@/lib/constants'
import { formatPeso } from '@/lib/utils'
import { Avatar } from './Avatar'

type PipelineProps = {
  onOpenDeal: (id: number) => void
}

function DealCard({ deal, onClick }: { deal: Deal; onClick: () => void }) {
  const isWon = deal.stage === 'won'
  const isLost = deal.stage === 'lost'

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
      {/* Brand + Category */}
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-[0.05em] text-slate-500">
          {deal.brand}
        </span>
        <span className={cn(
          'text-[10px] font-semibold px-2 py-0.5 rounded-full',
          deal.category === 'Inbound'
            ? 'bg-success-dim text-success'
            : 'bg-primary/10 text-primary'
        )}>
          {deal.category}
        </span>
      </div>

      {/* Deal name + project */}
      <div className="text-[14px] font-bold text-slate-900 leading-snug mb-0.5">
        {deal.name}
      </div>
      <div className="text-[11px] text-slate-400 mb-2.5">
        {deal.project}
      </div>

      {/* Services */}
      <div className="flex flex-wrap gap-1.5 mb-2.5">
        {deal.services.map(s => (
          <span key={s} className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary-dim text-primary">
            {s}
          </span>
        ))}
      </div>

      {/* Price + AM */}
      <div className="flex items-center justify-between pt-2 border-t border-black/[.05]">
        <span className="text-[15px] font-bold text-primary tabular-nums">
          {formatPeso(deal.size)}
        </span>
        <div className="flex items-center gap-1.5">
          <Avatar name={deal.am} size={22} />
          <span className="text-[12px] font-medium text-slate-600">{deal.am}</span>
        </div>
      </div>
    </div>
  )
}

export function Pipeline({ onOpenDeal }: PipelineProps) {
  // Will be replaced with real data from API
  const deals: Deal[] = []
  const activeDeals = deals.filter(d => d.stage !== 'lost')
  const totalValue = activeDeals.reduce((s, d) => s + d.size, 0)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Stats + actions */}
      <div className="flex items-center justify-between px-4 py-2.5 shrink-0">
        <span className="text-[13px] font-medium text-slate-900">
          {activeDeals.length} active deals {totalValue > 0 ? `· ${'\u20B1'}${(totalValue / 1_000_000).toFixed(1)}M` : ''}
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
          {STAGES.map(stage => {
            const stageDeals = deals.filter(d => d.stage === stage.id)
            const total = stageDeals.reduce((a, d) => a + d.size, 0)

            return (
              <div
                key={stage.id}
                className="w-[252px] shrink-0 flex flex-col overflow-hidden rounded-xl border border-black/[.07] bg-[rgba(0,0,0,0.02)]"
              >
                {/* Column header */}
                <div className="px-3.5 py-3 shrink-0 border-b border-black/[.06] bg-white/60">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: stage.color }} />
                    <span className="text-[12.5px] font-semibold text-slate-700 flex-1 leading-none">{stage.label}</span>
                    <span className="bg-white border border-black/[.07] text-slate-500 text-[11px] font-semibold tabular-nums px-2 py-0.5 rounded-full">
                      {stageDeals.length}
                    </span>
                  </div>
                  {total > 0 && (
                    <div className="text-[12px] text-slate-400 tabular-nums mt-1 pl-[18px]">
                      {formatPeso(total)}
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
