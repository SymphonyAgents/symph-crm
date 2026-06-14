'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import { useQueries } from '@tanstack/react-query'
import { cn, getBrandColor, getInitials } from '@/lib/utils'
import { STAGE_COLORS } from '@/lib/constants'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useGetDealNotes, useGetDocumentsByDeal } from '@/lib/hooks/queries'
import { queryKeys } from '@/lib/query-keys'
import { api } from '@/lib/api'
import type { ApiCompanyDetail, ApiDeal, ApiDocument, DealNoteFile, DealNotesResponse } from '@/lib/types'

export type WikiView = 'list' | 'graph'

type WikiSelection =
  | { kind: 'none' }
  | { kind: 'brand'; company: ApiCompanyDetail }
  | { kind: 'deal'; deal: ApiDeal; company: ApiCompanyDetail | null }

type WikiSidebarProps = {
  companies: ApiCompanyDetail[]
  deals: ApiDeal[]
  selection: WikiSelection
  onSelect: (sel: WikiSelection) => void
  isLoading?: boolean
  view: WikiView
  onViewChange: (v: WikiView) => void
  searchInputRef?: React.RefObject<HTMLInputElement | null>
}

const NOTE_CATEGORY_ORDER = ['general', 'meeting', 'discovery', 'transcript', 'proposal', 'notes'] as const
type NoteCategory = typeof NOTE_CATEGORY_ORDER[number]

type FlatNoteRow =
  | { kind: 'note'; category: NoteCategory; filename: string; title: string; createdAt: number }
  | { kind: 'log' }

