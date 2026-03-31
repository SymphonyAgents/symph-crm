'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'next/navigation'
import {
  cn, htmlToText, formatRelativeDate, formatChatTime, formatDateSeparator,
  isSameDay, getInitials, avatarColor, parseDisplayName, replySubject,
} from '@/lib/utils'
import type { GmailMessage, GmailThread, InboxResponse, FilterTab } from '@/lib/types'
import { API_BASE } from '@/lib/constants'
import { queryKeys } from '@/lib/query-keys'
import { useUser } from '@/lib/hooks/use-user'
import { ComposeWindow } from './ComposeWindow'
import { MoreHorizontal, Archive, Trash2, Mail } from 'lucide-react'

interface ComposeState {
  to: string[]
  cc: string[]
  subject: string
  threadId?: string
  inReplyTo?: string
  mode: 'compose' | 'reply'
}

// ─── API ─────────────────────────────────────────────────────────────────────

async function fetchInbox(userId: string): Promise<InboxResponse> {
  const res = await fetch('/api/gmail/inbox', {
    headers: { 'x-user-id': userId },
  })
  if (!res.ok) throw new Error('Failed to fetch inbox')
  return res.json()
}

async function fetchGmailUser(userId: string): Promise<{ email: string | null; needsReconnect?: boolean }> {
  const res = await fetch('/api/gmail/user', {
    headers: { 'x-user-id': userId },
  })
  if (!res.ok) return { email: null }
  return res.json()
}

async function sendEmail(userId: string, dto: {
  to: string[]
  cc?: string[]
  subject: string
  body: string
  threadId?: string
  inReplyTo?: string
}): Promise<{ messageId: string; threadId: string }> {
  const res = await fetch('/api/gmail/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
    body: JSON.stringify(dto),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message ?? 'Failed to send')
  }
  return res.json()
}

async function archiveThread(userId: string, threadId: string): Promise<void> {
  const res = await fetch(`/api/gmail/threads/${threadId}/archive`, {
    method: 'POST',
    headers: { 'x-user-id': userId },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message ?? 'Failed to archive')
  }
}

