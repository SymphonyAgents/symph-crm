'use client'

import { use, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useGetSignedProposalPdf } from '@/lib/hooks/queries'

export default function SignedProposalPdfPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { data, error } = useGetSignedProposalPdf(id)

  useEffect(() => {
    if (data?.url) window.location.replace(data.url)
  }, [data?.url])

  return (
    <div className="flex min-h-[60dvh] items-center justify-center bg-surface-alt px-6 text-center">
      <div className="max-w-sm rounded-md border border-border bg-card p-6 shadow-[var(--shadow-card)]">
        {error ? (
          <>
            <p className="text-sm font-semibold text-foreground">Signed PDF unavailable</p>
            <p className="mt-2 text-xs text-muted-foreground">{error.message || 'Signed PDF not found'}</p>
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
