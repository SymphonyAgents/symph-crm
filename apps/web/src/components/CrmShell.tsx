'use client'

import { useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { CommandPalette } from './CommandPalette'
import { useChatSidebar } from '@/lib/chat-sidebar-context'

export function CrmShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [userCollapsedSidebar, setUserCollapsedSidebar] = useState(false)
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const isProposalPresentation = pathname.startsWith('/proposals/') && searchParams.get('present') === '1'
  const routeCollapsedSidebar = pathname === '/chat' || pathname.startsWith('/wiki')
  const sidebarCollapsed = routeCollapsedSidebar || userCollapsedSidebar
  const isChat = pathname === '/chat'
  const { toggle: toggleChatSidebar } = useChatSidebar()

  if (isProposalPresentation) {
    return <div className="h-dvh overflow-hidden bg-background">{children}</div>
  }

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        collapsed={sidebarCollapsed}
        onCollapsedChange={setUserCollapsedSidebar}
      />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <Topbar
          onMenuToggle={() => setSidebarOpen(o => !o)}
          onChatSessionsToggle={isChat ? toggleChatSidebar : undefined}
        />
        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          {children}
        </main>
      </div>
      <CommandPalette />
    </div>
  )
}
