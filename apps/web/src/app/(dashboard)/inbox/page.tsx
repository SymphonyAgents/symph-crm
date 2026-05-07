'use client'

import { Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { Inbox } from '@/components/Inbox'

function InboxInner() {
  const router = useRouter()
  return <Inbox onOpenDeal={(id) => router.push(`/deals/${id}?from=inbox`)} />
}

export default function InboxPage() {
  return (
    <Suspense>
      <InboxInner />
    </Suspense>
  )
}
