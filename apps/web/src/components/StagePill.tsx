import { STAGE_LABELS } from '@/lib/constants'
import { cn } from '@/lib/utils'

const STAGE_PILL_STYLES: Record<string, string> = {
  lead: 'bg-slate-100 text-slate-500 dark:bg-white/[.06] dark:text-slate-400',
  discovery: 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400',
  assessment: 'bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-400',
  qualified: 'bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-400',
  demo: 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400',
  proposal: 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400',
  proposal_demo: 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400',
  negotiation: 'bg-orange-50 text-orange-600 dark:bg-orange-950/40 dark:text-orange-400',
  followup: 'bg-orange-50 text-orange-600 dark:bg-orange-950/40 dark:text-orange-400',
  parked: 'bg-slate-100 text-slate-500 dark:bg-white/[.06] dark:text-slate-400',
  closed_won: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400',
  closed_lost: 'bg-red-50 text-red-500 dark:bg-red-950/40 dark:text-red-400',
}

type StagePillProps = {
  stage: string
  className?: string
}

export function StagePill({ stage, className }: StagePillProps) {
  return (
    <span
      className={cn(
        'inline-flex h-5 items-center rounded-md px-2 text-xxs font-semibold leading-none whitespace-nowrap',
        STAGE_PILL_STYLES[stage] ?? 'bg-slate-100 text-slate-500 dark:bg-white/[.06] dark:text-slate-400',
        className,
      )}
    >
      {STAGE_LABELS[stage] ?? stage}
    </span>
  )
}
