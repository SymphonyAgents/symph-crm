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
    <div className="flex min-h-[60dvh] items-center justify-center bg-surface-alt px-6 text-center">
      <div className="max-w-sm rounded-md border border-border bg-card p-6 shadow-[var(--shadow-card)]">
        {error ? (
          <>
            <p className="text-sm font-semibold text-foreground">Signed PDF unavailable</p>
            <p className="mt-2 text-xs text-muted-foreground">{error}</p>
            <button
              type="button"
              onClick={() => router.push(`/proposals/${id}`)}
              className="mt-4 h-8 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
            >
              Back to proposal
            </button>
          </>
        ) : (
          <>
            <span className="mx-auto block h-5 w-5 animate-spin rounded-full border-2 border-border border-t-primary" />
            <p className="mt-3 text-xs font-semibold text-foreground">Opening signed PDF...</p>
          </>
        )}
      </div>
    </div>
  )
}
