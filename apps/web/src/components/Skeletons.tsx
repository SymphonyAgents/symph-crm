'use client'

/**
 * Named skeleton layouts for each data-loading context.
 *
 * Usage rule:
 *   Data loading  → skeleton (these components)
 *   Button action → spinner (<div className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />)
 *   Logout/save   → spinner inline in button
 */

import { Skeleton } from './ui/skeleton'

// ─── Primitives ──────────────────────────────────────────────────────────────

function SkeletonLine({ w = 'w-full', h = 'h-3' }: { w?: string; h?: string }) {
  return <Skeleton className={`${h} ${w} rounded`} />
}

// ─── MetricCard skeleton (4 per row on Dashboard / Reports) ──────────────────

export function MetricCardSkeleton() {
  return (
    <div className="flex-[1_1_200px] rounded-lg border border-black/[.06] dark:border-white/[.08] bg-white dark:bg-[#1e1e21] px-5 py-[18px] shadow-[0_1px_3px_rgba(0,0,0,0.04)] animate-pulse" />
  )
}

export function MetricCardSkeletonRow({ count = 4 }: { count?: number }) {
  return (
    <div className="flex gap-3 flex-wrap">
      {Array.from({ length: count }).map((_, i) => (
        <MetricCardSkeleton key={i} />
      ))}
    </div>
  )
}

// ─── PipelineBar skeleton ────────────────────────────────────────────────────

export function PipelineBarSkeleton() {
  const widths = ['w-full', 'w-4/5', 'w-3/5', 'w-2/3', 'w-1/2', 'w-2/5', 'w-3/5', 'w-1/3', 'w-1/4', 'w-1/5', 'w-1/6']
  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(11, 1fr)' }}>
      {widths.map((w, i) => (
        <div key={i} className="flex flex-col gap-1.5 min-w-0">
          <SkeletonLine w="w-full" h="h-2" />
          <div className="h-[6px] bg-slate-100 dark:bg-white/[.06] rounded-full overflow-hidden">
            <div className={`h-full bg-slate-200 dark:bg-white/[.1] animate-pulse rounded-full ${w}`} />
          </div>
          <SkeletonLine w="w-4" h="h-4" />
        </div>
      ))}
    </div>
  )
}

// ─── TopDeals skeleton ───────────────────────────────────────────────────────

export function TopDealsSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-0.5">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="grid grid-cols-[36px_1fr_auto] items-center gap-3 py-2.5 px-1">
          <Skeleton className="w-9 h-9 rounded" />
          <div className="flex flex-col gap-1.5 min-w-0">
            <SkeletonLine w="w-3/4" h="h-3" />
            <SkeletonLine w="w-1/2" h="h-2.5" />
          </div>
          <SkeletonLine w="w-12" h="h-3" />
        </div>
      ))}
    </div>
  )
}

// ─── AMLeaderboard skeleton ──────────────────────────────────────────────────

export function AMLeaderboardSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-1">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="grid grid-cols-[20px_26px_1fr_auto] items-center gap-2.5 py-2 px-1">
          <SkeletonLine w="w-4" h="h-2.5" />
          <Skeleton className="w-[26px] h-[26px] rounded-full" />
          <div className="flex flex-col gap-1.5">
            <SkeletonLine w="w-20" h="h-2.5" />
            <SkeletonLine w="w-12" h="h-2" />
          </div>
          <SkeletonLine w="w-12" h="h-2.5" />
        </div>
      ))}
    </div>
  )
}

// ─── RecentActivity skeleton ─────────────────────────────────────────────────

export function RecentActivitySkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="flex flex-col">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className={`grid grid-cols-[8px_1fr] gap-3 py-2.5 px-1 ${i < rows - 1 ? 'border-b border-black/[.06] dark:border-white/[.08]' : ''}`}
        >
          <Skeleton className="w-2 h-2 rounded-full mt-1 shrink-0" />
          <div className="flex flex-col gap-1.5">
            <SkeletonLine w="w-4/5" h="h-2.5" />
            <SkeletonLine w="w-12" h="h-2" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Deals list skeleton (brand-grouped rows) ────────────────────────────────

export function DealsListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="flex-1 bg-white dark:bg-[#1e1e21] border border-black/[.06] dark:border-white/[.08] rounded-lg shadow-[0_1px_4px_rgba(0,0,0,0.04)] overflow-hidden">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className={`grid grid-cols-[36px_1fr_auto_auto_auto_20px] items-center gap-3 px-[18px] py-3.5 ${i < rows - 1 ? 'border-b border-black/[.06] dark:border-white/[.08]' : ''}`}
        >
          <Skeleton className="w-9 h-9 rounded-lg shrink-0" />
          <div className="flex flex-col gap-1.5 min-w-0">
            <SkeletonLine w="w-40" h="h-3" />
            <SkeletonLine w="w-24" h="h-2.5" />
          </div>
          <SkeletonLine w="w-20" h="h-2.5" />
          <SkeletonLine w="w-14" h="h-2.5" />
          <div className="hidden sm:flex gap-[3px]">
            {[1,2,3].map(j => <Skeleton key={j} className="w-2 h-2 rounded-full" />)}
          </div>
          <Skeleton className="w-3.5 h-3.5 rounded" />
        </div>
      ))}
    </div>
  )
}

// ─── Pipeline Kanban skeleton ────────────────────────────────────────────────

