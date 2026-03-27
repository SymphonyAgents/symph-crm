'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'

type CommandItem = {
  id: string
  label: string
  path: string
  section: string
}

const ROUTES: CommandItem[] = [
  { id: 'chat', label: 'Chat', path: '/chat', section: 'Pages' },
  { id: 'dashboard', label: 'Dashboard', path: '/', section: 'Pages' },
  { id: 'pipeline', label: 'Pipeline', path: '/pipeline', section: 'Pages' },
  { id: 'deals', label: 'Deals', path: '/deals', section: 'Pages' },
  { id: 'inbox', label: 'Inbox', path: '/inbox', section: 'Pages' },
  { id: 'calendar', label: 'Calendar', path: '/calendar', section: 'Pages' },
  { id: 'reports', label: 'Reports', path: '/reports', section: 'Pages' },
  { id: 'proposals', label: 'Proposals', path: '/proposals', section: 'Pages' },
]

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const filtered = query.trim()
    ? ROUTES.filter(r => r.label.toLowerCase().includes(query.toLowerCase()))
    : ROUTES

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault()
      setOpen(o => !o)
    }
    if (e.key === 'Escape') setOpen(false)
  }, [])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  useEffect(() => {
    if (open) {
      setQuery('')
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  function navigate(path: string) {
    router.push(path)
    setOpen(false)
  }

  function handleInputKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(i => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && filtered[selectedIndex]) {
      navigate(filtered[selectedIndex].path)
    }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh] bg-black/40 dark:bg-black/60 backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        className="bg-white dark:bg-[#1e1e21] rounded-lg border border-black/[.06] dark:border-white/[.1] shadow-2xl w-full max-w-[480px] mx-4 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-black/[.06] dark:border-white/[.08]">
          <Search size={15} strokeWidth={1.4} className="text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => { setQuery(e.target.value); setSelectedIndex(0) }}
            onKeyDown={handleInputKeyDown}
            placeholder="Search or jump to..."
            className="flex-1 bg-transparent border-none outline-none text-[14px] text-slate-900 dark:text-white placeholder:text-slate-400"
          />
          <kbd className="text-[10px] font-medium text-slate-400 bg-slate-100 dark:bg-white/[.06] border border-black/[.06] dark:border-white/[.08] rounded px-1.5 py-0.5">
            Esc
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[300px] overflow-y-auto py-1.5">
          {filtered.length === 0 ? (
            <div className="px-4 py-6 text-center text-[13px] text-slate-400">
              No results for &quot;{query}&quot;
            </div>
          ) : (
            filtered.map((item, i) => (
              <button
                key={item.id}
                onClick={() => navigate(item.path)}
                onMouseEnter={() => setSelectedIndex(i)}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-2 text-left text-[13px] transition-colors',
                  i === selectedIndex
                    ? 'bg-slate-100 dark:bg-white/[.06] text-slate-900 dark:text-white'
                    : 'text-slate-600 dark:text-slate-400'
                )}
              >
                <span className="flex-1 font-medium">{item.label}</span>
                <span className="text-[10px] text-slate-400">{item.section}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
