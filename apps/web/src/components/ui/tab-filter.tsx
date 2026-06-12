'use client'

import { cn } from '@/lib/utils'

export type TabFilterItem<T extends string> = {
  id: T
  label: string
  count?: number
}

type TabFilterProps<T extends string> = {
  items: TabFilterItem<T>[]
  value: T
  onChange: (value: T) => void
  className?: string
}

export function TabFilter<T extends string>({ items, value, onChange, className }: TabFilterProps<T>) {
  return (
    <div className={cn('inline-flex items-center gap-1 rounded-md bg-secondary p-1', className)}>
      {items.map(item => {
        const active = value === item.id
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            className={cn(
              'inline-flex h-7 items-center rounded-control px-2.5 text-xxs font-semibold transition-colors active:scale-[0.96]',
              active
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <span>{item.label}</span>
            {item.count !== undefined && (
              <span className={cn(
                'ml-1 rounded-full px-1.5 py-0.5 text-atom tabular-nums',
                active
                  ? 'bg-secondary text-muted-foreground'
                  : 'bg-card/70 text-text-faint',
              )}>
                {item.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
