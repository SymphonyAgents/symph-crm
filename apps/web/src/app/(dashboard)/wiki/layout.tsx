'use client'

import { useState, useMemo, useRef, useCallback, useEffect, Suspense } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useGetCompanies, useGetDeals } from '@/lib/hooks/queries'
import { WikiSidebar } from '@/components/WikiSidebar'
import { DealsGraph } from '@/components/DealsGraph'
import { cn } from '@/lib/utils'
import type { WikiSelection, WikiView } from '@/components/WikiSidebar'
import type { ApiDeal, ApiCompanyDetail } from '@/lib/types'

const SIDEBAR_MIN = 220
const SIDEBAR_MAX = 480
const SIDEBAR_DEFAULT = 320
const STORAGE_KEY = 'wiki-sidebar-width'

function useSidebarWidth() {
  const [width, setWidth] = useState(SIDEBAR_DEFAULT)

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = parseInt(stored, 10)
      if (!isNaN(parsed) && parsed >= SIDEBAR_MIN && parsed <= SIDEBAR_MAX) {
        setWidth(parsed)
      }
    }
  }, [])

  const persist = useCallback((w: number) => {
    const clamped = Math.max(SIDEBAR_MIN, Math.min(SIDEBAR_MAX, w))
    setWidth(clamped)
    localStorage.setItem(STORAGE_KEY, String(clamped))
  }, [])

  return { width, setWidth: persist }
}

type MobilePane = 'sidebar' | 'content'

