'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'
import { useGetDocumentContent, useGetDocumentPreview } from '@/lib/hooks/queries'
import { useUpdateDocument } from '@/lib/hooks/mutations'
import { useEscapeKey } from '@/lib/hooks/use-escape-key'
import { queryKeys } from '@/lib/query-keys'
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
  const qc = useQueryClient()
  const isMarkdown = isMarkdownDoc(doc)
  const isImage = isImageDoc(doc)
  const isAudio = isAudioDoc(doc)
  const canEdit = !isImage && !isAudio
  const [viewMode, setViewMode] = useState<ViewMode>('rendered')
  const [isEditing, setIsEditing] = useState(false)
  const [editedContent, setEditedContent] = useState('')
  const contentRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const isEditingRef = useRef(false)
  isEditingRef.current = isEditing

  // Fetch content for all non-image, non-audio documents (text, extracted PDF text, etc.)
  const { data, isLoading } = useGetDocumentContent(!isImage && !isAudio ? doc.id : null)

  // Fetch signed preview URL for images and audio (stored as binaries in ATTACHMENTS_BUCKET)
  const { data: preview, isLoading: previewLoading } = useGetDocumentPreview(
    isImage || isAudio ? doc.id : null,
  )

  const updateDocument = useUpdateDocument({
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.documents.content(doc.id) })
      setIsEditing(false)
    },
  })

  // Escape: cancel edit if editing, otherwise close modal
  useEscapeKey(useCallback(() => {
    if (isEditingRef.current) {
      setIsEditing(false)
    } else {
      onClose()
    }
  }, [onClose]))

  // Auto-focus the content area on mount so Ctrl+A selects within the modal
  useEffect(() => {
    if (!isEditing) contentRef.current?.focus()
  }, [isEditing])

  // Auto-focus textarea when entering edit mode
  useEffect(() => {
    if (isEditing) {
      textareaRef.current?.focus()
      // Place cursor at end
      const len = textareaRef.current?.value.length ?? 0
      textareaRef.current?.setSelectionRange(len, len)
    }
  }, [isEditing])

  const content = data?.content ?? ''

  function handleEnterEdit() {
    if (!canEdit || isEditing || !content) return
    setEditedContent(content)
    setIsEditing(true)
  }

  function handleCancelEdit() {
    setIsEditing(false)
    updateDocument.reset()
  }

  function handleSave() {
    if (!editedContent.trim()) return
    updateDocument.mutate({ id: doc.id, content: editedContent })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={isEditing ? undefined : onClose}
    >
      <div
        className="bg-white dark:bg-[#1a1d21] rounded-xl shadow-2xl border border-black/[.08] dark:border-white/[.08] w-[92vw] max-w-[860px] min-h-[60vh] max-h-[88vh] flex flex-col animate-in fade-in-0 zoom-in-95 duration-150"
        onClick={e => e.stopPropagation()}
        onKeyDown={e => {
          if (e.key === 'Escape') {
            if (isEditing) handleCancelEdit()
            else onClose()
          }
          e.stopPropagation()
        }}
      >
        {/* ── Header ────────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 p-4 border-b border-black/[.06] dark:border-white/[.08] shrink-0">
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
            <div className="text-sm font-semibold text-slate-900 dark:text-white truncate flex items-center gap-2" title={doc.title}>
              {doc.title}
              {isEditing && (
                <span className="inline-flex items-center gap-1 text-xxs font-medium text-amber-500 bg-amber-50 dark:bg-amber-500/10 px-1.5 py-0.5 rounded-md shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                  Editing
                </span>
              )}
            </div>
            <div className="text-xxs text-slate-400 mt-0.5 flex items-center gap-1.5 overflow-hidden whitespace-nowrap">
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

          {/* When editing: Cancel + Save buttons */}
          {isEditing ? (
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleCancelEdit}
                disabled={updateDocument.isPending}
                className="h-7 px-3 rounded-lg text-xxs font-medium text-slate-500 dark:text-slate-400 border border-black/[.08] dark:border-white/[.08] hover:bg-slate-50 dark:hover:bg-white/[.04] transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={updateDocument.isPending || !editedContent.trim()}
                className="h-7 px-3 rounded-lg text-xxs font-semibold text-white flex items-center gap-1.5 transition-colors disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, var(--primary), var(--color-primary-accent))' }}
              >
                {updateDocument.isPending ? (
                  <span className="inline-block w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
                Save
              </button>
            </div>
          ) : (
            <>
              {/* Rendered / Raw toggle — only for markdown, hidden while editing */}
              {isMarkdown && (
                <div className="flex items-center bg-slate-100 dark:bg-white/[.06] rounded-lg p-0.5 gap-0.5 shrink-0">
                  <button
                    onClick={() => setViewMode('rendered')}
                    className={`h-[26px] px-3 rounded-md text-xxs font-medium transition-all ${
                      viewMode === 'rendered'
                        ? 'bg-white dark:bg-[#1e1e21] text-slate-900 dark:text-white shadow-sm'
                        : 'text-slate-500 hover:text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    Rendered
                  </button>
                  <button
                    onClick={() => setViewMode('raw')}
                    className={`h-[26px] px-3 rounded-md text-xxs font-medium transition-all ${
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
                  className="h-7 px-2.5 rounded-lg flex items-center gap-1.5 text-xxs font-semibold text-slate-500 hover:text-primary hover:bg-primary/10 transition-colors shrink-0"
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
                  className="h-7 px-2.5 rounded-lg flex items-center gap-1.5 text-xxs font-semibold text-red-500 hover:text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-500/15 transition-colors shrink-0"
                  title="Delete"
                >
                  <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                  Delete
                </button>
              )}
            </>
          )}

          {/* Close */}
          <button
            onClick={isEditing ? handleCancelEdit : onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[.08] transition-colors shrink-0"
            title={isEditing ? 'Cancel editing' : 'Close'}
          >
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ── Content ───────────────────────────────────────────────────────── */}
        {isEditing ? (
          /* Inline edit textarea */
          <div className="flex-1 flex flex-col overflow-hidden">
            {updateDocument.error && (
              <div className="px-8 pt-4">
                <p className="text-xs text-red-500 bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 rounded-lg px-3 py-2">
                  {updateDocument.error.message}
                </p>
              </div>
            )}
            <textarea
              ref={textareaRef}
              value={editedContent}
              onChange={e => setEditedContent(e.target.value)}
              className="flex-1 w-full resize-none px-8 py-7 text-ssm font-mono text-slate-700 dark:text-slate-300 bg-transparent outline-none leading-relaxed placeholder:text-slate-300 dark:placeholder:text-slate-600"
              placeholder="Write your note here..."
              spellCheck={false}
            />
            <div className="px-8 py-2 border-t border-black/[.05] dark:border-white/[.05] flex items-center justify-between shrink-0">
              <span className="text-xxs text-slate-400">{editedContent.length} chars</span>
              <span className="text-xxs text-slate-400">Click Save or press <kbd className="px-1 py-0.5 rounded bg-slate-100 dark:bg-white/[.06] font-mono">Esc</kbd> to cancel</span>
            </div>
          </div>
        ) : (
          /* tabIndex + ref: makes this div focusable so Ctrl+A selects only its text */
          <div ref={contentRef} className="flex-1 overflow-y-auto outline-none" tabIndex={0}>
            {isLoading ? (
              <div className="flex items-center justify-center h-48">
                <div className="w-5 h-5 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
              </div>
            ) : isAudio ? (
              /* Audio playback via signed URL from ATTACHMENTS_BUCKET */
              previewLoading ? (
                <div className="flex items-center justify-center h-48">
                  <div className="w-5 h-5 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
                </div>
              ) : preview?.url ? (
                <div className="flex flex-col items-center justify-center gap-4 p-8 min-h-[200px]">
                  <svg width={36} height={36} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1} strokeLinecap="round" className="text-slate-300 dark:text-slate-600">
                    <path d="M9 18V5l12-2v13" />
                    <circle cx="6" cy="18" r="3" />
                    <circle cx="18" cy="16" r="3" />
                  </svg>
                  <audio
                    controls
                    src={preview.url}
                    className="w-full max-w-md"
                    style={{ colorScheme: 'light dark' }}
                  >
                    Your browser does not support the audio element.
                  </audio>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-48 gap-3 text-slate-400 px-6">
                  <svg width={36} height={36} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1} strokeLinecap="round" className="opacity-30">
                    <path d="M9 18V5l12-2v13" />
                    <circle cx="6" cy="18" r="3" />
                    <circle cx="18" cy="16" r="3" />
                  </svg>
                  <p className="text-xs">Audio not available</p>
                </div>
              )
            ) : isImage ? (
              /* Image preview via signed URL from ATTACHMENTS_BUCKET */
              previewLoading ? (
                <div className="flex items-center justify-center h-48">
                  <div className="w-5 h-5 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
                </div>
              ) : preview?.url ? (
                <div className="flex items-center justify-center p-6 min-h-[200px] bg-[repeating-conic-gradient(#f0f0f0_0%_25%,transparent_0%_50%)] dark:bg-[repeating-conic-gradient(#2a2a2a_0%_25%,transparent_0%_50%)] bg-[length:16px_16px]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={preview.url}
                    alt={doc.title}
                    className="max-w-full max-h-[65vh] rounded-lg object-contain shadow-md"
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-48 gap-3 text-slate-400 px-6">
                  <svg width={36} height={36} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1} strokeLinecap="round" className="opacity-30">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21 15 16 10 5 21" />
                  </svg>
                  <p className="text-xs">Image not available</p>
                </div>
              )
            ) : !content ? (
              /* No content — storage may not be configured */
              <div className="flex flex-col items-center justify-center h-48 gap-3 text-slate-400 px-6">
                <svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1} strokeLinecap="round" className="opacity-30">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                {doc.excerpt ? (
                  <div className="text-center max-w-[480px]">
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mb-1">Preview (excerpt)</p>
                    <p className="text-xs text-slate-400 leading-relaxed">{doc.excerpt}</p>
                  </div>
                ) : (
                  <>
                    <p className="text-xs">Content not available</p>
                    <p className="text-atom text-slate-300 dark:text-slate-600">Enable Supabase Storage to view full content</p>
                  </>
                )}
              </div>
            ) : isMarkdown && viewMode === 'rendered' ? (
              /*
               * Rendered markdown — Warp IDE layout:
               * Large H1, bold H2s, simple left-border blockquotes,
               * HR section dividers, comfortable 15px body, generous spacing.
               * Colors follow the app's own light/dark theme.
               * Click anywhere to edit.
               */
              <div
                className={`px-8 py-7 max-w-none overflow-x-auto${canEdit ? ' cursor-text' : ''}
                  prose dark:prose-invert
                  prose-headings:font-bold prose-headings:tracking-tight
                  prose-h1:text-[1.9rem] prose-h1:leading-tight prose-h1:mb-3 prose-h1:mt-0
                  prose-h2:text-[1.3rem] prose-h2:leading-snug prose-h2:mt-8 prose-h2:mb-3
                  prose-h3:text-[1.05rem] prose-h3:mt-6 prose-h3:mb-2
                  prose-p:text-sbase prose-p:leading-[1.75] prose-p:my-3
                  prose-strong:font-semibold
                  prose-a:text-primary prose-a:no-underline hover:prose-a:underline
                  prose-hr:my-8 prose-hr:border-0 prose-hr:h-px prose-hr:bg-gradient-to-r prose-hr:from-transparent prose-hr:via-primary/30 prose-hr:to-transparent
                  prose-ul:my-3 prose-ul:pl-5 prose-li:my-1 prose-li:text-sbase prose-li:leading-[1.7]
                  prose-ol:my-3 prose-ol:pl-5
                  prose-blockquote:border-l-[3px] prose-blockquote:border-primary/50
                  prose-blockquote:pl-4 prose-blockquote:py-0 prose-blockquote:my-3
                  prose-blockquote:not-italic prose-blockquote:text-slate-600 dark:prose-blockquote:text-slate-400
                  prose-blockquote:bg-primary/[.03] dark:prose-blockquote:bg-primary/[.06] prose-blockquote:rounded-r prose-blockquote:font-normal
                  prose-code:text-ssm prose-code:font-mono prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded
                  prose-code:bg-black/[.06] dark:prose-code:bg-white/[.08]
                  prose-code:text-slate-800 dark:prose-code:text-slate-200
                  prose-code:before:content-none prose-code:after:content-none
                  prose-pre:rounded-lg prose-pre:text-ssm
                  prose-pre:bg-black/[.04] dark:prose-pre:bg-white/[.05]
                  prose-pre:border prose-pre:border-black/[.07] dark:prose-pre:border-white/[.08]
                  prose-table:text-sm
                  prose-th:font-semibold prose-th:border-b prose-th:border-black/10 dark:prose-th:border-white/10
                  prose-td:border-b prose-td:border-black/[.05] dark:prose-td:border-white/[.05]`}
                onClick={canEdit ? handleEnterEdit : undefined}
                title={canEdit ? 'Click to edit' : undefined}
              >
                <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
                  {content}
                </ReactMarkdown>
              </div>
            ) : (
              /* Raw / plain text — mono font, whitespace preserved. Click to edit. */
              <pre
                className={`px-8 py-7 text-ssm font-mono text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed overflow-x-auto${canEdit ? ' cursor-text' : ''}`}
                onClick={canEdit ? handleEnterEdit : undefined}
                title={canEdit ? 'Click to edit' : undefined}
              >
                {content}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
