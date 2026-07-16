'use client'

import { useRouter } from 'next/navigation'
import { Deals } from '@/components/Deals'
import { PipelineDealsPage } from '@/components/PipelineDealsPage'
import { useUser } from '@/lib/hooks/use-user'

export default function DealsPage() {
  const router = useRouter()
  const { isLoading, isPartner } = useUser()

  if (isLoading) return null
  if (isPartner) return <Deals onOpenDeal={(id) => router.push(`/deals/${id}?from=deals`)} />

  return <PipelineDealsPage />
}
