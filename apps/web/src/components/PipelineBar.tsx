'use client'

import { useRouter } from 'next/navigation'
import { KANBAN_STAGES } from '@/lib/constants'

type PipelineBarProps = {
  deals: { id: string; stage: string; value: string | null }[]
}

export function PipelineBar({ deals }: PipelineBarProps) {
  const router = useRouter()
  const stageData = KANBAN_STAGES.map((s, index) => ({
    ...s,
    count: deals.filter(d => s.matches.includes(d.stage)).length,
    position: index + 1,
  }))

  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${KANBAN_STAGES.length}, 1fr)` }}>
      {stageData.map(s => {
        const hasDeals = s.count > 0
        // Fill proportional to stage position: lead=1/7, …, lost=7/7
        const positionPct = Math.round((s.position / KANBAN_STAGES.length) * 100)
        const fillPct = hasDeals ? positionPct : 0

        return (
          <div
            key={s.id}
            role="button"
            tabIndex={0}
            className="flex flex-col gap-1.5 min-w-0 cursor-pointer hover:opacity-80 transition-opacity duration-150"
            onClick={() => router.push(`/pipeline?stage=${s.id}`)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') router.push(`/pipeline?stage=${s.id}`)
            }}
          >
            <div
              className="text-[11px] font-medium truncate"
              style={{ color: hasDeals ? s.color : '#94a3b8' }}
            >
              {s.label}
            </div>
            <div className="h-[6px] bg-slate-100 dark:bg-white/[.06] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${fillPct}%`,
                  background: s.color,
                  opacity: hasDeals ? 0.85 : 0,
                }}
              />
            </div>
            <div
              className="text-[15px] font-bold tabular-nums text-slate-900 dark:text-white"
              style={!hasDeals ? { color: '#94a3b8' } : undefined}
            >
              {s.count}
            </div>
          </div>
        )
      })}
    </div>
  )
}
