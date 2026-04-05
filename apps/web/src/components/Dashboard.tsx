'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { MetricCard } from './MetricCard'
import { StageFunnelChart } from './StageFunnelChart'
import { TopDeals } from './TopDeals'
import { AMLeaderboard } from './AMLeaderboard'
import { RecentActivity } from './RecentActivity'
import {
  MetricCardSkeletonRow,
  TopDealsSkeleton,
  AMLeaderboardSkeleton,
  RecentActivitySkeleton,
} from './Skeletons'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { useGetUsers } from '@/lib/hooks/queries'
import { queryKeys } from '@/lib/query-keys'
import { formatCurrency, timeAgo, formatDealTitle } from '@/lib/utils'
import { api } from '@/lib/api'
import { MONTHS } from '@/lib/constants'
import type { ApiDeal, PipelineSummary } from '@/lib/types'

// ─── Filter helpers ───────────────────────────────────────────────────────────

type FilterMode = 'month' | 'lifetime'

type DashboardFilter = {
  mode: FilterMode
  year: number
  month: number // 0-based (Jan = 0)
}

function getDateRange(filter: DashboardFilter): { from?: string; to?: string } {
  if (filter.mode === 'lifetime') return {}
  const from = new Date(filter.year, filter.month, 1)
  const to = new Date(filter.year, filter.month + 1, 0, 23, 59, 59, 999)
  return { from: from.toISOString(), to: to.toISOString() }
}

