'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import { useTheme } from 'next-themes'
import { Avatar } from './Avatar'
import { cn } from '@/lib/utils'
import { useGetNotifications } from '@/lib/hooks/queries'
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
  Receipt,
  Sun,
  Moon,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

function LogoutOverlay() {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-white/60 dark:bg-black/60 backdrop-blur-md">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
        <p className="text-ssm font-medium text-slate-500">Signing out...</p>
      </div>
    </div>
  )
}

type SidebarProps = {
  isOpen?: boolean
  onClose?: () => void
  collapsed?: boolean
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

function getNavSections(dormantCount: number): NavSection[] {
  return [
    {
      title: 'Main',
      items: [
        { path: '/chat', label: 'Chat', icon: MessageCircle },
        { path: '/', label: 'Dashboard', icon: LayoutGrid },
        { path: '/pipeline', label: 'Pipeline', icon: Columns3, ...(dormantCount > 0 ? { badge: dormantCount, badgeColor: '#f59e0b' } : {}) },
        { path: '/deals', label: 'Brands', icon: BookOpen },
        { path: '/inbox', label: 'Inbox', icon: Mail },
      ],
    },
    {
      title: 'Tools',
      items: [
        { path: '/calendar', label: 'Calendar', icon: Calendar },
        { path: '/reports', label: 'Reports', icon: BarChart3 },
        { path: '/proposals', label: 'Proposals', icon: FileText },
        { path: '/bills', label: 'Bills', icon: Receipt },
        { path: '/audit-logs', label: 'Audit Log', icon: ClipboardList },
      ],
    },
  ]
}

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
      className="fixed inset-0 z-[9998] bg-black/50 backdrop-blur-sm px-4 flex items-center justify-center"
      onClick={onCancel}
    >
      <div
        className="max-w-sm w-full rounded-xl border border-black/[.06] dark:border-white/[.08] bg-white dark:bg-[#1e1e21] shadow-2xl p-4 animate-in zoom-in-95 fade-in-0 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-sm font-semibold text-slate-900 dark:text-white">Sign out of Symph CRM?</p>
        <p className="text-ssm text-slate-600 dark:text-slate-400 leading-relaxed mt-1">
          Any unsaved work will be lost. You can sign back in anytime.
        </p>
        <div className="flex gap-2.5 mt-4">
          <button
            onClick={onCancel}
            className="flex-1 h-8 rounded-lg text-xs font-semibold border border-black/[.08] dark:border-white/[.1] text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[.04] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 h-8 rounded-lg text-xs font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  )
}

export function Sidebar({ isOpen, onClose, collapsed = false }: SidebarProps) {
  const pathname = usePathname()
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const { data: session } = useSession()
  const [hoveredPath, setHoveredPath] = useState<string | null>(null)
  const [signingOut, setSigningOut] = useState(false)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const user = session?.user

  const { data: notifications = [] } = useGetNotifications()
  const dormantCount = notifications.filter(n => n.type === 'dormant_deal' && !n.isRead).length
  const navSections = getNavSections(dormantCount)

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
        'shrink-0 bg-white dark:bg-[#1e1e21] border-r border-black/[.06] dark:border-white/[.08] flex flex-col h-full overflow-hidden',
        'fixed inset-y-0 left-0 z-30 md:relative md:z-auto',
        'transition-all duration-200',
        isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        collapsed ? 'md:w-[60px] w-[216px]' : 'w-[216px]'
      )}>
        {/* Logo */}
        <div className={cn(
          'h-[44px] border-b border-black/[.06] dark:border-white/[.08] flex items-center',
          collapsed ? 'md:justify-center md:px-0 px-4' : 'px-4'
        )}>
          <div
            className="w-[26px] h-[26px] rounded-[6px] flex items-center justify-center text-xxs font-extrabold text-white shrink-0 tracking-tight"
            style={{ background: 'linear-gradient(135deg, #1547e6, #3b82f6)' }}
          >
            S
          </div>
        </div>

        {/* Nav */}
        <nav className={cn(
          'py-1.5 flex-1 flex flex-col overflow-y-auto',
          collapsed ? 'md:px-1.5 px-2' : 'px-2'
        )}>
          {navSections.map((section, si) => (
            <div key={si} className={cn(si > 0 && 'mt-2.5')}>
              <div className={cn(
                'text-atom font-semibold uppercase tracking-[0.06em] text-slate-400 px-[10px] pt-[4px] pb-0.5',
                collapsed && 'md:hidden'
              )}>
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
                      title={collapsed ? item.label : undefined}
                      className={cn(
                        'relative flex items-center gap-[9px] px-[10px] py-[6px] rounded text-ssm w-full text-left transition-colors duration-150',
                        active
                          ? 'bg-primary/[.08] dark:bg-primary/[.12] text-primary dark:text-primary font-semibold ring-1 ring-primary/20 dark:ring-primary/25'
                          : 'font-medium',
                        !active && hovered && 'bg-slate-100 dark:bg-white/[.06] text-slate-900 dark:text-white',
                        !active && !hovered && 'text-slate-600 dark:text-slate-400',
                        collapsed && 'md:justify-center md:px-0 md:py-[8px]'
                      )}
                    >
                      <Icon size={15} strokeWidth={1.4} className="shrink-0" />
                      <span className={cn('flex-1', collapsed && 'md:hidden')}>{item.label}</span>
                      {item.badge && (
                        <span
                          className={cn(
                            'text-white text-atom font-bold px-1.5 py-px rounded-full tabular-nums',
                            collapsed && 'md:hidden'
                          )}
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
          <div className={cn(
            'py-2 border-t border-black/[.06] dark:border-white/[.08]',
            collapsed ? 'md:px-1.5 px-[14px]' : 'px-[14px]'
          )}>
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              title={collapsed ? (theme === 'dark' ? 'Light mode' : 'Dark mode') : undefined}
              className={cn(
                'w-full flex items-center gap-2 px-[10px] py-[6px] rounded text-xs font-medium text-slate-500 hover:bg-slate-100 dark:hover:bg-white/[.06] transition-colors',
                collapsed && 'md:justify-center md:px-0'
              )}
            >
              {theme === 'dark' ? <Sun size={14} strokeWidth={1.4} className="shrink-0" /> : <Moon size={14} strokeWidth={1.4} className="shrink-0" />}
              <span className={cn(collapsed && 'md:hidden')}>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
            </button>
          </div>
        )}

        {/* User profile */}
        <div className={cn(
          'py-2.5 border-t border-black/[.06] dark:border-white/[.08] flex items-center gap-[9px]',
          collapsed ? 'md:justify-center md:px-0 px-[14px]' : 'px-[14px]'
        )}>
          {user?.image ? (
            <img src={user.image} alt="" className="w-7 h-7 rounded-full shrink-0" />
          ) : (
            <Avatar name={user?.name || '?'} size={28} />
          )}
          <div className={cn('flex-1 min-w-0', collapsed && 'md:hidden')}>
            <div className="text-xs font-semibold text-slate-900 dark:text-white truncate">{user?.name || 'User'}</div>
            <div className="text-atom text-slate-400 truncate">{user?.email || ''}</div>
          </div>
          <button
            onClick={() => setShowLogoutConfirm(true)}
            disabled={signingOut}
            className={cn(
              'text-atom font-medium text-slate-400 hover:text-slate-600 dark:text-slate-400 transition-colors cursor-pointer disabled:opacity-40',
              collapsed && 'md:hidden'
            )}
            title="Sign out"
          >
            Sign out
          </button>
        </div>
      </aside>
    </>
  )
}
