'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { CommandPalette } from './CommandPalette'

export function CrmShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const pathname = usePathname()
  const sidebarCollapsed = pathname === '/chat'

  return (
    <div className="flex h-dvh overflow-hidden bg-[#f3f4f6] dark:bg-[#191a1c]">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        collapsed={sidebarCollapsed}
      />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <Topbar onMenuToggle={() => setSidebarOpen(o => !o)} />
        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          {children}
        </main>
      </div>
      <CommandPalette />
    </div>
  )
}
