'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'
import { useGetDocumentContent } from '@/lib/hooks/queries'
import { useEscapeKey } from '@/lib/hooks/use-escape-key'
import type { ApiDocument } from '@/lib/types'

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Markdown if storagePath ends in .md, or tags include 'markdown'/'notes'.
 * Covers both inline notes (auto-derived .md path) and uploaded .md/.txt files.
 */
function isMarkdownDoc(doc: ApiDocument): boolean {
  if (doc.storagePath?.endsWith('.md')) return true
  if (doc.tags?.includes('markdown')) return true
  if (doc.tags?.includes('notes')) return true
  return false
}

/** Image if tags contain a known image extension */
function isImageDoc(doc: ApiDocument): boolean {
  return ['jpeg', 'jpg', 'png', 'webp', 'gif'].some(t => doc.tags?.includes(t))
}


/** Audio if tags contain a known audio extension */
function isAudioDoc(doc: ApiDocument): boolean {
  return ['mp4', 'x-m4a', 'mpeg', 'mp3', 'm4a'].some(t => doc.tags?.includes(t))
}
/** Friendly type label from tags */
function getFileTypeLabel(doc: ApiDocument): string {
  if (!doc.tags?.length) return 'Note'
  const ext = doc.tags.find(t => !['notes', 'resources'].includes(t))
  return ext ? ext.toUpperCase() : 'Document'
}

// ── Component ─────────────────────────────────────────────────────────────────

type ViewMode = 'rendered' | 'raw'

type DocumentViewerModalProps = {
  doc: ApiDocument
  onClose: () => void
  onDelete?: (doc: ApiDocument) => void
  onDownload?: (doc: ApiDocument) => void
}

