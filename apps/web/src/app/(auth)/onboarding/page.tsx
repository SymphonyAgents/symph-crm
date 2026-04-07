'use client'

import { useState, useTransition } from 'react'
import { useSession } from 'next-auth/react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { completeOnboardingAction } from './actions'

const TEAM_OPTIONS = [
  { value: 'Agents',    label: 'Agents' },
  { value: 'Build',     label: 'Build' },
  { value: 'Growth',    label: 'Growth' },
  { value: 'Taste',     label: 'Taste' },
  { value: 'Judgement', label: 'Judgement' },
]

export default function OnboardingPage() {
  const { data: session } = useSession()
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
      const result = await completeOnboardingAction(userId, currentTeam)
      if (result?.error) {
        setError(result.error)
      }
    })
  }

  return (
    <div className="min-h-dvh flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-[360px]">
        {/* Logo */}
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

        {/* Card */}
        <div className="bg-card rounded-xl border border-border shadow-sm p-6">
          <div className="mb-6">
            <p className="text-ssm text-muted-foreground mb-0.5">Welcome,</p>
            <h1 className="text-lg font-semibold text-foreground">
              {displayName}
            </h1>
          </div>

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
        </div>

        <p className="text-xxs text-muted-foreground text-center mt-4">
          Symph internal use only
        </p>
      </div>
    </div>
  )
}
