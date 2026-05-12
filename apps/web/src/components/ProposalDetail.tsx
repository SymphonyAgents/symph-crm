'use client'

/**
 * ProposalDetail — full-screen proposal view at /proposals/[id].
 *
 * Layout:
 *   ┌──────────────────────────────────────────────────────────┐
 *   │ ← Back · Title · v2 · 3201 words · changeNote · date · ⤓ │  ← sticky
 *   ├──────────────────────────────────────────────────────────┤
 *   │ [Linked deal pill — clicks to /deals/:dealId]            │
 *   ├──────────────────────────────────────────────────────────┤
 *   │                                                          │
 *   │   <iframe srcdoc={proposal.version.html} />              │
 *   │                                                          │
 *   └──────────────────────────────────────────────────────────┘
 *
 * "Download as PDF" calls iframe.contentWindow.print() — the iframe
 * sandbox includes allow-modals so the browser's print dialog can open.
 */

import { useState, useRef } from 'react'
import { cn } from '@/lib/utils'
import { useGetProposalHead } from '@/lib/hooks/queries'
import { useSaveProposalVersion } from '@/lib/hooks/mutations'
import { DataTableSkeleton } from '@/components/ui/data-table'

function ChevronLeftIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  )
}

function ArrowRightIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  )
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
}

interface ProposalDetailProps {
  proposalId: string
  onBack: () => void
  onOpenDeal: (dealId: string) => void
}

