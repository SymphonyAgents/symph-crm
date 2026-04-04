'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState } from './EmptyState'
import { cn } from '@/lib/utils'
import type { FunnelResponse, FunnelStage } from '@/lib/types'

// Conversion rate pill color helpers
function conversionPillClasses(rate: number): string {
  if (rate >= 70) return 'bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400'
  if (rate >= 40) return 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400'
  return 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400'
}

function Spinner() {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="w-6 h-6 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
      <p className="text-xs text-slate-400">Loading...</p>
    </div>
  )
}

// Single stage block
function StageBlock({
  stage,
  isSelected,
  onSelect,
}: {
  stage: FunnelStage
  isSelected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'rounded-lg border px-3 py-2 text-left shrink-0 min-w-[100px] transition-colors duration-150 cursor-pointer',
        isSelected
          ? 'border-primary ring-1 ring-primary/20 bg-primary/[.04]'
          : 'border-black/[.06] dark:border-white/[.08] bg-white dark:bg-[#1e1e21]'
      )}
    >
      <div className="flex items-center gap-1.5">
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{ backgroundColor: stage.color || '#94a3b8' }}
        />
        <span className="text-xxs font-semibold text-slate-700 dark:text-slate-300 truncate">
          {stage.label}
        </span>
      </div>
      <div className="text-sbase font-bold tabular-nums text-slate-900 dark:text-white">
        {stage.entryCount}
      </div>
      {stage.conversionRate !== null ? (
        <span
          className={cn(
            'inline-flex items-center text-xxs font-semibold tabular-nums rounded-full py-0.5',
            conversionPillClasses(stage.conversionRate)
          )}
        >
          {stage.conversionRate}%
        </span>
      ) : (
        <span className="inline-block text-xxs text-slate-300 dark:text-slate-600">--</span>
      )}
    </button>
  )
}

// Main component
interface StageFunnelChartProps {
  data: FunnelResponse | undefined
  isLoading: boolean
}

export function StageFunnelChart({ data, isLoading }: StageFunnelChartProps) {
  const [selectedStage, setSelectedStage] = useState<string | null>(null)

  const stages = data?.stages ?? []
  const wonCount = data?.wonCount ?? 0
  const lostCount = data?.lostCount ?? 0
  const hasData = stages.some(s => s.entryCount > 0) || wonCount > 0 || lostCount > 0
  const total = wonCount + lostCount
  const winRate = total > 0 ? Math.round((wonCount / total) * 100) : null

  return (
    <Card>
      <CardContent>
        {/* Card header */}
        <div className="flex items-center justify-between mb-4 pb-4 border-b border-black/[.06] dark:border-white/[.08]">
          <div className="text-ssm font-semibold text-slate-900 dark:text-white">
            Pipeline Progress
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-[120px]">
            <Spinner />
          </div>
        ) : !hasData ? (
          <EmptyState
            icon="M3 4h18M4 8h16M6 12h12M8 16h8M10 20h4"
            title="No funnel data yet"
            description="Stage conversion data appears as deals move through the pipeline"
            compact
          />
        ) : (
          <div className="overflow-x-auto -mx-1 px-1 pb-1">
            <div className="flex flex-row gap-3">
              {/* Stage blocks */}
              {stages.map(stage => (
                <StageBlock
                  key={stage.stage}
                  stage={stage}
                  isSelected={selectedStage === stage.stage}
                  onSelect={() =>
                    setSelectedStage(prev =>
                      prev === stage.stage ? null : stage.stage
                    )
                  }
                />
              ))}

            </div>

            {/* Terminal row: Won + Lost inline */}
            <div className="flex items-center gap-4 mt-3 pt-3 border-t border-black/[.06] dark:border-white/[.08]">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                <span className="text-xxs font-semibold text-green-700 dark:text-green-400">Won</span>
                <span className="text-xs font-bold tabular-nums text-green-700 dark:text-green-400">{wonCount}</span>
                {winRate !== null && (
                  <span className="text-xxs text-green-600 dark:text-green-500 tabular-nums">{winRate}%</span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                <span className="text-xxs font-semibold text-red-700 dark:text-red-400">Lost</span>
                <span className="text-xs font-bold tabular-nums text-red-700 dark:text-red-400">{lostCount}</span>
                {total > 0 && (
                  <span className="text-xxs text-red-600 dark:text-red-500 tabular-nums">{total} closed</span>
                )}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
