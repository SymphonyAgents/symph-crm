'use client'

import { cn } from '@/lib/utils'

type MetricCardProps = {
  label: string
  value: string
  trend: string
  trendUp: boolean
  accentColor?: string
  /** Apply Geist Mono to the value — use for monetary/currency displays */
  mono?: boolean
}

export function MetricCard({ label, value, trend, trendUp, accentColor, mono }: MetricCardProps) {
  return (
    <div className="bg-white dark:bg-[#1e1e21] border border-black/[.06] dark:border-white/[.08] rounded-lg p-3 shadow-[var(--shadow-card)]">
      <div className="text-atom font-semibold uppercase tracking-[0.06em] text-slate-400 mb-1.5">
        {label}
      </div>
      <div
        className={cn('text-2xl font-bold leading-none tracking-tight tabular-nums', mono && '')}
        style={{ color: accentColor || 'var(--foreground)' }}
      >
        {value}
      </div>
      <div className={cn('text-xxs font-medium mt-1.5', trendUp ? 'text-success' : 'text-danger')}>
        {trend}
      </div>
    </div>
  )
}