function extractNoteTitle(filename: string, content: string): string {
  const headingMatch = content.match(/^#{1,3}\s+(.+)$/m)
  if (headingMatch) return headingMatch[1].trim()
  return filename
    .replace(/\.md$/, '')
    .replace(/^\d{4}-\d{2}-\d{2}[-_]?/, '')
    .replace(/[-_]/g, ' ')
    .trim() || filename
}

function flattenNotes(data: ReturnType<typeof useGetDealNotes>['data']): FlatNoteRow[] {
  if (!data) return []
  const rows: FlatNoteRow[] = []
  for (const cat of NOTE_CATEGORY_ORDER) {
    const files = (data.categories[cat] ?? []) as DealNoteFile[]
    const sorted = [...files].sort((a, b) => b.createdAt - a.createdAt)
    for (const file of sorted) {
      rows.push({
        kind: 'note',
        category: cat,
        filename: file.filename,
        title: extractNoteTitle(file.filename, file.content),
        createdAt: file.createdAt,
      })
    }
  }
  if (data.log) rows.push({ kind: 'log' })
  return rows
}

const CATEGORY_DOT: Record<string, string> = {
  general: '#2563eb',
  meeting: '#7c3aed',
  discovery: '#16a34a',
  transcript: '#0891b2',
  proposal: '#d97706',
  notes: '#6c63ff',
}

// ── Notes + resources tree under an expanded deal ─────────────────────────────

function DealNotesFlat({
  dealId,
  isSelectedDeal,
  activeCat,
  activeFile,
  activeDocId,
  searchQuery = '',
}: {
  dealId: string
  isSelectedDeal: boolean
  activeCat: string | null
  activeFile: string | null
  activeDocId: string | null
  /** When non-empty, filter notes + resources to those matching the query */
  searchQuery?: string
}) {
  const router = useRouter()
  const { data: notesData, isLoading: loadingNotes } = useGetDealNotes(dealId)
  const { data: docs = [], isLoading: loadingDocs } = useGetDocumentsByDeal(dealId)

  const noteRows = useMemo(() => {
    const all = flattenNotes(notesData)
    const q = searchQuery.trim().toLowerCase()
    if (!q) return all
    return all.filter(r => {
      if (r.kind === 'log') return 'log'.includes(q)
      return r.title.toLowerCase().includes(q) || r.filename.toLowerCase().includes(q)
    })
  }, [notesData, searchQuery])

  const resourceDocs = useMemo(() => {
    const all = docs.filter(d => d.storagePath?.includes('/resources/'))
    const q = searchQuery.trim().toLowerCase()
    if (!q) return all
    return all.filter(r =>
      (r.title ?? '').toLowerCase().includes(q) ||
      (r.storagePath?.split('/').pop() ?? '').toLowerCase().includes(q),
    )
  }, [docs, searchQuery])

  const isLoading = loadingNotes || loadingDocs

  if (isLoading) {
    return (
      <div className="ml-[22px] border-l border-border py-1">
        <div className="flex items-center gap-2 px-2 py-1 pl-8">
          <div className="w-3 h-3 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
          <span className="text-[10px] text-slate-400">Loading...</span>
        </div>
      </div>
    )
  }

  if (noteRows.length === 0 && resourceDocs.length === 0) {
    return (
      <div className="ml-[22px] border-l border-border py-1">
        <div className="pl-8 pr-2 py-1 text-[10px] text-slate-400 italic">No notes yet</div>
      </div>
    )
  }

  return (
    <div className="ml-[22px] border-l border-border">
      {noteRows.map((row) => {
        if (row.kind === 'log') {
          const isActive = isSelectedDeal && activeCat === 'log'
          return (
            <div
              key="log"
              onClick={(e) => {
                e.stopPropagation()
                router.push(`/wiki/deal/${dealId}?cat=log`)
              }}
              className={cn(
                'flex items-center gap-2 pl-8 pr-2 py-[4px] cursor-pointer transition-colors',
                isActive
                  ? 'bg-primary/[.07] dark:bg-primary/[.1]'
                  : 'hover:bg-surface-hover'
              )}
            >
              <span className="w-1 h-1 rounded-full shrink-0 bg-slate-400" />
              <span className={cn(
                'flex-1 text-sbase min-w-0 truncate',
                isActive ? 'text-primary font-medium' : 'text-muted-foreground'
              )}>
                Log
              </span>
            </div>
          )
        }

        const isActive = isSelectedDeal && activeCat === row.category && activeFile === row.filename
        const dotColor = CATEGORY_DOT[row.category] ?? '#94a3b8'

        return (
          <div
            key={`${row.category}-${row.filename}`}
            onClick={(e) => {
              e.stopPropagation()
              router.push(`/wiki/deal/${dealId}?cat=${row.category}&file=${encodeURIComponent(row.filename)}`)
            }}
            className={cn(
              'flex items-center gap-2 pl-8 pr-2 py-[4px] cursor-pointer transition-colors',
              isActive
                ? 'bg-primary/[.07] dark:bg-primary/[.1]'
                : 'hover:bg-surface-hover'
            )}
          >
            <span
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{ background: isActive ? 'var(--primary)' : dotColor, opacity: isActive ? 1 : 0.55 }}
            />
            <span className={cn(
              'flex-1 text-sbase min-w-0 truncate',
              isActive ? 'text-primary font-medium' : 'text-muted-foreground'
            )}>
              {row.title}
            </span>
          </div>
        )
      })}

      {resourceDocs.map((doc) => {
        const isActive = isSelectedDeal && activeCat === 'resources' && activeDocId === doc.id
        return (
          <div
            key={doc.id}
            onClick={(e) => {
              e.stopPropagation()
              router.push(`/wiki/deal/${dealId}?cat=resources&docId=${doc.id}`)
            }}
            className={cn(
              'flex items-center gap-2 pl-8 pr-2 py-[4px] cursor-pointer transition-colors',
              isActive
                ? 'bg-primary/[.07] dark:bg-primary/[.1]'
                : 'hover:bg-surface-hover'
            )}
          >
            <svg width={9} height={9} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" className={cn('shrink-0', isActive ? 'text-primary' : 'text-slate-400')}>
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
            </svg>
            <span className={cn(
              'flex-1 text-sbase min-w-0 truncate',
              isActive ? 'text-primary font-medium' : 'text-muted-foreground'
            )}>
              {doc.title || doc.storagePath?.split('/').pop()}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ── Main sidebar ─────────────────────────────────────────────────────────────

export function WikiSidebar({
  companies,
  deals,
  selection,
  onSelect,
  isLoading = false,
  view,
  onViewChange,
  searchInputRef,
}: WikiSidebarProps) {
  const params = useParams()
  const searchParams = useSearchParams()

  const [search, setSearch] = useState('')
  const [expandedBrands, setExpandedBrands] = useState<Set<string>>(new Set())
  const [expandedDeals, setExpandedDeals] = useState<Set<string>>(new Set())

  const selectedCompanyId =
    (params?.companyId as string) ??
    (selection.kind === 'brand' ? selection.company.id :
    selection.kind === 'deal' && selection.company ? selection.company.id :
    null)

  const selectedDealId =
    (params?.dealId as string) ??
    (selection.kind === 'deal' ? selection.deal.id : null)

  const activeCat = searchParams?.get('cat') ?? null
  const activeFile = searchParams?.get('file') ?? null
  const activeDocId = searchParams?.get('docId') ?? null

  const searchQ = search.trim().toLowerCase()
  const searchActive = searchQ.length > 0

  // ── Cross-tree search index ─────────────────────────────────────────────
  // When the user types in the filter, we fetch every deal's notes + docs
  // (idempotent — React Query caches and reuses these per-deal queries used
  // by DealNotesFlat). We then build a Set<dealId> of deals whose own title
  // OR notes/resources match the query, plus a Set<brandId> of brands whose
  // own name/industry OR any descendant matches.

  const noteQueries = useQueries({
    queries: deals.map(d => ({
      queryKey: queryKeys.deals.notes(d.id),
      queryFn: () => api.get<DealNotesResponse>(`/deals/${d.id}/notes`),
      enabled: searchActive,
      staleTime: 60_000,
    })),
  })
  const docQueries = useQueries({
    queries: deals.map(d => ({
      queryKey: queryKeys.documents.byDeal(d.id),
      queryFn: () => api.get<ApiDocument[]>('/documents', { dealId: d.id }),
      enabled: searchActive,
      staleTime: 60_000,
    })),
  })

  const matchedDealIds = useMemo(() => {
    if (!searchActive) return null
    const matched = new Set<string>()
    deals.forEach((deal, i) => {
      // Deal title hit
      if ((deal.title ?? '').toLowerCase().includes(searchQ)) {
        matched.add(deal.id)
        return
      }
      // Notes hit (any category, any title or filename)
      const notes = noteQueries[i]?.data
      if (notes) {
        for (const cat of NOTE_CATEGORY_ORDER) {
          const files = (notes.categories[cat] ?? []) as DealNoteFile[]
          if (files.some(f =>
            extractNoteTitle(f.filename, f.content).toLowerCase().includes(searchQ) ||
            f.filename.toLowerCase().includes(searchQ),
          )) {
            matched.add(deal.id)
            return
          }
        }
      }
      // Resources hit (filename or title)
      const docs = docQueries[i]?.data
      if (docs) {
        const resources = docs.filter(d => d.storagePath?.includes('/resources/'))
        if (resources.some(r =>
          (r.title ?? '').toLowerCase().includes(searchQ) ||
          (r.storagePath?.split('/').pop() ?? '').toLowerCase().includes(searchQ),
        )) {
          matched.add(deal.id)
          return
        }
      }
    })
    return matched
  }, [deals, noteQueries, docQueries, searchActive, searchQ])

  const groups = useMemo(() => {
    const map = new Map<string, ApiDeal[]>()
    for (const deal of deals) {
      const key = deal.companyId ?? '__none__'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(deal)
    }

    const result: Array<{
      company: ApiCompanyDetail | null
      id: string
      deals: ApiDeal[]
    }> = []

    for (const company of [...companies].sort((a, b) =>
      (a.name ?? '').localeCompare(b.name ?? '')
    )) {
      const companyDeals = map.get(company.id) ?? []
      if (!searchActive) {
        result.push({ company, id: company.id, deals: companyDeals })
        continue
      }
      const matchesCompany =
        (company.name ?? '').toLowerCase().includes(searchQ) ||
        (company.industry ?? '').toLowerCase().includes(searchQ)
      const matchingDeals = companyDeals.filter(d => matchedDealIds?.has(d.id))
      if (matchesCompany || matchingDeals.length > 0) {
        result.push({
          company,
          id: company.id,
          // If the brand itself matched, show all its deals; otherwise only matching ones
          deals: matchesCompany ? companyDeals : matchingDeals,
        })
      }
    }

    const orphans = (map.get('__none__') ?? []).filter(d =>
      !searchActive ? true : matchedDealIds?.has(d.id),
    )
    if (orphans.length > 0) {
      result.push({ company: null, id: '__none__', deals: orphans })
    }

    return result
  }, [companies, deals, searchActive, searchQ, matchedDealIds])

  // While searching, force every visible brand + every visible deal open
  // so matching notes/resources are immediately reachable.
  const effectiveExpandedBrands = useMemo(() => {
    if (!searchActive) return expandedBrands
    return new Set(groups.map(g => g.id))
  }, [searchActive, expandedBrands, groups])

  const effectiveExpandedDeals = useMemo(() => {
    if (!searchActive) return expandedDeals
    return new Set(groups.flatMap(g => g.deals.map(d => d.id)))
  }, [searchActive, expandedDeals, groups])

  // Auto-expand the brand and deal that match the URL so the open note is visible.
  // Triggered only by URL changes, not by tree clicks.
  useEffect(() => {
    if (selectedDealId) {
      const deal = deals.find(d => d.id === selectedDealId)
      const brandKey = deal?.companyId ?? (deal ? '__none__' : null)
      if (brandKey) {
        setExpandedBrands(prev => prev.has(brandKey) ? prev : new Set(prev).add(brandKey))
      }
      setExpandedDeals(prev => prev.has(selectedDealId) ? prev : new Set(prev).add(selectedDealId))
      return
    }

    if (selectedCompanyId) {
      setExpandedBrands(prev => prev.has(selectedCompanyId) ? prev : new Set(prev).add(selectedCompanyId))
    }
  }, [selectedDealId, selectedCompanyId, deals])

  function toggleExpandBrand(id: string) {
    setExpandedBrands(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  /**
   * Click on a brand row — expand the brand AND every deal under it so all
   * notes/resources are visible in one click. Clicking again collapses the
   * brand (deals stay expanded individually so reopening preserves state).
   */
  function handleBrandClick(group: { id: string; deals: ApiDeal[] }) {
    const isOpen = expandedBrands.has(group.id)
    if (isOpen) {
      // Collapse just the brand level
      setExpandedBrands(prev => {
        const next = new Set(prev)
        next.delete(group.id)
        return next
      })
    } else {
      // Expand brand + every deal under it
      setExpandedBrands(prev => new Set(prev).add(group.id))
      setExpandedDeals(prev => {
        const next = new Set(prev)
        for (const d of group.deals) next.add(d.id)
        return next
      })
    }
  }

  function toggleExpandDeal(id: string) {
    setExpandedDeals(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  return (
    <div className="flex flex-col h-full w-full min-w-0 bg-card border-r border-border">
        {/* Header + view toggle */}
        <div className="px-3 pt-3 pb-2 shrink-0 border-b border-border">
          <div className="flex items-center justify-between mb-2.5">
            <span className="eyebrow-label">
              Wiki
            </span>
            <TooltipProvider delayDuration={0}>
              <div className="flex items-center bg-secondary rounded-md p-0.5 gap-0.5">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => onViewChange('list')}
                      className={cn(
                        'h-6 w-6 rounded flex items-center justify-center transition-all',
                        view === 'list'
                          ? 'bg-card text-foreground shadow-sm'
                          : 'text-slate-400 hover:text-slate-600 hover:text-foreground'
                      )}
                    >
                      <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round">
                        <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
                        <circle cx="3" cy="6" r="1.5" fill="currentColor" stroke="none" />
                        <circle cx="3" cy="12" r="1.5" fill="currentColor" stroke="none" />
                        <circle cx="3" cy="18" r="1.5" fill="currentColor" stroke="none" />
                      </svg>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">List view</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => onViewChange('graph')}
                      className={cn(
                        'h-6 w-6 rounded flex items-center justify-center transition-all',
                        view === 'graph'
                          ? 'bg-card text-foreground shadow-sm'
                          : 'text-slate-400 hover:text-slate-600 hover:text-foreground'
                      )}
                    >
                      <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
                        <circle cx="5" cy="12" r="2" /><circle cx="19" cy="5" r="2" /><circle cx="19" cy="19" r="2" /><circle cx="12" cy="12" r="2" />
                        <line x1="7" y1="12" x2="10" y2="12" /><line x1="13.4" y1="10.6" x2="17" y2="6.9" /><line x1="13.4" y1="13.4" x2="17" y2="17.1" />
                      </svg>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Graph view</TooltipContent>
                </Tooltip>
              </div>
            </TooltipProvider>
          </div>

          {view === 'list' && (
            <div className="relative">
              <svg
                width={12} height={12}
                viewBox="0 0 24 24" fill="none"
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                stroke="currentColor" strokeWidth={1.4} strokeLinecap="round"
              >
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search brands, deals, notes, files..."
                className="w-full h-7 pl-7 pr-3 text-xs rounded-md border border-border bg-surface-alt text-foreground placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-primary/30 transition-colors"
              />
            </div>
          )}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="py-1">
            {isLoading ? (
              <div className="flex items-center justify-center h-24">
                <div className="w-4 h-4 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
              </div>
            ) : groups.length === 0 ? (
              <div className="px-4 py-6 text-center">
                <p className="text-xxs text-slate-400">No results</p>
              </div>
            ) : (
              groups.map((group) => {
                const { company, id, deals: groupDeals } = group
                const isBrandOpen = effectiveExpandedBrands.has(id)
                const color = company ? getBrandColor(company.name) : '#64748b'
                const isSelectedBrand = selectedCompanyId === id
                const label = company?.name ?? 'No Brand'

                return (
                  <div key={id}>
                    {/* Brand row — click expands brand + all deals beneath it.
                         Use the chevron alone if you only want to toggle the brand level. */}
                    <div
                      className={cn(
                        'flex items-center gap-1.5 px-2 py-[5px] cursor-pointer select-none group transition-colors',
                        isSelectedBrand && !selectedDealId
                          ? 'bg-primary/[.07] dark:bg-primary/[.1]'
                          : 'hover:bg-surface-hover'
                      )}
                      onClick={() => handleBrandClick(group)}
                    >
                      <button
                        onClick={e => { e.stopPropagation(); toggleExpandBrand(id) }}
                        className="w-4 h-4 flex items-center justify-center text-muted-foreground hover:text-slate-700 shrink-0 transition-colors"
                      >
                        <svg
                          width={10} height={10} viewBox="0 0 24 24"
                          fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"
                          className={cn('transition-transform', isBrandOpen && 'rotate-90')}
                        >
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                      </button>

                      <div
                        className="w-5 h-5 rounded flex items-center justify-center text-atom font-bold shrink-0"
                        style={{ background: `${color}18`, color }}
                      >
                        {getInitials(label)}
                      </div>

                      <span className={cn(
                        'flex-1 text-sbase truncate min-w-0',
                        isSelectedBrand && !selectedDealId
                          ? 'text-primary font-semibold'
                          : 'text-foreground font-medium'
                      )}>
                        {label}
                      </span>

                      <span className="text-atom text-slate-400 shrink-0 tabular-nums">
                        {groupDeals.length}
                      </span>
                    </div>

                    {/* Deals — click toggles tree, no nav */}
                    {isBrandOpen && groupDeals.length > 0 && (
                      <div className="ml-[22px] border-l border-border">
                        {groupDeals
                          .slice()
                          .sort((a, b) => (a.title ?? '').localeCompare(b.title ?? ''))
                          .map(deal => {
                            const stageColor = STAGE_COLORS[deal.stage] ?? '#94a3b8'
                            const isThisDealSelected = selectedDealId === deal.id
                            const isDealExpanded = effectiveExpandedDeals.has(deal.id)

                            return (
                              <div key={deal.id}>
                                <div
                                  onClick={() => toggleExpandDeal(deal.id)}
                                  className={cn(
                                    'flex items-center gap-2 px-2 py-[5px] cursor-pointer transition-colors',
                                    isThisDealSelected && !activeFile && activeCat !== 'log' && activeCat !== 'resources'
                                      ? 'bg-primary/[.07] dark:bg-primary/[.1]'
                                      : 'hover:bg-surface-hover'
                                  )}
                                >
                                  <button
                                    onClick={e => { e.stopPropagation(); toggleExpandDeal(deal.id) }}
                                    className="w-3 h-3 flex items-center justify-center text-muted-foreground hover:text-slate-700 shrink-0 transition-colors"
                                  >
                                    <svg
                                      width={8} height={8} viewBox="0 0 24 24"
                                      fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"
                                      className={cn('transition-transform', isDealExpanded && 'rotate-90')}
                                    >
                                      <polyline points="9 18 15 12 9 6" />
                                    </svg>
                                  </button>

                                  <div
                                    className="w-1.5 h-1.5 rounded-full shrink-0"
                                    style={{ background: stageColor }}
                                  />
                                  <span className={cn(
                                    'flex-1 text-sbase truncate min-w-0',
                                    isThisDealSelected
                                      ? 'text-primary font-medium'
                                      : 'text-muted-foreground'
                                  )}>
                                    {deal.title}
                                  </span>
                                </div>

                                {isDealExpanded && (
                                  <DealNotesFlat
                                    dealId={deal.id}
                                    isSelectedDeal={isThisDealSelected}
                                    activeCat={activeCat}
                                    activeFile={activeFile}
                                    activeDocId={activeDocId}
                                    searchQuery={searchActive ? searchQ : ''}
                                  />
                                )}
                              </div>
                            )
                          })}
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>
    </div>
  )
}

export type { WikiSelection }
