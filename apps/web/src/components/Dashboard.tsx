'use client'

import { useQuery } from '@tanstack/react-query'
import { MetricCard } from './MetricCard'
import { PipelineBar } from './PipelineBar'
import { TopDeals } from './TopDeals'
import { AMLeaderboard } from './AMLeaderboard'
import { RecentActivity } from './RecentActivity'
import { queryKeys } from '@/lib/query-keys'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api'

type ApiDeal = {
  id: string
  title: string
  value: string | null
  stage: string
  companyId: string
  assignedTo: string | null
  lastActivityAt: string | null
}

type PipelineSummary = {
  totalDeals: number
  activeDeals: number
  totalPipeline: number
  avgDealSize: number
  winRate: number
  dealsByStage: { stage: string; count: number; totalValue: number }[]
}

function formatCurrency(n: number): string {
  if (n >= 1_000_000) return `₱${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `₱${(n / 1_000).toFixed(0)}K`
  return `₱${n.toLocaleString()}`
}

function timeAgo(iso: string | null): string {
  if (!iso) return 'No activity'
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export function Dashboard() {
  const { data: summary, isLoading } = useQuery<PipelineSummary>({
    queryKey: queryKeys.pipeline.summary,
    queryFn: () => fetch(`${API}/pipeline/summary`).then(r => r.json()),
    staleTime: 60_000,
  })

  const { data: deals = [] } = useQuery<ApiDeal[]>({
    queryKey: queryKeys.deals.all,
    queryFn: () => fetch(`${API}/deals`).then(r => r.json()),
  })

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
    <div className="w-full p-4 md:px-6 pb-6">

      {/* KPI Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-[1.2fr_0.9fr_0.9fr_1fr] gap-3 md:gap-3.5 mb-5">
        <MetricCard
          label="Total Pipeline"
          value={isLoading ? '...' : totalPipeline > 0 ? formatCurrency(totalPipeline) : '₱0'}
          trend={totalPipeline > 0 ? `${activeDeals} active deals` : 'No deals yet'}
          trendUp={totalPipeline > 0}
        />
        <MetricCard
          label="Active Deals"
          value={isLoading ? '...' : String(activeDeals)}
          trend={activeDeals > 0 ? 'In pipeline' : 'No active deals'}
          trendUp={activeDeals > 0}
        />
        <MetricCard
          label="Win Rate"
          value={isLoading ? '...' : `${winRate}%`}
          trend={winRate > 0 ? 'Closed deals' : 'No closed deals'}
          trendUp={winRate >= 50}
          accentColor="#16a34a"
        />
        <MetricCard
          label="Avg Deal Size"
          value={isLoading ? '...' : avgDealSize > 0 ? formatCurrency(avgDealSize) : '₱0'}
          trend={avgDealSize > 0 ? 'Per deal' : 'No data yet'}
          trendUp={avgDealSize > 0}
        />
      </div>

      {/* 2-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4 items-start">
        <div className="flex flex-col gap-4">
          <div className="bg-white border border-black/[.06] rounded-[10px] px-5 py-[18px] shadow-[var(--shadow-card)]">
            <div className="text-[13px] font-semibold text-slate-900 mb-4">Pipeline by Stage</div>
            <PipelineBar deals={deals} />
          </div>
          <div className="bg-white border border-black/[.06] rounded-[10px] px-5 py-[18px] shadow-[var(--shadow-card)]">
            <TopDeals deals={topDeals} />
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="bg-white border border-black/[.06] rounded-[10px] px-5 py-[18px] shadow-[var(--shadow-card)]">
            <AMLeaderboard entries={amEntries} />
          </div>
          <div className="bg-white border border-black/[.06] rounded-[10px] px-5 py-[18px] shadow-[var(--shadow-card)]">
            <RecentActivity entries={recentEntries} />
          </div>
        </div>
      </div>
    </div>
  )
}
