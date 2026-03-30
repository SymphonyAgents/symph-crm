'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { cn } from '@/lib/utils'
import { queryKeys } from '@/lib/query-keys'

// ─── Types ────────────────────────────────────────────────────────────────────

interface SendEmailDto {
  to: string[]
  cc?: string[]
  subject: string
  body: string
  threadId?: string
  inReplyTo?: string
}

export interface ComposeWindowProps {
  open: boolean
  onClose: () => void
  /** Pre-filled for replies */
  initialTo?: string[]
  initialCc?: string[]
  initialSubject?: string
  initialBody?: string
  initialThreadId?: string
  initialInReplyTo?: string
  /** "New Message" | "Reply" — affects title */
  mode?: 'compose' | 'reply'
}

// ─── API ─────────────────────────────────────────────────────────────────────

async function sendEmailApi(dto: SendEmailDto): Promise<{ messageId: string; threadId: string }> {
  const res = await fetch('/api/gmail/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dto),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message ?? 'Failed to send email')
  }
  return res.json()
}

// ─── AddressInput — chip-style multi-email input ─────────────────────────────

function parseDisplayName(address: string): string {
  const match = address.match(/^(.+?)\s*<.+>$/)
  if (match) return match[1].trim().replace(/^["']|["']$/g, '')
  return address.split('@')[0]
}

function AddressInput({
  label,
  addresses,
  onChange,
  placeholder,
  autoFocus,
}: {
  label: string
  addresses: string[]
  onChange: (addrs: string[]) => void
  placeholder?: string
  autoFocus?: boolean
}) {
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  function commit(raw: string) {
    const trimmed = raw.trim().replace(/,+$/, '').trim()
    if (!trimmed) return
    onChange([...addresses, trimmed])
    setValue('')
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === 'Tab') {
      if (value.trim()) { e.preventDefault(); commit(value) }
    } else if (e.key === ',') {
      e.preventDefault()
      commit(value)
    } else if (e.key === 'Backspace' && !value && addresses.length > 0) {
      onChange(addresses.slice(0, -1))
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const pasted = e.clipboardData.getData('text')
    if (pasted.includes(',') || pasted.includes('\n')) {
      e.preventDefault()
      const parts = pasted.split(/[,\n]+/).map(s => s.trim()).filter(Boolean)
      onChange([...addresses, ...parts])
    }
  }

  return (
    <div
      className="flex items-start gap-1.5 px-3.5 py-2.5 border-b border-black/[.06] dark:border-white/[.06] cursor-text"
      onClick={() => inputRef.current?.focus()}
    >
      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mt-[3px] shrink-0 w-6">
        {label}
      </span>
      <div className="flex-1 flex flex-wrap gap-1 min-w-0">
        {addresses.map((addr, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/[0.08] text-primary text-[11.5px] font-medium max-w-[200px]"
          >
            <span className="truncate">{parseDisplayName(addr)}</span>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onChange(addresses.filter((_, j) => j !== i)) }}
              className="shrink-0 w-3.5 h-3.5 rounded-full flex items-center justify-center hover:bg-primary/20 transition-colors"
              aria-label={`Remove ${addr}`}
            >
              <svg width={8} height={8} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={value}
          autoFocus={autoFocus}
          onChange={e => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => commit(value)}
          onPaste={handlePaste}
          placeholder={addresses.length === 0 ? placeholder : ''}
          className="flex-1 min-w-[120px] text-[12.5px] text-slate-800 dark:text-slate-200 placeholder:text-slate-400 bg-transparent outline-none border-none py-0.5"
        />
      </div>
    </div>
  )
}

// ─── ComposeWindow ────────────────────────────────────────────────────────────

export function ComposeWindow({
  open,
  onClose,
  initialTo = [],
  initialCc = [],
  initialSubject = '',
  initialBody = '',
  initialThreadId,
  initialInReplyTo,
  mode = 'compose',
}: ComposeWindowProps) {
  const queryClient = useQueryClient()
  const bodyRef = useRef<HTMLTextAreaElement>(null)

  const [to, setTo] = useState<string[]>(initialTo)
  const [cc, setCc] = useState<string[]>(initialCc)
  const [subject, setSubject] = useState(initialSubject)
  const [body, setBody] = useState(initialBody)
  const [showCc, setShowCc] = useState(initialCc.length > 0)
  const [minimized, setMinimized] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)

  // Reset state when compose window opens with new initial values
  useEffect(() => {
    if (open) {
      setTo(initialTo)
      setCc(initialCc)
      setSubject(initialSubject)
      setBody(initialBody)
      setShowCc(initialCc.length > 0)
      setMinimized(false)
      setSendError(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const sendMutation = useMutation({
    mutationFn: sendEmailApi,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.gmail.inbox })
      onClose()
    },
    onError: (err: Error) => {
      setSendError(err.message)
    },
  })

  function handleSend() {
    setSendError(null)
    if (to.length === 0) { setSendError('Add at least one recipient'); return }
    if (!subject.trim()) { setSendError('Subject is required'); return }
    sendMutation.mutate({
      to,
      cc: cc.length > 0 ? cc : undefined,
      subject: subject.trim(),
      body: body.trim(),
      threadId: initialThreadId,
      inReplyTo: initialInReplyTo,
    })
  }

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      handleSend()
    }
  }, [to, cc, subject, body]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null

  return (
    <div
      className={cn(
        'fixed z-50 bg-card flex flex-col',
        // Mobile: full viewport overlay
        'inset-0',
        // Desktop: floating bottom-right widget
        'sm:inset-auto sm:bottom-0 sm:right-6 sm:w-[520px] sm:max-w-[calc(100vw-1.5rem)] sm:rounded-t-xl sm:shadow-[0_8px_40px_rgba(0,0,0,0.28)] sm:border sm:border-black/[.08] sm:dark:border-white/[.08]',
      )}
      onKeyDown={handleKeyDown}
    >
      {/* Title bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-900 shrink-0 cursor-default select-none">
        <span className="text-[12.5px] font-semibold text-white">
          {mode === 'reply' ? 'Reply' : 'New Message'}
        </span>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setMinimized(v => !v)}
            className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            title={minimized ? 'Expand' : 'Minimize'}
          >
            <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              {minimized ? <polyline points="18 15 12 9 6 15" /> : <polyline points="6 9 12 15 18 9" />}
            </svg>
          </button>
          <button
            onClick={onClose}
            className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            title="Close"
          >
            <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Body — hidden when minimized */}
      {!minimized && (
        <>
          {/* Address fields */}
          <AddressInput
            label="To"
            addresses={to}
            onChange={setTo}
            placeholder="Recipients"
            autoFocus={to.length === 0}
          />

          {showCc ? (
            <AddressInput
              label="Cc"
              addresses={cc}
              onChange={setCc}
              placeholder="CC recipients"
            />
          ) : (
            <div className="px-3.5 py-2 border-b border-black/[.06]">
              <button
                onClick={() => setShowCc(true)}
                className="text-[11px] font-medium text-slate-400 dark:text-slate-500 hover:text-primary transition-colors"
              >
                + Add Cc
              </button>
            </div>
          )}

          {/* Subject */}
          <div className="px-3.5 border-b border-black/[.06] dark:border-white/[.06]">
            <input
              type="text"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="Subject"
              className="w-full py-2.5 text-[12.5px] text-slate-800 dark:text-slate-200 placeholder:text-slate-400 bg-transparent outline-none border-none"
            />
          </div>

          {/* Body — flex-1 so it fills remaining height (especially on mobile fullscreen) */}
          <textarea
            ref={bodyRef}
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder="Write your message…"
            rows={8}
            className="flex-1 min-h-[160px] px-3.5 py-3 text-[12.5px] text-slate-800 dark:text-slate-200 placeholder:text-slate-400 bg-card outline-none border-none resize-none leading-relaxed"
          />

          {/* Footer */}
          <div className="flex items-center justify-between px-3.5 py-2.5 border-t border-black/[.06] dark:border-white/[.06] bg-slate-50/60 dark:bg-white/[.03] shrink-0">
            <div className="flex items-center gap-2">
              <button
                onClick={handleSend}
                disabled={sendMutation.isPending}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-primary hover:bg-primary/90 disabled:opacity-60 text-white text-[12px] font-semibold rounded-lg transition-colors active:scale-[0.98]"
              >
                {sendMutation.isPending ? (
                  <>
                    <div className="w-3 h-3 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    Sending…
                  </>
                ) : (
                  <>
                    Send
                    <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                      <line x1="22" y1="2" x2="11" y2="13" />
                      <polygon points="22 2 15 22 11 13 2 9 22 2" />
                    </svg>
                  </>
                )}
              </button>
              <span className="text-[10.5px] text-slate-400 dark:text-slate-500">Ctrl+Enter to send</span>
            </div>
            <button
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
              title="Discard"
            >
              <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14H6L5 6" />
                <path d="M10 11v6M14 11v6" />
              </svg>
            </button>
          </div>

          {/* Error */}
          {sendError && (
            <div className="px-3.5 py-2 bg-red-50 dark:bg-red-950/30 border-t border-red-100 dark:border-red-900/40">
              <p className="text-[11px] text-red-600 dark:text-red-400">{sendError}</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
