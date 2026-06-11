'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Avatar } from './Avatar'
import { api } from '@/lib/api'
import { useUser } from '@/lib/hooks/use-user'
import { cn } from '@/lib/utils'
import { CrmUserRole } from '@symph-crm/shared'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  BookMarked,
  BookOpen,
  Box,
  ChevronsUpDown,
  ClipboardList,
  Columns3,
  FileText,
  Grid2X2,
  Inbox,
  MessageCircle,
  Mic,
  PanelLeftClose,
  PanelLeftOpen,
  ReceiptText,
  Search,
  Settings,
  TrendingUp,
  Users,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

function LogoutOverlay() {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-overlay backdrop-blur-md">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-8 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
        <p className="text-ssm font-medium text-muted-foreground">Signing out...</p>
      </div>
    </div>
  )
}

type SidebarProps = {
  isOpen?: boolean
  onClose?: () => void
  collapsed?: boolean
  onCollapsedChange?: (collapsed: boolean) => void
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

function getNavSections(role?: CrmUserRole): NavSection[] {
  if (role === CrmUserRole.Partner) {
    return [
      {
        title: 'Main',
        items: [
          { path: '/deals', label: 'Deals', icon: BookOpen },
          { path: '/commissions', label: 'Commissions', icon: ReceiptText },
        ],
      },
    ]
  }

  return [
    {
      title: 'Main',
      items: [
        { path: '/chat', label: 'Chat', icon: MessageCircle },
        { path: '/', label: 'Dashboard', icon: Grid2X2 },
        { path: '/pipeline', label: 'Pipeline', icon: Columns3 },
        { path: '/deals', label: 'Brands', icon: BookOpen },
        { path: '/wiki', label: 'Wiki', icon: BookMarked },
      ],
    },
    {
      title: 'Engagement',
      items: [
        { path: '/inbox', label: 'Inbox', icon: Inbox },
        { path: '/meetings', label: 'Meetings', icon: Mic },
        { path: '/proposals', label: 'Proposals', icon: FileText },
        { path: '/users', label: 'Partnerships', icon: Users },
      ],
    },
    {
      title: 'Business',
      items: [
        { path: '/revenue', label: 'Revenue', icon: TrendingUp },
        { path: '/bills', label: 'Bills', icon: ReceiptText },
        { path: '/catalog', label: 'Catalog', icon: Box },
      ],
    },
    {
      title: 'System',
      items: [
        { path: '/audit-logs', label: 'Logs', icon: ClipboardList },
      ],
    },
  ]
}

function isActive(itemPath: string, pathname: string): boolean {
  if (itemPath === '/') return pathname === '/'
  if (itemPath === '/meetings') return pathname === '/meetings' || pathname === '/recordings' || pathname.startsWith('/meetings/')
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
      className="fixed inset-0 z-[9998] bg-overlay backdrop-blur-sm px-4 flex items-center justify-center"
      onClick={onCancel}
    >
      <div
        className="max-w-sm w-full rounded-md border border-border bg-card shadow-lg p-4 animate-in zoom-in-95 fade-in-0 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-sm font-semibold text-foreground">Sign out of Symph CRM?</p>
        <p className="text-ssm text-muted-foreground leading-relaxed mt-1">
          Any unsaved work will be lost. You can sign back in anytime.
        </p>
        <div className="flex gap-2.5 mt-4">
          <button
            onClick={onCancel}
            className="flex-1 h-11 sm:h-[var(--control-height-md)] rounded-control text-xs font-medium border border-border text-muted-foreground hover:bg-surface-hover hover:text-foreground transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 h-11 sm:h-[var(--control-height-md)] rounded-control text-xs font-medium text-danger-foreground bg-danger-dim hover:bg-danger/20 transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  )
}

export function Sidebar({ isOpen, onClose, collapsed = false, onCollapsedChange }: SidebarProps) {
  const pathname = usePathname()
  const { user, role, isLoading, isPartner } = useUser()
  const [hoveredPath, setHoveredPath] = useState<string | null>(null)
  const [signingOut, setSigningOut] = useState(false)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const navSections = isLoading ? [] : getNavSections(role)

  async function handleSignOut() {
    setShowLogoutConfirm(false)
    setSigningOut(true)
    await api.post('/auth/logout', {})
    window.location.href = '/login'
  }

  const collapsedWidth = 'md:w-[52px] w-[var(--sidebar-width)]'
  const expandedWidth = 'w-[var(--sidebar-width)]'

  return (
    <>
      {signingOut && <LogoutOverlay />}
      {showLogoutConfirm && (
        <LogoutConfirmModal
          onConfirm={handleSignOut}
          onCancel={() => setShowLogoutConfirm(false)}
        />
      )}
      {isOpen && (
        <div
          className="fixed inset-0 z-20 bg-overlay md:hidden"
          onClick={onClose}
        />
      )}

      <TooltipProvider delayDuration={0}>
        <aside className={cn(
          'shrink-0 bg-bg-subtle border-r border-border flex flex-col h-full overflow-hidden',
          'fixed inset-y-0 left-0 z-30 md:relative md:z-auto',
          'transition-[width,transform] duration-200',
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
          collapsed ? collapsedWidth : expandedWidth,
        )}>
          <div className={cn(
            'h-[var(--topbar-height)] border-b border-border flex items-center gap-2',
            collapsed ? 'md:justify-center md:px-0 px-3.5' : 'px-3.5',
          )}>
            <div className="w-8 h-8 rounded-md flex items-center justify-center text-sm font-bold text-primary-foreground bg-primary shrink-0 tracking-tight">
              S
            </div>
            <div className={cn('min-w-0 flex-1 flex items-center gap-2', collapsed && 'md:hidden')}>
              <span className="truncate text-sbase font-semibold tracking-[-0.02em] text-foreground">Symph</span>
              <ChevronsUpDown size={13} strokeWidth={1.5} className="ml-auto text-text-faint" />
            </div>
          </div>

          <div className={cn('border-b border-border', collapsed ? 'md:px-0 px-2 py-2' : 'px-2 py-2')}>
            <button
              type="button"
              className={cn(
                'flex h-[30px] w-full items-center gap-2 rounded-control border border-border bg-card text-xs text-text-faint transition-colors hover:border-border-strong hover:bg-surface-hover hover:text-foreground',
                collapsed ? 'md:mx-auto md:w-8 md:justify-center md:px-0 px-2' : 'px-2',
              )}
              onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }))}
            >
              <Search size={14} strokeWidth={1.5} className="shrink-0" />
              <span className={cn('min-w-0 flex-1 text-left', collapsed && 'md:hidden')}>Jump to...</span>
              <kbd className={cn('rounded-control border border-border bg-secondary px-1.5 py-px text-atom font-medium text-text-faint', collapsed && 'md:hidden')}>
                ⌘K
              </kbd>
            </button>
          </div>

          <nav className={cn('flex-1 overflow-y-auto pb-2', collapsed ? 'md:px-0 px-2' : 'px-0')}>
            {navSections.map((section, sectionIndex) => (
              <div key={section.title} className={cn(sectionIndex > 0 && 'mt-2')}>
                <div className={cn(
                  'text-atom font-semibold uppercase tracking-[0.12em] text-text-faint',
                  collapsed ? 'md:mx-auto md:my-2 md:h-px md:w-7 md:bg-border md:p-0 md:text-transparent px-3.5 pb-1 pt-3' : 'px-3.5 pb-1 pt-3',
                )}>
                  {section.title}
                </div>
                <div className="flex flex-col">
                  {section.items.map(item => {
                    const active = isActive(item.path, pathname)
                    const hovered = hoveredPath === item.path
                    const Icon = item.icon

                    const linkEl = (
                      <Link
                        key={item.path}
                        href={item.path}
                        onClick={() => onClose?.()}
                        onMouseEnter={() => setHoveredPath(item.path)}
                        onMouseLeave={() => setHoveredPath(null)}
                        className={cn(
                          'relative flex h-8 items-center gap-3 text-left text-[length:var(--v-size-nav)] leading-[var(--v-lh-nav)] font-[var(--v-wt-nav)] transition-colors duration-100',
                          collapsed ? 'md:mx-auto md:h-8 md:w-8 md:justify-center md:px-0 px-3.5' : 'px-3.5',
                          active
                            ? 'bg-surface-active text-foreground font-medium'
                            : 'text-muted-foreground',
                          !active && hovered && 'bg-surface-hover text-foreground',
                        )}
                      >
                        <Icon size={16} strokeWidth={1.55} className="shrink-0" />
                        <span className={cn('min-w-0 flex-1 truncate', collapsed && 'md:hidden')}>{item.label}</span>
                        {item.badge && (
                          <span
                            className={cn(
                              'rounded-control bg-secondary px-2 py-0.5 text-atom font-semibold tabular-nums text-text-faint ring-1 ring-border',
                              collapsed && 'md:hidden',
                            )}
                            style={item.badgeColor ? { color: item.badgeColor } : undefined}
                          >
                            {item.badge}
                          </span>
                        )}
                      </Link>
                    )

                    if (!collapsed) return <div key={item.path}>{linkEl}</div>

                    return (
                      <Tooltip key={item.path}>
                        <TooltipTrigger asChild>{linkEl}</TooltipTrigger>
                        <TooltipContent side="right" className="hidden md:block">{item.label}</TooltipContent>
                      </Tooltip>
                    )
                  })}
                </div>
              </div>
            ))}
          </nav>

          <div className={cn('border-t border-border py-2', collapsed ? 'md:px-0 px-2' : 'px-2')}>
            {!isLoading && !isPartner && (
              <Link
                href="/settings"
                onClick={() => onClose?.()}
                className={cn(
                  'mb-1 flex h-8 items-center gap-3 rounded-control px-2 text-sm font-medium transition-colors',
                  isActive('/settings', pathname)
                    ? 'bg-surface-active text-foreground'
                    : 'text-muted-foreground hover:bg-surface-hover hover:text-foreground',
                  collapsed && 'md:mx-auto md:h-8 md:w-8 md:justify-center md:px-0',
                )}
              >
                <Settings size={16} strokeWidth={1.55} />
                <span className={cn(collapsed && 'md:hidden')}>Settings</span>
              </Link>
            )}
            <button
              type="button"
              onClick={() => onCollapsedChange?.(!collapsed)}
              className={cn(
                'flex h-8 w-full items-center gap-3 rounded-control px-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground',
                collapsed && 'md:mx-auto md:h-8 md:w-8 md:justify-center md:px-0',
              )}
            >
              {collapsed ? <PanelLeftOpen size={16} strokeWidth={1.55} /> : <PanelLeftClose size={16} strokeWidth={1.55} />}
              <span className={cn(collapsed && 'md:hidden')}>{collapsed ? 'Expand' : 'Collapse'}</span>
            </button>
          </div>

          <div className={cn(
            'border-t border-border py-3 flex items-center gap-3',
            collapsed ? 'md:justify-center md:px-0 px-3.5' : 'px-3.5',
          )}>
            <Avatar
              name={user?.name || '?'}
              email={user?.email ?? undefined}
              src={user?.image ?? undefined}
              size={34}
            />
            <div className={cn('min-w-0 flex-1', collapsed && 'md:hidden')}>
              <div className="truncate text-sm font-semibold text-foreground">{user?.name || 'User'}</div>
              <div className="truncate text-xs text-text-faint">{user?.email || ''}</div>
            </div>
            {!isPartner && (
              <button
                onClick={() => setShowLogoutConfirm(true)}
                disabled={signingOut}
                className={cn(
                  'text-xs font-medium text-text-faint hover:text-foreground transition-colors disabled:opacity-40',
                  collapsed && 'md:hidden',
                )}
                title="Sign out"
              >
                Sign out
              </button>
            )}
          </div>
        </aside>
      </TooltipProvider>
    </>
  )
}
