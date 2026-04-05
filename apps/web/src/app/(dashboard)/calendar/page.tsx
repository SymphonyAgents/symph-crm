'use client'

import { useRouter } from 'next/navigation'
import { Calendar } from '@/components/Calendar'

export default function CalendarPage() {
  const router = useRouter()
  return <Calendar onOpenDeal={(id) => router.push(`/deals/${id}?from=calendar`)} />
}
