'use client'

import { Suspense, useCallback } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { Pipeline } from '@/components/Pipeline'
import { CatalogTabs, tabValueFromSlug, tabSlugFromValue, type CatalogTabValue } from '@/components/CatalogTabs'

function PipelineInner() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const tabValue: CatalogTabValue = tabValueFromSlug(searchParams.get('tab'))

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
      <div className="px-4 md:px-6 pt-3 shrink-0">
        <CatalogTabs value={tabValue} onChange={onTabChange} />
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
