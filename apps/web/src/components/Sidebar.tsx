'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import { useTheme } from 'next-themes'
import { Avatar } from './Avatar'
import { cn } from '@/lib/utils'
import {
  MessageCircle,
  LayoutGrid,
  Columns3,
  BookOpen,
  Mail,
  Calendar,
  BarChart3,
  FileText,
  ClipboardList,
  Sun,
  Moon,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

function LogoutOverlay() {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-white/60 dark:bg-black/60 backdrop-blur-md">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
        <p className="text-[13px] font-medium text-slate-500">Signing out...</p>
      </div>
    </div>
  )
}

type SidebarProps = {
  isOpen?: boolean
  onClose?: () => void
}

type NavItem = {
  path: string
  label: string
  badge?: number
  badgeColor?: string
  icon: LucideIcon
}

type NavSection = {
  title: string
  items: NavItem[]
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: 'Main',
    items: [
      { path: '/chat', label: 'Chat', icon: MessageCircle },
      { path: '/', label: 'Dashboard', icon: LayoutGrid },
      { path: '/pipeline', label: 'Pipeline', icon: Columns3 },
      { path: '/deals', label: 'Deals', icon: BookOpen },
      { path: '/inbox', label: 'Inbox', icon: Mail },
    ],
  },
  {
    title: 'Tools',
    items: [
      { path: '/calendar', label: 'Calendar', icon: Calendar },
      { path: '/reports', label: 'Reports', icon: BarChart3 },
      { path: '/proposals', label: 'Proposals', icon: FileText },
      { path: '/audit-logs', label: 'Audit Log', icon: ClipboardList },
    ],
  },
]

function isActive(itemPath: string, pathname: string): boolean {
  if (itemPath === '/') return pathname === '/'
  return pathname === itemPath || pathname.startsWith(itemPath + '/')
}

function LogoutConfirmModal({
  onConfirm,
  onCancel,
}: {
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/60 backdrop-blur-[2px]"
      onClick={onCancel}
    >
      <div
        className="bg-white dark:bg-[#1e1e21] rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] border border-black/[.06] dark:border-white/[.08] p-6 w-[320px] flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col gap-1">
          <p className="text-[14px] font-semibold text-slate-900 dark:text-white">Sign out of Symph CRM?</p>
          <p className="text-[12.5px] text-slate-500 leading-[1.5]">
            Any unsaved work will be lost. You can sign back in anytime.
          </p>
        </div>

        <div className="flex gap-2 mt-1">
          <button
            onClick={onCancel}
            className="flex-1 h-9 rounded-lg border border-black/[.08] dark:border-white/[.08] text-[13px] font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/[.04] dark:bg-white/[.03] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 h-9 rounded-lg bg-red-500 hover:bg-red-600 active:bg-red-700 text-[13px] font-medium text-white transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  )
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname()
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const { data: session } = useSession()
  const [hoveredPath, setHoveredPath] = useState<string | null>(null)
  const [signingOut, setSigningOut] = useState(false)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const user = session?.user

  async function handleSignOut() {
    setShowLogoutConfirm(false)
    setSigningOut(true)
    await signOut({ callbackUrl: '/login' })
  }

  return (
    <>
      {signingOut && <LogoutOverlay />}
      {showLogoutConfirm && (
        <LogoutConfirmModal
          onConfirm={handleSignOut}
          onCancel={() => setShowLogoutConfirm(false)}
        />
      )}
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/20 md:hidden"
          onClick={onClose}
        />
      )}

      <aside className={cn(
        'w-[216px] shrink-0 bg-white dark:bg-[#1e1e21] border-r border-black/[.06] dark:border-white/[.08] flex flex-col h-full',
        'fixed inset-y-0 left-0 z-30 md:relative md:z-auto',
        'transition-transform duration-150',
        isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      )}>
        {/* Logo */}
        <div className="h-[44px] px-4 border-b border-black/[.06] dark:border-white/[.08] flex items-center">
          <div
            className="w-[26px] h-[26px] rounded-[6px] flex items-center justify-center text-[11px] font-extrabold text-white shrink-0 tracking-tight"
            style={{ background: 'linear-gradient(135deg, #1547e6, #3b82f6)' }}
          >
            S
          </div>
        </div>

        {/* Nav */}
        <nav className="px-2 py-1.5 flex-1 flex flex-col overflow-y-auto">
          {NAV_SECTIONS.map((section, si) => (
            <div key={si} className={cn(si > 0 && 'mt-2.5')}>
              <div className="text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-400 px-[10px] pt-[4px] pb-0.5">
                {section.title}
              </div>
              <div className="flex flex-col gap-px">
                {section.items.map(item => {
                  const active = isActive(item.path, pathname)
                  const hovered = hoveredPath === item.path
                  const Icon = item.icon
                  return (
                    <Link
                      key={item.path}
                      href={item.path}
                      onClick={() => onClose?.()}
                      onMouseEnter={() => setHoveredPath(item.path)}
                      onMouseLeave={() => setHoveredPath(null)}
                      className={cn(
                        'flex items-center gap-[9px] px-[10px] py-[6px] rounded text-[12.5px] w-full text-left transition-colors duration-150',
                        active
                          ? 'bg-slate-100 dark:bg-white/[.06] text-slate-900 dark:text-white font-semibold'
                          : 'font-medium',
                        !active && hovered && 'bg-slate-100 dark:bg-white/[.06] text-slate-900 dark:text-white',
                        !active && !hovered && 'text-slate-600 dark:text-slate-400',
                      )}
                    >
                      <Icon size={15} strokeWidth={1.4} />
                      <span className="flex-1">{item.label}</span>
                      {item.badge && (
                        <span
                          className="text-white text-[10px] font-bold px-1.5 py-px rounded-full tabular-nums"
                          style={{ background: item.badgeColor || 'var(--primary)' }}
                        >
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Theme toggle */}
        {mounted && (
          <div className="px-[14px] py-2 border-t border-black/[.06] dark:border-white/[.08]">
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="w-full flex items-center gap-2 px-[10px] py-[6px] rounded text-[12px] font-medium text-slate-500 hover:bg-slate-100 dark:hover:bg-white/[.06] transition-colors"
            >
              {theme === 'dark' ? <Sun size={14} strokeWidth={1.4} /> : <Moon size={14} strokeWidth={1.4} />}
              {theme === 'dark' ? 'Light mode' : 'Dark mode'}
            </button>
          </div>
        )}

        {/* User profile */}
        <div className="px-[14px] py-2.5 border-t border-black/[.06] dark:border-white/[.08] flex items-center gap-[9px]">
          {user?.image ? (
            <img src={user.image} alt="" className="w-7 h-7 rounded-full" />
          ) : (
            <Avatar name={user?.name || '?'} size={28} />
          )}
          <div className="flex-1 min-w-0">
            <div className="text-[12px] font-semibold text-slate-900 dark:text-white truncate">{user?.name || 'User'}</div>
            <div className="text-[10px] text-slate-400 truncate">{user?.email || ''}</div>
          </div>
          <button
            onClick={() => setShowLogoutConfirm(true)}
            disabled={signingOut}
            className="text-[10px] font-medium text-slate-400 hover:text-slate-600 dark:text-slate-400 transition-colors cursor-pointer disabled:opacity-40"
            title="Sign out"
          >
            Sign out
          </button>
        </div>
      </aside>
    </>
  )
}
