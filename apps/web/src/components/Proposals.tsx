'use client'

/**
 * Proposals — deal-grouped tree sidebar + iframe preview.
 *
 * Layout:
 *   ┌──────────────────┬──────────────────────────────┐
 *   │ Sidebar          │ Preview (iframe)             │
 *   │  Deal A    ▼     │                              │
 *   │   • Proposal v3  │  <iframe srcdoc={html} />    │
 *   │   • Proposal …   │                              │
 *   │  Deal B    ▶     │                              │
 *   │  Deal C    ▼     │                              │
 *   │   • Proposal …   │                              │
 *   └──────────────────┴──────────────────────────────┘
 *
 * Behavior:
 *   - All deals listed (wiki-style); chevron toggles per deal
 *   - Clicking a deal auto-expands ALL its proposals (matches wiki)
 *   - Clicking a proposal selects it; URL ?proposal=<id> persists selection
 *   - Search matches deal title, brand name, AND proposal titles
 *     (mirrors WikiSidebar's cross-tree search index)
 *   - No notes/resources here — proposals only
 *   - Creation moves to Aria chat — no "+ New" button in this view
 */

import { useState, useMemo, useEffect, useRef } from 'react'
import { useQueries } from '@tanstack/react-query'
import { useRouter, useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'
import { queryKeys } from '@/lib/query-keys'
import { useGetDeals, useGetCompanies, useGetProposalHead } from '@/lib/hooks/queries'
import { useSearchHotkey } from '@/lib/hooks/use-search-hotkey'
import type { ApiDeal, ApiCompanyDetail, ApiProposalListItem } from '@/lib/types'

// ─── Sidebar tree ───────────────────────────────────────────────────────────

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width={10} height={10} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth={2.2}
      strokeLinecap="round" strokeLinejoin="round"
      className={cn('shrink-0 text-slate-400 transition-transform duration-150', open && 'rotate-90')}
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  )
}

function FileIcon({ className }: { className?: string }) {
  return (
    <svg
      width={12} height={12} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth={1.6}
      strokeLinecap="round" strokeLinejoin="round"
      className={className}
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
    </svg>
  )
}

function ProposalTreeRow({
  proposal,
  active,
  onSelect,
}: {
  proposal: ApiProposalListItem
  active: boolean
  onSelect: () => void
}) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        'w-full flex items-center gap-2 pl-7 pr-2 py-1.5 rounded-md text-left transition-colors',
        active
          ? 'bg-primary/10 text-primary'
          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[.04]',
      )}
    >
      <FileIcon className={cn('shrink-0', active ? 'text-primary' : 'text-slate-400')} />
      <span className="truncate text-xs">{proposal.title}</span>
      <span className={cn('ml-auto text-atom font-mono shrink-0', active ? 'text-primary/70' : 'text-slate-400')}>
        v{proposal.currentVersion}
      </span>
    </button>
  )
}

