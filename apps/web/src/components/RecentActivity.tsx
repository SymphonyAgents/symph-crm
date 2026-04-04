'use client'

import { cn } from '@/lib/utils'
import { EmptyState } from './EmptyState'

type ActivityEntry = {
  color: string
  text: string
  time: string
  dealId?: string
}

type RecentActivityProps = {
  entries: ActivityEntry[]
  onOpenDeal?: (id: string) => void
}

export function RecentActivity({ entries, onOpenDeal }: RecentActivityProps) {
  return (
    <div>
      {entries.length === 0 ? (
        <EmptyState
          icon="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          title="No recent activity"
          description="Activity will be logged as deals progress"
          compact
        />
      ) : (
        <div className="flex flex-col">
          {entries.map((entry, i) => (
            <div
              key={i}
              onClick={() => entry.dealId && onOpenDeal?.(entry.dealId)}
              className={cn(
                'grid grid-cols-[8px_1fr] gap-3 py-2.5 px-1',
                i < entries.length - 1 && 'border-b border-black/[.06] dark:border-white/[.08]',
                entry.dealId && onOpenDeal && 'cursor-pointer hover:bg-slate-50 dark:hover:bg-white/[.02] rounded-lg transition-colors',
              )}
            >
              <div
                className="w-2 h-2 rounded-full mt-1 shrink-0"
                style={{ background: entry.color }}
              />
              <div>
                <div className="text-xs font-medium text-slate-900 dark:text-white leading-[1.4]">{entry.text}</div>
                <div className="text-atom text-slate-400 mt-0.5">{entry.time}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
