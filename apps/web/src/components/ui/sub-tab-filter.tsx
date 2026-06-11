'use client'

import { cn } from '@/lib/utils'

export type SubTabFilterItem<T extends string> = {
  id: T
  label: string
  count?: number
}

type SubTabFilterProps<T extends string> = {
  items: SubTabFilterItem<T>[]
  value: T
  onChange: (value: T) => void
  className?: string
}

export function SubTabFilter<T extends string>({ items, value, onChange, className }: SubTabFilterProps<T>) {
  return (
    <div className={cn('flex items-center gap-1.5 overflow-x-auto no-scrollbar', className)}>
      {items.map(item => {
        const active = value === item.id
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            className={cn(
              'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-xl px-3 text-xxs font-medium transition-colors active:scale-[0.98]',
              active
                ? 'bg-primary/10 text-primary'
                : 'border border-border bg-card text-muted-foreground hover:bg-surface-hover hover:text-foreground',
            )}
          >
            <span>{item.label}</span>
            {item.count !== undefined && (
              <span className={cn('tabular-nums', active ? 'text-primary/70' : 'text-text-faint')}>
                {item.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
