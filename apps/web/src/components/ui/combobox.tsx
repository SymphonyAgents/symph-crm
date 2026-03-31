'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'

type Option = { value: string; label: string }

type ComboboxProps = {
  options: readonly (Option | string)[]
  value: string
  onValueChange: (value: string) => void
  placeholder?: string
  className?: string
  /** Allow free-text that isn't in the options list */
  allowCustom?: boolean
}

/**
 * Lightweight combobox — text input with filtered dropdown.
 * Use for any select with >6 options (per UX convention).
 */
export function Combobox({
  options,
  value,
  onValueChange,
  placeholder = 'Search...',
  className,
  allowCustom = false,
}: ComboboxProps) {
  const normalized: Option[] = options.map(o =>
    typeof o === 'string' ? { value: o, label: o } : o,
  )

  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [highlightIdx, setHighlightIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Display label for current value
  const selectedLabel = normalized.find(o => o.value === value)?.label ?? value

  // Filtered options
  const filtered = query
    ? normalized.filter(o => o.label.toLowerCase().includes(query.toLowerCase()))
    : normalized

  // Reset highlight when filtered list changes
  useEffect(() => { setHighlightIdx(0) }, [query])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      const el = inputRef.current?.parentElement
      if (el && !el.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Scroll highlighted item into view
  useEffect(() => {
    if (!open || !listRef.current) return
    const el = listRef.current.children[highlightIdx] as HTMLElement | undefined
    el?.scrollIntoView({ block: 'nearest' })
  }, [highlightIdx, open])

  const select = useCallback((val: string) => {
    onValueChange(val)
    setQuery('')
    setOpen(false)
  }, [onValueChange])

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') { setOpen(true); e.preventDefault() }
      return
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setHighlightIdx(i => Math.min(i + 1, filtered.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlightIdx(i => Math.max(i - 1, 0))
        break
      case 'Enter':
        e.preventDefault()
        if (filtered[highlightIdx]) select(filtered[highlightIdx].value)
        else if (allowCustom && query.trim()) select(query.trim())
        break
      case 'Escape':
        setOpen(false)
        setQuery('')
        break
    }
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={open ? query : (value ? selectedLabel : '')}
        onChange={e => {
          setQuery(e.target.value)
          if (!open) setOpen(true)
        }}
        onFocus={() => { setOpen(true); setQuery('') }}
        onKeyDown={handleKeyDown}
        placeholder={value ? selectedLabel : placeholder}
        className={cn(
          'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-[13px] shadow-sm transition-colors',
          'placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
          'dark:bg-transparent dark:border-white/10',
          className,
        )}
        autoComplete="off"
      />
      {/* Chevron */}
      <svg
        width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"
        className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400"
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>

      {open && filtered.length > 0 && (
        <div
          ref={listRef}
          className="absolute z-50 mt-1 w-full max-h-[200px] overflow-y-auto rounded-lg border border-black/[.08] dark:border-white/[.1] bg-white dark:bg-[#1e1e21] shadow-lg py-1"
        >
          {filtered.map((o, i) => (
            <button
              key={o.value}
              type="button"
              onMouseDown={e => { e.preventDefault(); select(o.value) }}
              onMouseEnter={() => setHighlightIdx(i)}
              className={cn(
                'flex w-full items-center px-3 py-1.5 text-[13px] text-left transition-colors',
                i === highlightIdx
                  ? 'bg-primary/10 text-primary'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[.04]',
                o.value === value && 'font-semibold',
              )}
            >
              {o.label}
              {o.value === value && (
                <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" className="ml-auto shrink-0">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
      {open && filtered.length === 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-black/[.08] dark:border-white/[.1] bg-white dark:bg-[#1e1e21] shadow-lg py-3 px-3 text-[12px] text-slate-400 text-center">
          {allowCustom ? `Press Enter to use "${query}"` : 'No results'}
        </div>
      )}
    </div>
  )
}
