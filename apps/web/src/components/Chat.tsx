'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import imageCompression from 'browser-image-compression'
import { useChatSidebar } from '@/lib/chat-sidebar-context'
import {
  cn, getGreeting, formatDuration, getAudioMimeType, mimeToExt,
} from '@/lib/utils'
import type { ActionRecord, ChatMessage, PendingAttachment } from '@/lib/types'
import {
  DEFAULT_WORKSPACE_ID, ACCEPTED_FILE_TYPES, SUGGESTED_PROMPTS, TOOL_LABELS,
} from '@/lib/constants'
import { PasteChip, PastePreviewModal } from './PasteChip'
import { Popover, PopoverTrigger, PopoverContent } from './ui/popover'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from './ui/tooltip'
import { useGetChatSessions, useGetChatHistory } from '@/lib/hooks/queries'
import { useCreateChatSession, useDeleteChatSession } from '@/lib/hooks/mutations'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'
import { useChatTyping } from '@/lib/chat-typing-context'

// ─── Sub-components ───────────────────────────────────────────────────────────

function ActionPills({ actions }: { actions: ActionRecord[] }) {
  if (!actions.length) return null
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {actions.map((a, i) => (
        <span
          key={i}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary-dim border border-primary-border text-xxs font-medium text-primary"
        >
          <svg width={8} height={8} viewBox="0 0 24 24" fill="currentColor">
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
          </svg>
          {TOOL_LABELS[a.tool] ?? a.tool}
        </span>
      ))}
    </div>
  )
}

function AttachmentBubble({ attachment }: { attachment: PendingAttachment }) {
  if (attachment.type === 'image' && attachment.previewUrl) {
    return (
      <div className="flex justify-end mb-1">
        <img
          src={attachment.previewUrl}
          alt={attachment.filename}
          className="max-w-[200px] max-h-[150px] rounded-lg border border-black/[.08] dark:border-white/[.08] object-cover"
        />
      </div>
    )
  }

  const icon =
    attachment.type === 'voice' ? (
      <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
        <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
        <line x1="12" y1="19" x2="12" y2="23"/>
        <line x1="8" y1="23" x2="16" y2="23"/>
      </svg>
    ) : (
      <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/>
        <polyline points="13 2 13 9 20 9"/>
      </svg>
    )

  const label =
    attachment.type === 'voice' && attachment.duration
      ? `Voice note · ${formatDuration(attachment.duration)}`
      : attachment.filename

  return (
    <div className="flex justify-end mb-1">
      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary-dim border border-primary-border text-xs text-slate-600 dark:text-slate-400">
        {icon}
        <span className="max-w-[160px] truncate">{label}</span>
      </div>
    </div>
  )
}

function AttachmentPreview({
  attachment,
  onRemove,
}: {
  attachment: PendingAttachment
  onRemove: () => void
}) {
  return (
    <div className="px-4 pt-2 pb-1 flex items-center gap-2">
      {attachment.type === 'image' && attachment.previewUrl ? (
        <img
          src={attachment.previewUrl}
          alt={attachment.filename}
          className="w-10 h-10 rounded-lg object-cover border border-black/[.08] dark:border-white/[.08] shrink-0"
        />
      ) : (
        <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-white/[.06] flex items-center justify-center shrink-0">
          {attachment.type === 'voice' ? (
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
              <line x1="12" y1="19" x2="12" y2="23"/>
            </svg>
          ) : (
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/>
              <polyline points="13 2 13 9 20 9"/>
            </svg>
          )}
        </div>
      )}

      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">{attachment.filename}</p>
        <p className="text-xxs text-slate-400 capitalize">
          {attachment.type === 'voice' && attachment.duration
            ? `Voice · ${formatDuration(attachment.duration)}`
            : attachment.type}
        </p>
      </div>

      <button
        onClick={onRemove}
        className="w-6 h-6 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[.06] dark:bg-white/[.06] transition-colors shrink-0"
      >
        <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
  )
}

// ─── Audio Visualizer ─────────────────────────────────────────────────────────

function AudioVisualizer({ analyser }: { analyser: AnalyserNode | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const frameRef = useRef<number | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!analyser || !canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    analyser.fftSize = 64
    analyser.smoothingTimeConstant = 0.82
    const BAR_COUNT = analyser.frequencyBinCount  // 32
    const BAR_GAP = 2.5

    function draw() {
      if (!analyser || !canvas || !ctx) return

      const dataArray = new Uint8Array(BAR_COUNT)
      analyser.getByteFrequencyData(dataArray)

      const { width, height } = canvas
      ctx.clearRect(0, 0, width, height)

      const totalGap = (BAR_COUNT - 1) * BAR_GAP
      const barWidth = (width - totalGap) / BAR_COUNT
      const centerY = height / 2

      for (let i = 0; i < BAR_COUNT; i++) {
        const raw = dataArray[i] / 255
        const amplitude = Math.max(0.06, raw)     // always-visible minimum
        const halfH = amplitude * centerY * 0.88
        const x = i * (barWidth + BAR_GAP)

        // opacity: dim baseline bars, bright active ones
        ctx.globalAlpha = 0.25 + raw * 0.75
        ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim() || '#6c63ff'
        ctx.beginPath()
        // roundRect: x, y, w, h, radius
        ctx.roundRect(x, centerY - halfH, barWidth, halfH * 2, 1.5)
        ctx.fill()
      }

      ctx.globalAlpha = 1
      frameRef.current = requestAnimationFrame(draw)
    }

    draw()

    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
    }
  }, [analyser])

  return (
    <canvas
      ref={canvasRef}
      width={220}
      height={36}
      className="flex-1 min-w-0"
      style={{ maxWidth: '220px' }}
    />
  )
}

