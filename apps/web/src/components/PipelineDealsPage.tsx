'use client'

import { useCallback, useMemo } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Pipeline } from '@/components/Pipeline'
import {
  CatalogTabs,
  tabValueFromSlug,
  tabSlugFromValue,
  type CatalogTabValue,
  type CatalogTabCounts,
} from '@/components/CatalogTabs'
import { useGetCatalogItems, useGetDeals } from '@/lib/hooks/queries'
import { CLOSED_STAGE_IDS } from '@/lib/constants'
import { formatCurrencyBreakdown, sumMoneyByCurrency } from '@/lib/currency'

type PipelineDealsPageProps = {
  title?: string
  from?: string
}

export function PipelineDealsPage({ title = 'Deals', from = 'deals' }: PipelineDealsPageProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const tabValue: CatalogTabValue = tabValueFromSlug(searchParams.get('tab'))
  const itemId = searchParams.get('item')
  const { data: rawDeals = [], isLoading } = useGetDeals()
  const allDeals = useMemo(() => rawDeals.filter(deal => deal.catalogItemType !== 'partnership'), [rawDeals])
  const showSubTabs = tabValue === 'internal' || tabValue === 'service' || tabValue === 'reseller'
  const { data: catalogRows = [] } = useGetCatalogItems(
    showSubTabs ? { activeOnly: true, type: tabValue } : false,
  )

  const counts: CatalogTabCounts = useMemo(() => {
    const c: CatalogTabCounts = { all: allDeals.length, internal: 0, service: 0, reseller: 0 }
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
    if (!showSubTabs) return null
    if (!itemId) return null
    return subTabs.some(t => t.id === itemId) ? itemId : null
  }, [showSubTabs, itemId, subTabs])

  const stats = useMemo(() => {
    let scoped = allDeals
    if (tabValue) scoped = scoped.filter(d => d.catalogItemType === tabValue)
    if (activeItemId) scoped = scoped.filter(d => d.catalogItemId === activeItemId)
    const active = scoped.filter(d => !CLOSED_STAGE_IDS.has(d.stage ?? ''))
    const totals = sumMoneyByCurrency(active)
    return { activeCount: active.length, totalLabel: formatCurrencyBreakdown(totals) }
  }, [allDeals, tabValue, activeItemId])

  const onTabChange = useCallback((next: CatalogTabValue) => {
    const params = new URLSearchParams(searchParams.toString())
    const slug = tabSlugFromValue(next)
    if (slug === 'all') params.delete('tab')
    else params.set('tab', slug)
    params.delete('item')
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }, [pathname, router, searchParams])

  const onSubTabChange = useCallback((nextItemId: string | null) => {
    const params = new URLSearchParams(searchParams.toString())
    if (nextItemId) params.set('item', nextItemId)
    else params.delete('item')
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }, [pathname, router, searchParams])

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="shrink-0 px-4 pb-0 pt-3 md:px-6">
        <div className="mb-3 flex flex-col gap-1">
          <div className="text-ssm font-semibold text-foreground">{title}</div>
          <div className="text-xxs text-slate-400 tabular-nums">
            {isLoading ? 'Loading deals...' : `${stats.activeCount} active deal${stats.activeCount !== 1 ? 's' : ''}${stats.totalLabel !== 'No value' ? ` · ${stats.totalLabel} active pipeline` : ' · No active pipeline value'}`}
          </div>
        </div>
        <div className="md:hidden">
          <CatalogTabs value={tabValue} onChange={onTabChange} counts={counts} />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        <Pipeline
          onOpenDeal={(id) => router.push(`/deals/${id}?from=${from}`)}
          catalogProductType={tabValue ?? undefined}
          catalogItemId={activeItemId ?? undefined}
          parentTabs={<CatalogTabs value={tabValue} onChange={onTabChange} counts={counts} />}
          subTabs={subTabs}
          activeSubTabId={activeItemId}
          onSubTabChange={onSubTabChange}
        />
      </div>
    </div>
  )
}
