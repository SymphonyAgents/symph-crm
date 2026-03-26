import { useSession } from 'next-auth/react'

/**
 * useUser — returns the current authenticated user from NextAuth session.
 *
 * Usage:
 *   const { userId, user, isLoading } = useUser()
 *   // Pass userId as 'x-user-id' header to API calls
 *
 * userId is the Google OAuth sub claim (stable, unique per Google account).
 * It maps to public.users.id which is synced on every login via POST /api/users/sync.
 */
export function useUser() {
  const { data: session, status } = useSession()

  return {
    userId: session?.user?.id ?? null,
    user: session?.user ?? null,
    isLoading: status === 'loading',
    isAuthenticated: status === 'authenticated',
  }
}

/**
 * apiHeaders — returns headers with the current user ID for API calls.
 * Pass the spread into fetch() options.
 *
 * Usage:
 *   const { apiHeaders } = useUser()
 *   fetch(`${API}/deals`, { headers: apiHeaders })
 */
export function useApiHeaders() {
  const { userId } = useUser()
  return {
    'Content-Type': 'application/json',
    ...(userId ? { 'x-user-id': userId } : {}),
  }
}
