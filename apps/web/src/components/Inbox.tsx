'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'next/navigation'
import {
  cn, htmlToText, cleanEmailBody, formatRelativeDate, formatChatTime, formatDateSeparator,
  isSameDay, parseDisplayName, replySubject,
} from '@/lib/utils'
import type { GmailMessage, GmailThread, FilterTab, InboxChannel } from '@/lib/types'
import { API_BASE } from '@/lib/constants'
import { queryKeys } from '@/lib/query-keys'
import { useUser } from '@/lib/hooks/use-user'
import { Avatar } from './Avatar'
import { ComposeWindow } from './ComposeWindow'
import { MoreHorizontal, Archive, Trash2, Mail } from 'lucide-react'
import { useGetInbox, useGetGmailUser } from '@/lib/hooks/queries'
import { useSendEmail, useArchiveEmailThread, useDeleteEmailThread } from '@/lib/hooks/mutations'

interface ComposeState {
  to: string[]
  cc: string[]
  subject: string
  threadId?: string
  inReplyTo?: string
  mode: 'compose' | 'reply'
}

// ─── Channel config ────────────────────────────────────────────────────────────

const CHANNELS: {
  id: InboxChannel
  label: string
  color: string
  bgColor: string
  icon: React.ReactNode
}[] = [
  {
    id: 'all',
    label: 'All',
    color: '#6b7280',
    bgColor: '#f3f4f6',
    icon: (
      <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    id: 'email',
    label: 'Email',
    color: '#2563eb',
    bgColor: '#dbeafe',
    icon: (
      <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
        <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    id: 'messenger',
    label: 'Messenger',
    color: '#0084FF',
    bgColor: '#dbeafe',
    icon: (
      <svg width={15} height={15} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.477 2 2 6.145 2 11.259c0 2.913 1.454 5.512 3.726 7.21V22l3.405-1.869c.91.252 1.875.387 2.869.387 5.523 0 10-4.145 10-9.259S17.523 2 12 2zm1.007 12.458l-2.548-2.718-4.973 2.718 5.472-5.808 2.61 2.718 4.91-2.718-5.471 5.808z" />
      </svg>
    ),
  },
  {
    id: 'instagram',
    label: 'Instagram',
    color: '#E1306C',
    bgColor: '#fce7f3',
    icon: (
      <svg width={15} height={15} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
      </svg>
    ),
  },
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    color: '#25D366',
    bgColor: '#dcfce7',
    icon: (
      <svg width={15} height={15} viewBox="0 0 24 24" fill="currentColor">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.890-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
      </svg>
    ),
  },
  {
    id: 'viber',
    label: 'Viber',
    color: '#7360F2',
    bgColor: '#ede9fe',
    icon: (
      <svg width={15} height={15} viewBox="0 0 24 24" fill="currentColor">
        <path d="M11.4 0H12c3.25.05 6.27 1.38 8.54 3.68 2.02 2.04 3.26 4.74 3.46 7.56v1.12c-.18 3.04-1.53 5.9-3.74 7.98-2.07 1.97-4.84 3.13-7.71 3.2H12c-1.5 0-3-.32-4.39-.92L2.5 24 3.98 18.9C2.2 17.2 1 14.97.5 12.57.18 11.27.03 9.94.05 8.6c.16-3.06 1.52-5.97 3.76-8.06C5.85.82 8.58-.06 11.4 0zm.48 1.92c-2.46.04-4.85 1.07-6.58 2.84C3.57 6.52 2.55 8.85 2.46 11.27c-.07 1.67.3 3.32 1.04 4.82l.26.44-1 3.48 3.48-1 .44.26c1.42.73 3 1.1 4.6 1.1 2.44 0 4.8-.89 6.62-2.5 1.8-1.58 2.96-3.78 3.17-6.1v-.77c-.19-2.31-1.26-4.47-2.96-6.05-1.81-1.7-4.23-2.65-6.73-2.63l.5-.4zM8.25 5.98c.27-.01.55.01.82.07.33.11.56.41.75.68.44.68.85 1.38 1.14 2.14.18.47.04.98-.28 1.34l-.5.56c-.18.2-.2.47-.1.71.46 1.19 1.27 2.22 2.28 2.98.44.34.93.61 1.43.84.29.13.61.08.83-.14l.5-.5c.3-.34.74-.52 1.18-.44.86.16 1.66.56 2.4 1 .2.13.36.32.42.55.1.52-.04 1.06-.34 1.5-.47.65-1.15 1.12-1.9 1.32-.44.11-.9.1-1.33-.01-1.3-.42-2.47-1.12-3.52-1.97-1.39-1.12-2.56-2.5-3.38-4.07-.5-.96-.83-2.01-.88-3.08-.02-.64.17-1.29.54-1.82.3-.42.75-.7 1.22-.76.17-.01.33-.01.5-.01l-.39.1z" />
      </svg>
    ),
  },
]

// ─── Channel icon badge (shown at bottom-right of avatar in conversation rows) ─

function ChannelBadge({ channel }: { channel: Exclude<InboxChannel, 'all'> }) {
  const cfg = CHANNELS.find(c => c.id === channel)
  if (!cfg) return null
  return (
    <span
      className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center border-[1.5px] border-white dark:border-[#1e1e21]"
      style={{ background: cfg.color, color: '#fff' }}
    >
      <span style={{ transform: 'scale(0.72)', display: 'flex', alignItems: 'center' }}>
        {cfg.icon}
      </span>
    </span>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────


function ConversationRow({
  thread,
  selected,
  channel,
  onClick,
}: {
  thread: GmailThread
  selected: boolean
  channel: Exclude<InboxChannel, 'all'>
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left px-3.5 py-3 border-b border-black/[.05] dark:border-white/[.04] transition-colors duration-150 flex items-start gap-3',
        selected
          ? 'bg-primary/[0.06] dark:bg-primary/[0.12]'
          : 'hover:bg-slate-50 dark:hover:bg-white/[.03]',
      )}
    >
      <div className="relative shrink-0 mt-0.5">
        <Avatar name={thread.from} email={thread.fromEmail} size={38} />
        {thread.unread && (
          <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-primary border-2 border-white dark:border-[#1e1e21]" />
        )}
        <ChannelBadge channel={channel} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <span className={cn(
            'text-sm truncate',
            thread.unread ? 'font-semibold text-slate-900 dark:text-white' : 'font-medium text-slate-700 dark:text-slate-300',
          )}>
            {thread.from}
          </span>
          <span className="text-xxs text-slate-400 shrink-0 tabular-nums">
            {formatRelativeDate(thread.latestDate)}
          </span>
        </div>
        <div className={cn(
          'text-ssm truncate mb-0.5',
          thread.unread ? 'font-medium text-slate-800 dark:text-slate-200' : 'text-slate-600 dark:text-slate-400',
        )}>
          {thread.subject}
        </div>
        <div className="text-xs text-slate-400 dark:text-slate-500 truncate leading-relaxed">
          {thread.snippet}
        </div>
      </div>
    </button>
  )
}

function DateSeparator({ date }: { date: string }) {
  return (
    <div className="flex items-center gap-3 px-5 py-3">
      <div className="flex-1 h-px bg-black/[.06] dark:bg-white/[.06]" />
      <span className="text-xxs font-medium text-slate-400 dark:text-slate-500 shrink-0">
        {formatDateSeparator(date)}
      </span>
      <div className="flex-1 h-px bg-black/[.06] dark:bg-white/[.06]" />
    </div>
  )
}

function ChatBubble({
  message,
  isMine,
  showAvatar,
}: {
  message: GmailMessage
  isMine: boolean
  showAvatar: boolean
}) {
  const rawBody = message.bodyText
    ? message.bodyText.trim()
    : message.bodyHtml
    ? htmlToText(message.bodyHtml)
    : message.snippet
  const bodyContent = cleanEmailBody(rawBody)

  return (
    <div className={cn('flex items-end gap-2 px-4', isMine ? 'flex-row-reverse' : 'flex-row', 'mb-1')}>
      {/* Avatar — only shown on received messages, placeholder space on sent */}
      <div className="w-7 h-7 shrink-0 mb-0.5">
        {!isMine && showAvatar && (
          <Avatar name={message.from} email={message.fromEmail} size={28} />
        )}
      </div>

      <div className={cn('flex flex-col max-w-[72%]', isMine ? 'items-end' : 'items-start')}>
        {/* Sender name — only for received, only when avatar shown */}
        {!isMine && showAvatar && (
          <span className="text-xxs font-semibold text-slate-500 dark:text-slate-400 mb-1 px-0.5">
            {message.from}
          </span>
        )}

        {/* Bubble */}
        <div
          className={cn(
            'text-left rounded-2xl px-4 py-3 max-w-full transition-all duration-150',
            isMine
              ? 'bg-primary text-white rounded-br-sm hover:bg-primary/90'
              : 'bg-card border border-black/[.07] dark:border-white/[.07] text-slate-800 dark:text-slate-200 rounded-bl-sm hover:bg-secondary shadow-[0_1px_2px_rgba(17,24,39,0.06)]',
          )}
        >
          {/* Message body — 16px desktop, 15px mobile for readability */}
          <p className={cn(
            'text-sm leading-[1.57] whitespace-pre-wrap break-words max-w-[460px]',
            isMine ? 'text-white/95' : 'text-slate-800 dark:text-slate-200',
          )}>
            {bodyContent}
          </p>
        </div>

        {/* Timestamp + CC indicator */}
        <div className={cn('flex items-center gap-1.5 mt-1 px-0.5', isMine ? 'flex-row-reverse' : 'flex-row')}>
          <span className="text-xxs text-slate-400 dark:text-slate-500 tabular-nums">
            {formatChatTime(message.date)}
          </span>
          {message.cc.length > 0 && (
            <span className="text-xxs text-slate-400 dark:text-slate-500">
              · {message.cc.length} CC
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

function ReplyBox({
  thread,
  myEmail,
  onSent,
}: {
  thread: GmailThread
  myEmail: string | null
  onSent: () => void
}) {
  const queryClient = useQueryClient()
  const { userId } = useUser()
  const [body, setBody] = useState('')
  const [error, setError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const lastMsg = thread.messages[thread.messages.length - 1]

  const mutation = useSendEmail({
    onSuccess: () => {
      setBody('')
      setError(null)
      queryClient.invalidateQueries({ queryKey: queryKeys.gmail.inbox })
      onSent()
    },
    onError: (err: Error) => setError(err.message),
  })

  function handleSend() {
    const trimmed = body.trim()
    if (!trimmed) return
    setError(null)
    mutation.mutate({
      to: [lastMsg.from === myEmail ? thread.from : `${lastMsg.from} <${lastMsg.fromEmail}>`].filter(Boolean),
      subject: replySubject(thread.subject),
      body: trimmed,
      threadId: thread.id,
      inReplyTo: lastMsg.rfcMessageId || undefined,
    })
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      handleSend()
    }
  }

  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setBody(e.target.value)
    const el = e.target
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
  }

  return (
    <div className="shrink-0 border-t border-black/[.06] dark:border-white/[.06] bg-card px-4 py-3">
      <div className={cn(
        'flex items-end gap-2.5 rounded-xl border border-black/[.08] dark:border-white/[.08] bg-slate-50/60 dark:bg-white/[.03] px-3 py-2.5 transition-colors focus-within:border-primary/40 focus-within:bg-white dark:focus-within:bg-white/[.06]',
      )}>
        {myEmail && (
          <Avatar name={myEmail.split('@')[0]} email={myEmail} size={26} />
        )}
        <textarea
          ref={textareaRef}
          value={body}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={`Reply to ${thread.from}… (Ctrl+Enter to send)`}
          rows={1}
          className="flex-1 min-w-0 text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 bg-transparent outline-none border-none resize-none leading-[1.55] py-0.5 max-h-[120px]"
        />
        <button
          onClick={handleSend}
          disabled={!body.trim() || mutation.isPending}
          className={cn(
            'shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-150',
            body.trim() && !mutation.isPending
              ? 'bg-primary text-white hover:bg-primary/90 active:scale-95'
              : 'bg-slate-100 dark:bg-white/[.06] text-slate-300',
          )}
          title="Send (Ctrl+Enter)"
        >
          {mutation.isPending ? (
            <div className="w-3.5 h-3.5 rounded-full border-2 border-current/30 border-t-current animate-spin" />
          ) : (
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          )}
        </button>
      </div>
      {error && (
        <p className="text-xxs text-red-500 mt-1.5 px-1">{error}</p>
      )}
    </div>
  )
}

function ThreadActionsMenu({
  thread,
  userId,
  myEmail,
  onCompose,
  onArchived,
  onDeleted,
}: {
  thread: GmailThread
  userId: string | null
  myEmail: string | null
  onCompose: (state: ComposeState) => void
  onArchived: () => void
  onDeleted: () => void
}) {
  const [open, setOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setDeleteConfirm(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const archiveMutation = useArchiveEmailThread({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.gmail.inbox, exact: false })
      setOpen(false)
      onArchived()
    },
  })

  const deleteMutation = useDeleteEmailThread({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.gmail.inbox, exact: false })
      setOpen(false)
      onDeleted()
    },
  })

  return (
    <div ref={ref} className="relative">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o); setDeleteConfirm(false) }}
        className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[.08] transition-colors"
        title="Thread actions"
      >
        <MoreHorizontal size={16} />
      </button>

      {open && (
        <div className="absolute right-0 top-9 z-50 min-w-[180px] bg-white dark:bg-[#1e1e21] border border-black/[.08] dark:border-white/[.1] rounded-lg shadow-lg py-1 animate-in fade-in-0 zoom-in-95 duration-100">
          <button
            onClick={() => {
              setOpen(false)
              onCompose({
                to: [myEmail ? thread.fromEmail : thread.fromEmail],
                cc: [],
                subject: replySubject(thread.subject),
                threadId: thread.id,
                inReplyTo: thread.messages.at(-1)?.rfcMessageId,
                mode: 'reply',
              })
            }}
            className="flex items-center gap-2.5 w-full px-3 py-1.5 text-ssm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[.06] transition-colors"
          >
            <Mail size={13} className="text-slate-400" />
            Email
          </button>

          <button
            onClick={() => archiveMutation.mutate(thread.id)}
            disabled={archiveMutation.isPending}
            className="flex items-center gap-2.5 w-full px-3 py-1.5 text-ssm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[.06] transition-colors disabled:opacity-50"
          >
            <Archive size={13} className="text-slate-400" />
            <>{archiveMutation.isPending && <span className="inline-block w-3 h-3 border-2 border-current/30 border-t-current rounded-full animate-spin" />}Archive</>
          </button>

          {!deleteConfirm ? (
            <button
              onClick={() => setDeleteConfirm(true)}
              className="flex items-center gap-2.5 w-full px-3 py-1.5 text-ssm text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
            >
              <Trash2 size={13} />
              Move to trash
            </button>
          ) : (
            <div className="px-3 py-2 border-t border-black/[.04] dark:border-white/[.06]">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">Move to trash?</p>
              <div className="flex gap-1.5">
                <button
                  onClick={() => setDeleteConfirm(false)}
                  className="flex-1 px-2 py-1 text-xs rounded-md border border-black/[.06] dark:border-white/[.08] text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/[.04] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => deleteMutation.mutate(thread.id)}
                  disabled={deleteMutation.isPending}
                  className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1 text-xs rounded-md bg-red-600 hover:bg-red-700 text-white font-medium transition-colors disabled:opacity-50"
                >
                  <>{deleteMutation.isPending && <span className="inline-block w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />}Trash</>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ChatView({
  thread,
  myEmail,
  onCompose,
  onBack,
  onArchived,
  onDeleted,
}: {
  thread: GmailThread
  myEmail: string | null
  onCompose: (state: ComposeState) => void
  onBack?: () => void
  onArchived: () => void
  onDeleted: () => void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const { userId } = useUser()

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [thread.id, thread.messages.length])

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Chat header */}
      <div className="shrink-0 px-3 sm:px-5 py-3.5 border-b border-black/[.06] dark:border-white/[.06] bg-card flex items-center gap-2 sm:gap-3">
        {onBack && (
          <button
            onClick={onBack}
            className="sm:hidden shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[.06] transition-colors -ml-1"
            aria-label="Back to inbox"
          >
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
        )}
        <Avatar name={thread.from} email={thread.fromEmail} size={36} />
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white truncate">{thread.from}</h2>
          <p className="text-xs text-slate-400 dark:text-slate-500 truncate">{thread.subject}</p>
        </div>
        <button
          onClick={() =>
            onCompose({
              to: [thread.fromEmail],
              cc: [],
              subject: replySubject(thread.subject),
              threadId: thread.id,
              inReplyTo: thread.messages.at(-1)?.rfcMessageId,
              mode: 'reply',
            })
          }
          className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-primary border border-black/[.08] dark:border-white/[.08] hover:border-primary/40 rounded-lg transition-colors"
          title="Open full compose for this reply"
        >
          <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
            <path d="M3 10h10a8 8 0 018 8v2M3 10l6 6M3 10l6-6" />
          </svg>
          Reply
        </button>
        <ThreadActionsMenu
          thread={thread}
          userId={userId ?? null}
          myEmail={myEmail}
          onCompose={onCompose}
          onArchived={onArchived}
          onDeleted={onDeleted}
        />
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto py-3 bg-background">
        {thread.messages.map((msg, i) => {
          const isMine = msg.fromEmail.toLowerCase().endsWith('@symph.co') || (!!myEmail && msg.fromEmail.toLowerCase() === myEmail.toLowerCase())
          const prevMsg = thread.messages[i - 1]
          const showDate = i === 0 || !isSameDay(prevMsg.date, msg.date)
          const showAvatar = i === 0 || thread.messages[i - 1].fromEmail !== msg.fromEmail

          return (
            <div key={msg.id}>
              {showDate && <DateSeparator date={msg.date} />}
              <ChatBubble message={msg} isMine={isMine} showAvatar={showAvatar} />
            </div>
          )
        })}
      </div>

      {/* Inline reply box */}
      <ReplyBox
        thread={thread}
        myEmail={myEmail}
        onSent={() => {
          setTimeout(() => {
            if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
          }, 300)
        }}
      />
    </div>
  )
}

function ConnectBanner({ connectUrl }: { connectUrl: string }) {
  return (
    <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/40 rounded-lg px-4 py-3 mx-4 mb-3">
      <div className="min-w-0">
        <p className="text-ssm font-semibold text-blue-900 dark:text-blue-300">Connect Google to use Inbox</p>
        <p className="text-xs text-blue-700 dark:text-blue-400 mt-0.5">Shows this month&apos;s team emails where you&apos;re CC&apos;d.</p>
      </div>
      <a
        href={connectUrl}
        className="ml-4 shrink-0 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors"
      >
        Connect
      </a>
    </div>
  )
}

function InboxSkeleton() {
  return (
    <div className="flex flex-col">
      {Array.from({ length: 7 }).map((_, i) => (
        <div key={i} className="px-3.5 py-3 border-b border-black/[.05] dark:border-white/[.05] flex items-start gap-3 animate-pulse">
          <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-white/[.08] shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1.5">
              <div className="h-3 w-24 bg-slate-100 dark:bg-white/[.08] rounded" />
              <div className="h-2.5 w-10 bg-slate-100 dark:bg-white/[.08] rounded" />
            </div>
            <div className="h-2.5 w-40 bg-slate-100 dark:bg-white/[.08] rounded mb-1.5" />
            <div className="h-2.5 w-full bg-slate-100 dark:bg-white/[.08] rounded" />
          </div>
        </div>
      ))}
    </div>
  )
}

/** Empty state for channels without an integration yet */
function ChannelConnectState({ channel }: { channel: Exclude<InboxChannel, 'all' | 'email'> }) {
  const cfg = CHANNELS.find(c => c.id === channel)!

  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 gap-4">
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm"
        style={{ background: cfg.bgColor, color: cfg.color }}
      >
        <span style={{ transform: 'scale(1.6)', display: 'flex', alignItems: 'center' }}>
          {cfg.icon}
        </span>
      </div>
      <div className="text-center">
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">
          {cfg.label} not connected
        </p>
        <p className="text-ssm text-slate-400 dark:text-slate-500 leading-relaxed max-w-[220px]">
          {cfg.label} integration is coming soon. Messages will appear here once connected.
        </p>
      </div>
      <button
        disabled
        className="px-4 py-2 rounded-lg text-ssm font-semibold text-white opacity-50 cursor-not-allowed"
        style={{ background: cfg.color }}
      >
        Coming Soon
      </button>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function Inbox({ onOpenDeal: _onOpenDeal }: { onOpenDeal: (id: string) => void }) {
  const [channelTab, setChannelTab] = useState<InboxChannel>('all')
  const [filter, setFilter] = useState<FilterTab>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [compose, setCompose] = useState<ComposeState | null>(null)
  const [mobileView, setMobileView] = useState<'list' | 'chat'>('list')
  const [oauthBanner, setOauthBanner] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const { userId } = useUser()
  const searchParams = useSearchParams()
  const qc = useQueryClient()

  useEffect(() => {
    const connected = searchParams.get('connected')
    const oauthError = searchParams.get('oauth_error')
    if (connected === 'true') {
      setOauthBanner({ type: 'success', message: 'Google connected successfully!' })
      qc.invalidateQueries({ queryKey: queryKeys.gmail.inbox, exact: false })
      qc.invalidateQueries({ queryKey: queryKeys.gmail.user, exact: false })
    } else if (oauthError) {
      setOauthBanner({ type: 'error', message: oauthError })
    }
    if (connected || oauthError) {
      const url = new URL(window.location.href)
      url.searchParams.delete('connected')
      url.searchParams.delete('oauth_error')
      window.history.replaceState({}, '', url.toString())
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const { data, isLoading } = useGetInbox(userId)
  const { data: gmailUser } = useGetGmailUser(userId)

  const threads = data?.threads ?? []
  const needsReconnect = data?.needsReconnect ?? false
  const apiError = data?.error ?? null
  const myEmail = gmailUser?.email ?? null

  const filtered = threads.filter(t => {
    if (filter === 'unread' && !t.unread) return false
    if (search.trim()) {
      const q = search.toLowerCase()
      return (
        t.subject.toLowerCase().includes(q) ||
        t.from.toLowerCase().includes(q) ||
        t.fromEmail.toLowerCase().includes(q) ||
        t.snippet.toLowerCase().includes(q)
      )
    }
    return true
  })

  const selectedThread = selectedId ? threads.find(t => t.id === selectedId) ?? null : null
  const unreadCount = threads.filter(t => t.unread).length

  // Email threads count for the 'email' channel tab badge
  const emailUnread = unreadCount

  // Social channels — no data yet, shows "coming soon" state
  const isSocialChannel = channelTab !== 'all' && channelTab !== 'email'

  function openCompose(state: ComposeState) {
    setCompose(state)
  }

  return (
    <div className="h-full flex flex-col overflow-hidden relative">
      {/* OAuth result banner */}
      {oauthBanner && (
        <div className={cn(
          'flex items-center justify-between rounded-lg px-4 py-3 mx-4 mb-3',
          oauthBanner.type === 'success'
            ? 'bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800/40'
            : 'bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/40',
        )}>
          <p className={cn(
            'text-ssm font-medium',
            oauthBanner.type === 'success' ? 'text-green-800 dark:text-green-300' : 'text-red-800 dark:text-red-300',
          )}>
            {oauthBanner.message}
          </p>
          <button
            onClick={() => setOauthBanner(null)}
            className="ml-4 shrink-0 text-xxs opacity-60 hover:opacity-100 transition-opacity"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Connect banner */}
      {needsReconnect && (
        <ConnectBanner
          connectUrl={`${API_BASE}/auth/google-calendar/connect?userId=${encodeURIComponent(userId ?? '')}&returnTo=%2Finbox`}
        />
      )}

      <div className="flex-1 flex overflow-hidden">
        {/* ── Left panel — conversation list ──────────────────────────────── */}
        <div className={cn(
          'w-full sm:w-[420px] shrink-0 sm:border-r border-black/[.06] dark:border-white/[.06] flex-col h-full bg-white dark:bg-card',
          mobileView === 'chat' ? 'hidden sm:flex' : 'flex',
        )}>

          {/* ── Header ─────────────────────────────────────────────────────── */}
          <div className="px-4 pt-4 pb-0 shrink-0 border-b border-black/[.05] dark:border-white/[.05]">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h1 className="text-ssm font-semibold text-slate-900 dark:text-white">Inbox</h1>
                {!isLoading && !needsReconnect && (channelTab === 'all' || channelTab === 'email') && (
                  <p className="text-xxs text-slate-400 mt-0.5 tabular-nums">
                    {threads.length} conversation{threads.length !== 1 ? 's' : ''} this month
                  </p>
                )}
              </div>
              {(channelTab === 'all' || channelTab === 'email') && (
                <button
                  onClick={() => openCompose({ to: [], cc: [], subject: '', mode: 'compose' })}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-primary hover:bg-primary/90 text-white text-xs font-semibold rounded-lg transition-colors active:scale-[0.98]"
                >
                  <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                  Compose
                </button>
              )}
            </div>

            {/* ── Channel tabs — THE KEY UX ELEMENT ──────────────────────── */}
            {/* Desktop: icon + label + badge | Mobile: icon-only */}
            <div className="flex overflow-x-auto gap-0.5 pb-px scrollbar-none -mx-4 px-4">
              {CHANNELS.map(ch => {
                const isActive = channelTab === ch.id
                // Compute unread badge for each channel
                const badge = ch.id === 'all' ? unreadCount : ch.id === 'email' ? emailUnread : 0
                return (
                  <button
                    key={ch.id}
                    onClick={() => {
                      setChannelTab(ch.id)
                      setSelectedId(null)
                      setMobileView('list')
                    }}
                    className={cn(
                      'relative flex-shrink-0 flex items-center justify-center rounded-t-lg transition-all duration-150 border-b-2',
                      'w-[52px] py-2.5',
                      isActive
                        ? 'border-b-primary text-primary bg-primary/[0.04] dark:bg-primary/[0.08]'
                        : 'border-b-transparent text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[.04]',
                    )}
                    title={ch.label}
                    aria-label={ch.label}
                  >
                    {/* Icon — always visible */}
                    <span className={cn(
                      'flex items-center justify-center w-4 h-4 transition-colors',
                      isActive ? '' : '',
                    )}>
                      {ch.icon}
                    </span>

                    {/* Unread dot — shown on all sizes when there are unread messages */}
                    {badge > 0 && (
                      <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-primary" />
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* ── Search + filter row — email/all channels only ─────────────── */}
          {(channelTab === 'all' || channelTab === 'email') && (
            <div className="px-3 py-2.5 shrink-0 border-b border-black/[.04] dark:border-white/[.04]">
              <div className="relative mb-2">
                <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-300" width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                  <circle cx={11} cy={11} r={8} /><path d="M21 21l-4.35-4.35" />
                </svg>
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search conversations…"
                  className="w-full pl-8 pr-3 py-[7px] text-ssm bg-slate-50 dark:bg-white/[.04] border border-black/[.07] dark:border-white/[.07] rounded-lg text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-primary/40 transition-colors"
                />
              </div>
              <div className="flex gap-1">
                {(['all', 'unread'] as FilterTab[]).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setFilter(tab)}
                    className={cn(
                      'px-3 py-1 rounded-full text-xs font-semibold capitalize transition-colors',
                      filter === tab
                        ? 'bg-primary text-white'
                        : 'bg-slate-100 dark:bg-white/[.06] text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/[.10]',
                    )}
                  >
                    {tab}
                    {tab === 'unread' && unreadCount > 0 && (
                      <span className={cn('ml-1.5 tabular-nums', filter === 'unread' ? 'text-white/70' : 'text-slate-400')}>
                        {unreadCount}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Conversation list ─────────────────────────────────────────── */}
          <div className="flex-1 overflow-y-auto">
            {isSocialChannel ? (
              <ChannelConnectState channel={channelTab as Exclude<InboxChannel, 'all' | 'email'>} />
            ) : isLoading ? (
              <InboxSkeleton />
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-16 px-6">
                <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-white/[.06] flex items-center justify-center">
                  <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" className="text-slate-400">
                    <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <div className="text-center">
                  <div className="text-ssm font-semibold text-slate-600 mb-1">
                    {search ? 'No matching conversations' : 'No conversations yet this month'}
                  </div>
                  <div className="text-xs text-slate-400 leading-relaxed">
                    {search ? 'Try a different search term' : 'Team emails with CC will appear here'}
                  </div>
                </div>
              </div>
            ) : (
              filtered.map(thread => (
                <ConversationRow
                  key={thread.id}
                  thread={thread}
                  selected={selectedId === thread.id}
                  channel="email"
                  onClick={() => {
                    setSelectedId(thread.id)
                    setMobileView('chat')
                  }}
                />
              ))
            )}
          </div>

          {apiError && !needsReconnect && (
            <div className="shrink-0 px-3.5 py-2.5 border-t border-red-100 dark:border-red-900/40 bg-red-50 dark:bg-red-950/30">
              <p className="text-xs text-red-600 dark:text-red-400 leading-relaxed">{apiError}</p>
            </div>
          )}
        </div>

        {/* ── Right panel — chat view ──────────────────────────────────────── */}
        <div className={cn(
          'flex-1 flex-col overflow-hidden bg-background',
          mobileView === 'list' ? 'hidden sm:flex' : 'flex',
        )}>
          {selectedThread ? (
            <ChatView
              thread={selectedThread}
              myEmail={myEmail}
              onCompose={openCompose}
              onBack={() => setMobileView('list')}
              onArchived={() => {
                setSelectedId(null)
                setMobileView('list')
              }}
              onDeleted={() => {
                setSelectedId(null)
                setMobileView('list')
              }}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-4">
              <div className="w-12 h-12 rounded-full bg-white dark:bg-card border border-black/[.06] dark:border-white/[.06] shadow-[0_1px_3px_rgba(17,24,39,0.06)] flex items-center justify-center">
                <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" className="text-slate-300">
                  <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                </svg>
              </div>
              <div className="text-center">
                <div className="text-ssm font-semibold text-slate-400 dark:text-slate-500">Select a conversation</div>
                <div className="text-xs text-slate-300 dark:text-slate-600 mt-1">or compose a new message</div>
              </div>
            </div>
          )}
        </div>

      </div>{/* end flex row */}

      {/* Floating compose window */}
      <ComposeWindow
        open={compose !== null}
        onClose={() => setCompose(null)}
        initialTo={compose?.to}
        initialCc={compose?.cc}
        initialSubject={compose?.subject}
        initialThreadId={compose?.threadId}
        initialInReplyTo={compose?.inReplyTo}
        mode={compose?.mode ?? 'compose'}
      />
    </div>
  )
}
