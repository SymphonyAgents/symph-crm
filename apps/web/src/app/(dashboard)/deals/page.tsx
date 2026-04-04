'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Deals } from '@/components/Deals'

export default function DealsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialView = (searchParams.get('view') === 'graph' ? 'graph' : 'table') as 'table' | 'graph'

  return (
    <Deals
      initialView={initialView}
      onOpenDeal={(id) => router.push(`/deals/${id}?from=brands`)}
    />
  )
}
