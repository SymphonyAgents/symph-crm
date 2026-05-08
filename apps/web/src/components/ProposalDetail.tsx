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

import { cn } from '@/lib/utils'
import { useGetProposalHead } from '@/lib/hooks/queries'
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

          {data.dealId && (
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
        </div>
      </div>

      {/* Full-width iframe — proposal HTML carries its own Download as PDF button */}
      <div className="flex-1 min-h-0 bg-slate-100 dark:bg-[#0f0f12]">
        <iframe
          key={proposalId}
          srcDoc={data.version.html}
          title={data.title}
          // No allow-same-origin: iframe can't read cookies / parent DOM.
          // allow-modals: required so the proposal's own window.print() can open the print dialog.
          sandbox="allow-scripts allow-forms allow-popups allow-modals"
          className="w-full h-full border-0 bg-white"
        />
      </div>
    </div>
  )
}
