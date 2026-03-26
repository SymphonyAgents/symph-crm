import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'

const API_URL = process.env.API_URL ?? 'http://localhost:3001/api'

export const { handlers, signIn, signOut, auth } = NextAuth({
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
      const isOnLogin = nextUrl.pathname === '/login'

      if (isOnLogin) {
        if (isLoggedIn) return Response.redirect(new URL('/', nextUrl))
        return true
      }

      return isLoggedIn
    },
    jwt({ token, user, account, profile }) {
      if (user) {
        token.id = user.id
      }
      if (profile) {
        // Store profile details for user sync
        token.name = profile.name
        token.email = profile.email
        token.picture = (profile as any).picture
      }
      return token
    },
    session({ session, token }) {
      if (token?.id) {
        session.user.id = token.id as string
      }
      return session
    },
    async signIn({ user, account, profile }) {
      // Upsert user into our public.users table on every login.
      // JWT strategy means no DB adapter — we sync manually here.
      if (!user?.id || !user?.email) return true

      try {
        await fetch(`${API_URL}/users/sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: user.id,
            email: user.email,
            name: user.name ?? null,
            image: user.image ?? null,
          }),
        })
      } catch {
        // Non-blocking — login still succeeds even if sync fails
      }

      return true
    },
  },
  session: { strategy: 'jwt' },
})
