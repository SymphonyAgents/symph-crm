'use client'

import { useGetCompanies, useGetDeals } from '@/lib/hooks/queries'
import { formatDealValue, totalNumericValue } from '@/lib/utils'

export default function WikiPage() {
  const { data: companies = [] } = useGetCompanies()
  const { data: deals = [] } = useGetDeals()

  const openDeals = deals.filter(d => !['closed_won', 'closed_lost'].includes(d.stage))
  const closedWon = deals.filter(d => d.stage === 'closed_won')
  const pipeline = totalNumericValue(openDeals)

  return (
    <div className="flex flex-col items-center justify-center h-full px-6 text-center">
      <div className="w-12 h-12 rounded-xl bg-primary/[.08] dark:bg-primary/[.12] flex items-center justify-center mb-4">
        <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" className="text-primary">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        </svg>
      </div>
      <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">Wiki</h2>
      <p className="text-xs text-slate-500 dark:text-slate-400 max-w-[220px] leading-relaxed mb-6">
        Select a brand or deal from the sidebar to explore details
      </p>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3 w-full max-w-[320px]">
        {[
          { label: 'Brands', value: companies.length },
          { label: 'Open deals', value: openDeals.length },
          { label: 'Won deals', value: closedWon.length },
        ].map(stat => (
          <div
            key={stat.label}
            className="rounded-lg border border-black/[.06] dark:border-white/[.08] bg-white dark:bg-[#1e1e21] px-3 py-3 text-center"
          >
            <div className="text-base font-bold text-slate-900 dark:text-white tabular-nums">{stat.value}</div>
            <div className="text-xxs text-slate-400 mt-0.5">{stat.label}</div>
          </div>
        ))}
      </div>

      {pipeline > 0 && (
        <p className="text-xxs text-slate-400 mt-3">
          {formatDealValue(String(pipeline))} open pipeline
        </p>
      )}
    </div>
  )
}
