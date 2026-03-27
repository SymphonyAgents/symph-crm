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
    <div className="bg-white border border-black/[.06] rounded-[10px] px-4 py-3.5 shadow-[var(--shadow-card)]">
      <div className="text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground mb-1.5">
        {label}
      </div>
      <div
        className={cn('text-[24px] font-bold leading-none tracking-tight tabular-nums', mono && '')}
        style={{ color: accentColor || 'var(--foreground)' }}
      >
        {value}
      </div>
      <div className={cn('text-[11px] font-medium mt-1.5', trendUp ? 'text-success' : 'text-danger')}>
        {trend}
      </div>
    </div>
  )
}
