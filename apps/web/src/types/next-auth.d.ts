import { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      role: 'SALES' | 'BUILD'
      isOnboarded: boolean
      firstName?: string | null
      lastName?: string | null
      nickname?: string | null
    } & DefaultSession['user']
    /**
     * Internal trigger flag passed to update() to force a server-side
     * re-fetch of the user record in the JWT callback.  Not a real session
     * field — only used as a payload to unstable_update().
     */
    refreshUser?: boolean
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string
    role?: 'SALES' | 'BUILD'
    isOnboarded?: boolean
    firstName?: string | null
    lastName?: string | null
    nickname?: string | null
  }
}
