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
    <div className={cn('inline-flex items-center gap-1 rounded-md bg-slate-100 p-1 dark:bg-white/[.04]', className)}>
      {items.map(item => {
        const active = value === item.id
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            className={cn(
              'inline-flex h-7 items-center rounded px-2.5 text-xxs font-semibold transition-colors active:scale-[0.96]',
              active
                ? 'bg-white text-slate-900 shadow-sm dark:bg-secondary dark:text-white'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200',
            )}
          >
            <span>{item.label}</span>
            {item.count !== undefined && (
              <span className={cn(
                'ml-1 rounded-full px-1.5 py-0.5 text-atom tabular-nums',
                active
                  ? 'bg-slate-100 text-slate-500 dark:bg-white/[.08] dark:text-slate-300'
                  : 'bg-white/70 text-slate-400 dark:bg-white/[.04] dark:text-slate-500',
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
