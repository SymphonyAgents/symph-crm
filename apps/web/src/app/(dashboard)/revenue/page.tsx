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
import { SubTabFilter } from '@/components/ui/sub-tab-filter'

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
          <div className="mt-2 max-w-full overflow-x-auto">
            <SubTabFilter
              items={[{ id: 'all', label: 'All' }, ...subTabs.map(s => ({ id: s.id, label: s.name, count: s.count }))]}
              value={activeItemId ?? 'all'}
              onChange={(next) => onSubTabChange(next === 'all' ? null : next)}
            />
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

export default function RevenuePage() {
  return (
    <Suspense>
      <RevenueInner />
    </Suspense>
  )
}
