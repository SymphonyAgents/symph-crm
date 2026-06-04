'use client'

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'

type SignedPdfResponse = {
  url: string
  fileName: string | null
  storagePath: string
  dealId: string | null
  proposalId: string
  slug: string | null
}

export default function SignedProposalPdfPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    api.get<SignedPdfResponse>(`/proposals/${id}/signed-pdf`)
      .then((res) => {
        if (cancelled) return
        window.location.replace(res.url)
      })
      .catch((err: Error) => {
        if (cancelled) return
        setError(err.message || 'Signed PDF not found')
      })
    return () => { cancelled = true }
  }, [id])

  return (
    <div className="flex min-h-[60dvh] items-center justify-center bg-slate-50 px-6 text-center dark:bg-background">
      <div className="max-w-sm rounded-md border border-black/[.06] bg-white p-6 shadow-[var(--shadow-card)] dark:border-white/[.08] dark:bg-card">
        {error ? (
          <>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">Signed PDF unavailable</p>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{error}</p>
            <button
              type="button"
              onClick={() => router.push(`/proposals/${id}`)}
              className="mt-4 h-8 rounded-lg bg-slate-900 px-3 text-xs font-semibold text-white transition-colors hover:bg-slate-700 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
            >
              Back to proposal
            </button>
          </>
        ) : (
          <>
            <span className="mx-auto block h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-slate-700 dark:border-white/20 dark:border-t-white" />
            <p className="mt-3 text-xs font-semibold text-slate-700 dark:text-slate-200">Opening signed PDF...</p>
          </>
        )}
      </div>
    </div>
  )
}
