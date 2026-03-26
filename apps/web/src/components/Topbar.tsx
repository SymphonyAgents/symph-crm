'use client'

import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

type TopbarProps = {
  onMenuToggle?: () => void
}

const PATH_LABELS: Record<string, string> = {
  '/': 'Dashboard',
  '/pipeline': 'Pipeline',
  '/deals': 'Deals',
  '/inbox': 'Inbox',
  '/calendar': 'Calendar',
  '/reports': 'Reports',
  '/proposals': 'Proposal Builder',
  '/chat': 'Chat',
}

function getLabel(pathname: string): string {
  if (PATH_LABELS[pathname]) return PATH_LABELS[pathname]
  if (pathname.startsWith('/deals/')) return 'Deal Detail'
  return 'Dashboard'
}

export function Topbar({ onMenuToggle }: TopbarProps) {
  const pathname = usePathname()

  return (
    <div className="h-[50px] shrink-0 border-b border-black/[.06] flex items-center px-5 gap-[14px] bg-white">
      {/* Hamburger — mobile only */}
      <button
        onClick={onMenuToggle}
        className="md:hidden w-8 h-8 flex items-center justify-center rounded text-slate-500 hover:bg-slate-100 transition-colors duration-150 active:scale-[0.96]"
      >
        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.2} strokeLinecap="round">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      {/* Breadcrumb */}
      <div className="text-[12px] font-medium text-slate-600">
        {getLabel(pathname)}
      </div>

      <div className="flex-1" />

      {/* Search */}
      <div className={cn(
        'hidden sm:flex items-center gap-1.5 bg-slate-100 border border-black/[.06] rounded',
        'px-[10px] py-[5px] w-[200px] transition-colors duration-150'
      )}>
        <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.2} strokeLinecap="round" className="text-slate-400 shrink-0">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="text"
          placeholder="Search deals, clients..."
          className="border-none bg-transparent outline-none text-[12px] text-slate-900 w-full placeholder:text-slate-400"
        />
      </div>

      {/* New Deal */}
      <button className="flex items-center gap-[5px] bg-primary hover:bg-primary-hover text-white rounded px-[14px] py-[6px] text-[12px] font-semibold transition-colors duration-150 cursor-pointer">
        <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        <span className="hidden sm:inline">New Deal</span>
      </button>
    </div>
  )
}
