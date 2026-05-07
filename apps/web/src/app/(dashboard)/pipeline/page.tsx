'use client'

import { Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { Pipeline } from '@/components/Pipeline'

function PipelineInner() {
  const router = useRouter()
  return <Pipeline onOpenDeal={(id) => router.push(`/deals/${id}?from=pipeline`)} />
}

export default function PipelinePage() {
  return (
    <Suspense>
      <PipelineInner />
    </Suspense>
  )
}
