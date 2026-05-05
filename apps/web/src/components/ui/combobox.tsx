'use client'

import { useState } from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'

type Option = { value: string; label: string }

type ComboboxProps = {
  options: readonly (Option | string)[]
  value: string
  onValueChange: (value: string) => void
  placeholder?: string
  className?: string
  /** Allow free-text that isn't in the options list (Enter accepts the typed query) */
  allowCustom?: boolean
}

/**
 * Combobox built on shadcn Popover + Command. Radix portals the dropdown into
 * document.body so it floats above any clipping ancestor (modal overflow, etc).
 *
 * Drop-in replacement for the previous hand-rolled combobox — same prop API.
 */
export function Combobox({
  options,
  value,
  onValueChange,
  placeholder = 'Search...',
  className,
  allowCustom = false,
}: ComboboxProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const normalized: Option[] = options.map(o =>
    typeof o === 'string' ? { value: o, label: o } : o,
  )
  const selectedLabel = normalized.find(o => o.value === value)?.label ?? value

  function select(val: string) {
    onValueChange(val)
    setOpen(false)
    setQuery('')
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          className={cn(
            'flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-1 text-ssm shadow-sm transition-colors',
            'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
            'dark:bg-transparent dark:border-white/10',
            !value && 'text-muted-foreground',
            className,
          )}
        >
          <span className="truncate">{value ? selectedLabel : placeholder}</span>
          <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command shouldFilter={!allowCustom}>
          <CommandInput
            placeholder={placeholder}
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            <CommandEmpty>
              {allowCustom && query.trim() ? (
                <button
                  type="button"
                  onClick={() => select(query.trim())}
                  className="w-full text-left px-2 py-1.5 text-ssm text-primary hover:bg-primary/10 rounded transition-colors"
                >
                  Use “{query.trim()}”
                </button>
              ) : (
                <span className="text-xs text-slate-400">No results</span>
              )}
            </CommandEmpty>
            <CommandGroup>
              {normalized
                .filter(o =>
                  allowCustom
                    ? !query || o.label.toLowerCase().includes(query.toLowerCase())
                    : true,
                )
                .map(o => (
                  <CommandItem
                    key={o.value}
                    value={o.label}
                    onSelect={() => select(o.value)}
                  >
                    <span className="flex-1 truncate">{o.label}</span>
                    <Check
                      className={cn(
                        'ml-2 h-3.5 w-3.5 shrink-0',
                        value === o.value ? 'opacity-100' : 'opacity-0',
                      )}
                    />
                  </CommandItem>
                ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
