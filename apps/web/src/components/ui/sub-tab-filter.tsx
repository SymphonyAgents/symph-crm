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
                : 'border border-black/[.08] bg-white text-slate-700 hover:bg-slate-50 dark:border-white/[.1] dark:bg-[#1e1e21] dark:text-slate-300 dark:hover:bg-white/[.04]',
            )}
          >
            <span>{item.label}</span>
            {item.count !== undefined && (
              <span className={cn('tabular-nums', active ? 'text-primary/70' : 'text-slate-400')}>
                {item.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
