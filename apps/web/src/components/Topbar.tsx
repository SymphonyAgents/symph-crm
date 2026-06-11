'use client'

import { useEffect, useState, type ComponentType } from 'react'
import { Check, Menu, MessageSquare, Moon, Search, Sparkles, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { NotificationBell } from './NotificationBell'
import { useUser } from '@/lib/hooks/use-user'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

type TopbarProps = {
  onMenuToggle?: () => void
  /** When provided (chat page only), shows a chat-sessions icon on the right side on mobile */
  onChatSessionsToggle?: () => void
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

function ThemeSelector() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  const activeTheme = mounted ? theme : 'light'
  const activeOption = THEME_OPTIONS.find(option => option.value === activeTheme) ?? THEME_OPTIONS[0]
  const ActiveIcon = activeOption.icon

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-11 w-11 items-center justify-center rounded-control border border-border bg-secondary text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground sm:h-[var(--control-height-md)] sm:w-[var(--control-height-md)]"
          aria-label={`Change color mode. Current mode: ${activeOption.label}`}
          title={activeOption.label}
        >
          <ActiveIcon size={14} strokeWidth={1.6} className="text-primary" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[220px] p-1.5">
        <div className="px-2 pb-1 pt-1">
          <p className="text-atom font-semibold uppercase tracking-[0.08em] text-text-faint">Color mode</p>
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

export function Topbar({ onMenuToggle, onChatSessionsToggle }: TopbarProps) {
  const { isPartner, isLoading } = useUser()

  return (
    <div className="h-[var(--topbar-height)] shrink-0 border-b border-border flex items-center px-3.5 gap-2 bg-bg-subtle">
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
          {/* Cmd+K search trigger */}
          <button
            className="hidden sm:flex h-[var(--control-height-lg)] items-center gap-2 rounded-control border border-border bg-secondary px-2.5 text-left transition-colors duration-150 hover:bg-surface-hover hover:border-border-strong cursor-pointer w-[220px] md:w-[260px]"
            onClick={() => {/* TODO: open cmd+k modal */}}
          >
            <Search size={13} strokeWidth={1.4} className="text-text-faint shrink-0" />
            <span className="text-xs text-text-faint flex-1">Search or jump to...</span>
            <kbd className="hidden sm:inline text-atom font-medium text-text-faint bg-card border border-border rounded-control px-1.5 py-px">
              Cmd K
            </kbd>
          </button>

          <NotificationBell />
        </>
      )}

      <ThemeSelector />

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
