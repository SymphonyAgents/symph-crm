import { STAGE_LABELS } from '@/lib/constants'
import { cn } from '@/lib/utils'

type StagePillProps = {
  stage: string
  className?: string
}

function stageColorVar(stage: string): string {
  const normalized = stage.replace(/-/g, '_')
  return `var(--stage-${normalized}, var(--text-muted))`
}

export function StagePill({ stage, className }: StagePillProps) {
  const color = stageColorVar(stage)

  return (
    <span
      className={cn(
        'inline-flex h-5 items-center rounded-md px-2 text-xxs font-semibold leading-none whitespace-nowrap',
        className,
      )}
      style={{
        color,
        backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)`,
      }}
    >
      {STAGE_LABELS[stage] ?? stage}
    </span>
  )
}
