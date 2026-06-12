import Link from 'next/link'

export default function PendingApprovalPage() {
  return (
    <main className="min-h-screen bg-surface-alt px-4 py-10 text-foreground">
      <div className="mx-auto mt-20 max-w-md rounded-md border border-border bg-card p-6 text-center shadow-[var(--shadow-card)]">
        <p className="text-base font-semibold">Account pending approval</p>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          A Sales user needs to approve your account before you can access the partner portal.
        </p>
        <Link
          href="/login"
          className="mt-5 inline-flex h-8 items-center justify-center rounded-lg border border-border px-3 text-xs font-semibold text-slate-600 transition-colors hover:bg-surface-alt"
        >
          Back to login
        </Link>
      </div>
    </main>
  )
}
