'use client'

import { use, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { ProposalDetail } from '@/components/ProposalDetail'

function ProposalDetailInner({ id }: { id: string }) {
  const router = useRouter()
  return (
    <ProposalDetail
      proposalId={id}
      onBack={() => router.push('/proposals')}
      onOpenDeal={(dealId) => router.push(`/deals/${dealId}?from=proposals`)}
    />
  )
}

export default function ProposalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return (
    <Suspense>
      <ProposalDetailInner id={id} />
    </Suspense>
  )
}
