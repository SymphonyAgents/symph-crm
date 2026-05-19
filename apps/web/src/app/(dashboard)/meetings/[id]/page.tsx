'use client'

import { Suspense, use } from 'react'
import { useRouter } from 'next/navigation'
import { MeetingDetail } from '@/components/MeetingDetail'

function MeetingDetailInner({ id }: { id: string }) {
  const router = useRouter()
  return <MeetingDetail meetingId={id} onBack={() => router.push('/meetings?=all')} />
}

export default function MeetingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return (
    <Suspense>
      <MeetingDetailInner id={id} />
    </Suspense>
  )
}
