'use client'

import { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { KANBAN_STAGES } from '@/lib/constants'
import type { ApiDeal } from '@/lib/types'

// Compute stage counts from deals array
function useStageData(deals: ApiDeal[]) {
  return useMemo(() => {
    const stageCounts = new Map<string, number>()
    let wonCount = 0
    let lostCount = 0

    for (const deal of deals) {
      const stage = deal.stage ?? 'lead'
      if (stage === 'closed_won') { wonCount++; continue }
      if (stage === 'closed_lost') { lostCount++; continue }
      // Map DB stage to kanban column
      const col = KANBAN_STAGES.find(c => c.matches.includes(stage))
      if (col) {
        stageCounts.set(col.id, (stageCounts.get(col.id) ?? 0) + 1)
      }
    }

    const stages = KANBAN_STAGES
      .filter(c => c.id !== 'closed_won' && c.id !== 'closed_lost')
      .map(col => ({
        id: col.id,
        label: col.label,
        color: col.color,
        count: stageCounts.get(col.id) ?? 0,
      }))

    return { stages, wonCount, lostCount }
  }, [deals])
}

interface PipelineProgressProps {
  deals: ApiDeal[]
  isLoading: boolean
  onStageClick?: (stageId: string) => void
}

export function StageFunnelChart({ deals, isLoading, onStageClick }: PipelineProgressProps) {
  const [selectedStage, setSelectedStage] = useState<string | null>(null)
  const { stages, wonCount, lostCount } = useStageData(deals)
  const total = wonCount + lostCount
  const hasData = deals.length > 0

  return (
    <div className="bg-white dark:bg-[#1e1e21] border border-black/[.06] dark:border-white/[.08] rounded-lg shadow-[var(--shadow-card)] p-3">
      <div className="text-ssm font-semibold text-slate-900 dark:text-white mb-4">
        Pipeline Progress
      </div>

      {isLoading ? (
        <div>
          <div className="grid grid-cols-5 gap-1.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="rounded-lg border border-black/[.06] dark:border-white/[.08] px-2.5 py-2 space-y-1.5">
                <div className="h-2 w-16 bg-slate-100 dark:bg-white/[.06] rounded animate-pulse" />
                <div className="h-5 w-8 bg-slate-100 dark:bg-white/[.06] rounded animate-pulse" />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-1.5 mt-2">
            <div className="h-9 rounded-lg bg-slate-100 dark:bg-white/[.06] animate-pulse" />
            <div className="h-9 rounded-lg bg-slate-100 dark:bg-white/[.06] animate-pulse" />
          </div>
        </div>
      ) : !hasData ? (
        <p className="text-xs text-slate-400 py-4 text-center">No deals yet</p>
      ) : (
        <>
          {/* Stage row — evenly distributed, scrollable on mobile */}
          <div className="overflow-x-auto no-scrollbar -mx-1 px-1 pb-1">
          <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${stages.length}, minmax(100px, 1fr))` }}>
            {stages.map(stage => (
              <button
                key={stage.id}
                type="button"
                onClick={() => onStageClick ? onStageClick(stage.id) : setSelectedStage(prev => prev === stage.id ? null : stage.id)}
                className={cn(
                  'rounded-lg border px-2.5 py-2 text-left transition-colors duration-150',
                  selectedStage === stage.id
                    ? 'border-primary ring-1 ring-primary/20 bg-primary/[.04]'
                    : 'border-black/[.06] dark:border-white/[.08] hover:border-black/[.12] dark:hover:border-white/[.15]'
                )}
              >
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: stage.color }} />
                  <span className="text-xxs font-medium text-slate-500 dark:text-slate-400 truncate">{stage.label}</span>
                </div>
                <div className="text-sbase font-bold tabular-nums text-slate-900 dark:text-white mt-0.5">
                  {stage.count}
                </div>
              </button>
            ))}
          </div>
          </div>

          {/* Terminal row: Won + Lost */}
          <div className="grid grid-cols-2 gap-1.5 mt-2">
            <div className="flex items-center justify-between rounded-lg bg-green-900/20 dark:bg-green-900/30 px-3 py-2">
              <span className="text-xs font-semibold text-green-700 dark:text-green-400">Won</span>
              <span className="text-xs font-bold tabular-nums text-green-700 dark:text-green-400">{wonCount}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-red-900/20 dark:bg-red-900/30 px-3 py-2">
              <span className="text-xs font-semibold text-red-700 dark:text-red-400">
                Lost{total > 0 && <span className="font-normal"> · {total} total</span>}
              </span>
              <span className="text-xs font-bold tabular-nums text-red-700 dark:text-red-400">{lostCount}</span>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
