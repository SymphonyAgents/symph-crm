'use client'

import * as React from 'react'
import { Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export type SearchInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  containerClassName?: string
  onClear?: () => void
}

const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  ({ className, containerClassName, value, onClear, ...props }, ref) => {
    const hasValue = typeof value === 'string' ? value.length > 0 : Boolean(value)

    return (
      <div
        className={cn(
          'group relative flex h-9 items-center rounded-control border border-border bg-secondary transition-colors',
          'hover:border-border-strong hover:bg-surface-alt',
          'focus-within:border-ring focus-within:bg-card focus-within:ring-1 focus-within:ring-inset focus-within:ring-primary-ring',
          containerClassName,
        )}
      >
        <Search size={14} strokeWidth={1.6} className="pointer-events-none absolute left-3 text-muted-foreground" />
        <input
          ref={ref}
          type="search"
          value={value}
          className={cn(
            'h-full w-full min-w-0 rounded-control bg-transparent pl-9 pr-3 text-xs text-foreground outline-none',
            'placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50',
            '[&::-webkit-search-cancel-button]:hidden',
            onClear && hasValue && 'pr-8',
            className,
          )}
          {...props}
        />
        {onClear && hasValue && (
          <button
            type="button"
            onClick={onClear}
            className="absolute right-2 inline-flex h-5 w-5 items-center justify-center rounded-control text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
            aria-label="Clear search"
          >
            <X size={12} strokeWidth={1.8} />
          </button>
        )}
      </div>
    )
  },
)
SearchInput.displayName = 'SearchInput'

export { SearchInput }
