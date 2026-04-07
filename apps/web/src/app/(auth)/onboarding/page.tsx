'use client'

import { useState, useTransition } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api'

const TEAM_OPTIONS = [
  { value: 'Agents',    label: 'Agents' },
  { value: 'Build',     label: 'Build' },
  { value: 'Growth',    label: 'Growth' },
  { value: 'Taste',     label: 'Taste' },
  { value: 'Judgement', label: 'Judgement' },
]

export default function OnboardingPage() {
  const { data: session, update } = useSession()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [currentTeam, setCurrentTeam] = useState('')
  const [error, setError] = useState<string | null>(null)

  const userId = session?.user?.id
  const displayName = session?.user?.name ?? session?.user?.email ?? ''

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!userId || !currentTeam) return
    setError(null)

    startTransition(async () => {
      try {
        const res = await fetch(`${API_URL}/users/onboarding`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: userId, currentTeam }),
        })

        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          setError(body?.message ?? 'Something went wrong. Please try again.')
          return
        }

        await update({ refreshUser: true })
        // Hard navigation — ensures the browser picks up the refreshed JWT cookie.
        // router.replace() uses the cached session; the middleware may redirect
        // back to /onboarding before isOnboarded=true propagates to the cookie.
        window.location.href = '/'
      } catch {
        setError('Network error. Please check your connection and try again.')
      }
    })
  }

  return (
    <div className="min-h-dvh flex items-center justify-center bg-slate-50 dark:bg-slate-950 px-4">
      <div className="w-full max-w-[400px]">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center text-base font-extrabold text-white tracking-tight"
            style={{ background: 'linear-gradient(135deg, var(--primary), var(--color-primary-accent))' }}
          >
            S
          </div>
          <div>
            <div className="text-base font-bold text-slate-900 dark:text-white tracking-tight">Symph CRM</div>
            <div className="text-xxs text-slate-400">Sales Pipeline</div>
          </div>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-black/[.06] dark:border-white/[.08] shadow-sm p-7">
          {/* Header */}
          <div className="mb-6">
            <p className="text-ssm text-slate-400 dark:text-slate-500 mb-0.5">Welcome,</p>
            <h1 className="text-lg font-semibold text-slate-900 dark:text-white">
              {displayName}
            </h1>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Current team */}
            <div>
              <label
                htmlFor="currentTeam"
                className="block text-xxs font-medium text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wide"
              >
                Current
              </label>
              <select
                id="currentTeam"
                required
                value={currentTeam}
                onChange={(e) => setCurrentTeam(e.target.value)}
                className="w-full px-3 py-2 text-sm text-slate-900 dark:text-white bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400 transition-colors appearance-none cursor-pointer"
              >
                <option value="" disabled>Select your team…</option>
                {TEAM_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            {/* Error */}
            {error && (
              <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/40 px-3.5 py-2.5 text-ssm text-red-600 dark:text-red-400">
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={isPending || !currentTeam}
              className="w-full py-2.5 rounded-lg text-ssm font-semibold text-white transition-opacity disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
              style={{ background: 'linear-gradient(135deg, var(--primary), var(--color-primary-accent))' }}
            >
              {isPending ? 'Setting up…' : 'Get started →'}
            </button>
          </form>
        </div>

        <p className="text-xxs text-slate-400 text-center mt-4">
          Symph internal use only
        </p>
      </div>
    </div>
  )
}
