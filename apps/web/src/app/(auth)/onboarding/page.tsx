'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { CrmUserRole, CrmUserStatus } from '@symph-crm/shared'
import { api } from '@/lib/api'
import { useUser } from '@/lib/hooks/use-user'

const TEAM_OPTIONS = [
  { value: 'Agents',    label: 'Agents' },
  { value: 'Build',     label: 'Build' },
  { value: 'Growth',    label: 'Growth' },
  { value: 'Taste',     label: 'Taste' },
  { value: 'Judgement', label: 'Judgement' },
]

export default function OnboardingPage() {
  const router = useRouter()
  const { user, userId, refreshUser } = useUser()
  const [isPending, startTransition] = useTransition()
  const [currentTeam, setCurrentTeam] = useState(user?.currentTeam ?? '')
  const [error, setError] = useState<string | null>(null)

  const displayName = user?.name ?? user?.email ?? ''
  const isPartnerPending = user?.role === CrmUserRole.Partner && user?.status === CrmUserStatus.Pending

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!userId || !currentTeam) return
    setError(null)

    startTransition(async () => {
      try {
        await api.patch('/users/onboarding', { id: userId, currentTeam })
        await refreshUser()
        router.replace('/')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      }
    })
  }

  return (
    <div className="min-h-dvh flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-[360px]">
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center text-base font-extrabold text-white tracking-tight"
            style={{ background: 'linear-gradient(135deg, var(--primary), var(--color-primary-accent))' }}
          >
            S
          </div>
          <div>
            <div className="text-base font-bold text-foreground tracking-tight">Symph CRM</div>
            <div className="text-xxs text-muted-foreground">Sales Pipeline</div>
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border shadow-sm p-6">
          <div className="mb-6">
            <p className="text-ssm text-muted-foreground mb-0.5">Welcome,</p>
            <h1 className="text-lg font-semibold text-foreground">
              {displayName}
            </h1>
          </div>

          {isPartnerPending ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-3 text-center dark:border-amber-500/20 dark:bg-amber-500/10">
              <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">Waiting for account approval</p>
              <p className="mt-1 text-xs leading-relaxed text-amber-700 dark:text-amber-300">
                Waiting for account approval, Please check back later
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <label className="block text-xxs font-medium text-muted-foreground uppercase tracking-wide">
                  Current Team
                </label>
                <Select value={currentTeam} onValueChange={setCurrentTeam}>
                  <SelectTrigger className="w-full h-9 text-sm">
                    <SelectValue placeholder="Select your team…" />
                  </SelectTrigger>
                  <SelectContent>
                    {TEAM_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {error && (
                <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3.5 py-2.5 text-ssm text-destructive">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                disabled={isPending || !currentTeam}
                className="w-full h-9 text-ssm"
              >
                {isPending ? 'Setting up…' : 'Get started →'}
              </Button>
            </form>
          )}
        </div>

        {user?.role !== CrmUserRole.Partner && (
          <p className="text-xxs text-muted-foreground text-center mt-4">
            Symph internal use only
          </p>
        )}
      </div>
    </div>
  )
}
