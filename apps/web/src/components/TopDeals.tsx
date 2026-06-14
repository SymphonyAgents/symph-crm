'use client'

import { getInitials, getBrandColor } from '@/lib/utils'
import { formatDealMoney } from '@/lib/currency'
import { EmptyState } from './EmptyState'

type TopDealsProps = {
  deals: { id: string; title: string; value: string | null; currency: 'PHP' | 'USD' | 'SGD' | null; stage: string | null; companyId: string; assignedTo: string | null }[]
  onViewAll?: () => void
}

export function TopDeals({ deals, onViewAll }: TopDealsProps) {
  const sorted = deals
    .filter(d => !['closed_won', 'closed_lost'].includes(d.stage ?? ''))
    .slice(0, 5)

  return (
    <div>
      {sorted.length === 0 ? (
        <EmptyState
          icon="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"
          title="No active deals"
          description="Active deals will appear here with native currency values"
          compact
        />
      ) : (
        <div className="flex flex-col gap-0.5">
          {sorted.map(d => {
            const color = getBrandColor(d.companyId)
            return (
              <div
                key={d.id}
                className="grid grid-cols-[36px_1fr_auto] items-center gap-3 py-2.5 px-1 rounded cursor-pointer hover:bg-surface-hover  active:scale-[0.98] transition-colors duration-150"
              >
                <div
                  className="w-9 h-9 rounded flex items-center justify-center text-xs font-bold shrink-0"
                  style={{ background: `${color}15`, color }}
                >
                  {getInitials(d.title)}
                </div>
                <div className="min-w-0">
                  <div className="text-ssm font-semibold text-foreground truncate">{d.title}</div>
                  <div className="text-xxs text-slate-400 mt-px">
                    {d.assignedTo || 'Unassigned'} &middot; <span className="capitalize">{(d.stage ?? '').replace(/_/g, ' ')}</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs font-semibold text-foreground tabular-nums">
                    {formatDealMoney(d)}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
