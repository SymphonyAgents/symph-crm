'use client'

import { Suspense, useCallback, useMemo } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { Pipeline } from '@/components/Pipeline'
import {
  CatalogTabs,
  tabValueFromSlug,
  tabSlugFromValue,
  type CatalogTabValue,
  type CatalogTabCounts,
} from '@/components/CatalogTabs'
import { useGetDeals } from '@/lib/hooks/queries'
import { CLOSED_STAGE_IDS } from '@/lib/constants'
import { formatPeso } from '@/lib/utils'

function PipelineInner() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const tabValue: CatalogTabValue = tabValueFromSlug(searchParams.get('tab'))

  // Cached deal fetch — Pipeline.tsx hits the same queryKey, no duplicate request.
  const { data: allDeals = [], isLoading } = useGetDeals()

  // Per-tab counts (all deals, not just active — matches the tab label semantic "how many deals exist here").
  const counts: CatalogTabCounts = useMemo(() => {
    const c: CatalogTabCounts = { all: allDeals.length, internal: 0, service: 0, reseller: 0, partnership: 0 }
    for (const d of allDeals) {
      if (d.catalogItemType && d.catalogItemType in c) {
        c[d.catalogItemType as keyof CatalogTabCounts] = (c[d.catalogItemType as keyof CatalogTabCounts] ?? 0) + 1
      }
    }
    return c
  }, [allDeals])

  // Stats strip — filtered by active tab.
  const stats = useMemo(() => {
    const scoped = tabValue ? allDeals.filter(d => d.catalogItemType === tabValue) : allDeals
    const active = scoped.filter(d => !CLOSED_STAGE_IDS.has(d.stage ?? ''))
    const total = active.reduce((s, d) => s + (parseFloat(d.value || '0') || 0), 0)
    return { activeCount: active.length, total }
  }, [allDeals, tabValue])

  const onTabChange = useCallback(
    (next: CatalogTabValue) => {
      const params = new URLSearchParams(searchParams.toString())
      const slug = tabSlugFromValue(next)
      if (slug === 'all') params.delete('tab')
      else params.set('tab', slug)
      const qs = params.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [pathname, router, searchParams],
  )

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Stats + Tabs strip */}
      <div className="shrink-0 px-4 md:px-6 pt-3 pb-0">
        <div className="flex items-center justify-between gap-3 mb-2 min-h-[20px]">
          {isLoading ? (
            <div className="h-4 w-40 bg-slate-100 dark:bg-white/[.06] rounded animate-pulse" />
          ) : (
            <span className="text-ssm font-medium text-slate-900 dark:text-white tabular-nums">
              {stats.activeCount} active deal{stats.activeCount !== 1 ? 's' : ''}
              {stats.total > 0 && (
                <> &middot; <span>{formatPeso(stats.total)}</span></>
              )}
            </span>
          )}
        </div>
        <CatalogTabs value={tabValue} onChange={onTabChange} counts={counts} />
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        <Pipeline
          onOpenDeal={(id) => router.push(`/deals/${id}?from=pipeline`)}
          catalogProductType={tabValue ?? undefined}
        />
      </div>
    </div>
  )
}

export default function PipelinePage() {
  return (
    <Suspense>
      <PipelineInner />
    </Suspense>
  )
}