// Generate year options: current year back to 2024
function getYearOptions(): number[] {
  const current = new Date().getFullYear()
  const years: number[] = []
  for (let y = current; y >= 2024; y--) years.push(y)
  return years
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export function Dashboard() {
  const router = useRouter()
  const now = new Date()
  const [filter, setFilter] = useState<DashboardFilter>({
    mode: 'month',
    year: now.getFullYear(),
    month: now.getMonth(),
  })

  const { from, to } = getDateRange(filter)

  const { data: summary, isLoading: loadingSummary, isError: errorSummary } = useQuery<PipelineSummary>({
    queryKey: queryKeys.pipeline.summaryFiltered({ from, to }),
    queryFn: () => api.get<PipelineSummary>('/pipeline/summary', { from, to }),
    staleTime: 60_000,
    retry: false,
  })

  const { data: deals = [], isLoading: loadingDeals, isError: errorDeals } = useQuery<ApiDeal[]>({
    queryKey: [...queryKeys.deals.all, { from, to }],
    queryFn: () => api.get<ApiDeal[]>('/deals', { from, to }),
    retry: false,
  })



  const { data: users = [] } = useGetUsers()
  // Build a map from user ID -> display name for AM resolution
  const userMap = new Map(users.map(u => [u.id, u.name || u.email]))

  const isLoading = loadingSummary || loadingDeals
  const isError = errorSummary || errorDeals

  const totalPipeline = summary?.totalPipeline ?? 0
  const activeDeals   = summary?.activeDeals ?? 0
  // Derive win rate from deals data
  const wonDeals = deals.filter(d => d.stage === 'closed_won').length
  const lostDeals = deals.filter(d => d.stage === 'closed_lost').length
  const closedTotal = wonDeals + lostDeals
  const winRate = closedTotal > 0 ? Math.round((wonDeals / closedTotal) * 100) : 0
  const avgDealSize   = summary?.avgDealSize ?? 0

  const topDeals = [...deals]
    .filter(d => d.value && !['closed_won', 'closed_lost'].includes(d.stage))
    .sort((a, b) => parseFloat(b.value ?? '0') - parseFloat(a.value ?? '0'))
    .slice(0, 5)

  // AM Leaderboard — group by assignedTo, resolve UUID to name
  const amMap = new Map<string, { deals: number; value: number }>()
  for (const d of deals) {
    const key = d.assignedTo || 'Unassigned'
    const cur = amMap.get(key) || { deals: 0, value: 0 }
    cur.deals++
    cur.value += parseFloat(d.value || '0') || 0
    amMap.set(key, cur)
  }
  const amEntries = Array.from(amMap.entries())
    .sort((a, b) => b[1].value - a[1].value)
    .map(([key, stats]) => ({
      name: key === 'Unassigned' ? 'Unassigned' : (userMap.get(key) ?? key),
      deals: `${stats.deals} deal${stats.deals !== 1 ? 's' : ''}`,
      value: formatCurrency(stats.value),
      userId: key,
      image: users.find(u => u.id === key)?.image ?? undefined,
    }))

  // Recent Activity — deals with recent activity, clickable to navigate
  const recentEntries = useMemo(() => {
    return deals
      .filter(d => d.lastActivityAt)
      .sort((a, b) => new Date(b.lastActivityAt!).getTime() - new Date(a.lastActivityAt!).getTime())
      .slice(0, 5)
      .map(d => ({
        color: '#2563eb',
        text: formatDealTitle(d.title),
        time: timeAgo(d.lastActivityAt),
        dealId: d.id,
      }))
  }, [deals])

  const yearOptions = getYearOptions()

  return (
    <div className="w-full p-4 md:p-5">

      {/* Filter Row */}
      <div className="flex items-center gap-2 mb-5">
        <Button
          variant={filter.mode === 'lifetime' ? 'default' : 'outline'}
          size="sm"
          className="h-8 text-xs font-medium"
          onClick={() => setFilter(f =>
            f.mode === 'lifetime'
              ? { ...f, mode: 'month' }
              : { ...f, mode: 'lifetime' }
          )}
        >
          Lifetime
        </Button>

        <div className={filter.mode === 'month' ? 'flex items-center gap-2' : 'flex items-center gap-2 opacity-50 pointer-events-none'}>
          <Select
            value={String(filter.month)}
            onValueChange={(v) => setFilter(f => ({ ...f, mode: 'month', month: parseInt(v, 10) }))}
          >
            <SelectTrigger className="h-8 text-xs w-[110px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((m, i) => (
                <SelectItem key={i} value={String(i)} className="text-xs">
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={String(filter.year)}
            onValueChange={(v) => setFilter(f => ({ ...f, mode: 'lifetime', year: parseInt(v, 10) }))}
          >
            <SelectTrigger className="h-8 text-xs w-[80px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map(y => (
                <SelectItem key={y} value={String(y)} className="text-xs">
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPI Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-[1.2fr_0.9fr_0.9fr_1fr] gap-3 md:gap-3.5 mb-5">
        {loadingSummary ? (
          <>
            {Array.from({ length: 4 }).map((_, i) => (
              <MetricCardSkeletonRow key={i} count={1} />
            ))}
          </>
        ) : (
          <>
            <MetricCard
              label="Total Pipeline"
              value={totalPipeline > 0 ? formatCurrency(totalPipeline) : 'P0.00'}
              trend={totalPipeline > 0 ? `${activeDeals} active deals` : 'No deals yet'}
              trendUp={totalPipeline > 0}
              mono
            />
            <MetricCard
              label="Active Deals"
              value={String(activeDeals)}
              trend={activeDeals > 0 ? 'In pipeline' : 'No active deals'}
              trendUp={activeDeals > 0}
            />
            <MetricCard
              label="Win Rate"
              value={`${winRate}%`}
              trend={winRate > 0 ? 'Closed deals' : 'No closed deals'}
              trendUp={winRate >= 50}
              accentColor="#16a34a"
            />
            <MetricCard
              label="Avg Deal Size"
              value={avgDealSize > 0 ? formatCurrency(avgDealSize) : 'P0.00'}
              trend={avgDealSize > 0 ? 'Per deal' : 'No data yet'}
              trendUp={avgDealSize > 0}
              mono
            />
          </>
        )}
      </div>

      {/* 2-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4 items-start">
        <div className="flex flex-col gap-4">
          <StageFunnelChart deals={deals} isLoading={loadingDeals} onStageClick={(stageId) => router.push(`/pipeline?stage=${stageId}`)} />
          <div className="bg-white dark:bg-[#1e1e21] border border-black/[.06] dark:border-white/[.08] rounded-lg p-3 shadow-[var(--shadow-card)]">
            <div className="text-ssm font-semibold text-slate-900 dark:text-white mb-3.5">Top Deals</div>
            {isLoading ? <TopDealsSkeleton /> : isError ? <p className="text-xs text-slate-400 py-2">No data available</p> : <TopDeals deals={topDeals} />}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="bg-white dark:bg-[#1e1e21] border border-black/[.06] dark:border-white/[.08] rounded-lg p-3 shadow-[var(--shadow-card)]">
            <div className="text-ssm font-semibold text-slate-900 dark:text-white mb-3.5">AM Leaderboard</div>
            {isLoading ? <AMLeaderboardSkeleton /> : isError ? <p className="text-xs text-slate-400 py-2">No data available</p> : <AMLeaderboard entries={amEntries} />}
          </div>
          <div className="bg-white dark:bg-[#1e1e21] border border-black/[.06] dark:border-white/[.08] rounded-lg p-3 shadow-[var(--shadow-card)]">
            <div className="text-ssm font-semibold text-slate-900 dark:text-white mb-3.5">Recent Activity</div>
            {isLoading ? <RecentActivitySkeleton /> : isError ? <p className="text-xs text-slate-400 py-2">No data available</p> : <RecentActivity entries={recentEntries} onOpenDeal={(id) => router.push(`/deals/${id}?from=dashboard`)} />}
          </div>
        </div>
      </div>
    </div>
  )
}
