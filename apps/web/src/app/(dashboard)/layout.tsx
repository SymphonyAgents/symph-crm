import { auth } from '@/auth'
import { CrmShell } from '@/components/CrmShell'
import { SessionProvider } from 'next-auth/react'
import { ChatTypingProvider } from '@/lib/chat-typing-context'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()

  return (
    <SessionProvider session={session}>
      <ChatTypingProvider>
        <CrmShell>{children}</CrmShell>
      </ChatTypingProvider>
    </SessionProvider>
  )
}
