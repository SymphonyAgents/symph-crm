'use client'

import { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { Textarea } from '@/components/ui/textarea'

type ChatWidgetProps = {
  onSubmit: (message: string) => void
}

export function ChatWidget({ onSubmit }: ChatWidgetProps) {
  const [value, setValue] = useState('')
  const [focused, setFocused] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const t = setTimeout(() => textareaRef.current?.focus(), 500)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
  }, [value])

  function handleSubmit() {
    const trimmed = value.trim()
    if (!trimmed) return
    onSubmit(trimmed)
    setValue('')
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className="mb-5">
      <div
        className={cn(
          'flex items-end gap-2.5 px-4 py-3 bg-white dark:bg-[#1e1e21] rounded-lg transition-all duration-150',
          focused
            ? 'border border-black/30 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_1px_3px_rgba(0,0,0,0.04),0_0_0_3px_rgba(0,0,0,0.05)]'
            : 'border border-black/[.06] dark:border-white/[.08] shadow-[var(--shadow-card)]'
        )}
      >
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about your pipeline, deals, follow-ups..."
          rows={1}
          className="flex-1 border-none outline-none bg-transparent text-[13px] text-slate-900 dark:text-white leading-[1.5] resize-none overflow-hidden min-h-5 max-h-[120px] focus-visible:ring-0 focus-visible:border-transparent px-0 py-0 rounded-none"
        />

        {/* Mic */}
        <button className="shrink-0 w-8 h-8 rounded flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[.06] dark:bg-white/[.06] transition-colors duration-150">
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
            <path d="M19 10v2a7 7 0 01-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
        </button>

        {/* Send */}
        <button
          onClick={handleSubmit}
          className={cn(
            'shrink-0 w-8 h-8 rounded flex items-center justify-center transition-colors duration-150',
            value.trim()
              ? 'bg-primary hover:bg-primary-hover cursor-pointer'
              : 'bg-slate-100 dark:bg-white/[.06] cursor-default'
          )}
        >
          <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={value.trim() ? '#fff' : '#94a3b8'} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>

      <div className="flex gap-1.5 mt-2 flex-wrap">
        {['What deals need follow-up?', 'Summarize Mlhuillier pipeline', 'Who has the highest win rate?'].map((prompt) => (
          <button
            key={prompt}
            onClick={() => onSubmit(prompt)}
            className="px-[10px] py-1 rounded-full border border-black/[.06] dark:border-white/[.08] bg-white dark:bg-[#1e1e21] text-[11px] font-medium text-slate-600 dark:text-slate-400 hover:border-slate-300 hover:text-slate-900 dark:text-white transition-colors duration-150"
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  )
}
