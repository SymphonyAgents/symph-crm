'use client'

import { useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useGetCompanies, useGetDeals } from '@/lib/hooks/queries'
import { WikiContent } from '@/components/WikiContent'
import type { WikiSelection } from '@/components/WikiSidebar'
import type { ApiCompanyDetail, ApiDeal } from '@/lib/types'

export default function WikiBrandPage() {
  const router = useRouter()
  const params = useParams()
  const companyId = params?.companyId as string | undefined

  const { data: companies = [] } = useGetCompanies()
  const { data: deals = [] } = useGetDeals()

  const companyMap = useMemo(() => {
    const m = new Map<string, ApiCompanyDetail>()
    for (const c of companies) m.set(c.id, c)
    return m
  }, [companies])

  const selection: WikiSelection = useMemo(() => {
    if (companyId) {
      const company = companyMap.get(companyId)
      if (company) return { kind: 'brand', company }
    }
    return { kind: 'none' }
  }, [companyId, companyMap])

  function handleSelectDeal(deal: ApiDeal) {
    router.push(`/wiki/deal/${deal.id}`)
  }

  return (
    <WikiContent
      selection={selection}
      companies={companies}
      deals={deals}
      onSelectDeal={handleSelectDeal}
    />
  )
}