export function DocumentViewerModal({ doc, onClose, onDelete, onDownload }: DocumentViewerModalProps) {
  const isMarkdown = isMarkdownDoc(doc)
  const isImage = isImageDoc(doc)
  const isAudio = isAudioDoc(doc)
  const [viewMode, setViewMode] = useState<ViewMode>('rendered')
  const contentRef = useRef<HTMLDivElement>(null)

  // Fetch content for all non-image documents (text, extracted PDF text, etc.)
  const { data, isLoading } = useGetDocumentContent(!isImage && !isAudio ? doc.id : null)

  useEscapeKey(useCallback(onClose, [onClose]))

  // Auto-focus the content area on mount so Ctrl+A selects within the modal
  useEffect(() => {
    contentRef.current?.focus()
  }, [])

  const content = data?.content ?? ''

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-[#1a1d21] rounded-xl shadow-2xl border border-black/[.08] dark:border-white/[.08] w-[92vw] max-w-[860px] max-h-[88vh] flex flex-col animate-in fade-in-0 zoom-in-95 duration-150"
        onClick={e => e.stopPropagation()}
        onKeyDown={e => { if (e.key === 'Escape') { onClose(); } e.stopPropagation(); }}
      >
        {/* ── Header ────────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-black/[.06] dark:border-white/[.08] shrink-0">
          {/* File icon */}
          <div className="text-slate-400 shrink-0">
            {isImage ? (
              <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
            ) : (
              <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
            )}
          </div>

          {/* Title + meta */}
          <div className="flex-1 min-w-0 max-w-[calc(100%-200px)] md:max-w-none">
            <div className="text-[14px] font-semibold text-slate-900 dark:text-white truncate" title={doc.title}>
              {doc.title}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1.5 overflow-hidden whitespace-nowrap">
              {/* Clean breadcrumb — just category / filename, not the full UUID path */}
              {doc.storagePath && (() => {
                const parts = doc.storagePath.replace(/^\//, '').split('/').filter(Boolean)
                const category = parts.find(p => ['notes', 'resources', 'uploads', 'documents'].includes(p.toLowerCase()))
                const filename = parts[parts.length - 1]
                const breadcrumb = category ? `${category} / ${filename}` : filename
                return breadcrumb ? (
                  <span className="text-slate-300 dark:text-slate-600 truncate max-w-[180px]" title={doc.storagePath}>{breadcrumb}</span>
                ) : null
              })()}
              <span className="shrink-0">{getFileTypeLabel(doc)}</span>
              <span>·</span>
              <span className="shrink-0">{new Date(doc.createdAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
              {doc.wordCount != null && doc.wordCount > 0 && (
                <>
                  <span>·</span>
                  <span className="shrink-0">{doc.wordCount} words</span>
                </>
              )}
            </div>
          </div>

          {/* Rendered / Raw toggle — only for markdown */}
          {isMarkdown && (
            <div className="flex items-center bg-slate-100 dark:bg-white/[.06] rounded-lg p-0.5 gap-0.5 shrink-0">
              <button
                onClick={() => setViewMode('rendered')}
                className={`h-[26px] px-3 rounded-md text-[11px] font-medium transition-all ${
                  viewMode === 'rendered'
                    ? 'bg-white dark:bg-[#1e1e21] text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-300'
                }`}
              >
                Rendered
              </button>
              <button
                onClick={() => setViewMode('raw')}
                className={`h-[26px] px-3 rounded-md text-[11px] font-medium transition-all ${
                  viewMode === 'raw'
                    ? 'bg-white dark:bg-[#1e1e21] text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-300'
                }`}
              >
                Raw
              </button>
            </div>
          )}

          {/* Download */}
          {onDownload && (
            <button
              onClick={() => onDownload(doc)}
              className="h-7 px-2.5 rounded-lg flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 hover:text-primary hover:bg-primary/10 transition-colors shrink-0"
              title="Download"
            >
              <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Download
            </button>
          )}

          {/* Delete */}
          {onDelete && (
            <button
              onClick={() => onDelete(doc)}
              className="h-7 px-2.5 rounded-lg flex items-center gap-1.5 text-[11px] font-semibold text-red-500 hover:text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-500/15 transition-colors shrink-0"
              title="Delete"
            >
              <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
              Delete
            </button>
          )}

          {/* Close */}
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[.08] transition-colors shrink-0"
          >
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ── Content ───────────────────────────────────────────────────────── */}
        {/* tabIndex + ref: makes this div focusable so Ctrl+A selects only its text */}
        <div ref={contentRef} className="flex-1 overflow-y-auto outline-none" tabIndex={0}>
          {isLoading ? (
            <div className="flex items-center justify-center h-48">
              <div className="w-5 h-5 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
            </div>
          ) : isAudio ? (
            /* Audio playback — requires signed URL from Supabase Storage */
            <div className="flex flex-col items-center justify-center h-48 gap-3 text-slate-400 px-6">
              <svg width={36} height={36} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1} strokeLinecap="round" className="opacity-30">
                <path d="M9 18V5l12-2v13" />
                <circle cx="6" cy="18" r="3" />
                <circle cx="18" cy="16" r="3" />
              </svg>
              <p className="text-[12px] text-center">Audio playback requires Supabase Storage</p>
              <p className="text-[10px] text-slate-300 dark:text-slate-600 text-center">
                Add SUPABASE_SERVICE_ROLE_KEY to enable audio playback
              </p>
            </div>
          ) : isImage ? (
            /* Images require signed URL — not available without Supabase configured */
            <div className="flex flex-col items-center justify-center h-48 gap-3 text-slate-400 px-6">
              <svg width={36} height={36} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1} strokeLinecap="round" className="opacity-30">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
              <p className="text-[12px] text-center">Image preview requires Supabase Storage</p>
              <p className="text-[10px] text-slate-300 dark:text-slate-600 text-center">
                Add SUPABASE_SERVICE_ROLE_KEY to enable inline previews
              </p>
            </div>
          ) : !content ? (
            /* No content — storage may not be configured */
            <div className="flex flex-col items-center justify-center h-48 gap-3 text-slate-400 px-6">
              <svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1} strokeLinecap="round" className="opacity-30">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              {doc.excerpt ? (
                <div className="text-center max-w-[480px]">
                  <p className="text-[12px] text-slate-500 dark:text-slate-400 font-medium mb-1">Preview (excerpt)</p>
                  <p className="text-[12px] text-slate-400 leading-relaxed">{doc.excerpt}</p>
                </div>
              ) : (
                <>
                  <p className="text-[12px]">Content not available</p>
                  <p className="text-[10px] text-slate-300 dark:text-slate-600">Enable Supabase Storage to view full content</p>
                </>
              )}
            </div>
          ) : isMarkdown && viewMode === 'rendered' ? (
            /*
             * Rendered markdown — Warp IDE layout:
             * Large H1, bold H2s, simple left-border blockquotes,
             * HR section dividers, comfortable 15px body, generous spacing.
             * Colors follow the app's own light/dark theme.
             */
            <div className="px-8 py-7 max-w-none overflow-x-auto
              prose dark:prose-invert
              prose-headings:font-bold prose-headings:tracking-tight
              prose-h1:text-[1.9rem] prose-h1:leading-tight prose-h1:mb-3 prose-h1:mt-0
              prose-h2:text-[1.3rem] prose-h2:leading-snug prose-h2:mt-8 prose-h2:mb-3
              prose-h3:text-[1.05rem] prose-h3:mt-6 prose-h3:mb-2
              prose-p:text-[15px] prose-p:leading-[1.75] prose-p:my-3
              prose-strong:font-semibold
              prose-a:text-primary prose-a:no-underline hover:prose-a:underline
              prose-hr:my-8 prose-hr:border-0 prose-hr:h-px prose-hr:bg-gradient-to-r prose-hr:from-transparent prose-hr:via-primary/30 prose-hr:to-transparent
              prose-ul:my-3 prose-ul:pl-5 prose-li:my-1 prose-li:text-[15px] prose-li:leading-[1.7]
              prose-ol:my-3 prose-ol:pl-5
              prose-blockquote:border-l-[3px] prose-blockquote:border-primary/50
              prose-blockquote:pl-4 prose-blockquote:py-0 prose-blockquote:my-3
              prose-blockquote:not-italic prose-blockquote:text-slate-600 dark:prose-blockquote:text-slate-400
              prose-blockquote:bg-primary/[.03] dark:prose-blockquote:bg-primary/[.06] prose-blockquote:rounded-r prose-blockquote:font-normal
              prose-code:text-[13px] prose-code:font-mono prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded
              prose-code:bg-black/[.06] dark:prose-code:bg-white/[.08]
              prose-code:text-slate-800 dark:prose-code:text-slate-200
              prose-code:before:content-none prose-code:after:content-none
              prose-pre:rounded-lg prose-pre:text-[13px]
              prose-pre:bg-black/[.04] dark:prose-pre:bg-white/[.05]
              prose-pre:border prose-pre:border-black/[.07] dark:prose-pre:border-white/[.08]
              prose-table:text-[14px]
              prose-th:font-semibold prose-th:border-b prose-th:border-black/10 dark:prose-th:border-white/10
              prose-td:border-b prose-td:border-black/[.05] dark:prose-td:border-white/[.05]">
              <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
                {content}
              </ReactMarkdown>
            </div>
          ) : (
            /* Raw / plain text — mono font, whitespace preserved */
            <pre className="px-8 py-7 text-[13px] font-mono text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed overflow-x-auto">
              {content}
            </pre>
          )}
        </div>
      </div>
    </div>
  )
}
