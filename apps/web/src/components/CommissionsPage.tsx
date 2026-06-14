'use client'

import Link from 'next/link'
import { HandCoins } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function CommissionsPage() {
  return (
    <div className="p-4 pb-6 md:px-6">
      <div className="rounded-md border border-border bg-card shadow-[var(--shadow-card)]">
        <div className="border-b border-border px-4 py-3">
          <h1 className="text-base font-semibold text-foreground">Commissions</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Track partner commission once payout rules are configured.
          </p>
        </div>
        <div className="flex min-h-[360px] flex-col items-center justify-center px-4 py-12 text-center">
          <div className="flex size-12 items-center justify-center rounded-md bg-primary/10 text-primary dark:bg-primary/15">
            <HandCoins size={24} strokeWidth={1.6} />
          </div>
          <p className="mt-4 text-sm font-semibold text-foreground">Commission tracking is coming soon</p>
          <p className="mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
            Your commission summary will appear here once payout rules are configured. For now, review your tagged deals in Deals.
          </p>
          <Button asChild className="mt-4">
            <Link href="/deals">View deals</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