function DealNode({
  deal,
  brandName,
  proposals,
  isLoading,
  expanded,
  onToggle,
  selectedProposalId,
  onSelectProposal,
}: {
  deal: ApiDeal
  brandName: string | null
  proposals: ApiProposalListItem[]
  isLoading: boolean
  expanded: boolean
  onToggle: () => void
  selectedProposalId: string | null
  onSelectProposal: (id: string) => void
}) {
  const count = proposals.length
  // Only show brand subtitle if it isn't already a substring of the deal title.
  const showBrand =
    !!brandName &&
    !(deal.title ?? '').toLowerCase().includes(brandName.toLowerCase())
  return (
    <div className="mb-0.5">
      <button
        onClick={onToggle}
        className={cn(
          'w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left transition-colors',
          'text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[.04]',
        )}
      >
        <ChevronIcon open={expanded} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-ssm font-medium">{deal.title}</div>
          {showBrand && (
            <div className="truncate text-atom text-slate-400 mt-0.5">{brandName}</div>
          )}
        </div>
        <span className={cn(
          'ml-2 text-atom font-mono shrink-0',
          count > 0 ? 'text-slate-500' : 'text-slate-300',
        )}>
          {isLoading ? '…' : count}
        </span>
      </button>
      {expanded && (
        <div className="mt-0.5 space-y-px">
          {isLoading ? (
            <div className="pl-7 py-1.5 text-xxs text-slate-400">Loading…</div>
          ) : proposals.length === 0 ? (
            <div className="pl-7 py-1.5 text-xxs text-slate-400">No proposals</div>
          ) : (
            proposals.map(p => (
              <ProposalTreeRow
                key={p.id}
                proposal={p}
                active={selectedProposalId === p.id}
                onSelect={() => onSelectProposal(p.id)}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}

// ─── Preview pane ───────────────────────────────────────────────────────────

function ProposalPreview({ proposalId }: { proposalId: string }) {
  const { data, isLoading, error } = useGetProposalHead(proposalId)

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center text-ssm text-slate-400">
        Loading proposal…
      </div>
    )
  }
  if (error || !data) {
    return (
      <div className="flex-1 flex items-center justify-center text-ssm text-slate-400">
        {error?.message ?? 'Proposal not found'}
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex items-center gap-3 px-5 py-3 border-b border-black/[.06] dark:border-white/[.08] bg-white dark:bg-[#1c1c1f]">
        <div className="min-w-0 flex-1">
          <div className="text-ssm font-semibold text-slate-900 dark:text-white truncate">{data.title}</div>
          <div className="text-xxs text-slate-500 mt-0.5">
            v{data.currentVersion} · {data.version.wordCount ?? 0} words
            {data.version.changeNote && <> · <span className="text-slate-400">{data.version.changeNote}</span></>}
          </div>
        </div>
        <div className="text-xxs text-slate-400">
          {new Date(data.updatedAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
        </div>
      </div>
      <div className="flex-1 min-h-0 bg-slate-100 dark:bg-[#0f0f12]">
        <iframe
          key={proposalId}
          srcDoc={data.version.html}
          title={data.title}
          // No allow-same-origin: iframe can't read cookies / parent DOM.
          // allow-scripts: author-trusted content; public render path strips scripts separately.
          sandbox="allow-scripts allow-forms allow-popups allow-modals"
          className="w-full h-full border-0 bg-white"
        />
      </div>
    </div>
  )
}

// ─── Main component ─────────────────────────────────────────────────────────

export function Proposals() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const selectedId = searchParams?.get('proposal') ?? null

  const { data: deals = [], isLoading: dealsLoading } = useGetDeals()
  const { data: companies = [] } = useGetCompanies()
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Cmd/Ctrl+F focuses the search; Escape clears.
  useSearchHotkey({
    inputRef: searchInputRef,
    onClear: () => setSearch(''),
  })

  // Brand lookup — used both for the deal subtitle and for brand-aware search.
  const companyById = useMemo(() => {
    const m = new Map<string, ApiCompanyDetail>()
    for (const c of companies) m.set(c.id, c)
    return m
  }, [companies])

  // Per-deal proposal lists (parallel queries — same pattern as WikiSidebar)
  const proposalQueries = useQueries({
    queries: deals.map(d => ({
      queryKey: queryKeys.proposals.byDeal(d.id),
      queryFn: () => api.get<ApiProposalListItem[]>(`/deals/${d.id}/proposals`),
      staleTime: 60_000,
    })),
  })

  const proposalsByDeal = useMemo(() => {
    const map = new Map<string, ApiProposalListItem[]>()
    deals.forEach((d, i) => map.set(d.id, proposalQueries[i]?.data ?? []))
    return map
  }, [deals, proposalQueries])

  // Only deals that actually have proposals are worth listing — empty deals
  // would just be noise. We compute this base list once, then narrow further
  // with the search query.
  const dealsWithProposals = useMemo(
    () => deals.filter(d => (proposalsByDeal.get(d.id)?.length ?? 0) > 0),
    [deals, proposalsByDeal],
  )

  // Filter deals by search across deal title + brand name + proposal titles
  const filteredDeals = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return dealsWithProposals
    return dealsWithProposals.filter(d => {
      if ((d.title ?? '').toLowerCase().includes(q)) return true
      // Brand match — find the deal's brand and check its name
      const brand = d.companyId ? companyById.get(d.companyId) : null
      if (brand && (brand.name ?? '').toLowerCase().includes(q)) return true
      // Proposal title match
      const list = proposalsByDeal.get(d.id) ?? []
      return list.some(p => (p.title ?? '').toLowerCase().includes(q))
    })
  }, [dealsWithProposals, search, proposalsByDeal, companyById])

  // When a search is active, auto-expand every visible deal so matched proposals show.
  const effectiveExpanded = useMemo(() => {
    if (!search.trim()) return expanded
    const all = new Set(expanded)
    filteredDeals.forEach(d => all.add(d.id))
    return all
  }, [expanded, search, filteredDeals])

  // Auto-expand the deal containing the currently-selected proposal.
  useEffect(() => {
    if (!selectedId) return
    for (const [dealId, list] of proposalsByDeal) {
      if (list.some(p => p.id === selectedId)) {
        setExpanded(prev => prev.has(dealId) ? prev : new Set(prev).add(dealId))
        return
      }
    }
  }, [selectedId, proposalsByDeal])

  const toggleDeal = (dealId: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(dealId)) next.delete(dealId)
      else next.add(dealId)
      return next
    })
  }

  const selectProposal = (id: string) => {
    const sp = new URLSearchParams(searchParams?.toString() || '')
    sp.set('proposal', id)
    router.push(`?${sp.toString()}`, { scroll: false })
  }

  const totalCount = useMemo(() => {
    let n = 0
    for (const list of proposalsByDeal.values()) n += list.length
    return n
  }, [proposalsByDeal])

  return (
    <div className="h-full flex overflow-hidden">
      {/* Sidebar */}
      <div className="w-72 shrink-0 border-r border-black/[.06] dark:border-white/[.08] bg-white dark:bg-[#1c1c1f] flex flex-col">
        <div className="px-4 pt-4 pb-2">
          <div className="text-base font-semibold text-slate-900 dark:text-white">Proposals</div>
          <div className="text-xxs text-slate-500 mt-0.5">
            {totalCount} across {dealsWithProposals.length} deal{dealsWithProposals.length === 1 ? '' : 's'}
          </div>
        </div>
        <div className="px-3 pb-2">
          <div className="relative">
            <svg
              width={12} height={12} viewBox="0 0 24 24"
              fill="none" stroke="currentColor" strokeWidth={1.5}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            >
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
            <input
              ref={searchInputRef}
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search deals, brands, proposals…"
              className="w-full h-8 pl-8 pr-3 text-xs rounded-lg bg-slate-100 dark:bg-white/[.04] border border-transparent focus:border-primary/30 focus:bg-white dark:focus:bg-[#1c1c1f] outline-none placeholder:text-slate-400 text-slate-900 dark:text-white"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-2 pb-3">
          {dealsLoading ? (
            <div className="px-2 py-2 text-xxs text-slate-400">Loading deals…</div>
          ) : filteredDeals.length === 0 ? (
            <div className="px-2 py-6 text-center">
              <div className="text-xs text-slate-400">
                {search ? 'No matches' : 'No proposals yet'}
              </div>
            </div>
          ) : (
            filteredDeals.map(deal => {
              const list = proposalsByDeal.get(deal.id) ?? []
              const q = search.trim().toLowerCase()
              const brand = deal.companyId ? companyById.get(deal.companyId) ?? null : null
              const dealOrBrandHit =
                !q ||
                (deal.title ?? '').toLowerCase().includes(q) ||
                (brand?.name ?? '').toLowerCase().includes(q)
              // If the search matched the deal/brand itself, show ALL proposals.
              // If the search only matched specific proposal titles, show just those.
              const visible = dealOrBrandHit
                ? list
                : list.filter(p => (p.title ?? '').toLowerCase().includes(q))
              const dealIndex = deals.indexOf(deal)
              return (
                <DealNode
                  key={deal.id}
                  deal={deal}
                  brandName={brand?.name ?? null}
                  proposals={visible}
                  isLoading={proposalQueries[dealIndex]?.isLoading ?? false}
                  expanded={effectiveExpanded.has(deal.id)}
                  onToggle={() => toggleDeal(deal.id)}
                  selectedProposalId={selectedId}
                  onSelectProposal={selectProposal}
                />
              )
            })
          )}
        </div>
      </div>

      {/* Preview */}
      {selectedId ? (
        <ProposalPreview proposalId={selectedId} />
      ) : (
        <div className="flex-1 flex items-center justify-center bg-slate-50 dark:bg-[#0f0f12]">
          <div className="flex flex-col items-center text-center px-6">
            <div className="w-14 h-14 rounded-md bg-slate-200/60 dark:bg-white/[.06] flex items-center justify-center mb-4">
              <FileIcon className="w-6 h-6 text-slate-400" />
            </div>
            <div className="text-sbase font-semibold text-slate-900 dark:text-white">Select a proposal</div>
            <div className="text-ssm text-slate-500 mt-1">Pick one from the sidebar. New proposals are created via Aria chat.</div>
          </div>
        </div>
      )}
    </div>
  )
}
