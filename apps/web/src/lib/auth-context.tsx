'use client'

// AuthUserProvider is the single source of truth for the current user.
// Calling useSession() in every component triggers loading on remounts.
// This provider resolves the session once and exposes a synchronous useUser() shape.

import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { useSession } from 'next-auth/react'

type UserRole = 'SALES' | 'BUILD' | 'PARTNER'
type UserStatus = 'active' | 'pending' | 'rejected'

type UserShape = {
  userId: string | null
  user: any
  role: UserRole
  status: UserStatus
  isSales: boolean
  isBuild: boolean
  isLoading: boolean
  isAuthenticated: boolean
}

const AuthUserContext = createContext<UserShape | null>(null)

function resolveUserShape(session: any, status: 'loading' | 'authenticated' | 'unauthenticated'): UserShape {
  const role = (session?.user?.role as UserRole | undefined) ?? 'BUILD'
  const userStatus = (session?.user?.status as UserStatus | undefined) ?? 'active'
  return {
    userId: session?.user?.id ?? null,
    user: session?.user ?? null,
    role,
    status: userStatus,
    isSales: role === 'SALES',
    isBuild: role !== 'SALES',
    isLoading: status === 'loading',
    isAuthenticated: status === 'authenticated',
  }
}

export function AuthUserProvider({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession()
  const value = useMemo<UserShape>(() => resolveUserShape(session, status), [session, status])
  return <AuthUserContext.Provider value={value}>{children}</AuthUserContext.Provider>
}

export function useUser(): UserShape {
  const ctx = useContext(AuthUserContext)
  if (!ctx) {
    // Fallback for isolated trees that render outside AuthUserProvider.
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const { data: session, status } = useSession()
    return resolveUserShape(session, status)
  }
  return ctx
}

export function useApiHeaders() {
  const { userId } = useUser()
  return {
    'Content-Type': 'application/json',
    ...(userId ? { 'x-user-id': userId } : {}),
  }
}