async function trashThread(userId: string, threadId: string): Promise<void> {
  const res = await fetch(`/api/gmail/threads/${threadId}`, {
    method: 'DELETE',
    headers: { 'x-user-id': userId },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message ?? 'Failed to delete')
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Avatar({ name, email, size = 32 }: { name: string; email: string; size?: number }) {
  return (
    <div
      className="rounded-full flex items-center justify-center shrink-0 text-white font-semibold"
      style={{ width: size, height: size, background: avatarColor(email), fontSize: size * 0.36 }}
    >
      {getInitials(name || email)}
    </div>
  )
}

function ConversationRow({
  thread,
  selected,
  onClick,
}: {
  thread: GmailThread
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left px-3.5 py-3 border-b border-black/[.05] dark:border-white/[.04] transition-colors duration-150 flex items-start gap-3',
        selected
          ? 'bg-primary/[0.06] dark:bg-primary/[0.12] border-l-2 border-l-primary'
          : 'hover:bg-slate-50 dark:hover:bg-white/[.03] border-l-2 border-l-transparent',
      )}
    >
      <div className="relative shrink-0 mt-0.5">
        <Avatar name={thread.from} email={thread.fromEmail} size={36} />
        {thread.unread && (
          <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-primary border-2 border-white" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <span className={cn('text-[12.5px] truncate', thread.unread ? 'font-semibold text-slate-900 dark:text-white' : 'font-medium text-slate-700 dark:text-slate-300')}>
            {thread.from}
          </span>
          <span className="text-[10.5px] text-slate-400 shrink-0 tabular-nums">
            {formatRelativeDate(thread.latestDate)}
          </span>
        </div>
        <div className={cn('text-[12px] truncate mb-0.5', thread.unread ? 'font-medium text-slate-800 dark:text-slate-200' : 'text-slate-600 dark:text-slate-400')}>
          {thread.subject}
        </div>
        <div className="text-[11px] text-slate-400 dark:text-slate-500 truncate leading-relaxed">{thread.snippet}</div>
      </div>
    </button>
  )
}

function DateSeparator({ date }: { date: string }) {
  return (
    <div className="flex items-center gap-3 px-5 py-3">
      <div className="flex-1 h-px bg-black/[.06] dark:bg-white/[.06]" />
      <span className="text-[10.5px] font-medium text-slate-400 dark:text-slate-500 shrink-0">
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
  // Extract readable text from HTML (prefer bodyText, fall back to stripping bodyHtml)
  const bodyContent = message.bodyText
    ? message.bodyText.trim()
    : message.bodyHtml
    ? htmlToText(message.bodyHtml)
    : message.snippet

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
          <span className="text-[10.5px] font-semibold text-slate-500 dark:text-slate-400 mb-1 px-0.5">
            {message.from}
          </span>
        )}

        {/* Bubble */}
        <div
          className={cn(
            'text-left rounded-2xl px-3.5 py-2.5 max-w-full transition-all duration-150',
            isMine
              ? 'bg-primary text-white rounded-br-sm hover:bg-primary/90'
              : 'bg-card border border-black/[.07] dark:border-white/[.07] text-slate-800 dark:text-slate-200 rounded-bl-sm hover:bg-secondary shadow-[0_1px_2px_rgba(17,24,39,0.06)]',
          )}
        >
          {/* Native email body — rendered as CRM-styled text, no iframe */}
          <p className={cn(
            'text-[12.5px] leading-relaxed whitespace-pre-wrap break-words max-w-[460px]',
            isMine ? 'text-white/95' : 'text-slate-800 dark:text-slate-200',
          )}>
            {bodyContent}
          </p>
        </div>

        {/* Timestamp + CC indicator */}
        <div className={cn('flex items-center gap-1.5 mt-1 px-0.5', isMine ? 'flex-row-reverse' : 'flex-row')}>
          <span className="text-[10px] text-slate-400 dark:text-slate-500 tabular-nums">
            {formatChatTime(message.date)}
          </span>
          {message.cc.length > 0 && (
            <span className="text-[10px] text-slate-400 dark:text-slate-500">
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

  const mutation = useMutation({
    mutationFn: (dto: Parameters<typeof sendEmail>[1]) => sendEmail(userId ?? '', dto),
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

  // Auto-resize textarea
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
          className="flex-1 min-w-0 text-[12.5px] text-slate-800 dark:text-slate-200 placeholder:text-slate-400 bg-transparent outline-none border-none resize-none leading-relaxed py-0.5 max-h-[120px]"
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
        <p className="text-[11px] text-red-500 mt-1.5 px-1">{error}</p>
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

  const archiveMutation = useMutation({
    mutationFn: () => archiveThread(userId ?? '', thread.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.gmail.inbox, exact: false })
      setOpen(false)
      onArchived()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => trashThread(userId ?? '', thread.id),
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
          {/* Email (compose new to this thread) */}
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
            className="flex items-center gap-2.5 w-full px-3 py-1.5 text-[12px] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[.06] transition-colors"
          >
            <Mail size={13} className="text-slate-400" />
            Email
          </button>

          {/* Archive */}
          <button
            onClick={() => archiveMutation.mutate()}
            disabled={archiveMutation.isPending}
            className="flex items-center gap-2.5 w-full px-3 py-1.5 text-[12px] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[.06] transition-colors disabled:opacity-50"
          >
            <Archive size={13} className="text-slate-400" />
            {archiveMutation.isPending ? 'Archiving…' : 'Archive'}
          </button>

          {/* Delete — two-step confirm */}
          {!deleteConfirm ? (
            <button
              onClick={() => setDeleteConfirm(true)}
              className="flex items-center gap-2.5 w-full px-3 py-1.5 text-[12px] text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
            >
              <Trash2 size={13} />
              Move to trash
            </button>
          ) : (
            <div className="px-3 py-2 border-t border-black/[.04] dark:border-white/[.06]">
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2">Move to trash?</p>
              <div className="flex gap-1.5">
                <button
                  onClick={() => setDeleteConfirm(false)}
                  className="flex-1 px-2 py-1 text-[11px] rounded-md border border-black/[.06] dark:border-white/[.08] text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/[.04] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => deleteMutation.mutate()}
                  disabled={deleteMutation.isPending}
                  className="flex-1 px-2 py-1 text-[11px] rounded-md bg-red-600 hover:bg-red-700 text-white font-medium transition-colors disabled:opacity-50"
                >
                  {deleteMutation.isPending ? '…' : 'Trash'}
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

  // Scroll to bottom when thread changes or messages update
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [thread.id, thread.messages.length])

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Chat header */}
      <div className="shrink-0 px-3 sm:px-5 py-3.5 border-b border-black/[.06] dark:border-white/[.06] bg-card flex items-center gap-2 sm:gap-3">
        {/* Back button — mobile only */}
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
        <Avatar name={thread.from} email={thread.fromEmail} size={34} />
        <div className="flex-1 min-w-0">
          <h2 className="text-[13px] font-semibold text-slate-900 dark:text-white truncate">{thread.from}</h2>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate">{thread.subject}</p>
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
          className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-[11.5px] font-semibold text-slate-600 dark:text-slate-300 hover:text-primary border border-black/[.08] dark:border-white/[.08] hover:border-primary/40 rounded-lg transition-colors"
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
          // Symph emails (*.symph.co) go right; client emails go left
          const isMine = msg.fromEmail.toLowerCase().endsWith('@symph.co') || (!!myEmail && msg.fromEmail.toLowerCase() === myEmail.toLowerCase())
          const prevMsg = thread.messages[i - 1]
          const showDate = i === 0 || !isSameDay(prevMsg.date, msg.date)
          // Show avatar when sender changes or first in a group
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
          // Scroll to bottom after send
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
        <p className="text-[13px] font-semibold text-blue-900 dark:text-blue-300">Connect Google to use Inbox</p>
        <p className="text-[12px] text-blue-700 dark:text-blue-400 mt-0.5">Shows this month&apos;s team emails where you&apos;re CC&apos;d.</p>
      </div>
      <a
        href={connectUrl}
        className="ml-4 shrink-0 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[12px] font-semibold rounded-lg transition-colors"
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

// ─── Main ─────────────────────────────────────────────────────────────────────

export function Inbox({ onOpenDeal: _onOpenDeal }: { onOpenDeal: (id: string) => void }) {
  const [filter, setFilter] = useState<FilterTab>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [compose, setCompose] = useState<ComposeState | null>(null)
  // Mobile navigation: 'list' shows the conversation list, 'chat' shows the chat panel
  const [mobileView, setMobileView] = useState<'list' | 'chat'>('list')
  const [oauthBanner, setOauthBanner] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const { userId } = useUser()
  const searchParams = useSearchParams()
  const qc = useQueryClient()

  // Read OAuth redirect params once on mount, then clean the URL
  useEffect(() => {
    const connected = searchParams.get('connected')
    const oauthError = searchParams.get('oauth_error')
    if (connected === 'true') {
      setOauthBanner({ type: 'success', message: 'Google connected successfully!' })
      // Invalidate with prefix match so all userId-keyed variants are refreshed
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

  const { data, isLoading } = useQuery({
    queryKey: [...queryKeys.gmail.inbox, userId],
    queryFn: () => fetchInbox(userId ?? ''),
    staleTime: 5 * 60 * 1000,
    retry: false,
    enabled: !!userId,
  })

  const { data: gmailUser } = useQuery({
    queryKey: [...queryKeys.gmail.user, userId],
    queryFn: () => fetchGmailUser(userId ?? ''),
    staleTime: 60 * 60 * 1000, // 1 hour — email doesn't change
    retry: false,
    enabled: !!userId,
  })

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

  function openCompose(state: ComposeState) {
    setCompose(state)
  }

  return (
    <div className="h-full flex flex-col overflow-hidden relative">
      {/* OAuth result banner — shown after returning from Google consent */}
      {oauthBanner && (
        <div className={cn(
          'flex items-center justify-between rounded-lg px-4 py-3 mx-4 mb-3',
          oauthBanner.type === 'success'
            ? 'bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800/40'
            : 'bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/40',
        )}>
          <p className={cn(
            'text-[13px] font-medium',
            oauthBanner.type === 'success' ? 'text-green-800 dark:text-green-300' : 'text-red-800 dark:text-red-300',
          )}>
            {oauthBanner.message}
          </p>
          <button
            onClick={() => setOauthBanner(null)}
            className="ml-4 shrink-0 text-[11px] opacity-60 hover:opacity-100 transition-opacity"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Connect banner — shown when Google not connected */}
      {needsReconnect && (
        <ConnectBanner
          connectUrl={`${API_BASE}/auth/google-calendar/connect?userId=${encodeURIComponent(userId ?? '')}&returnTo=%2Finbox`}
        />
      )}

      <div className="flex-1 flex overflow-hidden">
      {/* Left panel — conversation list (full width on mobile, fixed width on desktop) */}
      <div className={cn(
        'w-full sm:w-[320px] shrink-0 sm:border-r border-black/[.06] dark:border-white/[.06] flex-col h-full bg-white dark:bg-card',
        mobileView === 'chat' ? 'hidden sm:flex' : 'flex',
      )}>

        {/* Header */}
        <div className="px-4 pt-4 pb-2.5 shrink-0 border-b border-black/[.05] dark:border-white/[.05]">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-[13px] font-semibold text-slate-900 dark:text-white">Inbox</h1>
              {!isLoading && !needsReconnect && (
                <p className="text-[10.5px] text-slate-400 mt-0.5 tabular-nums">
                  {threads.length} conversation{threads.length !== 1 ? 's' : ''} this month
                </p>
              )}
            </div>
            <button
              onClick={() => openCompose({ to: [], cc: [], subject: '', mode: 'compose' })}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary hover:bg-primary/90 text-white text-[11.5px] font-semibold rounded-lg transition-colors active:scale-[0.98]"
            >
              <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
              Compose
            </button>
          </div>

          <div className="relative mb-2.5">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-300" width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <circle cx={11} cy={11} r={8} /><path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search conversations…"
              className="w-full pl-8 pr-3 py-[7px] text-[12px] bg-slate-50 dark:bg-white/[.04] border border-black/[.07] dark:border-white/[.07] rounded-lg text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-primary/40 transition-colors"
            />
          </div>

          <div className="flex gap-1">
            {(['all', 'unread'] as FilterTab[]).map(tab => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={cn(
                  'px-3 py-1 rounded-full text-[11px] font-semibold capitalize transition-colors',
                  filter === tab ? 'bg-primary text-white' : 'bg-slate-100 dark:bg-white/[.06] text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/[.10]',
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

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <InboxSkeleton />
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 px-6">
              <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-white/[.06] flex items-center justify-center">
                <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" className="text-slate-400">
                  <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="text-center">
                <div className="text-[12.5px] font-semibold text-slate-600 mb-1">
                  {search ? 'No matching conversations' : 'No conversations yet this month'}
                </div>
                <div className="text-[11px] text-slate-400 leading-relaxed">
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
            <p className="text-[11px] text-red-600 dark:text-red-400 leading-relaxed">{apiError}</p>
          </div>
        )}
      </div>

      {/* Right panel — chat view (hidden on mobile when showing list) */}
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
              <div className="text-[13px] font-semibold text-slate-400 dark:text-slate-500">Select a conversation</div>
              <div className="text-[11.5px] text-slate-300 dark:text-slate-600 mt-1">or compose a new message</div>
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
