import { notFound } from 'next/navigation'

export default function CalendarPage() {
  notFound()
}

// Temporarily disabled. Keep this page scaffold for future reactivation.
//
// 'use client'
//
// import { Suspense } from 'react'
// import { useRouter } from 'next/navigation'
// import { Calendar } from '@/components/Calendar'
//
// function CalendarInner() {
//   const router = useRouter()
//   return <Calendar onOpenDeal={(id) => router.push(`/deals/${id}?from=calendar`)} />
// }
//
// export default function CalendarPage() {
//   return (
//     <Suspense>
//       <CalendarInner />
//     </Suspense>
//   )
// }
