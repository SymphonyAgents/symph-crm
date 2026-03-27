'use client'

import { formatPeso, getInitials } from '@/lib/utils'
import { EmptyState } from './EmptyState'

type ApiDealBrief = {
  id: string
  title: string
  value: string | null
  stage: string
  companyId: string
  assignedTo: string | null
}

type TopDealsProps = {
  deals: ApiDealBrief[]
  onViewAll?: () => void
}

// Deterministic color from a string
const PALETTE = ['#2563eb', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16']
function getColor(s: string | null | undefined): string {
  const str = s || 'default'
  let h = 0
  for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h)
  return PALETTE[Math.abs(h) % PALETTE.length]
}

export function TopDeals({ deals, onViewAll }: TopDealsProps) {
  const sorted = [...deals]
    .filter(d => !['closed_won', 'closed_lost'].includes(d.stage))
    .sort((a, b) => parseFloat(b.value ?? '0') - parseFloat(a.value ?? '0'))
    .slice(0, 5)

  return (
    <div>
      {sorted.length === 0 ? (
        <EmptyState
          icon="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"
          title="No active deals"
          description="Active deals will appear here sorted by value"
          compact
        />
      ) : (
        <div className="flex flex-col gap-0.5">
          {sorted.map(d => {
            const color = getColor(d.companyId)
            const value = d.value ? parseFloat(d.value) : 0
            return (
              <div
                key={d.id}
                className="grid grid-cols-[36px_1fr_auto] items-center gap-3 py-2.5 px-1 rounded cursor-pointer hover:bg-slate-100 dark:hover:bg-white/[.06] dark:bg-white/[.06] active:scale-[0.98] transition-colors duration-150"
              >
                <div
                  className="w-9 h-9 rounded flex items-center justify-center text-xs font-bold shrink-0"
                  style={{ background: `${color}15`, color }}
                >
                  {getInitials(d.title)}
                </div>
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold text-slate-900 dark:text-white truncate">{d.title}</div>
                  <div className="text-[11px] text-slate-400 mt-px">
                    {d.assignedTo || 'Unassigned'} &middot; <span className="capitalize">{d.stage.replace(/_/g, ' ')}</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs font-semibold text-slate-900 dark:text-white tabular-nums">
                    {value > 0 ? formatPeso(value) : '—'}
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
