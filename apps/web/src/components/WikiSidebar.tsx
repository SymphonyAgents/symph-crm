'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import { cn, getBrandColor, getInitials } from '@/lib/utils'
import { STAGE_COLORS } from '@/lib/constants'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useGetDealNotes, useGetDocumentsByDeal } from '@/lib/hooks/queries'
import type { ApiCompanyDetail, ApiDeal, DealNoteFile } from '@/lib/types'

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
}: {
  dealId: string
  isSelectedDeal: boolean
  activeCat: string | null
  activeFile: string | null
  activeDocId: string | null
}) {
  const router = useRouter()
  const { data: notesData, isLoading: loadingNotes } = useGetDealNotes(dealId)
  const { data: docs = [], isLoading: loadingDocs } = useGetDocumentsByDeal(dealId)

  const noteRows = useMemo(() => flattenNotes(notesData), [notesData])
  const resourceDocs = useMemo(
    () => docs.filter(d => d.storagePath?.includes('/resources/')),
    [docs],
  )

  const isLoading = loadingNotes || loadingDocs

  if (isLoading) {
    return (
      <div className="ml-[22px] border-l border-black/[.05] dark:border-white/[.05] py-1">
        <div className="flex items-center gap-2 px-2 py-1 pl-8">
          <div className="w-3 h-3 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
          <span className="text-[10px] text-slate-400">Loading...</span>
        </div>
      </div>
    )
  }

  if (noteRows.length === 0 && resourceDocs.length === 0) {
    return (
      <div className="ml-[22px] border-l border-black/[.05] dark:border-white/[.05] py-1">
        <div className="pl-8 pr-2 py-1 text-[10px] text-slate-400 italic">No notes yet</div>
      </div>
    )
  }

  return (
    <div className="ml-[22px] border-l border-black/[.05] dark:border-white/[.05]">
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
                  : 'hover:bg-slate-50 dark:hover:bg-white/[.04]'
              )}
            >
              <span className="w-1 h-1 rounded-full shrink-0 bg-slate-400" />
              <span className={cn(
                'flex-1 text-[11px] min-w-0 truncate',
                isActive ? 'text-primary font-medium' : 'text-slate-500 dark:text-slate-400'
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
                : 'hover:bg-slate-50 dark:hover:bg-white/[.04]'
            )}
          >
            <span
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{ background: isActive ? 'var(--primary)' : dotColor, opacity: isActive ? 1 : 0.55 }}
            />
            <span className={cn(
              'flex-1 text-[11px] min-w-0 truncate',
              isActive ? 'text-primary font-medium' : 'text-slate-600 dark:text-slate-300'
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
                : 'hover:bg-slate-50 dark:hover:bg-white/[.04]'
            )}
          >
            <svg width={9} height={9} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" className={cn('shrink-0', isActive ? 'text-primary' : 'text-slate-400')}>
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
            </svg>
            <span className={cn(
              'flex-1 text-[11px] min-w-0 truncate',
              isActive ? 'text-primary font-medium' : 'text-slate-500 dark:text-slate-400'
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

  const groups = useMemo(() => {
    const q = search.trim().toLowerCase()

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
      const matchesCompany = !q || (company.name ?? '').toLowerCase().includes(q) ||
        (company.industry ?? '').toLowerCase().includes(q)
      const matchingDeals = companyDeals.filter(
        d => !q || (d.title ?? '').toLowerCase().includes(q)
      )

      if (!q || matchesCompany || matchingDeals.length > 0) {
        result.push({
          company,
          id: company.id,
          deals: matchesCompany ? companyDeals : matchingDeals,
        })
      }
    }

    const orphans = (map.get('__none__') ?? []).filter(
      d => !q || (d.title ?? '').toLowerCase().includes(q)
    )
    if (orphans.length > 0) {
      result.push({ company: null, id: '__none__', deals: orphans })
    }

    return result
  }, [companies, deals, search])

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

  function toggleExpandDeal(id: string) {
    setExpandedDeals(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  return (
    <div className="flex flex-col h-full w-full min-w-0 bg-white dark:bg-[#1a1a1d] border-r border-black/[.06] dark:border-white/[.06]">
        {/* Header + view toggle */}
        <div className="px-3 pt-3 pb-2 shrink-0 border-b border-black/[.06] dark:border-white/[.06]">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-xxs font-semibold uppercase tracking-[0.06em] text-slate-400">
              Wiki
            </span>
            <TooltipProvider delayDuration={0}>
              <div className="flex items-center bg-slate-100 dark:bg-white/[.06] rounded-md p-0.5 gap-0.5">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => onViewChange('list')}
                      className={cn(
                        'h-6 w-6 rounded flex items-center justify-center transition-all',
                        view === 'list'
                          ? 'bg-white dark:bg-[#2a2a2e] text-slate-900 dark:text-white shadow-sm'
                          : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
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
                          ? 'bg-white dark:bg-[#2a2a2e] text-slate-900 dark:text-white shadow-sm'
                          : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
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
                placeholder="Filter..."
                className="w-full h-7 pl-7 pr-3 text-xs rounded-md border border-black/[.08] dark:border-white/[.08] bg-slate-50 dark:bg-white/[.04] text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-primary/30 transition-colors"
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
                const isBrandOpen = expandedBrands.has(id)
                const color = company ? getBrandColor(company.name) : '#64748b'
                const isSelectedBrand = selectedCompanyId === id
                const label = company?.name ?? 'No Brand'

                return (
                  <div key={id}>
                    {/* Brand row — Obsidian semantics: click toggles tree, no nav */}
                    <div
                      className={cn(
                        'flex items-center gap-1.5 px-2 py-[5px] cursor-pointer select-none group transition-colors',
                        isSelectedBrand && !selectedDealId
                          ? 'bg-primary/[.07] dark:bg-primary/[.1]'
                          : 'hover:bg-slate-50 dark:hover:bg-white/[.04]'
                      )}
                      onClick={() => toggleExpandBrand(id)}
                    >
                      <button
                        onClick={e => { e.stopPropagation(); toggleExpandBrand(id) }}
                        className="w-4 h-4 flex items-center justify-center text-slate-300 dark:text-slate-600 hover:text-slate-500 dark:hover:text-slate-400 shrink-0 transition-colors"
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
                        'flex-1 text-sm truncate min-w-0',
                        isSelectedBrand && !selectedDealId
                          ? 'text-primary font-semibold'
                          : 'text-slate-700 dark:text-slate-200 font-medium'
                      )}>
                        {label}
                      </span>

                      <span className="text-atom text-slate-400 shrink-0 tabular-nums">
                        {groupDeals.length}
                      </span>
                    </div>

                    {/* Deals — click toggles tree, no nav */}
                    {isBrandOpen && groupDeals.length > 0 && (
                      <div className="ml-[22px] border-l border-black/[.05] dark:border-white/[.05]">
                        {groupDeals
                          .slice()
                          .sort((a, b) => (a.title ?? '').localeCompare(b.title ?? ''))
                          .map(deal => {
                            const stageColor = STAGE_COLORS[deal.stage] ?? '#94a3b8'
                            const isThisDealSelected = selectedDealId === deal.id
                            const isDealExpanded = expandedDeals.has(deal.id)

                            return (
                              <div key={deal.id}>
                                <div
                                  onClick={() => toggleExpandDeal(deal.id)}
                                  className={cn(
                                    'flex items-center gap-2 px-2 py-[5px] cursor-pointer transition-colors',
                                    isThisDealSelected && !activeFile && activeCat !== 'log' && activeCat !== 'resources'
                                      ? 'bg-primary/[.07] dark:bg-primary/[.1]'
                                      : 'hover:bg-slate-50 dark:hover:bg-white/[.04]'
                                  )}
                                >
                                  <button
                                    onClick={e => { e.stopPropagation(); toggleExpandDeal(deal.id) }}
                                    className="w-3 h-3 flex items-center justify-center text-slate-300 dark:text-slate-600 hover:text-slate-500 dark:hover:text-slate-400 shrink-0 transition-colors"
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
                                    'flex-1 text-sm truncate min-w-0',
                                    isThisDealSelected
                                      ? 'text-primary font-medium'
                                      : 'text-slate-600 dark:text-slate-300'
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
