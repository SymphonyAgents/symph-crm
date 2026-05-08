'use client'

/**
 * Proposals — workspace-wide index.
 *
 * Replaces the deal-tree sidebar pattern. One fetch returns all proposals
 * with deal + brand context joined server-side. Click a card → /proposals/[id].
 *
 * View toggle (grid / list) persists in localStorage. Sorted newest-first by
 * updatedAt server-side.
 */

import { useMemo, useRef, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useGetAllProposals } from '@/lib/hooks/queries'
import { useSearchHotkey } from '@/lib/hooks/use-search-hotkey'
import { DataTableSkeleton } from '@/components/ui/data-table'
import type { ApiProposalSummary } from '@/lib/types'

type ViewMode = 'grid' | 'list'
const VIEW_KEY = 'proposals.view'

function FileIcon({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth={1.4}
      strokeLinecap="round" strokeLinejoin="round"
      className={className}
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <line x1="8" y1="13" x2="15" y2="13" />
      <line x1="8" y1="17" x2="13" y2="17" />
    </svg>
  )
}

function GridIcon({ active }: { active: boolean }) {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={cn(active ? 'text-primary' : 'text-slate-400')}>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  )
}

function ListIcon({ active }: { active: boolean }) {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={cn(active ? 'text-primary' : 'text-slate-400')}>
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <circle cx="4" cy="6" r="1" />
      <circle cx="4" cy="12" r="1" />
      <circle cx="4" cy="18" r="1" />
    </svg>
  )
}

