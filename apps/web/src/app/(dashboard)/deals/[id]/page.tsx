'use client'

import { use } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { DealDetail } from '@/components/DealDetail'

export default function DealDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const searchParams = useSearchParams()
  const from = searchParams.get('from')
  const backLabels: Record<string, string> = {
    brands: 'Back to Brands',
    pipeline: 'Back to Pipeline',
    dashboard: 'Back to Dashboard',
    bills: 'Back to Bills',
    calendar: 'Back to Calendar',
    inbox: 'Back to Inbox',
  }
  const backLabel = backLabels[from ?? ''] ?? 'Go Back'

  return (
    <DealDetail
      dealId={id}
      backLabel={backLabel}
      onBack={() => router.back()}
      onOpenDeal={(dealId) => router.push(`/deals/${dealId}`)}
    />
  )
}
