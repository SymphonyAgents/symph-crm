'use client'

import { Card, CardContent } from '@/components/ui/card'
import { EmptyState } from './EmptyState'
import { formatCurrency } from '@/lib/utils'
import { STAGE_LABELS, STAGE_COLORS } from '@/lib/constants'
import { useGetPipelineSummary, useGetDeals, useGetUsers } from '@/lib/hooks/queries'
import { StageFunnelChart } from './StageFunnelChart'
import { Skeleton } from './ui/skeleton'

function Spinner() {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="w-6 h-6 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
      <p className="text-xs text-slate-400">Loading…</p>
    </div>
  )
}

function MetricCardSkeleton() {
  return (
    <Card className="flex-[1_1_200px]">
      <CardContent>
        <div className="animate-pulse">
          <Skeleton className="h-2.5 w-20 rounded mb-2.5" />
          <Skeleton className="h-7 w-24 rounded mb-2" />
          <Skeleton className="h-2.5 w-16 rounded" />
        </div>
      </CardContent>
    </Card>
  )
}

function ChartSkeleton() {
  const bars = [85, 60, 45, 70, 30, 55, 20, 40]
  return (
    <div className="flex flex-col gap-2.5">
      {bars.map((w, i) => (
        <div key={i} className="flex items-center gap-2.5">
          <Skeleton className="w-[80px] h-2.5 rounded shrink-0" />
          <div className="flex-1 h-[16px] bg-slate-100 dark:bg-white/[.06] rounded overflow-hidden">
            <div className="h-full bg-slate-200 dark:bg-white/[.1] animate-pulse rounded" style={{ width: w + '%' }} />
          </div>
          <Skeleton className="w-12 h-2.5 rounded shrink-0" />
        </div>
      ))}
    </div>
  )
}

function AMTableSkeleton() {
  return (
    <div className="flex flex-col">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="grid grid-cols-[20px_1fr_auto] items-center gap-3 py-2.5 px-1 border-b border-black/[.04] dark:border-white/[.06] last:border-0">
          <Skeleton className="w-4 h-3 rounded" />
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-3 w-28 rounded" />
            <Skeleton className="h-2.5 w-14 rounded" />
          </div>
          <Skeleton className="h-3 w-16 rounded" />
        </div>
      ))}
    </div>
  )
}

