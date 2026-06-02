'use client'

import { Suspense } from 'react'
import { AuthUserProvider } from '@/lib/auth-context'
import { CrmShell } from '@/components/CrmShell'
import { ChangelogDialog } from '@/components/ChangelogDialog'
import { ChatTypingProvider } from '@/lib/chat-typing-context'
import { ChatSidebarProvider } from '@/lib/chat-sidebar-context'

// Dashboard layout — purely client-side.
//
// AuthUserProvider resolves the backend-owned auth session once and exposes
// the current CRM user through Context so downstream useUser() calls stay sync.
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
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
  )
}
