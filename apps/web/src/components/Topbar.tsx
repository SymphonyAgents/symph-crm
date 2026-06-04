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
          className="flex h-11 w-11 items-center justify-center rounded-lg border border-black/[.06] bg-slate-100 text-slate-600 transition-colors hover:bg-slate-200 dark:border-white/[.08] dark:bg-white/[.06] dark:text-slate-300 dark:hover:bg-white/[.1] sm:h-8 sm:w-8"
          aria-label={`Change color mode. Current mode: ${activeOption.label}`}
          title={activeOption.label}
        >
          <ActiveIcon size={14} strokeWidth={1.6} className="text-primary" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[220px] p-1.5">
        <div className="px-2 pb-1 pt-1">
          <p className="text-xxs font-semibold uppercase tracking-[0.08em] text-slate-400 dark:text-slate-500">Color mode</p>
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
                    : 'text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-white/[.06]',
                )}
              >
                <Icon size={15} strokeWidth={1.6} className="shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-semibold">{option.label}</span>
                  <span className={cn('block truncate text-atom', isActive ? 'text-primary/75' : 'text-slate-400 dark:text-slate-500')}>
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
    <div className="h-[44px] shrink-0 border-b border-black/[.06] dark:border-white/[.08] flex items-center px-4 gap-3 bg-card">
      {/* Hamburger — mobile only */}
      <button
        onClick={onMenuToggle}
        className="md:hidden w-11 h-11 flex items-center justify-center rounded text-slate-500 hover:bg-slate-100 dark:hover:bg-white/[.06] dark:bg-white/[.06] transition-colors duration-150"
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
            <kbd className="hidden sm:inline text-atom font-medium text-slate-400 bg-card border border-black/[.08] dark:border-white/[.08] rounded px-1.5 py-px">
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
          className="md:hidden w-11 h-11 flex items-center justify-center rounded text-slate-500 hover:bg-slate-100 dark:hover:bg-white/[.06] dark:bg-white/[.06] transition-colors duration-150"
        >
          <MessageSquare size={16} strokeWidth={1.4} />
        </button>
      )}

      <div className="flex-1 md:block hidden" />
    </div>
  )
}
