import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type StatusPillTone = 'neutral' | 'blue' | 'amber' | 'orange' | 'emerald' | 'red' | 'violet' | 'primary'

const TONE_CLASSES: Record<StatusPillTone, string> = {
  neutral: 'bg-slate-100 text-slate-500 dark:bg-white/[.06] dark:text-slate-400',
  blue: 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400',
  amber: 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400',
  orange: 'bg-orange-50 text-orange-600 dark:bg-orange-950/40 dark:text-orange-400',
  emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400',
  red: 'bg-red-50 text-red-500 dark:bg-red-950/40 dark:text-red-400',
  violet: 'bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-400',
  primary: 'bg-primary/10 text-primary dark:bg-primary/15 dark:text-primary',
}

type StatusPillProps = {
  children: ReactNode
  tone?: StatusPillTone
  className?: string
}

export function StatusPill({ children, tone = 'neutral', className }: StatusPillProps) {
  return (
    <span
      className={cn(
        'inline-flex h-5 items-center rounded-md px-2 text-xxs font-semibold leading-none whitespace-nowrap',
        TONE_CLASSES[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}
