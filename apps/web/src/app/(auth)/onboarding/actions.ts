'use server'

import { redirect } from 'next/navigation'
import { auth, update } from '@/auth'

function resolveApiUrl() {
  const raw = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api'
  const normalized = raw.replace(/\/+$/, '')
  return normalized.endsWith('/api') ? normalized : `${normalized}/api`
}

const API_URL = resolveApiUrl()

export async function completeOnboardingAction(
  currentTeam: string,
): Promise<{ error: string } | never> {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) return { error: 'Your session expired. Please sign in again.' }

  // 1. Persist the team selection in the DB via the NestJS API
  let res: Response
  try {
    res = await fetch(`${API_URL}/users/onboarding`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': userId,
        ...(process.env.INTERNAL_SECRET ? { 'x-internal-secret': process.env.INTERNAL_SECRET } : {}),
      },
      body: JSON.stringify({ id: userId, currentTeam }),
    })
  } catch {
    return { error: 'Network error. Please check your connection and try again.' }
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    return { error: body?.message ?? 'Something went wrong. Please try again.' }
  }

  // 2. Refresh the JWT cookie server-side.
  //
  //    Running update() inside a Server Action lets Auth.js write the new
  //    JWT cookie directly via next/headers cookies() — the token.isOnboarded
  //    flag is guaranteed to be flushed to the browser before the redirect
  //    fires.  Calling update() client-side (the previous approach) created a
  //    race: if the JWT-callback re-fetch from the API was still in-flight or
  //    failed silently, the cookie would still carry isOnboarded=false and the
  //    middleware would bounce the user back to /onboarding.
  await update({ refreshUser: true })

  // 3. Hard redirect — the fresh cookie is already in the response headers
  //    so the middleware will see isOnboarded=true on the very first request.
  redirect('/')
}
