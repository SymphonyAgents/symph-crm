'use client'

import { Menu, Search } from 'lucide-react'
import { NotificationBell } from './NotificationBell'

type TopbarProps = {
  onMenuToggle?: () => void
}

export function Topbar({ onMenuToggle }: TopbarProps) {
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

      {/* Cmd+K search trigger */}
      <button
        className="flex items-center gap-2 bg-slate-100 dark:bg-white/[.06] border border-black/[.06] dark:border-white/[.08] rounded-lg px-3 py-[5px] w-[260px] text-left transition-colors duration-150 hover:bg-slate-200 dark:bg-white/[.1]/70 cursor-pointer"
        onClick={() => {/* TODO: open cmd+k modal */}}
      >
        <Search size={13} strokeWidth={1.4} className="text-slate-400 shrink-0" />
        <span className="text-xs text-slate-400 flex-1">Search or jump to...</span>
        <kbd className="hidden sm:inline text-atom font-medium text-slate-400 bg-white dark:bg-[#1e1e21] border border-black/[.08] dark:border-white/[.08] rounded px-1.5 py-px">
          Cmd K
        </kbd>
      </button>

      <NotificationBell />

      <div className="flex-1" />
    </div>
  )
}
