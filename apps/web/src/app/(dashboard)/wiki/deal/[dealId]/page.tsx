'use client'

import { useMemo, Suspense } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import { useGetCompanies, useGetDeals } from '@/lib/hooks/queries'
import { WikiContent } from '@/components/WikiContent'
import type { WikiSelection } from '@/components/WikiSidebar'
import type { ApiCompanyDetail, ApiDeal } from '@/lib/types'

function WikiDealPageInner() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()

  const dealId = params?.dealId as string | undefined
  const activeTab = searchParams?.get('tab') ?? undefined

  const { data: companies = [] } = useGetCompanies()
  const { data: deals = [] } = useGetDeals()

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

  const selection: WikiSelection = useMemo(() => {
    if (dealId) {
      const deal = dealMap.get(dealId)
      if (deal) {
        const company = deal.companyId ? companyMap.get(deal.companyId) ?? null : null
        return { kind: 'deal', deal, company }
      }
    }
    return { kind: 'none' }
  }, [dealId, dealMap, companyMap])

  function handleSelectDeal(deal: ApiDeal, company: ApiCompanyDetail | null) {
    router.push(`/wiki/deal/${deal.id}`)
  }

  return (
    <WikiContent
      selection={selection}
      companies={companies}
      deals={deals}
      onSelectDeal={handleSelectDeal}
      activeTab={activeTab}
    />
  )
}

export default function WikiDealPage() {
  return (
    <Suspense>
      <WikiDealPageInner />
    </Suspense>
  )
}