// ─── Recording indicator ──────────────────────────────────────────────────────

function RecordingIndicator({
  elapsed,
  analyser,
  onStop,
}: {
  elapsed: number
  analyser: AnalyserNode | null
  onStop: () => void
}) {
  return (
    <div className="px-4 pt-3 pb-1 flex items-center gap-3">
      {/* Mic + timer */}
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
        <span className="text-xxs font-medium text-slate-500 tabular-nums w-[32px]">
          {formatDuration(elapsed)}
        </span>
      </div>

      {/* Visualizer */}
      <AudioVisualizer analyser={analyser} />

      {/* Stop */}
      <button
        onClick={onStop}
        className="shrink-0 h-7 px-3 rounded-lg bg-red-50 border border-red-200 text-xxs font-semibold text-red-600 hover:bg-red-100 active:scale-[0.96] transition-all"
      >
        Stop
      </button>
    </div>
  )
}

function renderContent(text: string) {
  return text.split('\n').map((line, lineIdx) => {
    const parts = line.split(/(\*\*.*?\*\*)/)
    const rendered = parts.map((part, partIdx) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={partIdx} className="font-semibold text-slate-900 dark:text-white">{part.slice(2, -2)}</strong>
      }
      return <span key={partIdx}>{part}</span>
    })
    return (
      <span key={lineIdx}>
        {lineIdx > 0 && <br />}
        {rendered}
      </span>
    )
  })
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 py-2">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-slate-400"
          style={{
            animation: 'typingDot 1.2s ease-in-out infinite',
            animationDelay: `${i * 0.2}s`,
          }}
        />
      ))}
    </div>
  )
}


// ─── Session Sidebar ──────────────────────────────────────────────────────────

