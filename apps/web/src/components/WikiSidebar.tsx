'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import { cn, getBrandColor, getInitials, formatDealValue } from '@/lib/utils'
import { STAGE_COLORS, STAGE_LABELS } from '@/lib/constants'
import { useGetDealNotes } from '@/lib/hooks/queries'
import type { ApiCompanyDetail, ApiDeal } from '@/lib/types'

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
}

// Note category config for 3rd level
const NOTE_CATEGORIES = [
  { key: 'general' as const, label: 'general', icon: 'document' },
  { key: 'meeting' as const, label: 'meeting', icon: 'calendar' },
  { key: 'notes' as const, label: 'notes', icon: 'pencil' },
  { key: 'resources' as const, label: 'resources', icon: 'paperclip' },
] as const

type NoteCategory = typeof NOTE_CATEGORIES[number]['key']

function NoteCategoryIcon({ type, className }: { type: string; className?: string }) {
  switch (type) {
    case 'document':
      return (
        <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" className={className}>
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
      )
    case 'calendar':
      return (
        <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" className={className}>
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      )
    case 'pencil':
      return (
        <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" className={className}>
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
        </svg>
      )
    case 'paperclip':
      return (
        <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" className={className}>
          <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
        </svg>
      )
    default:
      return null
  }
}

