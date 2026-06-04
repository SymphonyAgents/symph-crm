'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { CommandPalette } from './CommandPalette'
import { useChatSidebar } from '@/lib/chat-sidebar-context'

export function CrmShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const pathname = usePathname()
  const sidebarCollapsed = pathname === '/chat' || pathname.startsWith('/wiki')
  const isChat = pathname === '/chat'
  const { toggle: toggleChatSidebar } = useChatSidebar()

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        collapsed={sidebarCollapsed}
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
