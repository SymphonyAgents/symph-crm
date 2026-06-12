'use client'

import { Menu, MessageSquare } from 'lucide-react'
import { NotificationBell } from './NotificationBell'
import { useUser } from '@/lib/hooks/use-user'

type TopbarProps = {
  onMenuToggle?: () => void
  // When provided on the chat page, shows a chat-sessions icon on mobile.
  onChatSessionsToggle?: () => void
}

export function Topbar({ onMenuToggle, onChatSessionsToggle }: TopbarProps) {
  const { isPartner, isLoading } = useUser()

  return (
    <div className="h-2 shrink-0 border-b border-border flex items-center px-3.5 gap-2 bg-bg-subtle">
      {/* Hamburger — mobile only */}
      <button
        onClick={onMenuToggle}
        className="md:hidden w-11 h-11 flex items-center justify-center rounded-control text-muted-foreground hover:bg-surface-hover hover:text-foreground transition-colors duration-150"
      >
        <Menu size={16} strokeWidth={1.4} />
      </button>

      <div className="flex-1" />

      {!isLoading && !isPartner && (
        <>
          <NotificationBell />
        </>
      )}

      {/* Chat sessions toggle — mobile only, shown on /chat page */}
      {onChatSessionsToggle && (
        <button
          onClick={onChatSessionsToggle}
          title="Chat sessions"
          className="md:hidden w-11 h-11 flex items-center justify-center rounded-control text-muted-foreground hover:bg-surface-hover hover:text-foreground transition-colors duration-150"
        >
          <MessageSquare size={16} strokeWidth={1.4} />
        </button>
      )}

      <div className="flex-1 md:block hidden" />
    </div>
  )
}
