'use client'

import { useRouter } from 'next/navigation'
import { Pipeline } from '@/components/Pipeline'

export default function PipelinePage() {
  const router = useRouter()
  return <Pipeline onOpenDeal={(id) => router.push(`/deals/${id}?from=pipeline`)} />
}
