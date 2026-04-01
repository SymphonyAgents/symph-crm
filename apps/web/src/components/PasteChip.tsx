'use client'

/**
 * PasteChip — Claude.ai-style paste card.
 *
 * When a user pastes bulk text, intercept it and show this chip instead of
 * dumping it inline. The chip shows a word-wrapped preview with a "PASTED"
 * badge at the bottom. Click to open PastePreviewModal with the full content.
 * X button (visible on hover) dismisses the chip.
 */

import { useEffect, useRef } from 'react'

// ── PasteChip ─────────────────────────────────────────────────────────────────

type PasteChipProps = {
  text: string
  onRemove: () => void
  onClick: () => void
}

export function PasteChip({ text, onRemove, onClick }: PasteChipProps) {
  // Up to ~280 chars of preview — enough for ~6 lines at this font size
  const preview = text.slice(0, 280) + (text.length > 280 ? '…' : '')

  return (
    <div className="px-4 pt-3 pb-0">
      <div className="relative inline-block max-w-[210px] group">
        {/* Card — clickable to expand */}
        <button
          type="button"
          onClick={onClick}
          className="w-full text-left p-3 rounded-xl bg-slate-100 dark:bg-white/[.06] border border-black/[.08] dark:border-white/[.10] hover:border-black/20 dark:hover:border-white/20 transition-colors"
        >
          {/* Word-wrapped preview text */}
          <p className="text-[12px] text-slate-500 dark:text-slate-400 leading-[1.55] line-clamp-6 break-words">
            {preview}
          </p>
          {/* PASTED badge */}
          <div className="mt-2.5">
            <span className="text-[9.5px] font-semibold tracking-[0.12em] uppercase text-slate-400 dark:text-slate-500 border border-slate-300 dark:border-white/[.15] rounded px-1.5 py-0.5">
              PASTED
            </span>
          </div>
        </button>

        {/* X — appears on hover, top-right corner */}
        <button
          type="button"
          onClick={e => { e.stopPropagation(); onRemove() }}
          className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-white dark:bg-[#2a2c30] border border-black/[.12] dark:border-white/[.15] flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
          aria-label="Remove pasted content"
        >
          <svg width={9} height={9} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.8} strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
    </div>
  )
}

// ── PastePreviewModal ─────────────────────────────────────────────────────────

type PastePreviewModalProps = {
  text: string
  onClose: () => void
}

export function PastePreviewModal({ text, onClose }: PastePreviewModalProps) {
  const lineCount = text.split('\n').length
  const charCount = text.length
  const sizeLabel = charCount < 1024 ? `${charCount} chars` : `${(charCount / 1024).toFixed(1)} KB`
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => { contentRef.current?.focus() }, [])

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-[#1a1d21] rounded-xl shadow-2xl border border-black/[.08] dark:border-white/[.08] w-[86vw] max-w-[720px] max-h-[80vh] flex flex-col animate-in fade-in-0 zoom-in-95 duration-150"
        onClick={e => e.stopPropagation()}
        onKeyDown={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-black/[.06] dark:border-white/[.08] shrink-0">
          <svg className="text-slate-400 shrink-0" width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
            <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
          </svg>
          <div className="flex-1 min-w-0">
            <div className="text-[14px] font-semibold text-slate-900 dark:text-white">Pasted content</div>
            <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1.5">
              <span>{lineCount} {lineCount === 1 ? 'line' : 'lines'}</span>
              <span>·</span>
              <span>{sizeLabel}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[.08] transition-colors shrink-0"
          >
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content — focusable so Ctrl+A selects within modal */}
        <div ref={contentRef} className="flex-1 overflow-y-auto outline-none" tabIndex={0}>
          <pre className="px-6 py-5 text-[12.5px] font-mono text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed overflow-x-auto">
            {text}
          </pre>
        </div>
      </div>
    </div>
  )
}
