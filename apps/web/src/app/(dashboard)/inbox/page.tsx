'use client'

import { useRouter } from 'next/navigation'
import { Inbox } from '@/components/Inbox'

export default function InboxPage() {
  const router = useRouter()
  return <Inbox onOpenDeal={(id) => router.push(`/deals/${id}?from=inbox`)} />
}