function relTime(iso: string): string {
  const d = new Date(iso)
  const ms = Date.now() - d.getTime()
  const m = Math.floor(ms / 60_000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const days = Math.floor(h / 24)
  if (days < 7) return `${days}d ago`
  return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ─── Card (grid) ────────────────────────────────────────────────────────────

function ProposalCard({ p, onOpen }: { p: ApiProposalSummary; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className={cn(
        'group flex flex-col text-left',
        'rounded-xl border border-black/[.06] dark:border-white/[.08]',
        'bg-white dark:bg-[#1c1c1f]',
        'shadow-[var(--shadow-card)]',
        'hover:border-primary/40 hover:shadow-[0_0_0_3px_rgba(108,99,255,0.06)]',
        'transition-colors duration-150 active:scale-[0.99]',
      )}
    >
      {/* Thumbnail panel */}
      <div className="aspect-[4/3] flex items-center justify-center bg-slate-50 dark:bg-white/[.03] rounded-t-xl border-b border-black/[.06] dark:border-white/[.08]">
        <FileIcon size={36} className="text-slate-400 group-hover:text-primary transition-colors duration-150" />
      </div>
      {/* Meta */}
      <div className="px-3 py-2.5">
        <div className="text-ssm font-semibold text-slate-900 dark:text-white truncate" title={p.title}>
          {p.title}
        </div>
        <div className="text-xxs text-slate-500 mt-0.5 truncate flex items-center gap-1.5">
          {p.brandName && <span className="truncate">{p.brandName}</span>}
          {p.brandName && <span className="text-slate-300">·</span>}
          <span className="font-mono shrink-0">v{p.currentVersion}</span>
          <span className="text-slate-300">·</span>
          <span className="shrink-0">{relTime(p.updatedAt)}</span>
        </div>
      </div>
    </button>
  )
}

// ─── Row (list) ─────────────────────────────────────────────────────────────

function ProposalRow({ p, onOpen }: { p: ApiProposalSummary; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className={cn(
        'w-full flex items-center gap-3 text-left',
        'px-3 py-2.5 rounded-lg',
        'hover:bg-slate-50 dark:hover:bg-white/[.04] transition-colors duration-150',
      )}
    >
      <div className="w-9 h-9 rounded-md bg-slate-100 dark:bg-white/[.04] flex items-center justify-center shrink-0">
        <FileIcon size={16} className="text-slate-400" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-ssm font-semibold text-slate-900 dark:text-white truncate">{p.title}</div>
        <div className="text-xxs text-slate-500 mt-0.5 truncate flex items-center gap-1.5">
          {p.brandName && <span className="truncate">{p.brandName}</span>}
          {p.brandName && p.dealTitle && <span className="text-slate-300">·</span>}
          {p.dealTitle && <span className="truncate text-slate-400">{p.dealTitle}</span>}
        </div>
      </div>
      <div className="flex items-center gap-3 text-xxs text-slate-500 shrink-0">
        <span className="font-mono">v{p.currentVersion}</span>
        <span className="text-slate-300">·</span>
        <span>{relTime(p.updatedAt)}</span>
      </div>
    </button>
  )
}

// ─── Main ───────────────────────────────────────────────────────────────────

export function Proposals() {
  const router = useRouter()
  const { data: proposals = [], isLoading } = useGetAllProposals()
  const [search, setSearch] = useState('')
  const [view, setView] = useState<ViewMode>('grid')
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Persist view choice across reloads.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const stored = window.localStorage.getItem(VIEW_KEY)
    if (stored === 'list' || stored === 'grid') setView(stored)
  }, [])
  const setViewPersisted = (next: ViewMode) => {
    setView(next)
    if (typeof window !== 'undefined') window.localStorage.setItem(VIEW_KEY, next)
  }

  useSearchHotkey({
    inputRef: searchInputRef,
    onClear: () => setSearch(''),
  })

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return proposals
    return proposals.filter(p =>
      (p.title ?? '').toLowerCase().includes(q) ||
      (p.brandName ?? '').toLowerCase().includes(q) ||
      (p.dealTitle ?? '').toLowerCase().includes(q),
    )
  }, [proposals, search])

  const open = (id: string) => router.push(`/proposals/${id}`)

  return (
    <div className="p-4 md:px-6 pb-6 max-w-[1200px] mx-auto w-full">
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-base font-semibold text-slate-900 dark:text-white">Proposals</h1>
        <p className="text-xxs text-slate-500 mt-1">
          Versioned proposal documents across your workspace. New proposals are created via Aria chat.
        </p>
      </div>

      {/* Search + view toggle */}
      <div className="flex items-center gap-3 mb-5">
        <div className="relative flex-1">
          <svg
            width={14} height={14} viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth={1.6}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
          >
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <input
            ref={searchInputRef}
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search proposals, brands, deals…"
            className="w-full h-9 pl-9 pr-3 text-xs rounded-lg bg-slate-100 dark:bg-white/[.04] border border-transparent focus:border-primary/30 focus:bg-white dark:focus:bg-[#1c1c1f] outline-none placeholder:text-slate-400 text-slate-900 dark:text-white"
          />
        </div>
        <div className="flex items-center bg-slate-100 dark:bg-white/[.04] rounded-lg p-0.5 shrink-0">
          <button
            onClick={() => setViewPersisted('list')}
            aria-pressed={view === 'list'}
            className={cn(
              'h-8 w-8 rounded-md flex items-center justify-center transition-colors duration-150',
              view === 'list' ? 'bg-white dark:bg-[#1c1c1f] shadow-[0_1px_2px_rgba(0,0,0,0.06)]' : 'hover:bg-white/60 dark:hover:bg-white/[.04]',
            )}
            title="List view"
          >
            <ListIcon active={view === 'list'} />
          </button>
          <button
            onClick={() => setViewPersisted('grid')}
            aria-pressed={view === 'grid'}
            className={cn(
              'h-8 w-8 rounded-md flex items-center justify-center transition-colors duration-150',
              view === 'grid' ? 'bg-white dark:bg-[#1c1c1f] shadow-[0_1px_2px_rgba(0,0,0,0.06)]' : 'hover:bg-white/60 dark:hover:bg-white/[.04]',
            )}
            title="Grid view"
          >
            <GridIcon active={view === 'grid'} />
          </button>
        </div>
      </div>

      {/* Body */}
      {isLoading ? (
        <div className="bg-white dark:bg-[#1c1c1f] border border-black/[.06] dark:border-white/[.08] rounded-xl shadow-[var(--shadow-card)] overflow-hidden">
          <DataTableSkeleton />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white dark:bg-[#1c1c1f] border border-black/[.06] dark:border-white/[.08] rounded-xl py-16 text-center">
          <FileIcon size={32} className="text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <div className="text-ssm font-semibold text-slate-700 dark:text-slate-200">
            {search ? 'No matches' : 'No proposals yet'}
          </div>
          <div className="text-xxs text-slate-500 mt-1">
            {search ? 'Try another search term.' : 'New proposals are created via Aria chat.'}
          </div>
        </div>
      ) : view === 'grid' ? (
        <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(190px,1fr))]">
          {filtered.map(p => (
            <ProposalCard key={p.id} p={p} onOpen={() => open(p.id)} />
          ))}
        </div>
      ) : (
        <div className="bg-white dark:bg-[#1c1c1f] border border-black/[.06] dark:border-white/[.08] rounded-xl shadow-[var(--shadow-card)] divide-y divide-black/[.06] dark:divide-white/[.06] overflow-hidden">
          {filtered.map(p => (
            <ProposalRow key={p.id} p={p} onOpen={() => open(p.id)} />
          ))}
        </div>
      )}
    </div>
  )
}
