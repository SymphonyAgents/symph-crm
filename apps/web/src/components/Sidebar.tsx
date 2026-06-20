'use client'

import { useEffect, useState, type ComponentType } from 'react'
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
  Check,
  ChevronsUpDown,
  ClipboardList,
  Columns3,
  FileStack,
  FileText,
  Grid2X2,
  Inbox,
  MessageCircle,
  Mic,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  ReceiptText,
  Search,
  Settings,
  Target,
  Sparkles,
  Sun,
  TrendingUp,
  Users,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useTheme } from 'next-themes'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

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
  children?: Array<Pick<NavItem, 'path' | 'label' | 'icon' | 'badge' | 'badgeColor'>>
}

type NavSection = {
  title: string
  items: NavItem[]
}

type ThemeOption = {
  value: 'light' | 'dark' | 'midnight'
  label: string
  description: string
  icon: ComponentType<{ size?: number; strokeWidth?: number; className?: string }>
}

const THEME_OPTIONS: ThemeOption[] = [
  { value: 'light', label: 'Light', description: 'Clean daytime workspace', icon: Sun },
  { value: 'dark', label: 'Dark', description: 'Neutral low-light mode', icon: Moon },
  { value: 'midnight', label: 'Midnight', description: 'Deep blue focus mode', icon: Sparkles },
]

function ThemeSelector({ collapsed }: { collapsed?: boolean }) {
  const { theme, resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  const activeTheme = mounted ? (theme === 'system' ? resolvedTheme : theme) : 'light'
  const activeOption = THEME_OPTIONS.find(option => option.value === activeTheme) ?? THEME_OPTIONS[0]
  const ActiveIcon = activeOption.icon

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-control border border-border bg-secondary text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground',
            collapsed && 'md:mx-auto',
          )}
          aria-label={`Change color mode. Current mode: ${activeOption.label}`}
          title={activeOption.label}
        >
          <ActiveIcon size={14} strokeWidth={1.6} className="text-primary" />
        </button>
      </PopoverTrigger>
      <PopoverContent side="right" align="end" className="w-[220px] p-1.5">
        <div className="px-2 pb-1 pt-1">
          <p className="eyebrow-label">Color mode</p>
        </div>
        <div className="space-y-1">
          {THEME_OPTIONS.map(option => {
            const Icon = option.icon
            const isActive = activeOption.value === option.value
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setTheme(option.value)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-md px-2 py-2 text-left transition-colors',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-surface-hover hover:text-foreground',
                )}
              >
                <Icon size={15} strokeWidth={1.6} className="shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-semibold">{option.label}</span>
                  <span className={cn('block truncate text-atom', isActive ? 'text-primary/75' : 'text-text-faint')}>
                    {option.description}
                  </span>
                </span>
                {isActive && <Check size={14} strokeWidth={1.8} className="shrink-0" />}
              </button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
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
        {
          path: '/pipeline',
          label: 'Pipeline',
          icon: Columns3,
          children: [
            { path: '/pipeline?view=deals', label: 'Deals', icon: FileStack },
            { path: '/pipeline?view=leads', label: 'Leads', icon: Target },
          ],
        },
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
  if (itemPath === '/pipeline') return pathname === '/pipeline' || pathname.startsWith('/pipeline/') || pathname === '/leads' || pathname.startsWith('/leads/')
  return pathname === itemPath || pathname.startsWith(itemPath + '/')
}

function splitNavPath(itemPath: string) {
  const [path, query = ''] = itemPath.split('?')
  return { path, query }
}

function isExactActive(itemPath: string, pathname: string, queryString: string): boolean {
  const item = splitNavPath(itemPath)
  if (item.path === '/') return pathname === '/'
  if (item.path === '/pipeline' && item.query) {
    const itemView = new URLSearchParams(item.query).get('view')
    const currentView = new URLSearchParams(queryString).get('view')
    if (itemView === 'deals') return pathname === '/pipeline' && currentView !== 'leads'
    return pathname === '/pipeline' && currentView === itemView
  }
  if (item.query) return pathname === item.path && queryString === item.query
  return pathname === item.path || pathname.startsWith(item.path + '/')
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
  const [queryString, setQueryString] = useState('')

  useEffect(() => {
    setQueryString(window.location.search.replace(/^\?/, ''))
  }, [pathname])

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
                  'eyebrow-label',
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
                        href={item.children ? `${item.path}?view=deals` : item.path}
                        onClick={() => {
                          if (item.children) setQueryString('view=deals')
                          onClose?.()
                        }}
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

                    const childLinks = item.children && !collapsed ? (
                      <div className="ml-[21px] border-l border-border py-1">
                        {item.children.map(child => {
                          const ChildIcon = child.icon
                          const childActive = isExactActive(child.path, pathname, queryString)
                          return (
                            <Link
                              key={child.path}
                              href={child.path}
                              onClick={() => {
                                setQueryString(splitNavPath(child.path).query)
                                onClose?.()
                              }}
                              className={cn(
                                'flex h-8 items-center gap-2 rounded-control px-2 text-[length:var(--v-size-nav)] leading-[var(--v-lh-nav)] font-[var(--v-wt-nav)] transition-colors',
                                childActive
                                  ? 'bg-card text-foreground ring-1 ring-border'
                                  : 'text-muted-foreground hover:bg-surface-hover hover:text-foreground',
                              )}
                            >
                              <ChildIcon size={16} strokeWidth={1.55} className="shrink-0" />
                              <span className="min-w-0 flex-1 truncate">{child.label}</span>
                            </Link>
                          )
                        })}
                      </div>
                    ) : null

                    if (!collapsed) return <div key={item.path}>{linkEl}{childLinks}</div>

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
              <div className={cn('mb-1 flex items-center gap-1.5', collapsed && 'md:flex-col')}>
                <Link
                  href="/settings"
                  onClick={() => onClose?.()}
                  className={cn(
                    'flex h-8 flex-1 items-center gap-3 rounded-control px-2 text-[length:var(--v-size-nav)] leading-[var(--v-lh-nav)] font-[var(--v-wt-nav)] transition-colors',
                    isActive('/settings', pathname)
                      ? 'bg-surface-active text-foreground'
                      : 'text-muted-foreground hover:bg-surface-hover hover:text-foreground',
                    collapsed && 'md:mx-auto md:h-8 md:w-8 md:flex-none md:justify-center md:px-0',
                  )}
                >
                  <Settings size={16} strokeWidth={1.55} />
                  <span className={cn(collapsed && 'md:hidden')}>Settings</span>
                </Link>
                <ThemeSelector collapsed={collapsed} />
              </div>
            )}
            <button
              type="button"
              onClick={() => onCollapsedChange?.(!collapsed)}
              className={cn(
                'flex h-8 w-full items-center gap-3 rounded-control px-2 text-[length:var(--v-size-nav)] leading-[var(--v-lh-nav)] font-[var(--v-wt-nav)] text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground',
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
          </div>
        </aside>
      </TooltipProvider>
    </>
  )
}
