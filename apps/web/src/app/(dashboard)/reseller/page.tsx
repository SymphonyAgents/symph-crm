'use client'

import { Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { ResellerPipeline } from '@/components/ResellerPipeline'

function ResellerInner() {
  const router = useRouter()
  return <ResellerPipeline onOpenDeal={(id) => router.push(`/deals/${id}?from=reseller`)} />
}

export default function ResellerPage() {
  return (
    <Suspense>
      <ResellerInner />
    </Suspense>
  )
}
