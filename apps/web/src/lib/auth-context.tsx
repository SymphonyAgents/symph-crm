'use client'

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { CrmUserRole, CrmUserStatus } from '@symph-crm/shared'
import { BACKEND_API_URL } from '@/lib/backend-url'

type UserRole = CrmUserRole
type UserStatus = CrmUserStatus

type BackendUser = {
  id: string
  name?: string | null
  email?: string | null
  image?: string | null
  role?: UserRole
  status?: UserStatus
  isOnboarded?: boolean
  currentTeam?: string | null
}

type UserShape = {
  userId: string | null
  user: BackendUser | null
  role: UserRole
  status: UserStatus
  isSales: boolean
  isBuild: boolean
  isPartner: boolean
  isLoading: boolean
  isAuthenticated: boolean
  refreshUser: () => Promise<void>
}

const AuthUserContext = createContext<UserShape | null>(null)

async function fetchSession(): Promise<BackendUser | null> {
  const res = await fetch(`${BACKEND_API_URL}/auth/session`, {
    credentials: 'include',
    cache: 'no-store',
  })
  if (!res.ok) return null
  const data = await res.json() as { user?: BackendUser | null }
  return data.user ?? null
}

function resolveUserShape(user: BackendUser | null, isLoading: boolean, refreshUser: () => Promise<void>): UserShape {
  const role = user?.role ?? CrmUserRole.Build
  const userStatus = user?.status ?? CrmUserStatus.Active
  return {
    userId: user?.id ?? null,
    user,
    role,
    status: userStatus,
    isSales: role === CrmUserRole.Sales,
    isBuild: role === CrmUserRole.Build,
    isPartner: role === CrmUserRole.Partner,
    isLoading,
    isAuthenticated: !!user,
    refreshUser,
  }
}

function isAuthRoute(pathname: string | null): boolean {
  return pathname === '/login' || pathname === '/onboarding' || pathname === '/pending-approval'
}

export function AuthUserProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<BackendUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  async function refreshUser() {
    const nextUser = await fetchSession()
    setUser(nextUser)
  }

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    fetchSession()
      .then(nextUser => {
        if (!cancelled) setUser(nextUser)
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (isLoading) return
    if (!user && !isAuthRoute(pathname)) {
      router.replace('/login')
      return
    }
    if (!user) return
    if (user.status === CrmUserStatus.Rejected && pathname !== '/pending-approval') {
      router.replace('/pending-approval')
      return
    }
    if (user.status === CrmUserStatus.Pending && pathname !== '/onboarding') {
      router.replace('/onboarding')
      return
    }
    if (!user.isOnboarded && pathname !== '/onboarding') {
      router.replace('/onboarding')
      return
    }
    if (user.isOnboarded && isAuthRoute(pathname)) {
      router.replace(user.role === CrmUserRole.Partner ? '/deals' : '/')
    }
  }, [isLoading, pathname, router, user])

  const value = useMemo<UserShape>(() => resolveUserShape(user, isLoading, refreshUser), [user, isLoading])
  return <AuthUserContext.Provider value={value}>{children}</AuthUserContext.Provider>
}

export function useUser(): UserShape {
  const ctx = useContext(AuthUserContext)
  if (!ctx) return resolveUserShape(null, true, async () => {})
  return ctx
}

export function useApiHeaders() {
  return { 'Content-Type': 'application/json' }
}
