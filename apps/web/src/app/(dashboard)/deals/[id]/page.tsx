'use client'

import { use } from 'react'
import { useRouter } from 'next/navigation'
import { DealDetail } from '@/components/DealDetail'

export default function DealDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()

  return (
    <DealDetail
      dealId={id}
      onBack={() => router.back()}
      onOpenDeal={(dealId) => router.push(`/deals/${dealId}`)}
    />
  )
}
