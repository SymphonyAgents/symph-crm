'use client'

import { Menu, Search, MessageSquare } from 'lucide-react'
import { NotificationBell } from './NotificationBell'
import { useUser } from '@/lib/hooks/use-user'

type TopbarProps = {
  onMenuToggle?: () => void
  /** When provided (chat page only), shows a chat-sessions icon on the right side on mobile */
  onChatSessionsToggle?: () => void
}

export function Topbar({ onMenuToggle, onChatSessionsToggle }: TopbarProps) {
  const { isPartner, isLoading } = useUser()

  return (
    <div className="h-[44px] shrink-0 border-b border-black/[.06] dark:border-white/[.08] flex items-center px-4 gap-3 bg-white dark:bg-[#1e1e21]">
      {/* Hamburger — mobile only */}
      <button
        onClick={onMenuToggle}
        className="md:hidden w-8 h-8 flex items-center justify-center rounded text-slate-500 hover:bg-slate-100 dark:hover:bg-white/[.06] dark:bg-white/[.06] transition-colors duration-150"
      >
        <Menu size={16} strokeWidth={1.4} />
      </button>

      <div className="flex-1" />

      {!isLoading && !isPartner && (
        <>
          {/* Cmd+K search trigger */}
          <button
            className="hidden sm:flex items-center gap-2 bg-slate-100 dark:bg-white/[.06] border border-black/[.06] dark:border-white/[.08] rounded-lg px-3 py-[5px] w-[220px] md:w-[260px] text-left transition-colors duration-150 hover:bg-slate-200 dark:bg-white/[.1]/70 cursor-pointer"
            onClick={() => {/* TODO: open cmd+k modal */}}
          >
            <Search size={13} strokeWidth={1.4} className="text-slate-400 shrink-0" />
            <span className="text-xs text-slate-400 flex-1">Search or jump to...</span>
            <kbd className="hidden sm:inline text-atom font-medium text-slate-400 bg-white dark:bg-[#1e1e21] border border-black/[.08] dark:border-white/[.08] rounded px-1.5 py-px">
              Cmd K
            </kbd>
          </button>

          <NotificationBell />
        </>
      )}

      {/* Chat sessions toggle — mobile only, shown on /chat page */}
      {onChatSessionsToggle && (
        <button
          onClick={onChatSessionsToggle}
          title="Chat sessions"
          className="md:hidden w-8 h-8 flex items-center justify-center rounded text-slate-500 hover:bg-slate-100 dark:hover:bg-white/[.06] dark:bg-white/[.06] transition-colors duration-150"
        >
          <MessageSquare size={16} strokeWidth={1.4} />
        </button>
      )}

      <div className="flex-1 md:block hidden" />
    </div>
  )
}
