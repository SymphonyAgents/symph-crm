'use client'

import { useQuery } from '@tanstack/react-query'
import { MetricCard } from './MetricCard'
import { PipelineBar } from './PipelineBar'
import { TopDeals } from './TopDeals'
import { AMLeaderboard } from './AMLeaderboard'
import { RecentActivity } from './RecentActivity'
import {
  MetricCardSkeletonRow,
  PipelineBarSkeleton,
  TopDealsSkeleton,
  AMLeaderboardSkeleton,
  RecentActivitySkeleton,
} from './Skeletons'
import { queryKeys } from '@/lib/query-keys'
import { formatCurrency, timeAgo } from '@/lib/utils'
import { API_BASE } from '@/lib/constants'
import type { ApiDeal, PipelineSummary } from '@/lib/types'

export function Dashboard() {
  const { data: summary, isLoading: loadingSummary } = useQuery<PipelineSummary>({
    queryKey: queryKeys.pipeline.summary,
    queryFn: () => fetch(`${API_BASE}/pipeline/summary`).then(r => r.json()),
    staleTime: 60_000,
  })

  const { data: deals = [], isLoading: loadingDeals } = useQuery<ApiDeal[]>({
    queryKey: queryKeys.deals.all,
    queryFn: () => fetch(`${API_BASE}/deals`).then(r => r.json()),
  })

  const isLoading = loadingSummary || loadingDeals

  const totalPipeline = summary?.totalPipeline ?? 0
  const activeDeals   = summary?.activeDeals ?? 0
  const winRate       = summary?.winRate ?? 0
  const avgDealSize   = summary?.avgDealSize ?? 0

  const topDeals = [...deals]
    .filter(d => d.value && !['closed_won', 'closed_lost'].includes(d.stage))
    .sort((a, b) => parseFloat(b.value ?? '0') - parseFloat(a.value ?? '0'))
    .slice(0, 5)

  // AM Leaderboard — group by assignedTo
  const amMap = new Map<string, { deals: number; value: number }>()
  for (const d of deals) {
    const name = d.assignedTo || 'Unassigned'
    const cur = amMap.get(name) || { deals: 0, value: 0 }
    cur.deals++
    cur.value += parseFloat(d.value || '0') || 0
    amMap.set(name, cur)
  }
  const amEntries = Array.from(amMap.entries())
    .sort((a, b) => b[1].value - a[1].value)
    .map(([name, stats]) => ({
      name,
      deals: `${stats.deals} deal${stats.deals !== 1 ? 's' : ''}`,
      value: formatCurrency(stats.value),
    }))

  // Recent Activity — last-touched deals sorted by lastActivityAt
  const recentEntries = [...deals]
    .filter(d => d.lastActivityAt)
    .sort((a, b) => new Date(b.lastActivityAt!).getTime() - new Date(a.lastActivityAt!).getTime())
    .slice(0, 5)
    .map(d => ({
      color: '#2563eb',
      text: d.title,
      time: timeAgo(d.lastActivityAt),
    }))

  return (
    <div className="w-full p-4 md:p-5">

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
              value={totalPipeline > 0 ? formatCurrency(totalPipeline) : 'P0'}
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
              value={avgDealSize > 0 ? formatCurrency(avgDealSize) : 'P0'}
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
          <div className="bg-white dark:bg-[#1e1e21] border border-black/[.06] dark:border-white/[.08] rounded-lg px-5 py-[18px] shadow-[var(--shadow-card)]">
            <div className="text-[13px] font-semibold text-slate-900 dark:text-white mb-4">Pipeline by Stage</div>
            {isLoading ? <PipelineBarSkeleton /> : <PipelineBar deals={deals} />}
          </div>
          <div className="bg-white dark:bg-[#1e1e21] border border-black/[.06] dark:border-white/[.08] rounded-lg px-5 py-[18px] shadow-[var(--shadow-card)]">
            <div className="text-[13px] font-semibold text-slate-900 dark:text-white mb-3.5">Top Deals</div>
            {isLoading ? <TopDealsSkeleton /> : <TopDeals deals={topDeals} />}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="bg-white dark:bg-[#1e1e21] border border-black/[.06] dark:border-white/[.08] rounded-lg px-5 py-[18px] shadow-[var(--shadow-card)]">
            <div className="text-[13px] font-semibold text-slate-900 dark:text-white mb-3.5">AM Leaderboard</div>
            {isLoading ? <AMLeaderboardSkeleton /> : <AMLeaderboard entries={amEntries} />}
          </div>
          <div className="bg-white dark:bg-[#1e1e21] border border-black/[.06] dark:border-white/[.08] rounded-lg px-5 py-[18px] shadow-[var(--shadow-card)]">
            <div className="text-[13px] font-semibold text-slate-900 dark:text-white mb-3.5">Recent Activity</div>
            {isLoading ? <RecentActivitySkeleton /> : <RecentActivity entries={recentEntries} />}
          </div>
        </div>
      </div>
    </div>
  )
}