export function ProposalDetail({ proposalId, onBack, onOpenDeal }: ProposalDetailProps) {
  const { data, isLoading, error } = useGetProposalHead(proposalId)
  const [isEditing, setIsEditing] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const saveVersion = useSaveProposalVersion()

  function handleEnterEdit() {
    setIsEditing(true)
  }

  function handleCancelEdit() {
    setIsEditing(false)
  }

  function handleSave() {
    const iframeDoc = iframeRef.current?.contentDocument
    if (!iframeDoc) return
    // Strip edit markers before serializing
    iframeDoc.querySelectorAll<HTMLElement>('[contenteditable]').forEach(el => {
      el.removeAttribute('contenteditable')
      el.style.removeProperty('outline')
      el.style.removeProperty('border-radius')
      el.style.removeProperty('cursor')
    })
    const html = iframeDoc.documentElement.outerHTML
    saveVersion.mutate(
      { proposalId, html, changeNote: 'Inline edit' },
      { onSuccess: () => setIsEditing(false) },
    )
  }

  function injectContentEditable() {
    const iframeDoc = iframeRef.current?.contentDocument
    if (!iframeDoc || !isEditing) return
    iframeDoc.querySelectorAll<HTMLElement>('p, h1, h2, h3, h4, h5, h6, li, td, th, blockquote').forEach(el => {
      // Skip elements that have block-level children (they're containers, not text nodes)
      const hasBlockKids = Array.from(el.children).some(c =>
        ['P','DIV','H1','H2','H3','H4','H5','H6','UL','OL','LI','TABLE','TR','BLOCKQUOTE'].includes(c.tagName),
      )
      if (hasBlockKids) return
      el.contentEditable = 'true'
      el.style.outline = '2px dashed rgba(108, 99, 255, 0.35)'
      el.style.borderRadius = '3px'
      el.style.cursor = 'text'
    })
  }

  if (isLoading) {
    return (
      <div className="h-full flex flex-col bg-slate-50 dark:bg-[#0f0f12]">
        <div className="shrink-0 bg-white dark:bg-[#1c1c1f] border-b border-black/[.06] dark:border-white/[.08] h-[57px]" />
        <div className="flex-1 min-h-0 p-4 md:p-6 max-w-[1400px] mx-auto w-full">
          <div className="bg-white dark:bg-[#1c1c1f] border border-black/[.06] dark:border-white/[.08] rounded-xl shadow-[var(--shadow-card)] overflow-hidden">
            <DataTableSkeleton />
          </div>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 px-6 text-center">
        <div className="text-ssm font-semibold text-slate-700 dark:text-slate-200">
          {error?.message ?? 'Proposal not found'}
        </div>
        <button
          onClick={onBack}
          className="text-xs text-primary hover:underline"
        >
          ← Back to proposals
        </button>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col overflow-hidden bg-slate-50 dark:bg-[#0f0f12]">
      {/* Sticky header */}
      <div className="shrink-0 bg-white dark:bg-[#1c1c1f] border-b border-black/[.06] dark:border-white/[.08]">
        <div className="flex items-center gap-3 px-4 md:px-6 py-3 max-w-[1400px] mx-auto w-full">
          <button
            onClick={onBack}
            className="shrink-0 flex items-center gap-1.5 h-7 px-2 -ml-2 rounded-md text-xs font-medium text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[.05] transition-colors duration-150"
          >
            <ChevronLeftIcon size={14} />
            <span>Proposals</span>
          </button>

          <div className="w-px h-5 bg-black/[.08] dark:bg-white/[.08] shrink-0" />

          <div className="min-w-0 flex-1">
            <div className="text-ssm font-semibold text-slate-900 dark:text-white truncate" title={data.title}>
              {data.title}
            </div>
            <div className="text-xxs text-slate-500 mt-0.5 truncate flex items-center gap-1.5">
              <span className="font-mono">v{data.currentVersion}</span>
              {data.version.wordCount != null && (
                <>
                  <span className="text-slate-300">·</span>
                  <span className="font-mono">{data.version.wordCount.toLocaleString()} words</span>
                </>
              )}
              {data.version.changeNote && (
                <>
                  <span className="text-slate-300">·</span>
                  <span className="text-slate-400 truncate" title={data.version.changeNote}>
                    {data.version.changeNote}
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="hidden sm:block text-xxs text-slate-400 shrink-0 font-mono">
            {fmtDate(data.updatedAt)}
          </div>

          {data.dealId && !isEditing && (
            <button
              onClick={() => data.dealId && onOpenDeal(data.dealId)}
              className={cn(
                'shrink-0 flex items-center gap-1.5 h-8 px-3 rounded-lg',
                'bg-primary/10 text-primary',
                'text-xs font-semibold',
                'hover:bg-primary/15 transition-colors duration-150 active:scale-[0.98]',
              )}
            >
              <span>View deal</span>
              <ArrowRightIcon size={13} />
            </button>
          )}

          {/* Edit / Save / Cancel */}
          {isEditing ? (
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleCancelEdit}
                disabled={saveVersion.isPending}
                className="h-7 px-3 rounded-lg text-xxs font-medium text-slate-500 border border-black/[.08] hover:bg-slate-50 dark:hover:bg-white/[.04] transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saveVersion.isPending}
                className="h-7 px-3 rounded-lg text-xxs font-semibold text-white flex items-center gap-1.5 transition-colors disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, var(--primary), var(--color-primary-accent))' }}
              >
                {saveVersion.isPending ? (
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
            <button
              onClick={handleEnterEdit}
              className="shrink-0 h-7 px-2.5 rounded-lg flex items-center gap-1.5 text-xxs font-semibold text-slate-500 hover:text-primary hover:bg-primary/10 transition-colors"
            >
              <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              Edit
            </button>
          )}
        </div>
      </div>

      {/* Full-width iframe */}
      <div className="flex-1 min-h-0 bg-slate-100 dark:bg-[#0f0f12] relative">
        {isEditing && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 bg-primary/90 text-white text-xxs font-medium px-3 py-1 rounded-full shadow-md pointer-events-none">
            Click any text to edit
          </div>
        )}
        <iframe
          ref={iframeRef}
          key={`${proposalId}-${isEditing ? 'edit' : 'view'}`}
          srcDoc={data.version.html}
          title={data.title}
          // Edit mode: add allow-same-origin so we can access contentDocument for contenteditable.
          // View mode: no allow-same-origin, iframe can't read parent DOM or cookies.
          // allow-modals: required so the proposal's own window.print() opens the print dialog.
          sandbox={isEditing
            ? 'allow-scripts allow-forms allow-popups allow-modals allow-same-origin'
            : 'allow-scripts allow-forms allow-popups allow-modals'
          }
          className="w-full h-full border-0 bg-white"
          onLoad={injectContentEditable}
        />
      </div>
    </div>
  )
}
