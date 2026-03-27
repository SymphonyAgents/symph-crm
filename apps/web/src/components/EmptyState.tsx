import { cn } from '@/lib/utils'

type EmptyStateProps = {
  icon?: string
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
  compact?: boolean
}

const DEFAULT_ICONS: Record<string, string> = {
  deals: 'M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2',
  inbox: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
  calendar: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  reports: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
  proposal: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  activity: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
  users: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
}

export function EmptyState({ icon, title, description, action, className, compact }: EmptyStateProps) {
  const iconPath = icon || DEFAULT_ICONS.deals

  return (
    <div className={cn(
      'flex flex-col items-center justify-center text-center',
      compact ? 'py-6 px-4' : 'py-12 px-6',
      className
    )}>
      <div className={cn(
        'rounded-lg bg-slate-50 dark:bg-white/[.03] flex items-center justify-center mb-3',
        compact ? 'w-10 h-10' : 'w-12 h-12'
      )}>
        <svg
          width={compact ? 18 : 22}
          height={compact ? 18 : 22}
          viewBox="0 0 24 24"
          fill="none"
          stroke="#94a3b8"
          strokeWidth={1.2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d={iconPath} />
        </svg>
      </div>
      <div className={cn(
        'font-semibold text-slate-900 dark:text-white',
        compact ? 'text-[12px]' : 'text-[13px]'
      )}>
        {title}
      </div>
      {description && (
        <div className={cn(
          'text-slate-400 mt-1 max-w-[280px]',
          compact ? 'text-[11px]' : 'text-[12px]'
        )}>
          {description}
        </div>
      )}
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}
