'use client'

import { use } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { DealDetail } from '@/components/DealDetail'

export default function DealDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const searchParams = useSearchParams()
  const from = searchParams.get('from')
  const backLabel = from === 'brands' ? 'Back to Brands' : 'Back to Pipeline'

  return (
    <DealDetail
      dealId={id}
      backLabel={backLabel}
      onBack={() => router.back()}
      onOpenDeal={(dealId) => router.push(`/deals/${dealId}`)}
    />
  )
}
