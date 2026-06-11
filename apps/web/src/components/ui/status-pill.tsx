import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type StatusPillTone = 'neutral' | 'blue' | 'amber' | 'orange' | 'emerald' | 'red' | 'violet' | 'primary'

const TONE_CLASSES: Record<StatusPillTone, string> = {
  neutral: 'bg-secondary text-muted-foreground',
  blue: 'bg-info-dim text-info-foreground',
  amber: 'bg-warning-dim text-warning-foreground',
  orange: 'bg-warning-dim text-warning-foreground',
  emerald: 'bg-success-dim text-success-foreground',
  red: 'bg-danger-dim text-danger-foreground',
  violet: 'bg-purple-dim text-purple-foreground',
  primary: 'bg-primary-dim text-primary',
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
        'inline-flex h-5 items-center rounded-control px-2 text-xxs font-medium leading-none whitespace-nowrap',
        TONE_CLASSES[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}
