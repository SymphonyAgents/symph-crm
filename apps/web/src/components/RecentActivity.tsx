'use client'

import { cn } from '@/lib/utils'
import { EmptyState } from './EmptyState'

type ActivityEntry = {
  color: string
  text: string
  time: string
}

type RecentActivityProps = {
  entries: ActivityEntry[]
}

export function RecentActivity({ entries }: RecentActivityProps) {
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
              className={cn('grid grid-cols-[8px_1fr] gap-3 py-2.5 px-1', i < entries.length - 1 && 'border-b border-black/[.06]')}
            >
              <div
                className="w-2 h-2 rounded-full mt-1 shrink-0"
                style={{ background: entry.color }}
              />
              <div>
                <div className="text-xs font-medium text-slate-900 leading-[1.4]">{entry.text}</div>
                <div className="text-[10px] text-slate-400 mt-0.5">{entry.time}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
