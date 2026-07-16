'use client'

import { useRouter } from 'next/navigation'
import { Deals } from '@/components/Deals'

export default function BrandsPage() {
  const router = useRouter()
  return <Deals onOpenDeal={(id) => router.push(`/deals/${id}?from=brands`)} />
}