function WikiLayoutInner({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()

  const { data: companies = [], isLoading: loadingCompanies } = useGetCompanies()
  const { data: deals = [], isLoading: loadingDeals } = useGetDeals()

  const [mobilePane, setMobilePane] = useState<MobilePane>('sidebar')
  const [view, setView] = useState<WikiView>('list')
  const { width: sidebarWidth, setWidth: setSidebarWidth } = useSidebarWidth()
  const [isDragging, setIsDragging] = useState(false)
  const dragRef = useRef<{ startX: number; startW: number } | null>(null)

  // Search state
  const sidebarSearchRef = useRef<HTMLInputElement>(null)
  const graphSearchRef = useRef<HTMLInputElement>(null)
  const [graphSearch, setGraphSearch] = useState('')

  // Cmd+F / Ctrl+F — focus the appropriate search input
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault()
        if (view === 'list') {
          sidebarSearchRef.current?.focus()
        } else {
          graphSearchRef.current?.focus()
        }
      }
      if (e.key === 'Escape' && view === 'graph' && graphSearch) {
        setGraphSearch('')
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [view, graphSearch])

  // Resize drag handlers
  const onDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    dragRef.current = { startX: e.clientX, startW: sidebarWidth }
    setIsDragging(true)
  }, [sidebarWidth])

  useEffect(() => {
    if (!isDragging) return

    function onMouseMove(e: MouseEvent) {
      if (!dragRef.current) return
      const delta = e.clientX - dragRef.current.startX
      setSidebarWidth(dragRef.current.startW + delta)
    }

    function onMouseUp() {
      setIsDragging(false)
      dragRef.current = null
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    return () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isDragging, setSidebarWidth])

  const isLoading = loadingCompanies || loadingDeals

  // When the URL navigates to a specific deal/brand page (e.g. via graph click),
  // force list view so the content is visible. Toggling back to graph from the
  // list view is unaffected because pathname doesn't change.
  useEffect(() => {
    if (/\/wiki\/(deal|brand)\//.test(pathname ?? '')) {
      setView('list')
    }
  }, [pathname])

  const companyMap = useMemo(() => {
    const m = new Map<string, ApiCompanyDetail>()
    for (const c of companies) m.set(c.id, c)
    return m
  }, [companies])

  const dealMap = useMemo(() => {
    const m = new Map<string, ApiDeal>()
    for (const d of deals) m.set(d.id, d)
    return m
  }, [deals])

  // Derive selection from pathname
  const selection: WikiSelection = useMemo(() => {
    const dealMatch = pathname?.match(/\/wiki\/deal\/([^/?]+)/)
    const brandMatch = pathname?.match(/\/wiki\/brand\/([^/?]+)/)

    if (dealMatch) {
      const dealId = dealMatch[1]
      const deal = dealMap.get(dealId)
      if (deal) {
        const company = deal.companyId ? companyMap.get(deal.companyId) ?? null : null
        return { kind: 'deal', deal, company }
      }
    }

    if (brandMatch) {
      const companyId = brandMatch[1]
      const company = companyMap.get(companyId)
      if (company) {
        return { kind: 'brand', company }
      }
    }

    return { kind: 'none' }
  }, [pathname, dealMap, companyMap])

  const hasSelection = selection.kind !== 'none'
  const effectivePane = hasSelection ? mobilePane : 'sidebar'

  function handleSelect(sel: WikiSelection) {
    if (sel.kind === 'brand') {
      router.push(`/wiki/brand/${sel.company.id}`)
    } else if (sel.kind === 'deal') {
      router.push(`/wiki/deal/${sel.deal.id}`)
    } else {
      router.push('/wiki')
    }
    if (sel.kind !== 'none') setMobilePane('content')
  }

  function handleViewChange(v: WikiView) {
    setView(v)
    if (v === 'list') setGraphSearch('')
  }

  // Unified layout: sidebar always visible, content pane switches between list children and graph
  return (
    <div className="flex h-full overflow-hidden">
      {/* Wiki sidebar — persistent across views and navigations, resizable */}
      <div
        className={cn(
          'md:flex md:shrink-0 md:h-full h-full w-full',
          effectivePane === 'sidebar' || mobilePane === 'sidebar' ? 'flex' : 'hidden md:flex',
        )}
        style={{ width: sidebarWidth, maxWidth: SIDEBAR_MAX, minWidth: SIDEBAR_MIN }}
      >
        <WikiSidebar
          companies={companies}
          deals={deals}
          selection={selection}
          onSelect={handleSelect}
          isLoading={isLoading}
          view={view}
          onViewChange={handleViewChange}
          searchInputRef={sidebarSearchRef}
        />
      </div>

      {/* Drag handle */}
      <div
        onMouseDown={onDragStart}
        className={cn(
          'hidden md:flex w-1 shrink-0 cursor-col-resize items-stretch justify-center group',
          isDragging ? 'bg-primary/20' : 'hover:bg-primary/10',
          'transition-colors duration-150',
        )}
      >
        <div className={cn(
          'w-px h-full',
          isDragging ? 'bg-primary/40' : 'bg-black/[.06] dark:bg-white/[.06] group-hover:bg-primary/30',
          'transition-colors duration-150',
        )} />
      </div>

      {/* Content area */}
      <div className={cn(
        'md:flex md:flex-1 md:h-full md:min-w-0 flex-col',
        'bg-white dark:bg-[#161618]',
        'h-full w-full',
        mobilePane === 'content' || view === 'graph' ? 'flex' : 'hidden md:flex',
      )}>
        {view === 'graph' ? (
          <div className="relative flex flex-col h-full">
            {/* Graph search bar — floating top-right over the graph */}
            <div className="absolute top-3 right-4 z-10">
              <div className="relative">
                <svg
                  width={13} height={13}
                  viewBox="0 0 24 24" fill="none"
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                  stroke="currentColor" strokeWidth={1.4} strokeLinecap="round"
                >
                  <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  ref={graphSearchRef}
                  type="text"
                  value={graphSearch}
                  onChange={e => setGraphSearch(e.target.value)}
                  placeholder="Search nodes..."
                  className="w-[240px] h-8 pl-8 pr-3 text-xs rounded-lg border border-black/[.08] dark:border-white/[.1] bg-white/90 dark:bg-[#1e1e21]/90 backdrop-blur-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-primary/30 shadow-sm transition-colors"
                />
                {graphSearch && (
                  <button
                    onClick={() => { setGraphSearch(''); graphSearchRef.current?.focus() }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                  >
                    <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 min-h-0">
              <DealsGraph
                companies={companies}
                deals={deals}
                searchQuery={graphSearch}
                onOpenDeal={(id) => {
                  const deal = deals.find(d => d.id === id)
                  if (deal) {
                    router.push(`/wiki/deal/${deal.id}`)
                    handleViewChange('list')
                  }
                }}
                onOpenBrand={(companyId) => {
                  const company = companyMap.get(companyId)
                  if (company) {
                    router.push(`/wiki/brand/${company.id}`)
                    handleViewChange('list')
                  }
                }}
              />
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            {children}
          </div>
        )}
      </div>
    </div>
  )
}

export default function WikiLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense>
      <WikiLayoutInner>{children}</WikiLayoutInner>
    </Suspense>
  )
}