export function Reports() {
  const { data: summary, isLoading } = useGetPipelineSummary()
  const { data: deals = [], isLoading: loadingDeals } = useGetDeals()
  const { data: users = [] } = useGetUsers()
  const userMap = new Map(users.map(u => [u.id, u.name || u.email]))

  const closedWon = summary?.dealsByStage.find(s => s.stage === 'closed_won')
  const closedLost = summary?.dealsByStage.find(s => s.stage === 'closed_lost')

  const metrics = [
    {
      label: 'Total Closed Won',
      value: formatCurrency(closedWon?.totalValue || 0),
      trend: `${closedWon?.count || 0} deals`,
      color: '#16a34a',
    },
    {
      label: 'Deals Won',
      value: String(closedWon?.count || 0),
      trend: `${summary?.winRate || 0}% win rate`,
      color: undefined,
    },
    {
      label: 'Deals Lost',
      value: String(closedLost?.count || 0),
      trend: `${summary?.totalDeals || 0} total deals`,
      color: '#dc2626',
    },
    {
      label: 'Avg Deal Size',
      value: formatCurrency(summary?.avgDealSize || 0),
      trend: `From ${summary?.activeDeals || 0} active`,
      color: undefined,
    },
  ]

  // Pipeline value by stage — only stages with deals
  const activeStages = summary?.dealsByStage.filter(s => s.count > 0) ?? []
  const maxStageValue = Math.max(...activeStages.map(s => s.totalValue), 1)

  // Funnel — active (non-closed) stages only
  const funnelStages = activeStages.filter(s => !['closed_won', 'closed_lost'].includes(s.stage))
  const maxFunnelCount = Math.max(...funnelStages.map(s => s.count), 1)

  // AM Performance — computed from deals, resolve UUIDs to names
  const amMapRaw = new Map<string, { deals: number; value: number }>()
  for (const d of deals) {
    const key = d.assignedTo || 'Unassigned'
    const cur = amMapRaw.get(key) || { deals: 0, value: 0 }
    cur.deals++
    cur.value += parseFloat(d.value || '0') || 0
    amMapRaw.set(key, cur)
  }
  const amRows = Array.from(amMapRaw.entries())
    .sort((a, b) => b[1].value - a[1].value)
    .slice(0, 10)
    .map(([key, stats]) => [key === 'Unassigned' ? 'Unassigned' : (userMap.get(key) ?? key), stats] as [string, { deals: number; value: number }])

  return (
    <div className="p-4 md:p-5 max-w-[1200px]">

      {/* Metrics row */}
      <div className="flex gap-3 mb-4 flex-wrap">
        {isLoading ? (
          <>
            {Array.from({ length: 4 }).map((_, i) => (
              <MetricCardSkeleton key={i} />
            ))}
          </>
        ) : (
          metrics.map((m) => (
            <Card key={m.label} className="flex-[1_1_200px]">
              <CardContent>
                <div className="text-atom font-semibold text-slate-400 uppercase tracking-wide mb-1.5">{m.label}</div>
                <div className="text-2xl font-bold tabular-nums leading-none" style={{ color: m.color || undefined }}>
                  {!m.color && <span className="text-slate-900 dark:text-white">{m.value}</span>}
                  {m.color && m.value}
                </div>
                <div className="text-xxs text-slate-500 mt-1.5">{m.trend}</div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Charts section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">

        {/* Pipeline Value by Stage */}
        <Card>
          <CardContent>
            <div className="text-ssm font-semibold text-slate-900 dark:text-white mb-4 pb-4 border-b border-black/[.06] dark:border-white/[.08]">
              Pipeline Value by Stage
            </div>
            {isLoading ? (
              <div className="py-2"><ChartSkeleton /></div>
            ) : activeStages.length === 0 ? (
              <EmptyState
                icon="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                title="No deals in pipeline"
                description="Add deals to see pipeline value by stage"
                compact
              />
            ) : (
              <div className="flex flex-col gap-2.5">
                {activeStages.map(s => (
                  <div key={s.stage} className="flex items-center gap-2.5">
                    <div className="w-[80px] shrink-0 text-xxs font-medium text-slate-600 dark:text-slate-400 truncate">
                      {STAGE_LABELS[s.stage] ?? s.stage}
                    </div>
                    <div className="flex-1 h-[16px] bg-slate-100 dark:bg-white/[.06] rounded overflow-hidden">
                      <div
                        className="h-full rounded transition-all duration-500"
                        style={{
                          width: `${Math.max(2, Math.round((s.totalValue / maxStageValue) * 100))}%`,
                          background: STAGE_COLORS[s.stage] ?? '#94a3b8',
                          opacity: 0.85,
                        }}
                      />
                    </div>
                    <div className="w-[56px] shrink-0 text-xxs font-semibold tabular-nums text-right text-slate-700 dark:text-slate-300">
                      {formatCurrency(s.totalValue)}
                    </div>
                    <div className="w-[18px] shrink-0 text-atom font-medium text-center text-slate-400 tabular-nums">
                      {s.count}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stage Conversion Funnel */}
        <StageFunnelChart deals={deals} isLoading={loadingDeals} />
      </div>

      {/* AM Performance */}
      <Card className="mb-4">
        <CardContent>
          <div className="text-ssm font-semibold text-slate-900 dark:text-white mb-3.5 pb-3.5 border-b border-black/[.06] dark:border-white/[.08]">
            AM Performance
          </div>
          {loadingDeals ? (
            <AMTableSkeleton />
          ) : amRows.length === 0 ? (
            <EmptyState
              icon="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
              title="No deals assigned yet"
              description="AM metrics appear as deals are assigned to team members"
              compact
            />
          ) : (
            <div className="flex flex-col">
              {amRows.map(([name, stats], i) => (
                <div
                  key={name}
                  className="grid grid-cols-[20px_1fr_auto_auto] items-center gap-3 py-2.5 px-1 border-b border-black/[.04] dark:border-white/[.06] last:border-0"
                >
                  <div className={`text-xxs font-bold tabular-nums text-center ${i === 0 ? 'text-primary' : 'text-slate-400'}`}>
                    {i + 1}
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-900 dark:text-white">{name}</div>
                    <div className="text-atom text-slate-400">{stats.deals} deal{stats.deals !== 1 ? 's' : ''}</div>
                  </div>
                  <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 tabular-nums">{formatCurrency(stats.value)}</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
