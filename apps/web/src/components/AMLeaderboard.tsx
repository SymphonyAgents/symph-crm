'use client'

import { cn } from '@/lib/utils'
import { Avatar } from './Avatar'
import { EmptyState } from './EmptyState'

type AMEntry = {
  name: string
  deals: string
  value: string
  image?: string | null
}

type AMLeaderboardProps = {
  entries: AMEntry[]
}

export function AMLeaderboard({ entries }: AMLeaderboardProps) {
  return (
    <div>
      {entries.length === 0 ? (
        <EmptyState
          icon="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
          title="No activity yet"
          description="AM rankings will appear once deals are tracked"
          compact
        />
      ) : (
        <div className="flex flex-col gap-1">
          {entries.map((entry, i) => (
            <div
              key={entry.name}
              className="grid grid-cols-[20px_26px_1fr_auto] items-center gap-2.5 py-2 px-1 rounded"
            >
              <div className={cn('text-[11px] font-bold tabular-nums text-center', i === 0 ? 'text-primary' : 'text-slate-400')}>
                {i + 1}
              </div>
              <Avatar name={entry.name} src={entry.image ?? undefined} size={26} />
              <div>
                <div className="text-xs font-semibold text-slate-900 dark:text-white">{entry.name}</div>
                <div className="text-[10px] text-slate-400">{entry.deals}</div>
              </div>
              <div className="text-xs font-semibold text-slate-900 dark:text-white tabular-nums">{entry.value}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