function KanbanColumnSkeleton({ cards = 2 }: { cards?: number }) {
  return (
    <div className="w-[252px] shrink-0 flex flex-col rounded-lg border border-black/[.07] dark:border-white/[.08] bg-[rgba(0,0,0,0.02)] overflow-hidden">
      {/* column header */}
      <div className="px-3.5 py-3 shrink-0 border-b border-black/[.06] dark:border-white/[.08] bg-white dark:bg-[#1e1e21]/60 flex items-center gap-2">
        <Skeleton className="w-2.5 h-2.5 rounded-full shrink-0" />
        <Skeleton className="flex-1 h-2.5 rounded" />
        <Skeleton className="w-6 h-4 rounded-full" />
      </div>
      {/* cards */}
      <div className="flex flex-col gap-2 p-2.5">
        {Array.from({ length: cards }).map((_, i) => (
          <div key={i} className="rounded-lg p-3.5 bg-white dark:bg-[#1e1e21] border border-black/[.08] dark:border-white/[.08] flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <SkeletonLine w="w-16" h="h-2" />
              <SkeletonLine w="w-12" h="h-4" />
            </div>
            <SkeletonLine w="w-full" h="h-3.5" />
            <SkeletonLine w="w-2/3" h="h-2.5" />
            <div className="flex gap-1.5">
              <SkeletonLine w="w-14" h="h-4" />
              <SkeletonLine w="w-14" h="h-4" />
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-black/[.05] dark:border-white/[.06]">
              <SkeletonLine w="w-16" h="h-4" />
              <div className="flex items-center gap-1">
                <Skeleton className="w-5 h-5 rounded-full" />
                <SkeletonLine w="w-12" h="h-2.5" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function PipelineKanbanSkeleton() {
  const cardCounts = [3, 2, 2, 1, 2, 1, 1, 1, 1, 1, 1]
  return (
    <div className="flex gap-2.5 h-full px-4 pb-4" style={{ minWidth: 'max-content' }}>
      {cardCounts.map((cards, i) => (
        <KanbanColumnSkeleton key={i} cards={cards} />
      ))}
    </div>
  )
}

// ─── Reports chart skeleton ───────────────────────────────────────────────────

export function ChartSkeleton() {
  const bars = [85, 60, 45, 70, 30, 55, 20, 40, 25, 50, 15]
  return (
    <div className="flex flex-col gap-2.5">
      {bars.map((w, i) => (
        <div key={i} className="flex items-center gap-2.5">
          <SkeletonLine w="w-20" h="h-2.5" />
          <div className="flex-1 h-[16px] bg-slate-100 dark:bg-white/[.06] rounded overflow-hidden">
            <div
              className="h-full bg-slate-200 dark:bg-white/[.1] animate-pulse rounded"
              style={{ width: `${w}%` }}
            />
          </div>
          <SkeletonLine w="w-12" h="h-2.5" />
        </div>
      ))}
    </div>
  )
}

export function FunnelSkeleton() {
  const widths = [100, 78, 62, 48, 35, 25, 18]
  return (
    <div className="flex flex-col gap-1.5">
      {widths.map((w, i) => (
        <div key={i} className="flex items-center gap-2.5">
          <SkeletonLine w="w-20" h="h-2.5" />
          <div className="flex-1 flex items-center">
            <div
              className="h-[20px] rounded bg-slate-100 dark:bg-white/[.06] animate-pulse"
              style={{ width: `${w}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── DealDetail skeleton ─────────────────────────────────────────────────────

export function DealDetailSkeleton() {
  return (
    <div className="flex flex-col gap-4 pb-4">
      {/* header card */}
      <div className="bg-white dark:bg-[#1e1e21] border border-black/[.06] dark:border-white/[.08] rounded-lg p-5 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex-1 flex flex-col gap-2.5">
            <SkeletonLine w="w-3/4" h="h-6" />
            <div className="flex gap-2">
              <SkeletonLine w="w-20" h="h-5" />
              <SkeletonLine w="w-16" h="h-5" />
            </div>
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            <SkeletonLine w="w-28" h="h-8" />
            <SkeletonLine w="w-20" h="h-2.5" />
          </div>
        </div>
        {/* meta grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-black/[.05] dark:border-white/[.06]">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-1.5">
              <SkeletonLine w="w-16" h="h-2" />
              <SkeletonLine w="w-24" h="h-3.5" />
            </div>
          ))}
        </div>
        {/* tags */}
        <div className="flex gap-1.5 mt-3 pt-3 border-t border-black/[.05] dark:border-white/[.06]">
          {[1,2,3].map(i => <SkeletonLine key={i} w="w-16" h="h-5" />)}
        </div>
      </div>

      {/* activity feed */}
      <div className="bg-white dark:bg-[#1e1e21] border border-black/[.06] dark:border-white/[.08] rounded-lg p-5 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
        <SkeletonLine w="w-20" h="h-4" />
        <div className="mt-3.5 flex flex-col">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className={`flex items-start gap-3 py-2.5 ${i < 4 ? 'border-b border-black/[.04] dark:border-white/[.06]' : ''}`}
            >
              <Skeleton className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" />
              <div className="flex-1 flex flex-col gap-1.5">
                <SkeletonLine w="w-3/5" h="h-2.5" />
                <SkeletonLine w="w-20" h="h-2" />
              </div>
              <SkeletonLine w="w-10" h="h-2" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Calendar upcoming skeleton ───────────────────────────────────────────────

export function UpcomingEventsSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2 p-1">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-start gap-2.5 p-2 rounded-lg">
          <Skeleton className="w-1 self-stretch rounded-full shrink-0 mt-0.5" />
          <div className="flex flex-col gap-1.5 min-w-0 flex-1">
            <SkeletonLine w="w-4/5" h="h-3" />
            <SkeletonLine w="w-1/2" h="h-2.5" />
          </div>
        </div>
      ))}
    </div>
  )
}
