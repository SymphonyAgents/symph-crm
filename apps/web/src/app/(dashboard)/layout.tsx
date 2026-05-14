'use client'

import { Suspense } from 'react'
import { SessionProvider } from 'next-auth/react'
import { AuthUserProvider } from '@/lib/auth-context'
import { CrmShell } from '@/components/CrmShell'
import { ChangelogDialog } from '@/components/ChangelogDialog'
import { ChatTypingProvider } from '@/lib/chat-typing-context'
import { ChatSidebarProvider } from '@/lib/chat-sidebar-context'

/**
 * Dashboard layout — purely client-side.
 *
 * The middleware (`src/middleware.ts`) already gates unauth/onboarding
 * redirects at the edge via the `authorized` callback in `auth.ts`, so there's
 * no need to `await auth()` here. Removing that server-side auth fetch
 * eliminates the RSC roundtrip on every back-navigation that was causing
 * stuck loaders.
 *
 * `SessionProvider` without an initial session fetches `/api/auth/session`
 * once on mount; `AuthUserProvider` exposes the resolved user via Context
 * so every downstream `useUser()` is a sync read.
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <AuthUserProvider>
        <ChatTypingProvider>
          <ChatSidebarProvider>
            <CrmShell>{children}</CrmShell>
            <Suspense>
              <ChangelogDialog />
            </Suspense>
          </ChatSidebarProvider>
        </ChatTypingProvider>
      </AuthUserProvider>
    </SessionProvider>
  )
}
