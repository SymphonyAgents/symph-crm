'use client'

import { Suspense, useCallback, useMemo } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { RevenueGeneration } from '@/components/RevenueGeneration'
import {
  CatalogTabs,
  tabValueFromSlug,
  tabSlugFromValue,
  type CatalogTabValue,
  type CatalogTabCounts,
} from '@/components/CatalogTabs'
import { useGetDeals, useGetCatalogItems } from '@/lib/hooks/queries'
import { cn } from '@/lib/utils'

function RevenueInner() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const tabValue: CatalogTabValue = tabValueFromSlug(searchParams.get('tab'))
  const itemId = searchParams.get('item')

  // Cached deal fetch — RevenueGeneration hits the same queryKey, no duplicate request.
  const { data: allDeals = [] } = useGetDeals()
  const showSubTabs = tabValue === 'internal' || tabValue === 'service' || tabValue === 'reseller'
  const { data: catalogRows = [] } = useGetCatalogItems(
    showSubTabs ? { activeOnly: true, type: tabValue } : false,
  )

  const counts: CatalogTabCounts = useMemo(() => {
    const c: CatalogTabCounts = { all: allDeals.length, internal: 0, service: 0, reseller: 0, partnership: 0 }
    for (const d of allDeals) {
      if (d.catalogItemType && d.catalogItemType in c) {
        c[d.catalogItemType as keyof CatalogTabCounts] = (c[d.catalogItemType as keyof CatalogTabCounts] ?? 0) + 1
      }
    }
    return c
  }, [allDeals])

  const subTabs = useMemo(() => {
    if (!showSubTabs) return []
    const dealsForType = allDeals.filter(d => d.catalogItemType === tabValue)
    return catalogRows.map(c => ({
      id: c.id,
      name: c.name,
      count: dealsForType.filter(d => d.catalogItemId === c.id).length,
    }))
  }, [showSubTabs, catalogRows, allDeals, tabValue])

  const activeItemId = useMemo(() => {
    if (!showSubTabs || !itemId) return null
    return subTabs.some(t => t.id === itemId) ? itemId : null
  }, [showSubTabs, itemId, subTabs])

  const onTabChange = useCallback(
    (next: CatalogTabValue) => {
      const params = new URLSearchParams(searchParams.toString())
      const slug = tabSlugFromValue(next)
      if (slug === 'all') params.delete('tab')
      else params.set('tab', slug)
      params.delete('item')
      const qs = params.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [pathname, router, searchParams],
  )

  const onSubTabChange = useCallback(
    (nextItemId: string | null) => {
      const params = new URLSearchParams(searchParams.toString())
      if (nextItemId) params.set('item', nextItemId)
      else params.delete('item')
      const qs = params.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [pathname, router, searchParams],
  )

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Tabs strip */}
      <div className="shrink-0 px-4 md:px-6 pt-3 pb-0">
        <CatalogTabs value={tabValue} onChange={onTabChange} counts={counts} />

        {showSubTabs && subTabs.length > 0 && (
          <div className="flex items-center flex-wrap gap-1.5 mt-2">
            <SubTabButton active={!activeItemId} onClick={() => onSubTabChange(null)}>
              All
            </SubTabButton>
            {subTabs.map(s => (
              <SubTabButton
                key={s.id}
                active={activeItemId === s.id}
                onClick={() => onSubTabChange(s.id)}
                count={s.count}
              >
                {s.name}
              </SubTabButton>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        <RevenueGeneration
          catalogProductType={tabValue ?? undefined}
          catalogItemId={activeItemId ?? undefined}
        />
      </div>
    </div>
  )
}

function SubTabButton({
  active,
  onClick,
  count,
  children,
}: {
  active: boolean
  onClick: () => void
  count?: number
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'rounded-md px-2.5 py-1 text-xxs font-medium transition-colors inline-flex items-center gap-1.5 active:scale-[0.98]',
        active
          ? 'bg-primary/10 text-primary'
          : 'bg-white dark:bg-[#1e1e21] border border-black/[.08] dark:border-white/[.08] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[.04]',
      )}
    >
      {children}
      {count !== undefined && (
        <span className={cn('tabular-nums', active ? 'text-primary/70' : 'text-slate-400')}>
          {count}
        </span>
      )}
    </button>
  )
}

export default function RevenuePage() {
  return (
    <Suspense>
      <RevenueInner />
    </Suspense>
  )
}
