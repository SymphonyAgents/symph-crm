import Link from 'next/link'

export default function PendingApprovalPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-900 dark:bg-[#121214] dark:text-white">
      <div className="mx-auto mt-20 max-w-md rounded-md border border-black/[.06] bg-white p-6 text-center shadow-[var(--shadow-card)] dark:border-white/[.08] dark:bg-[#1e1e21]">
        <p className="text-base font-semibold">Account pending approval</p>
        <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
          A Sales user needs to approve your account before you can access the partner portal.
        </p>
        <Link
          href="/login"
          className="mt-5 inline-flex h-8 items-center justify-center rounded-lg border border-black/[.08] px-3 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 dark:border-white/[.1] dark:text-slate-300 dark:hover:bg-white/[.04]"
        >
          Back to login
        </Link>
      </div>
    </main>
  )
}
