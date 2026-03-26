'use client'

import { MetricCard } from './MetricCard'
import { PipelineBar } from './PipelineBar'
import { TopDeals } from './TopDeals'
import { AMLeaderboard } from './AMLeaderboard'
import { RecentActivity } from './RecentActivity'
import { STAGES } from '@/lib/constants'

export function Dashboard() {
  return (
    <div className="w-full p-4 md:px-6 pb-6">

      {/* KPI Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-[1.2fr_0.9fr_0.9fr_1fr] gap-3 md:gap-3.5 mb-5">
        <MetricCard label="Total Pipeline" value="--" trend="No data yet" trendUp />
        <MetricCard label="Active Deals" value="0" trend="No deals" trendUp />
        <MetricCard label="Win Rate" value="--" trend="No data yet" trendUp accentColor="#16a34a" />
        <MetricCard label="Avg Deal Size" value="--" trend="No data yet" trendUp={false} />
      </div>

      {/* 2-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4 items-start">
        <div className="flex flex-col gap-4">
          <div className="bg-white border border-black/[.06] rounded-[10px] px-5 py-[18px] shadow-[var(--shadow-card)]">
            <div className="text-[13px] font-semibold text-slate-900 mb-4">Pipeline by Stage</div>
            <PipelineBar stages={STAGES} deals={[]} />
          </div>
          <div className="bg-white border border-black/[.06] rounded-[10px] px-5 py-[18px] shadow-[var(--shadow-card)]">
            <TopDeals deals={[]} />
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="bg-white border border-black/[.06] rounded-[10px] px-5 py-[18px] shadow-[var(--shadow-card)]">
            <AMLeaderboard entries={[]} />
          </div>
          <div className="bg-white border border-black/[.06] rounded-[10px] px-5 py-[18px] shadow-[var(--shadow-card)]">
            <RecentActivity entries={[]} />
          </div>
        </div>
      </div>
    </div>
  )
}
