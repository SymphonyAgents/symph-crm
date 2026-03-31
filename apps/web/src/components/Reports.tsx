'use client'

import { useQuery } from '@tanstack/react-query'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState } from './EmptyState'
import { queryKeys } from '@/lib/query-keys'
import { formatCurrency } from '@/lib/utils'
import { API_BASE, STAGE_LABELS, STAGE_COLORS } from '@/lib/constants'
import type { PipelineSummary, ApiDeal } from '@/lib/types'

async function fetchPipelineSummary(): Promise<PipelineSummary> {
  const res = await fetch('/api/pipeline/summary')
  if (!res.ok) throw new Error('Failed to fetch pipeline summary')
  return res.json()
}

function Spinner() {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="w-6 h-6 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
      <p className="text-[12px] text-slate-400">Loading…</p>
    </div>
  )
}

export function Reports() {
  const { data: summary, isLoading } = useQuery({
    queryKey: queryKeys.pipeline.summary,
    queryFn: fetchPipelineSummary,
  })

  const { data: deals = [], isLoading: loadingDeals } = useQuery<ApiDeal[]>({
    queryKey: queryKeys.deals.all,
    queryFn: () => fetch(`${API_BASE}/deals`).then(r => r.json()),
  })

  const closedWon = summary?.dealsByStage.find(s => s.stage === 'closed_won')
  const closedLost = summary?.dealsByStage.find(s => s.stage === 'closed_lost')

  const metrics = [
    {
      label: 'Total Closed Won',
      value: isLoading ? '--' : formatCurrency(closedWon?.totalValue || 0),
      trend: isLoading ? 'Loading…' : `${closedWon?.count || 0} deals`,
      color: '#16a34a',
    },
    {
      label: 'Deals Won',
      value: isLoading ? '0' : String(closedWon?.count || 0),
      trend: isLoading ? 'Loading…' : `${summary?.winRate || 0}% win rate`,
      color: undefined,
    },
    {
      label: 'Deals Lost',
      value: isLoading ? '0' : String(closedLost?.count || 0),
      trend: isLoading ? 'Loading…' : `${summary?.totalDeals || 0} total deals`,
      color: '#dc2626',
    },
    {
      label: 'Avg Deal Size',
      value: isLoading ? '--' : formatCurrency(summary?.avgDealSize || 0),
      trend: isLoading ? 'Loading…' : `From ${summary?.activeDeals || 0} active`,
      color: undefined,
    },
  ]

  // Pipeline value by stage — only stages with deals
  const activeStages = summary?.dealsByStage.filter(s => s.count > 0) ?? []
  const maxStageValue = Math.max(...activeStages.map(s => s.totalValue), 1)

  // Funnel — active (non-closed) stages only
  const funnelStages = activeStages.filter(s => !['closed_won', 'closed_lost'].includes(s.stage))
  const maxFunnelCount = Math.max(...funnelStages.map(s => s.count), 1)

  // AM Performance — computed from deals
  const amMap = new Map<string, { deals: number; value: number }>()
  for (const d of deals) {
    const name = d.assignedTo || 'Unassigned'
    const cur = amMap.get(name) || { deals: 0, value: 0 }
    cur.deals++
    cur.value += parseFloat(d.value || '0') || 0
    amMap.set(name, cur)
  }
  const amRows = Array.from(amMap.entries())
    .sort((a, b) => b[1].value - a[1].value)
    .slice(0, 10)

  return (
    <div className="p-4 md:p-5 max-w-[1200px]">

      {/* Metrics row */}
      <div className="flex gap-3 mb-4 flex-wrap">
        {metrics.map((m) => (
          <Card key={m.label} className="flex-[1_1_200px]">
            <CardContent>
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">{m.label}</div>
              <div className="text-[22px] font-bold tabular-nums leading-none" style={{ color: m.color || undefined }}>
                {!m.color && <span className="text-slate-900 dark:text-white">{m.value}</span>}
                {m.color && m.value}
              </div>
              <div className="text-[11px] text-slate-500 mt-1.5">{m.trend}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">

        {/* Pipeline Value by Stage */}
        <Card>
          <CardContent>
            <div className="text-[13px] font-semibold text-slate-900 dark:text-white mb-4 pb-4 border-b border-black/[.06] dark:border-white/[.08]">
              Pipeline Value by Stage
            </div>
            {isLoading ? (
              <div className="flex items-center justify-center h-[200px]"><Spinner /></div>
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
                    <div className="w-[80px] shrink-0 text-[11px] font-medium text-slate-600 dark:text-slate-400 truncate">
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
                    <div className="w-[56px] shrink-0 text-[11px] font-semibold tabular-nums text-right text-slate-700 dark:text-slate-300">
                      {formatCurrency(s.totalValue)}
                    </div>
                    <div className="w-[18px] shrink-0 text-[10px] font-medium text-center text-slate-400 tabular-nums">
                      {s.count}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pipeline Funnel */}
        <Card>
          <CardContent>
            <div className="text-[13px] font-semibold text-slate-900 dark:text-white mb-4 pb-4 border-b border-black/[.06] dark:border-white/[.08]">
              Pipeline Funnel
            </div>
            {isLoading ? (
              <div className="flex items-center justify-center h-[200px]"><Spinner /></div>
            ) : funnelStages.length === 0 ? (
              <EmptyState
                icon="M3 4h18M4 8h16M6 12h12M8 16h8M10 20h4"
                title="No active deals"
                description="The funnel shows conversion rates across active stages"
                compact
              />
            ) : (
              <div className="flex flex-col gap-1.5">
                {funnelStages.map(s => {
                  const widthPct = Math.max(10, Math.round((s.count / maxFunnelCount) * 100))
                  return (
                    <div key={s.stage} className="flex items-center gap-2.5">
                      <div className="w-[80px] shrink-0 text-[11px] font-medium text-slate-600 dark:text-slate-400 truncate">
                        {STAGE_LABELS[s.stage] ?? s.stage}
                      </div>
                      <div className="flex-1 flex items-center">
                        <div
                          className="h-[20px] rounded flex items-center px-2 transition-all duration-500"
                          style={{
                            width: `${widthPct}%`,
                            background: `${STAGE_COLORS[s.stage] ?? '#94a3b8'}50`,
                          }}
                        >
                          <span
                            className="text-[11px] font-semibold"
                            style={{ color: STAGE_COLORS[s.stage] ?? '#94a3b8' }}
                          >
                            {s.count}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* AM Performance */}
      <Card className="mb-4">
        <CardContent>
          <div className="text-[13px] font-semibold text-slate-900 dark:text-white mb-3.5 pb-3.5 border-b border-black/[.06] dark:border-white/[.08]">
            AM Performance
          </div>
          {loadingDeals ? (
            <div className="flex items-center justify-center h-[120px]"><Spinner /></div>
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
                  <div className={`text-[11px] font-bold tabular-nums text-center ${i === 0 ? 'text-primary' : 'text-slate-400'}`}>
                    {i + 1}
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-900 dark:text-white">{name}</div>
                    <div className="text-[10px] text-slate-400">{stats.deals} deal{stats.deals !== 1 ? 's' : ''}</div>
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
