'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import { Avatar } from './Avatar'
import { cn } from '@/lib/utils'
import { LogOut } from 'lucide-react'

function LogoutOverlay() {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center" style={{ backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', backgroundColor: 'rgba(255,255,255,0.6)' }}>
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
        <p className="text-[13px] font-medium text-slate-500">Signing out…</p>
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
  icon: string
}

type NavSection = {
  title: string
  items: NavItem[]
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: 'Main',
    items: [
      { path: '/chat', label: 'Chat', icon: 'M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z' },
      { path: '/', label: 'Dashboard', icon: 'M3 3h7v7H3V3zm0 11h7v7H3v-7zm11-11h7v7h-7V3zm0 11h7v7h-7v-7z' },
      { path: '/pipeline', label: 'Pipeline', icon: 'M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2' },
      { path: '/inbox', label: 'Inbox', icon: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
    ],
  },
  {
    title: 'Tools',
    items: [
      { path: '/calendar', label: 'Calendar', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
      { path: '/reports', label: 'Reports', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
      { path: '/proposals', label: 'Proposal Builder', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
    ],
  },
]

function NavIcon({ path }: { path: string }) {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round">
      <path d={path} />
    </svg>
  )
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
      className="fixed inset-0 z-[9998] flex items-center justify-center"
      style={{
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        backgroundColor: 'rgba(255,255,255,0.5)',
      }}
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] border border-black/[.06] p-6 w-[320px] flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Icon */}
        <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
          <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
        </div>

        {/* Text */}
        <div className="flex flex-col gap-1">
          <p className="text-[14px] font-semibold text-slate-900">Sign out of Symph CRM?</p>
          <p className="text-[12.5px] text-slate-500 leading-[1.5]">
            Any unsaved work will be lost. You can sign back in anytime.
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-2 mt-1">
          <button
            onClick={onCancel}
            className="flex-1 h-9 rounded-lg border border-black/[.08] text-[13px] font-medium text-slate-600 hover:bg-slate-50 transition-colors"
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
        'w-[216px] shrink-0 bg-white border-r border-black/[.06] flex flex-col h-full',
        'fixed inset-y-0 left-0 z-30 md:relative md:z-auto',
        'transition-transform duration-150',
        isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      )}>
        {/* Logo */}
        <div className="px-4 pt-[18px] pb-[14px] border-b border-black/[.06] flex items-center gap-[10px]">
          <div
            className="w-[30px] h-[30px] rounded-[7px] flex items-center justify-center text-[13px] font-extrabold text-white shrink-0 tracking-tight"
            style={{ background: 'linear-gradient(135deg, var(--primary), var(--color-primary-accent))' }}
          >
            S
          </div>
          <div>
            <div className="text-[13px] font-bold text-slate-900 tracking-[-0.02em]">Symph CRM</div>
            <div className="text-[10px] text-slate-400">Sales Pipeline</div>
          </div>
        </div>

        {/* Nav */}
        <nav className="px-2 py-2 flex-1 flex flex-col overflow-y-auto">
          {NAV_SECTIONS.map((section, si) => (
            <div key={si} className={cn(si > 0 && 'mt-3')}>
              <div className="text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-400 px-[10px] pt-[6px] pb-1">
                {section.title}
              </div>
              <div className="flex flex-col gap-0.5">
                {section.items.map(item => {
                  const active = isActive(item.path, pathname)
                  const hovered = hoveredPath === item.path
                  return (
                    <Link
                      key={item.path}
                      href={item.path}
                      onClick={() => onClose?.()}
                      onMouseEnter={() => setHoveredPath(item.path)}
                      onMouseLeave={() => setHoveredPath(null)}
                      className={cn(
                        'flex items-center gap-[9px] px-[10px] py-2 rounded text-[12.5px] w-full text-left transition-colors duration-150',
                        active
                          ? 'border border-primary-border font-semibold'
                          : 'border border-transparent font-medium',
                        !active && hovered && 'bg-slate-100 text-slate-900',
                        !active && !hovered && 'text-slate-600',
                      )}
                      style={active ? { background: 'var(--color-primary-dim)', color: 'var(--primary)' } : undefined}
                    >
                      <NavIcon path={item.icon} />
                      <span className="flex-1">{item.label}</span>
                      {item.badge && (
                        <span
                          className="text-white text-[10px] font-bold px-1.5 py-px rounded-full font-mono tabular-nums"
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

        {/* User profile */}
        <div className="px-[14px] py-3 border-t border-black/[.06] flex items-center gap-[9px]">
          {user?.image ? (
            <img src={user.image} alt="" className="w-7 h-7 rounded-full" />
          ) : (
            <Avatar name={user?.name || '?'} size={28} />
          )}
          <div className="flex-1 min-w-0">
            <div className="text-[12px] font-semibold text-slate-900 truncate">{user?.name || 'User'}</div>
            <div className="text-[10px] text-slate-400 truncate">{user?.email || ''}</div>
          </div>
          <button
            onClick={() => setShowLogoutConfirm(true)}
            disabled={signingOut}
            className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors shrink-0 cursor-pointer disabled:opacity-40"
            title="Sign out"
          >
            <LogOut size={14} />
          </button>
        </div>
      </aside>
    </>
  )
}
