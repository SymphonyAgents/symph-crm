'use client'

/**
 * Proposals — workspace-wide index.
 *
 * Replaces the deal-tree sidebar pattern. One fetch returns all proposals
 * with deal + brand context joined server-side. Click a card → /proposals/[id].
 *
 * Sorted newest-first by updatedAt server-side.
 */

import { useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, History } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useGetAllProposals, useGetProposalVersions } from '@/lib/hooks/queries'
import { useSearchHotkey } from '@/lib/hooks/use-search-hotkey'
import { DataTableSkeleton } from '@/components/ui/data-table'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AvatarFallback, AvatarImage, AvatarRoot } from '@/components/ui/avatar'
import type { ApiProposalSummary, ApiProposalVersion } from '@/lib/types'

function FileIcon({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth={1.4}
      strokeLinecap="round" strokeLinejoin="round"
      className={className}
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <line x1="8" y1="13" x2="15" y2="13" />
      <line x1="8" y1="17" x2="13" y2="17" />
    </svg>
  )
}

function initials(name?: string | null, email?: string | null) {
  const source = name || email || 'User'
  const parts = source.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  return source.slice(0, 2).toUpperCase()
}

function relTime(iso: string): string {
  const d = new Date(iso)
  const ms = Date.now() - d.getTime()
  const m = Math.floor(ms / 60_000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const days = Math.floor(h / 24)
  if (days < 7) return `${days}d ago`
  return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ─── Row (list) ─────────────────────────────────────────────────────────────

function ProposalRow({ p, onOpen, onViewVersions }: { p: ApiProposalSummary; onOpen: () => void; onViewVersions: () => void }) {
  return (
    <div
      className={cn(
        'w-full flex items-center gap-3 text-left',
        'px-3 py-2.5 rounded-lg',
        'hover:bg-slate-50 dark:hover:bg-white/[.04] transition-colors duration-150',
      )}
    >
      <button type="button" onClick={onOpen} className="w-9 h-9 rounded-md bg-slate-100 dark:bg-white/[.04] flex items-center justify-center shrink-0 transition-transform active:scale-[0.96]">
        <FileIcon size={16} className="text-slate-400" />
      </button>
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left transition-transform active:scale-[0.99]">
        <div className="text-ssm font-semibold text-slate-900 dark:text-white truncate">{p.title}</div>
        <div className="mt-1 flex min-w-0 items-center gap-1.5 text-xxs text-slate-500">
          <AvatarRoot className="h-4 w-4 border border-black/[.06] dark:border-white/[.08]">
            {p.creatorImage && <AvatarImage src={p.creatorImage} alt={p.creatorName || p.creatorEmail || 'Creator'} />}
            <AvatarFallback className="bg-slate-100 text-[8px] text-slate-500 dark:bg-white/[.06] dark:text-slate-300">
              {initials(p.creatorName, p.creatorEmail)}
            </AvatarFallback>
          </AvatarRoot>
          <span className="max-w-[120px] truncate" title={p.creatorName || p.creatorEmail || 'Creator'}>
            {p.creatorName || p.creatorEmail || 'Creator'}
          </span>
          {(p.brandName || p.dealTitle) && <span className="text-slate-300">·</span>}
          {p.brandName && <span className="truncate text-slate-400">{p.brandName}</span>}
          {p.brandName && p.dealTitle && <span className="text-slate-300">·</span>}
          {p.dealTitle && <span className="truncate text-slate-400">{p.dealTitle}</span>}
        </div>
      </button>
      <div className="hidden items-center gap-2 text-xxs text-slate-500 shrink-0 sm:flex">
        <span className="font-mono">v{p.currentVersion}</span>
        <span className="text-slate-300">·</span>
        <span>{relTime(p.updatedAt)}</span>
      </div>
      <button
        type="button"
        onClick={onViewVersions}
        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-black/[.08] px-2.5 text-xxs font-semibold text-slate-600 transition-colors hover:bg-white active:scale-[0.96] dark:border-white/[.1] dark:text-slate-300 dark:hover:bg-white/[.05]"
      >
        <History className="h-3.5 w-3.5" strokeWidth={1.8} />
        View versions
      </button>
    </div>
  )
}

function ProposalVersionsDialog({
  proposal,
  open,
  onOpenChange,
  onViewVersion,
}: {
  proposal: ApiProposalSummary | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onViewVersion: (version: ApiProposalVersion) => void
}) {
  const { data: versions = [], isLoading } = useGetProposalVersions(proposal?.id, { enabled: open && !!proposal?.id })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80dvh] w-[calc(100vw-2rem)] max-w-[560px] overflow-hidden rounded-lg">
        <DialogHeader className="px-4 sm:px-6">
          <div className="min-w-0">
            <DialogTitle>Proposal versions</DialogTitle>
            <DialogDescription className="mt-1 truncate">
              {proposal?.title ?? 'Select a proposal'}
            </DialogDescription>
          </div>
        </DialogHeader>
        <div className="max-h-[60dvh] overflow-auto p-3 sm:p-4">
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((item) => (
                <div key={item} className="h-14 rounded-md bg-slate-100 dark:bg-white/[.06] animate-pulse" />
              ))}
            </div>
          ) : versions.length === 0 ? (
            <div className="rounded-md border border-black/[.06] px-4 py-8 text-center dark:border-white/[.08]">
              <History className="mx-auto mb-2 h-5 w-5 text-slate-300 dark:text-slate-600" strokeWidth={1.6} />
              <p className="text-ssm font-semibold text-slate-700 dark:text-slate-200">No versions yet</p>
              <p className="mt-1 text-xxs text-slate-500 dark:text-slate-400">Saved proposal versions will appear here.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {versions.map((version) => (
                <div key={version.id} className="flex flex-col gap-3 rounded-md border border-black/[.06] bg-white px-3 py-2.5 dark:border-white/[.08] dark:bg-[#1c1c1f] sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-slate-900 dark:text-white">v{version.version}</span>
                      {version.wordCount != null && <span className="text-xxs text-slate-400 tabular-nums">{version.wordCount.toLocaleString()} words</span>}
                    </div>
                    <p className="mt-0.5 truncate text-xxs text-slate-500 dark:text-slate-400">
                      {version.changeNote || version.excerpt || 'Saved version'}
                    </p>
                    <p className="mt-1 text-atom text-slate-400 dark:text-slate-500">{relTime(version.createdAt)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onViewVersion(version)}
                    className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-3 text-xxs font-semibold text-white transition-colors hover:bg-slate-700 active:scale-[0.96] dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
                  >
                    <Eye className="h-3.5 w-3.5" strokeWidth={1.8} />
                    View
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Main ───────────────────────────────────────────────────────────────────

export function Proposals() {
  const router = useRouter()
  const { data: proposals = [], isLoading } = useGetAllProposals()
  const [search, setSearch] = useState('')
  const [versionProposal, setVersionProposal] = useState<ApiProposalSummary | null>(null)
  const [versionsOpen, setVersionsOpen] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)

  useSearchHotkey({
    inputRef: searchInputRef,
    onClear: () => setSearch(''),
  })

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return proposals
    return proposals.filter(p =>
      (p.title ?? '').toLowerCase().includes(q) ||
      (p.brandName ?? '').toLowerCase().includes(q) ||
      (p.dealTitle ?? '').toLowerCase().includes(q),
    )
  }, [proposals, search])

  const open = (id: string) => router.push(`/proposals/${id}`)
  const openVersion = (proposalId: string, versionId: string) => router.push(`/proposals/${proposalId}?versionId=${versionId}`)

  return (
    <div className="p-4 md:px-6 pb-6 w-full">
      <div className="flex items-center gap-3 mb-5">
        <div className="relative flex-1">
          <svg
            width={14} height={14} viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth={1.6}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
          >
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <input
            ref={searchInputRef}
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search proposals, brands, deals…"
            className="w-full h-9 pl-9 pr-3 text-xs rounded-lg bg-slate-100 dark:bg-white/[.04] border border-transparent focus:border-primary/30 focus:bg-white dark:focus:bg-[#1c1c1f] outline-none placeholder:text-slate-400 text-slate-900 dark:text-white"
          />
        </div>
      </div>

      {/* Body */}
      {isLoading ? (
        <div className="bg-white dark:bg-[#1c1c1f] border border-black/[.06] dark:border-white/[.08] rounded-xl shadow-[var(--shadow-card)] overflow-hidden">
          <DataTableSkeleton />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white dark:bg-[#1c1c1f] border border-black/[.06] dark:border-white/[.08] rounded-xl py-16 text-center">
          <FileIcon size={32} className="text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <div className="text-ssm font-semibold text-slate-700 dark:text-slate-200">
            {search ? 'No matches' : 'No proposals yet'}
          </div>
          <div className="text-xxs text-slate-500 mt-1">
            {search ? 'Try another search term.' : 'New proposals are created via Aria chat.'}
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-[#1c1c1f] border border-black/[.06] dark:border-white/[.08] rounded-xl shadow-[var(--shadow-card)] divide-y divide-black/[.06] dark:divide-white/[.06] overflow-hidden">
          {filtered.map(p => (
            <ProposalRow key={p.id} p={p} onOpen={() => open(p.id)} onViewVersions={() => { setVersionProposal(p); setVersionsOpen(true) }} />
          ))}
        </div>
      )}

      <ProposalVersionsDialog
        proposal={versionProposal}
        open={versionsOpen}
        onOpenChange={setVersionsOpen}
        onViewVersion={(version) => {
          if (!versionProposal) return
          setVersionsOpen(false)
          openVersion(versionProposal.id, version.id)
        }}
      />
    </div>
  )
}