function SessionSidebar({
  sessions,
  activeSessionId,
  onSelect,
  onNewChat,
  onDeleteSession,
  isOpen,
  onToggle,
  expanded,
  onToggleExpand,
}: {
  sessions: { id: string; title: string | null; updatedAt: string; contextType: string | null }[]
  activeSessionId: string | undefined
  onSelect: (id: string) => void
  onNewChat: () => void
  onDeleteSession: (id: string) => void
  isOpen: boolean
  onToggle: () => void
  expanded: boolean
  onToggleExpand: () => void
}) {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const { isOpen: isMobileOpen, close: closeMobile } = useChatSidebar()
  const { typingSessions, unreadSessions } = useChatTyping()

  // ── Session list (shared between mobile overlay and desktop panel) ──────────
  const sessionList = (
    <TooltipProvider delayDuration={300}>
    <div className="flex-1 overflow-y-auto px-1.5 pb-3">
      {sessions.length === 0 ? (
        <div className={cn('py-6 text-center', expanded ? 'px-3' : 'px-1')}>
          {expanded && <p className="text-xxs text-slate-400">No conversations yet</p>}
        </div>
      ) : (
        <div className="flex flex-col gap-0.5">
          {sessions.map((s) => {
            const isActive = s.id === activeSessionId
            const label = s.title || s.id.slice(0, 8)
            const isMenuOpen = openMenuId === s.id
            const isSessionTyping = !!typingSessions[s.id]
            const isUnread = !!unreadSessions[s.id] && !isActive
            return (
              <div key={s.id} className="relative">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => onSelect(s.id)}
                      onKeyDown={e => e.key === 'Enter' && onSelect(s.id)}
                      className={cn(
                        'w-full text-left rounded-md transition-colors group cursor-pointer',
                        expanded ? 'p-1.5' : 'p-1.5 flex items-center justify-center',
                        isActive
                          ? 'bg-primary/10 text-primary'
                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/[.04]'
                      )}
                    >
                      {expanded ? (
                        <div className="flex items-center gap-2 min-w-0">
                          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" className="shrink-0 opacity-50">
                            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                          </svg>
                          <span className={cn('text-xs truncate flex-1', isUnread || isSessionTyping ? 'font-semibold text-slate-900 dark:text-white' : 'font-medium')}>{label}</span>
                          {/* Typing animation — Aria still formulating */}
                          {isSessionTyping && (
                            <span className="flex items-center gap-[2px] shrink-0">
                              {[0, 1, 2].map(i => (
                                <span key={i} className="w-1 h-1 rounded-full bg-primary" style={{ animation: 'typingDot 1.2s ease-in-out infinite', animationDelay: `${i * 0.2}s` }} />
                              ))}
                            </span>
                          )}
                          {/* Unread dot — response arrived while user was away */}
                          {isUnread && !isSessionTyping && (
                            <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                          )}
                          <Popover open={isMenuOpen} onOpenChange={(open) => setOpenMenuId(open ? s.id : null)}>
                            <PopoverTrigger asChild>
                              <button
                                onClick={(e) => e.stopPropagation()}
                                className="shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/[.08] opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <svg width={14} height={14} viewBox="0 0 24 24" fill="currentColor">
                                  <circle cx="5" cy="12" r="2" />
                                  <circle cx="12" cy="12" r="2" />
                                  <circle cx="19" cy="12" r="2" />
                                </svg>
                              </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-32 p-1" align="end">
                              <button
                                onClick={() => { setOpenMenuId(null); onDeleteSession(s.id) }}
                                className="w-full text-left px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors flex items-center gap-2 rounded"
                              >
                                <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                                  <polyline points="3 6 5 6 21 6" />
                                  <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                                </svg>
                                Delete
                              </button>
                            </PopoverContent>
                          </Popover>
                        </div>
                      ) : (
                        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" className="opacity-60">
                          <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                        </svg>
                      )}
                    </div>
                  </TooltipTrigger>
                  {!expanded && <TooltipContent side="right">{label}</TooltipContent>}
                </Tooltip>
              </div>
            )
          })}
        </div>
      )}
    </div>
    </TooltipProvider>
  )

  return (
    <>
      {/* ── Mobile overlay — only rendered when open, no z-index tricks ──── */}
      {isMobileOpen && (
        <div className="lg:hidden">
          <div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            onClick={closeMobile}
          />
          <div className="fixed top-0 left-0 h-full w-[260px] z-50 flex flex-col bg-white dark:bg-[#16171a] border-r border-black/[.06] dark:border-white/[.08]">
            <div className="px-1.5 pt-3 pb-2 shrink-0 flex flex-col gap-1.5">
              <Link
                href="/"
                onClick={closeMobile}
                className="flex items-center gap-2 px-2.5 py-1.5 mx-1.5 rounded-md text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[.06] transition-colors"
              >
                <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                  <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
                Dashboard
              </Link>
              <div className="px-1.5">
                <button
                  onClick={onNewChat}
                  className="w-full h-9 rounded-md border border-black/[.08] dark:border-white/[.1] bg-white dark:bg-white/[.04] hover:bg-slate-50 dark:hover:bg-white/[.06] flex items-center gap-2 px-3 text-xs font-semibold text-slate-600 dark:text-slate-300 transition-colors"
                >
                  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  New Chat
                </button>
              </div>
            </div>
            {sessionList}
          </div>
        </div>
      )}

      {/* ── Desktop sidebar — always visible, relative in flex flow ────── */}
      <div
        className={cn(
          'hidden lg:flex lg:relative shrink-0 h-full flex-col bg-white dark:bg-[#16171a] border-r border-black/[.06] dark:border-white/[.08] transition-all duration-200 ease-out',
          expanded ? 'lg:w-[260px]' : 'lg:w-[52px]',
        )}
      >
        {/* Header + New Chat + Collapse toggle */}
        <div className="px-1.5 pt-3 pb-2 shrink-0 flex flex-col gap-1.5">
          {expanded ? (
            <>
              {/* Back to dashboard */}
              <Link
                href="/"
                className="flex items-center gap-2 px-2.5 py-1.5 mx-1.5 rounded-md text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[.06] transition-colors"
              >
                <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                  <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
                Dashboard
              </Link>
              <div className="flex items-center gap-1.5 px-1.5">
                <button
                  onClick={onNewChat}
                  className="flex-1 h-9 rounded-md border border-black/[.08] dark:border-white/[.1] bg-white dark:bg-white/[.04] hover:bg-slate-50 dark:hover:bg-white/[.06] flex items-center gap-2 px-3 text-xs font-semibold text-slate-600 dark:text-slate-300 transition-colors"
                >
                  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  New Chat
                </button>
                <button
                  onClick={onToggleExpand}
                  title="Collapse sidebar"
                  className="h-9 w-9 shrink-0 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/[.06] transition-colors"
                >
                  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <path d="M9 3v18" />
                    <path d="M14 9l-3 3 3 3" />
                  </svg>
                </button>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center gap-1.5">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    href="/"
                    className="h-9 w-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/[.06] transition-colors"
                  >
                    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                      <polyline points="9 22 9 12 15 12 15 22" />
                    </svg>
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right">Dashboard</TooltipContent>
              </Tooltip>
              <button
                onClick={onToggleExpand}
                title="Expand sidebar"
                className="h-9 w-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/[.06] transition-colors"
              >
                <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <path d="M9 3v18" />
                  <path d="M13 15l3-3-3-3" />
                </svg>
              </button>
              <button
                onClick={onNewChat}
                title="New Chat"
                className="h-9 w-9 rounded-lg border border-black/[.08] dark:border-white/[.1] bg-white dark:bg-white/[.04] hover:bg-slate-50 dark:hover:bg-white/[.06] flex items-center justify-center text-slate-600 dark:text-slate-300 transition-colors"
              >
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </button>
            </div>
          )}
        </div>

        {sessionList}
      </div>
    </>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function Chat({ dealId }: { dealId?: string }) {
  const { data: session } = useSession()
  const queryClient = useQueryClient()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { typingSessions, unreadSessions, setTyping: setTypingCtx, markUnread, markRead } = useChatTyping()
  const { close: closeSessionSidebar } = useChatSidebar()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [sessionId, setSessionId] = useState<string | undefined>(
    () => searchParams.get('session') ?? undefined,
  )
  const [input, setInput] = useState('')
  const [focused, setFocused] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)

  // Typing indicator for the CURRENT session only
  const isTyping = !!(sessionId && typingSessions[sessionId])

  // Sidebar desktop expand state (mobile open/close is handled via ChatSidebarContext)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarExpanded, setSidebarExpanded] = useState(true)

  // Attachment state
  const [pendingAttachment, setPendingAttachment] = useState<PendingAttachment | null>(null)
  const [recording, setRecording] = useState(false)
  const [recordingElapsed, setRecordingElapsed] = useState(0)
  const [attachmentError, setAttachmentError] = useState<string | null>(null)
  // Live AnalyserNode — passed to AudioVisualizer while recording
  const [liveAnalyser, setLiveAnalyser] = useState<AnalyserNode | null>(null)

  // Paste chips — each bulk paste creates a new chip (array, not singular)
  const [pasteChips, setPasteChips] = useState<string[]>([])
  const [pastePreviewText, setPastePreviewText] = useState<string | null>(null)

  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const recordingStartRef = useRef<number>(0)
  const audioContextRef = useRef<AudioContext | null>(null)
  // Ref that always reflects the latest sessionId so async callbacks can
  // check whether the session is still active without stale-closure issues.
  const sessionIdRef = useRef<string | undefined>(sessionId)
  useEffect(() => { sessionIdRef.current = sessionId }, [sessionId])

  const userName = session?.user?.name?.split(' ')[0] || 'there'
  const userId = (session?.user as { id?: string })?.id || 'anonymous'

  // Session management hooks
  const { data: chatSessions = [] } = useGetChatSessions(userId !== 'anonymous' ? userId : null)
  const createSession = useCreateChatSession({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.chatSessions.byUser(userId) })
    },
  })
  const deleteSession = useDeleteChatSession({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.chatSessions.byUser(userId) })
    },
  })
  const { data: historyMessages, isLoading: loadingHistory } = useGetChatHistory(sessionId)

  // Load history when switching sessions — set messages unconditionally when data arrives
  useEffect(() => {
    if (historyMessages !== undefined) {
      const loaded: ChatMessage[] = historyMessages.map((m) => ({
        id: m.id,
        role: m.role as 'user' | 'assistant',
        content: m.content,
        actionsTaken: (m.actionsTaken ?? []) as ActionRecord[],
      }))
      setMessages(loaded)
    }
  }, [historyMessages])

  const handleSelectSession = useCallback((id: string) => {
    setSessionId(id)
    setMessages([])
    markRead(id)       // clear unread badge on the session we're navigating to
    setApiError(null)
    setSidebarOpen(false)
    closeSessionSidebar()
    router.replace(`/chat?session=${id}`)
  }, [markRead, router, closeSessionSidebar])

  const handleNewChat = useCallback(() => {
    setSessionId(undefined)
    setMessages([])
    // Don't touch typing state — ongoing responses for other sessions keep streaming
    setApiError(null)
    setInput('')
    setPasteChips([])
    setPendingAttachment(null)
    setSidebarOpen(false)
    closeSessionSidebar()
    router.replace('/chat')
  }, [router, closeSessionSidebar])

  const handleDeleteSession = useCallback((id: string) => {
    deleteSession.mutate(id)
    if (sessionId === id) {
      setSessionId(undefined)
      setMessages([])
      setApiError(null)
      router.replace('/chat')
    }
  }, [deleteSession, sessionId, router])

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 300)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 160) + 'px'
  }, [input])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  // ── Image compression ────────────────────────────────────────────────────

  const compressImage = useCallback(async (file: File): Promise<File> => {
    try {
      return await imageCompression(file, {
        maxSizeMB: 1,
        maxWidthOrHeight: 1920,
        useWebWorker: true,
      })
    } catch {
      return file // if compression fails, use original
    }
  }, [])

  // ── Attachment helpers ───────────────────────────────────────────────────

  const setImageAttachment = useCallback(async (file: File) => {
    const compressed = await compressImage(file)
    const previewUrl = URL.createObjectURL(compressed)
    setPendingAttachment({
      type: 'image',
      filename: compressed.name || file.name,
      blob: compressed,
      mimetype: compressed.type || file.type,
      previewUrl,
    })
  }, [compressImage])

  const handleFileSelected = useCallback(async (file: File) => {
    setAttachmentError(null)
    const ACCEPTED_MIMES = new Set([
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/plain',
      'text/markdown',
      'text/csv',
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
      'audio/webm',
      'audio/mp4',
      'audio/x-m4a',
    ])
    // Some browsers report empty MIME for .md files — fall back to extension check
    const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
    const ACCEPTED_EXTS = new Set(['md', 'txt', 'csv', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'jpg', 'jpeg', 'png', 'webp', 'gif', 'webm', 'm4a'])
    if (!ACCEPTED_MIMES.has(file.type) && !ACCEPTED_EXTS.has(ext)) {
      setAttachmentError(`Unsupported file type: ${file.type || ext}. Accepted: PDF, DOCX, XLSX, TXT, MD, CSV, images, audio (webm, m4a).`)
      return
    }
    const isImage = file.type.startsWith('image/')
    if (isImage) {
      await setImageAttachment(file)
    } else {
      setPendingAttachment({
        type: 'file',
        filename: file.name,
        blob: file,
        mimetype: file.type,
      })
    }
  }, [setImageAttachment])

  // ── Paste handler (detect clipboard images) ──────────────────────────────

  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData.items)

    // Image paste → attachment
    const imageItem = items.find(item => item.type.startsWith('image/'))
    if (imageItem) {
      e.preventDefault()
      const file = imageItem.getAsFile()
      if (!file) return
      const filename = `screenshot-${Date.now()}.${file.type.split('/')[1] || 'png'}`
      const namedFile = new File([file], filename, { type: file.type })
      await setImageAttachment(namedFile)
      return
    }

    // Bulk text paste → add a new chip (stacks, doesn't replace)
    const text = e.clipboardData.getData('text/plain')
    if (text && (text.length > 80 || text.includes('\n'))) {
      e.preventDefault()
      setPasteChips(prev => [...prev, text])
    }
  }, [setImageAttachment])

  // ── Drag-and-drop handlers ──────────────────────────────────────────────

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.dataTransfer.types.includes('Files')) {
      setDragOver(true)
    }
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
  }, [])

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) {
      await handleFileSelected(file)
    }
  }, [handleFileSelected])

  // ── Voice recording ──────────────────────────────────────────────────────

  const startRecording = useCallback(async () => {
    setAttachmentError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = getAudioMimeType()
      const recorder = new MediaRecorder(stream, { mimeType })

      // ── Web Audio API visualizer setup ───────────────────────────────────
      const audioCtx = new AudioContext()
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 64
      analyser.smoothingTimeConstant = 0.82
      const source = audioCtx.createMediaStreamSource(stream)
      source.connect(analyser)
      audioContextRef.current = audioCtx
      setLiveAnalyser(analyser)
      // ─────────────────────────────────────────────────────────────────────

      audioChunksRef.current = []
      recorder.ondataavailable = e => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data)
      }

      recorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop())
        // Close audio context and clear analyser
        audioCtx.close().catch(() => {})
        audioContextRef.current = null
        setLiveAnalyser(null)

        const blob = new Blob(audioChunksRef.current, { type: mimeType })
        const ext = mimeToExt(mimeType)
        const duration = (Date.now() - recordingStartRef.current) / 1000
        setPendingAttachment({
          type: 'voice',
          filename: `voice-${Date.now()}.${ext}`,
          blob,
          mimetype: mimeType,
          duration,
        })
        setRecording(false)
        setRecordingElapsed(0)
        if (recordingTimerRef.current) clearInterval(recordingTimerRef.current)
      }

      mediaRecorderRef.current = recorder
      recordingStartRef.current = Date.now()
      recorder.start(200)
      setRecording(true)
      setRecordingElapsed(0)

      recordingTimerRef.current = setInterval(() => {
        setRecordingElapsed(Math.floor((Date.now() - recordingStartRef.current) / 1000))
      }, 1000)
    } catch (err) {
      const isDenied = err instanceof DOMException && err.name === 'NotAllowedError'
      setAttachmentError(
        isDenied
          ? 'Microphone access denied — allow it in your browser settings.'
          : 'Could not start recording. Check your microphone.'
      )
    }
  }, [])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
  }, [])

  const toggleRecording = useCallback(() => {
    if (recording) stopRecording()
    else startRecording()
  }, [recording, startRecording, stopRecording])

  const clearAttachment = useCallback(() => {
    if (pendingAttachment?.previewUrl) {
      URL.revokeObjectURL(pendingAttachment.previewUrl)
    }
    setPendingAttachment(null)
    setAttachmentError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [pendingAttachment])

  // ── Send message ─────────────────────────────────────────────────────────

  async function sendMessage(text: string, attachment?: PendingAttachment) {
    // Auto-create session if none active
    let activeSessionId = sessionId
    if (!activeSessionId) {
      try {
        const newSession = await createSession.mutateAsync({
          userId,
          workspaceId: '60f84f03-283e-4c1a-8c88-b8330dc71d32',
          dealId,
          title: text.slice(0, 60) || 'New chat',
        })
        activeSessionId = newSession.id
        setSessionId(newSession.id)
        sessionIdRef.current = newSession.id
        // Refresh sidebar session list immediately
        queryClient.invalidateQueries({ queryKey: queryKeys.chatSessions.byUser(userId) })
        // Sync URL so the session survives page navigation
        router.replace(`/chat?session=${newSession.id}`)
      } catch (err) {
        setApiError('Failed to create chat session')
        return
      }
    }

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: text,
      attachment,
    }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setPendingAttachment(null)
    setPasteChips([])
    if (attachment?.previewUrl) URL.revokeObjectURL(attachment.previewUrl)
    setTypingCtx(activeSessionId, true)
    setApiError(null)

    // Persist the user message to DB immediately so it survives page
    // navigation (e.g. new-session redirect). Awaited to guarantee the
    // message is in the DB before history is fetched on the new page.
    try {
      await fetch(`/api/chat/sessions/${activeSessionId}/messages/user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
        body: JSON.stringify({ userId, userMessage: text }),
      })
    } catch (err) {
      console.error('[Chat] pre-save user message failed:', err)
      // Non-fatal: the Aria route also saves the user message as fallback
    }

    const assistantMsgId = `a-${Date.now()}`

    try {
      // Prepare request body
      let attachmentData: { filename: string; mimeType: string; base64: string } | undefined
      if (attachment) {
        const reader = new FileReader()
        attachmentData = await new Promise((resolve, reject) => {
          reader.onload = () => {
            const base64 = (reader.result as string).split(',')[1] || ''
            resolve({
              filename: attachment.filename,
              mimeType: attachment.mimetype,
              base64,
            })
          }
          reader.onerror = reject
          reader.readAsDataURL(attachment.blob)
        })
      }

      // Call Aria streaming endpoint
      const res = await fetch('/api/chat/aria', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: text,
          userId,
          userName: 'AM',
          sessionId: activeSessionId,
          dealId,
          attachment: attachmentData,
        }),
      })

      if (!res.ok) {
        const errText = await res.text()
        throw new Error(`API error ${res.status}: ${errText}`)
      }

      // Stream response
      let assistantText = ''
      const actions: ActionRecord[] = []
      const reader = res.body?.getReader()
      if (!reader) throw new Error('No response body')

      const decoder = new TextDecoder()
      let buffer = ''

      // Initialize assistant message placeholder
      setMessages(prev => [
        ...prev,
        {
          id: assistantMsgId,
          role: 'assistant',
          content: '',
          actionsTaken: [],
        },
      ])

      // Aria gateway sends proper SSE named events:
      //   id: 1\nevent: text\ndata: {"text":"..."}\n\n
      //   id: 2\nevent: done\ndata: {}\n\n
      // Track the current event type from `event:` lines, then use it
      // when the matching `data:` line arrives.
      let currentEventType = ''
      let streamDone = false

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEventType = line.slice(7).trim()
          } else if (line.startsWith('data: ')) {
            try {
              const payload = JSON.parse(line.slice(6)) as Record<string, unknown>

              if (currentEventType === 'text' && typeof payload.text === 'string') {
                assistantText += payload.text
                setMessages(prev =>
                  prev.map(m =>
                    m.id === assistantMsgId
                      ? { ...m, content: assistantText, actionsTaken: actions }
                      : m,
                  ),
                )
              } else if (currentEventType === 'action') {
                // Gateway sends: { type: string, payload: Record<string,unknown> }
                const actionType = typeof payload.type === 'string' ? payload.type : 'tool'
                const actionPayload = (payload.payload ?? {}) as Record<string, unknown>
                actions.push({ tool: actionType, input: actionPayload, result: {} })
                setMessages(prev =>
                  prev.map(m =>
                    m.id === assistantMsgId ? { ...m, actionsTaken: actions } : m,
                  ),
                )
              } else if (currentEventType === 'error') {
                const msg = typeof payload.message === 'string' ? payload.message : 'Stream error'
                throw new Error(msg)
              } else if (currentEventType === 'done') {
                streamDone = true
              }
            } catch (parseErr) {
              // Re-throw intentional stream errors; swallow JSON parse failures
              if (parseErr instanceof Error && parseErr.message !== 'Unexpected end of JSON input') {
                const isStreamError = currentEventType === 'error'
                if (isStreamError) throw parseErr
              }
              console.error('Failed to parse stream event:', line, parseErr)
            }
            currentEventType = ''
          }
        }

        if (streamDone) {
          reader.cancel().catch(() => {})
          break
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      setApiError(msg)
      setMessages(prev => [
        ...prev,
        { id: `err-${Date.now()}`, role: 'assistant', content: 'Something went wrong. Please try again.' },
      ])
    } finally {
      // Always clear the typing state for this session.
      setTypingCtx(activeSessionId, false)
      // If the user switched to a different session while this one was streaming,
      // mark it as unread so the session nav shows a visual indicator.
      if (sessionIdRef.current !== activeSessionId) {
        markUnread(activeSessionId)
      }
    }
  }

  function handleSubmit() {
    const trimmed = input.trim()
    // Join all paste chips + typed text into one message
    const parts = [...(trimmed ? [trimmed] : []), ...pasteChips].filter(Boolean)
    const textToSend = parts.join('\n\n')
    if ((!textToSend && !pendingAttachment) || isTyping) return
    sendMessage(textToSend, pendingAttachment ?? undefined)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const canSubmit = (input.trim() || pendingAttachment || pasteChips.length > 0) && !isTyping

  // ── Input box ────────────────────────────────────────────────────────────

  const inputBox = (
    <div className="max-w-[680px] w-full mx-auto">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          'relative rounded-lg bg-white dark:bg-[#1e1e21] transition-all duration-150',
          dragOver
            ? 'border-2 border-dashed border-primary shadow-[0_0_0_3px_rgba(var(--primary-rgb,99,102,241),0.15)]'
            : focused
              ? 'border border-black/20 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_0_0_3px_rgba(0,0,0,0.05)]'
              : 'border border-black/[.08] dark:border-white/[.08] shadow-[var(--shadow-card)]'
        )}
      >
        {/* Drag overlay hint */}
        {dragOver && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-primary/5 pointer-events-none">
            <span className="text-sm font-medium text-primary">Drop file here</span>
          </div>
        )}
        {/* Recording indicator + visualizer */}
        {recording && (
          <RecordingIndicator
            elapsed={recordingElapsed}
            analyser={liveAnalyser}
            onStop={stopRecording}
          />
        )}

        {/* Attachment preview */}
        {pendingAttachment && !recording && (
          <AttachmentPreview attachment={pendingAttachment} onRemove={clearAttachment} />
        )}

        {/* Paste chips — stacked, each independently removable */}
        {pasteChips.length > 0 && !recording && (
          <div className="flex flex-wrap gap-x-0">
            {pasteChips.map((chip, i) => (
              <PasteChip
                key={i}
                text={chip}
                onRemove={() => setPasteChips(prev => prev.filter((_, idx) => idx !== i))}
                onClick={() => setPastePreviewText(chip)}
              />
            ))}
          </div>
        )}

        <div className={cn('px-4 pt-4 pb-2', (pendingAttachment || pasteChips.length > 0 || recording) && 'pt-3')}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={
              pendingAttachment
                ? 'Add a message, or just send the attachment…'
                : recording
                ? 'Recording… press Stop when done'
                : 'How can I help you today?'
            }
            disabled={isTyping}
            rows={1}
            className={cn(
              'w-full bg-transparent border-none outline-none text-sm text-slate-900 dark:text-white leading-[1.6] resize-none overflow-hidden placeholder:text-slate-400',
              isTyping && 'opacity-50'
            )}
            style={{ minHeight: '28px', maxHeight: '160px' }}
          />
        </div>

        {/* Attachment / mic error */}
        {attachmentError && (
          <div className="mx-4 mb-1 mt-0.5 flex items-center gap-1.5 text-xxs text-red-500">
            <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            {attachmentError}
          </div>
        )}

        <div className="flex items-center gap-1.5 px-3 pb-3 pt-1">
          {/* File picker */}
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_FILE_TYPES}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleFileSelected(file)
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isTyping || recording}
            title="Attach file or image"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[.06] dark:bg-white/[.06] transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>

          {/* Voice record */}
          <button
            type="button"
            onClick={toggleRecording}
            disabled={isTyping || !!pendingAttachment}
            title={recording ? 'Stop recording' : 'Record voice note'}
            className={cn(
              'w-8 h-8 rounded-lg flex items-center justify-center transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed',
              recording
                ? 'text-red-500 bg-red-50 hover:bg-red-100'
                : 'text-slate-400 hover:text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[.06] dark:bg-white/[.06]'
            )}
          >
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
              <line x1="12" y1="19" x2="12" y2="23"/>
              <line x1="8" y1="23" x2="16" y2="23"/>
            </svg>
          </button>

          <div className="flex-1" />

          <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-slate-400">
            <span className="text-xs font-medium">Symph AI</span>
            {sessionId && (
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 ml-0.5" title="Session active" />
            )}
          </div>

          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={cn(
              'w-8 h-8 rounded-lg flex items-center justify-center transition-colors duration-150 active:scale-[0.94]',
              canSubmit
                ? 'bg-primary hover:bg-primary-hover cursor-pointer'
                : 'bg-slate-100 dark:bg-white/[.06] cursor-default'
            )}
          >
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={canSubmit ? '#fff' : '#94a3b8'} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="19" x2="12" y2="5" />
              <polyline points="5 12 12 5 19 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )

  // ── Empty state ──────────────────────────────────────────────────────────

  // Only show empty state when there's no active session — if sessionId is set we're loading/showing history
  const isEmpty = messages.length === 0 && !isTyping && !sessionId && !loadingHistory

  if (isEmpty) {
    return (
      <div className="h-full flex">
        <SessionSidebar
          sessions={chatSessions}
          activeSessionId={sessionId}
          onSelect={handleSelectSession}
          onNewChat={handleNewChat}
          onDeleteSession={handleDeleteSession}
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen(p => !p)}
          expanded={sidebarExpanded}
          onToggleExpand={() => setSidebarExpanded(p => !p)}
        />
        <div className="flex-1 min-w-0 flex flex-col">
        <div
          ref={containerRef}
          className="h-full flex flex-col items-center justify-center px-6"
        >
          <div className="flex flex-col items-center gap-6 max-w-[680px] w-full">
            <div className="flex items-center gap-3 mb-2">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-white text-sbase shrink-0"
                style={{ background: 'linear-gradient(135deg, var(--primary), var(--color-primary-accent))' }}
              >
                S
              </div>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight leading-none">
                {getGreeting()}, {userName}
              </h1>
            </div>

            {apiError && (
              <p className="text-xs text-red-500 text-center -mb-2">{apiError}</p>
            )}

            {inputBox}

            <div className="flex flex-wrap gap-2 justify-center">
              {SUGGESTED_PROMPTS.map((p) => (
                <button
                  key={p.prompt}
                  type="button"
                  onClick={() => sendMessage(p.prompt)}
                  className="px-3.5 py-2 rounded-lg bg-white dark:bg-[#1e1e21] border border-black/[.08] dark:border-white/[.08] text-xs font-medium text-slate-600 dark:text-slate-400 hover:border-slate-300 hover:text-slate-900 dark:text-white active:scale-[0.98] transition-colors duration-150 shadow-[var(--shadow-card)]"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        {pastePreviewText && (
          <PastePreviewModal text={pastePreviewText} onClose={() => setPastePreviewText(null)} />
        )}
        </div>
      </div>
    )
  }

  // ── Loading history skeleton (session selected, waiting for messages) ──────
  if (sessionId && loadingHistory && messages.length === 0) {
    return (
      <div className="h-full flex">
        <SessionSidebar
          sessions={chatSessions}
          activeSessionId={sessionId}
          onSelect={handleSelectSession}
          onNewChat={handleNewChat}
          onDeleteSession={handleDeleteSession}
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen(p => !p)}
          expanded={sidebarExpanded}
          onToggleExpand={() => setSidebarExpanded(p => !p)}
        />
        <div className="flex-1 min-w-0 h-full flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-[680px] w-full mx-auto px-6 pt-8 pb-4 flex flex-col gap-5">
              {[1, 2, 3].map(i => (
                <div key={i} className={`flex ${i % 2 === 0 ? 'justify-end' : 'justify-start'}`}>
                  <div className={`h-10 rounded-xl bg-slate-100 dark:bg-white/[.06] animate-pulse ${i % 2 === 0 ? 'w-48' : 'w-64'}`} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Active chat ──────────────────────────────────────────────────────────

  return (
    <div className="h-full flex">
      <SessionSidebar
        sessions={chatSessions}
        activeSessionId={sessionId}
        onSelect={handleSelectSession}
        onNewChat={handleNewChat}
        onDeleteSession={handleDeleteSession}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(p => !p)}
        expanded={sidebarExpanded}
        onToggleExpand={() => setSidebarExpanded(p => !p)}
      />
      <div ref={containerRef} className="flex-1 min-w-0 h-full flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[680px] w-full mx-auto px-6 pt-8 pb-4 flex flex-col gap-5">
          {messages.map((msg) => (
            <div key={msg.id}>
              {msg.role === 'user' ? (
                <div>
                  {msg.attachment && <AttachmentBubble attachment={msg.attachment} />}
                  {msg.content && (
                    <div className="flex justify-end">
                      <div className="max-w-[78%] px-4 py-3 rounded-lg bg-primary-dim border border-primary-border text-ssm text-slate-900 dark:text-white leading-[1.6]">
                        {msg.content}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <div className="text-ssm text-slate-700 dark:text-slate-300 leading-[1.75] whitespace-pre-wrap">
                    {renderContent(msg.content)}
                  </div>
                  {msg.actionsTaken && msg.actionsTaken.length > 0 && (
                    <ActionPills actions={msg.actionsTaken} />
                  )}
                </div>
              )}
            </div>
          ))}
          {isTyping && <TypingIndicator />}
          <div ref={bottomRef} />
        </div>
      </div>

      <div className="shrink-0 px-6 pb-5 pt-3 border-t border-black/[.06] dark:border-white/[.08]">
        {apiError && (
          <p className="text-xxs text-red-500 mb-2 text-center">{apiError}</p>
        )}
        {inputBox}
      </div>
      {pastePreviewText && (
        <PastePreviewModal text={pastePreviewText} onClose={() => setPastePreviewText(null)} />
      )}
      </div>
    </div>
  )
}
