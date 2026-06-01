import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'

// NEXT_PUBLIC_API_URL includes the /api prefix (e.g. https://...run.app/api)
// API_URL is the bare base URL without /api — don't use it for endpoint calls
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? process.env.API_URL ?? 'http://localhost:3001/api'

export const { handlers, signIn, signOut, auth, unstable_update: update } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  pages: {
    signIn: '/login',
  },
  callbacks: {
    authorized({ auth: session, request: { nextUrl } }) {
      const isLoggedIn = !!session?.user
      const isOnboarded = session?.user?.isOnboarded ?? false
      const status = session?.user?.status ?? 'active'
      const path = nextUrl.pathname

      // Unauthenticated users → login (except /login itself)
      if (!isLoggedIn) {
        if (path === '/login') return true
        return Response.redirect(new URL('/login', nextUrl))
      }

      if (status === 'pending') {
        if (path === '/onboarding') return true
        return Response.redirect(new URL('/onboarding', nextUrl))
      }

      if (status === 'rejected') {
        if (path === '/pending-approval') return true
        return Response.redirect(new URL('/pending-approval', nextUrl))
      }

      // Authenticated but not onboarded → onboarding page only
      if (!isOnboarded) {
        if (path === '/onboarding') return true
        return Response.redirect(new URL('/onboarding', nextUrl))
      }

      // Fully onboarded → redirect away from login/onboarding
      if (path === '/login' || path === '/onboarding' || path === '/pending-approval') {
        return Response.redirect(new URL('/', nextUrl))
      }

      return true
    },

    async jwt({ token, user, trigger, session: sessionUpdate, profile }) {
      // --- First sign-in: user object is present ---
      if (user) {
        token.id = user.id

        // Sync user to our DB and capture role + isOnboarded
        if (user.email) {
          try {
            const res = await fetch(`${API_URL}/users/sync`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                id: user.id,
                email: user.email,
                name: user.name ?? null,
                image: user.image ?? null,
              }),
            })
            if (res.ok) {
              const data = await res.json()
              // Use the DB's stable id — the OAuth user.id UUID can differ
              // across sessions when no DB adapter is used. Email upsert
              // preserves the original DB record id.
              token.id = data.id
              token.role = data.role
              token.status = data.status ?? 'active'
              token.isOnboarded = data.isOnboarded ?? false
              token.firstName = data.firstName ?? null
              token.lastName = data.lastName ?? null
              token.nickname = data.nickname ?? null
              token.currentTeam = data.currentTeam ?? null
            }
          } catch {
            // Non-blocking — login still succeeds even if sync fails
          }
        }
      }

      // --- Profile enrichment (name/picture from Google) ---
      if (profile) {
        token.name = profile.name
        token.email = profile.email
        token.picture = (profile as any).picture
      }

      // --- Session update: re-fetch user to pick up onboarding changes ---
      if (trigger === 'update' && sessionUpdate?.refreshUser && token.id) {
        try {
          const res = await fetch(`${API_URL}/users/${token.id}`)
          if (res.ok) {
            const data = await res.json()
            token.role = data.role
            token.status = data.status ?? 'active'
            token.isOnboarded = data.isOnboarded ?? false
            token.firstName = data.firstName ?? null
            token.lastName = data.lastName ?? null
            token.nickname = data.nickname ?? null
            token.currentTeam = data.currentTeam ?? null
          }
        } catch {
          // Non-blocking
        }
      }

      return token
    },

    session({ session, token }) {
      if (token?.id) {
        session.user.id = token.id as string
      }
      if (token?.role) {
        ;(session.user as any).role = token.role
      }
      ;(session.user as any).status = token.status ?? 'active'
      ;(session.user as any).isOnboarded = token.isOnboarded ?? false
      ;(session.user as any).firstName = token.firstName ?? null
      ;(session.user as any).lastName = token.lastName ?? null
      ;(session.user as any).nickname = token.nickname ?? null
      ;(session.user as any).currentTeam = token.currentTeam ?? null
      return session
    },
  },
  session: { strategy: 'jwt' },
})