// Sub-component: lazy note counts for an expanded deal
function DealNoteCategories({
  dealId,
  isSelectedDeal,
  activeTab,
}: {
  dealId: string
  isSelectedDeal: boolean
  activeTab: string | null
}) {
  const router = useRouter()
  const { data, isLoading } = useGetDealNotes(dealId)

  if (isLoading) {
    return (
      <div className="ml-[22px] border-l border-black/[.05] dark:border-white/[.05] py-1">
        <div className="flex items-center gap-2 px-2 py-1 pl-10">
          <div className="w-3 h-3 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
          <span className="text-[10px] text-slate-400">Loading...</span>
        </div>
      </div>
    )
  }

  if (!data) return null

  const counts: Record<NoteCategory, number> = {
    general: data.categories.general.length,
    meeting: data.categories.meeting.length,
    notes: data.categories.notes.length,
    resources: data.resources.length,
  }

  return (
    <div className="ml-[22px] border-l border-black/[.05] dark:border-white/[.05]">
      {NOTE_CATEGORIES.map(({ key, label, icon }) => {
        const count = counts[key]
        const isActive = isSelectedDeal && activeTab === key

        return (
          <div
            key={key}
            onClick={(e) => {
              e.stopPropagation()
              router.push(`/wiki/deal/${dealId}?tab=${key}`)
            }}
            className={cn(
              'flex items-center gap-1.5 pl-10 pr-2 py-[4px] cursor-pointer transition-colors',
              isActive
                ? 'bg-primary/[.07] dark:bg-primary/[.1]'
                : 'hover:bg-slate-50 dark:hover:bg-white/[.04]'
            )}
          >
            <NoteCategoryIcon
              type={icon}
              className={cn(
                'shrink-0',
                isActive ? 'text-primary' : 'text-slate-400 dark:text-slate-500'
              )}
            />
            <span className={cn(
              'flex-1 text-[10px] min-w-0',
              isActive
                ? 'text-primary font-medium'
                : 'text-slate-500 dark:text-slate-400'
            )}>
              {label}
            </span>
            {count > 0 && (
              <span className={cn(
                'text-[9px] tabular-nums shrink-0',
                isActive ? 'text-primary' : 'text-slate-400'
              )}>
                ({count})
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

export function WikiSidebar({
  companies,
  deals,
  selection,
  onSelect,
  isLoading = false,
  view,
  onViewChange,
}: WikiSidebarProps) {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()

  const [search, setSearch] = useState('')
  const [expandedBrands, setExpandedBrands] = useState<Set<string>>(new Set())
  const [expandedDeals, setExpandedDeals] = useState<Set<string>>(new Set())

  // Derive active IDs from URL
  const selectedCompanyId =
    (params?.companyId as string) ??
    (selection.kind === 'brand' ? selection.company.id :
    selection.kind === 'deal' && selection.company ? selection.company.id :
    null)

  const selectedDealId =
    (params?.dealId as string) ??
    (selection.kind === 'deal' ? selection.deal.id : null)

  const activeTab = searchParams?.get('tab') ?? null

  // Auto-expand the brand node so the selected deal is visible in the list.
  // Does NOT auto-expand the deal node (note categories) — that's manual via chevron only.
  useEffect(() => {
    if (selectedDealId) {
      const deal = deals.find(d => d.id === selectedDealId)
      const brandKey = deal?.companyId ?? (deal ? '__none__' : null)
      if (brandKey) {
        setExpandedBrands(prev => {
          if (prev.has(brandKey)) return prev
          const next = new Set(prev)
          next.add(brandKey)
          return next
        })
      }
    } else if (selectedCompanyId) {
      setExpandedBrands(prev => {
        if (prev.has(selectedCompanyId)) return prev
        const next = new Set(prev)
        next.add(selectedCompanyId)
        return next
      })
    }
  }, [selectedDealId, selectedCompanyId, deals])

  // Group deals by company, sorted alpha
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
      a.name.localeCompare(b.name)
    )) {
      const companyDeals = map.get(company.id) ?? []
      const matchesCompany = !q || company.name.toLowerCase().includes(q) ||
        (company.industry ?? '').toLowerCase().includes(q)
      const matchingDeals = companyDeals.filter(
        d => !q || d.title.toLowerCase().includes(q) || STAGE_LABELS[d.stage]?.toLowerCase().includes(q)
      )

      if (!q || matchesCompany || matchingDeals.length > 0) {
        result.push({
          company,
          id: company.id,
          deals: matchesCompany ? companyDeals : matchingDeals,
        })
      }
    }

    // Orphan deals (no company)
    const orphans = (map.get('__none__') ?? []).filter(
      d => !q || d.title.toLowerCase().includes(q)
    )
    if (orphans.length > 0) {
      result.push({ company: null, id: '__none__', deals: orphans })
    }

    return result
  }, [companies, deals, search])

  function toggleExpandBrand(id: string) {
    setExpandedBrands(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleExpandDeal(id: string) {
    setExpandedDeals(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#1a1a1d] border-r border-black/[.06] dark:border-white/[.06]">
      {/* Header + view toggle */}
      <div className="px-3 pt-3 pb-2 shrink-0 border-b border-black/[.06] dark:border-white/[.06]">
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-xxs font-semibold uppercase tracking-[0.06em] text-slate-400">
            Wiki
          </span>
          <div className="flex items-center bg-slate-100 dark:bg-white/[.06] rounded-md p-0.5 gap-0.5">
            <button
              onClick={() => onViewChange('list')}
              title="List view"
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
            <button
              onClick={() => onViewChange('graph')}
              title="Graph view"
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
          </div>
        </div>

        {/* Search -- list view only */}
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
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Filter..."
              className="w-full h-7 pl-7 pr-3 text-xs rounded-md border border-black/[.08] dark:border-white/[.08] bg-slate-50 dark:bg-white/[.04] text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-primary/30 transition-colors"
            />
          </div>
        )}
      </div>

      {/* Body -- list view only; graph is rendered full-width by the parent page */}
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
              groups.map(({ company, id, deals: groupDeals }) => {
                const isBrandOpen = expandedBrands.has(id)
                const color = company ? getBrandColor(company.name) : '#64748b'
                const isSelectedBrand = selectedCompanyId === id
                const label = company?.name ?? 'No Brand'

                return (
                  <div key={id}>
                    {/* Brand row */}
                    <div
                      className={cn(
                        'flex items-center gap-1.5 px-2 py-[5px] cursor-pointer select-none group transition-colors',
                        isSelectedBrand && !selectedDealId
                          ? 'bg-primary/[.07] dark:bg-primary/[.1]'
                          : 'hover:bg-slate-50 dark:hover:bg-white/[.04]'
                      )}
                      onClick={() => {
                        toggleExpandBrand(id)
                        if (company) {
                          router.push(`/wiki/brand/${company.id}`)
                          onSelect({ kind: 'brand', company })
                        }
                      }}
                    >
                      {/* Chevron */}
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

                      {/* Brand avatar */}
                      <div
                        className="w-5 h-5 rounded flex items-center justify-center text-atom font-bold shrink-0"
                        style={{ background: `${color}18`, color }}
                      >
                        {getInitials(label)}
                      </div>

                      {/* Brand name */}
                      <span className={cn(
                        'flex-1 text-xs truncate min-w-0',
                        isSelectedBrand && !selectedDealId
                          ? 'text-primary font-semibold'
                          : 'text-slate-700 dark:text-slate-200 font-medium'
                      )}>
                        {label}
                      </span>

                      {/* Deal count badge */}
                      <span className="text-atom text-slate-400 shrink-0 tabular-nums">
                        {groupDeals.length}
                      </span>
                    </div>

                    {/* Deals (children) -- level 2 */}
                    {isBrandOpen && groupDeals.length > 0 && (
                      <div className="ml-[22px] border-l border-black/[.05] dark:border-white/[.05]">
                        {groupDeals
                          .slice()
                          .sort((a, b) => a.title.localeCompare(b.title))
                          .map(deal => {
                            const stageColor = STAGE_COLORS[deal.stage] ?? '#94a3b8'
                            const isThisDealSelected = selectedDealId === deal.id
                            const isDealExpanded = expandedDeals.has(deal.id)

                            return (
                              <div key={deal.id}>
                                {/* Deal row */}
                                <div
                                  onClick={() => {
                                    router.push(`/wiki/deal/${deal.id}`)
                                    onSelect({ kind: 'deal', deal, company: company ?? null })
                                  }}
                                  className={cn(
                                    'flex items-center gap-2 px-2 py-[5px] cursor-pointer transition-colors',
                                    isThisDealSelected && !activeTab
                                      ? 'bg-primary/[.07] dark:bg-primary/[.1]'
                                      : 'hover:bg-slate-50 dark:hover:bg-white/[.04]'
                                  )}
                                >
                                  {/* Chevron for deal expand */}
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

                                  {/* Stage dot */}
                                  <div
                                    className="w-1.5 h-1.5 rounded-full shrink-0"
                                    style={{ background: stageColor }}
                                  />
                                  {/* Deal title */}
                                  <span className={cn(
                                    'flex-1 text-xs truncate min-w-0',
                                    isThisDealSelected
                                      ? 'text-primary font-medium'
                                      : 'text-slate-600 dark:text-slate-300'
                                  )}>
                                    {deal.title}
                                  </span>
                                </div>

                                {/* Note categories -- level 3 (lazy loaded) */}
                                {isDealExpanded && (
                                  <DealNoteCategories
                                    dealId={deal.id}
                                    isSelectedDeal={isThisDealSelected}
                                    activeTab={activeTab}
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
