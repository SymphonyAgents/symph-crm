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
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Download, Eye, History, Loader2, MoreVertical, Upload } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useGetAllProposals, useGetProposalVersions } from '@/lib/hooks/queries'
import { useDownloadProposalHtml, useUpdateProposalMeta, useUploadSignedProposalPdf } from '@/lib/hooks/mutations'
import { useSearchHotkey } from '@/lib/hooks/use-search-hotkey'
import { DataTableSkeleton } from '@/components/ui/data-table'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { TabFilter, type TabFilterItem } from '@/components/ui/tab-filter'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AvatarFallback, AvatarImage, AvatarRoot } from '@/components/ui/avatar'
import { StatusPill, type StatusPillTone } from '@/components/ui/status-pill'
import type { ApiProposalStatus, ApiProposalSummary, ApiProposalType, ApiProposalVersion } from '@/lib/types'

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

function downloadHtmlFile(title: string, html: string) {
  const safeTitle = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'proposal'
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${safeTitle}.html`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

// ─── Row (list) ─────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<ApiProposalStatus, string> = {
  draft: 'Draft',
  sent: 'Sent',
  signed: 'Signed',
}

const STATUS_TONES: Record<ApiProposalStatus, StatusPillTone> = {
  draft: 'neutral',
  sent: 'amber',
  signed: 'emerald',
}

function ProposalActionsMenu({
  p,
  onViewVersions,
  onDownloadHtml,
  onSignedPdfUpload,
  isHtmlPending,
  isPdfPending,
}: {
  p: ApiProposalSummary
  onViewVersions: () => void
  onDownloadHtml: () => void
  onSignedPdfUpload: (file: File) => void
  isHtmlPending: boolean
  isPdfPending: boolean
}) {
  const canUploadPdf = p.status === 'signed'
  const hasPdf = Boolean(p.signedPdfFileName)

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Proposal actions"
          className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-black/[.08] bg-white text-slate-500 shadow-sm transition-colors hover:bg-slate-100 hover:text-slate-800 active:scale-[0.96] dark:border-white/[.1] dark:bg-white/[.04] dark:text-slate-300 dark:hover:bg-white/[.08] dark:hover:text-white"
        >
          <MoreVertical className="h-4 w-4" strokeWidth={1.8} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-44 rounded-md p-1">
        <button
          type="button"
          onClick={onViewVersions}
          className="flex h-8 w-full items-center gap-2 rounded-md px-2.5 text-left text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/[.06]"
        >
          <History className="h-3.5 w-3.5" strokeWidth={1.8} />
          View versions
        </button>
        <button
          type="button"
          onClick={onDownloadHtml}
          disabled={isHtmlPending}
          className="flex h-8 w-full items-center gap-2 rounded-md px-2.5 text-left text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-300 dark:text-slate-200 dark:hover:bg-white/[.06] dark:disabled:text-slate-600"
        >
          {isHtmlPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.8} /> : <Download className="h-3.5 w-3.5" strokeWidth={1.8} />}
          Download HTML
        </button>
        <label className={cn(
          'flex h-8 w-full items-center gap-2 rounded-md px-2.5 text-left text-xs font-medium transition-colors',
          canUploadPdf && !isPdfPending
            ? 'cursor-pointer text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/[.06]'
            : 'cursor-not-allowed text-slate-300 dark:text-slate-600',
        )}>
          {isPdfPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.8} /> : <Upload className="h-3.5 w-3.5" strokeWidth={1.8} />}
          {hasPdf ? 'Replace PDF' : 'Upload PDF'}
          <input
            type="file"
            accept="application/pdf"
            className="sr-only"
            disabled={!canUploadPdf || isPdfPending}
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file && canUploadPdf && !isPdfPending) onSignedPdfUpload(file)
              event.target.value = ''
            }}
          />
        </label>
        <a
          href={hasPdf ? `/proposals/${p.id}/signed-pdf` : undefined}
          target="_blank"
          rel="noreferrer"
          aria-disabled={!hasPdf}
          className={cn(
            'flex h-8 w-full items-center gap-2 rounded-md px-2.5 text-xs font-medium transition-colors',
            hasPdf
              ? 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/[.06]'
              : 'pointer-events-none text-slate-300 dark:text-slate-600',
          )}
        >
          <Download className="h-3.5 w-3.5" strokeWidth={1.8} />
          Download PDF
        </a>
      </PopoverContent>
    </Popover>
  )
}

function ProposalRow({
  p,
  onOpen,
  onViewVersions,
  onStatusChange,
  onDownloadHtml,
  onSignedPdfUpload,
  showStatusControls,
  isStatusPending,
  isHtmlPending,
  isPdfPending,
}: {
  p: ApiProposalSummary
  onOpen: () => void
  onViewVersions: () => void
  onStatusChange: (status: ApiProposalStatus) => void
  onDownloadHtml: () => void
  onSignedPdfUpload: (file: File) => void
  showStatusControls: boolean
  isStatusPending: boolean
  isHtmlPending: boolean
  isPdfPending: boolean
}) {
  return (
    <TableRow
      onClick={onOpen}
      className="cursor-pointer transition-colors hover:bg-slate-50/70 dark:hover:bg-white/[.03]"
    >
      <TableCell className="py-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-slate-100 dark:bg-white/[.04]">
            <FileIcon size={16} className="text-slate-400" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-ssm font-semibold text-slate-900 dark:text-white">{p.title}</div>
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
          </div>
        </div>
      </TableCell>
      {showStatusControls && (
        <TableCell className="w-[118px] py-3" onClick={(event) => event.stopPropagation()}>
          <div className="flex items-center justify-end gap-1.5">
            {p.signedPdfFileName && <StatusPill tone="emerald">PDF</StatusPill>}
            <Select value={p.status} onValueChange={(value) => onStatusChange(value as ApiProposalStatus)} disabled={isStatusPending}>
              <SelectTrigger
                aria-label="Proposal status"
                size="sm"
                className="h-7 w-auto gap-1 border-transparent bg-transparent p-0 text-xs font-semibold shadow-none disabled:opacity-70 [&_svg]:h-3 [&_svg]:w-3"
              >
                <StatusPill tone={STATUS_TONES[p.status]}>
                  <SelectValue />
                </StatusPill>
              </SelectTrigger>
              <SelectContent align="start" className="min-w-[92px] rounded-md">
                <SelectItem value="draft" className="text-xs font-semibold">Draft</SelectItem>
                <SelectItem value="sent" className="text-xs font-semibold">Sent</SelectItem>
                <SelectItem value="signed" className="text-xs font-semibold">Signed</SelectItem>
              </SelectContent>
            </Select>
            {isStatusPending && <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" strokeWidth={1.8} />}
          </div>
        </TableCell>
      )}
      <TableCell className="w-[190px] py-3" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-end gap-1.5">
          <div className="hidden items-center gap-1.5 text-xxs text-slate-500 sm:flex">
            <span className="font-mono">v{p.currentVersion}</span>
            <span className="text-slate-300">·</span>
            <span>{relTime(p.updatedAt)}</span>
          </div>
          <ProposalActionsMenu
            p={p}
            onViewVersions={onViewVersions}
            onDownloadHtml={onDownloadHtml}
            onSignedPdfUpload={onSignedPdfUpload}
            isHtmlPending={isHtmlPending}
            isPdfPending={isPdfPending}
          />
        </div>
      </TableCell>
    </TableRow>
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
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { data: proposals = [], isLoading } = useGetAllProposals()
  const updateProposal = useUpdateProposalMeta()
  const downloadProposalHtml = useDownloadProposalHtml()
  const uploadSignedPdf = useUploadSignedProposalPdf()
  const [search, setSearch] = useState('')
  const pathType = pathname.split('/').filter(Boolean).at(-1)
  const typeFilter: ApiProposalType = pathType === 'presentation' || searchParams.get('type') === 'presentation' ? 'presentation' : 'formal'
  const statusParam = searchParams.get('status')
  const statusFilter: ApiProposalStatus | 'all' = statusParam === 'draft' || statusParam === 'sent' || statusParam === 'signed' ? statusParam : 'all'
  const [statusPendingId, setStatusPendingId] = useState<string | null>(null)
  const [htmlPendingId, setHtmlPendingId] = useState<string | null>(null)
  const [pdfPendingId, setPdfPendingId] = useState<string | null>(null)
  const [versionProposal, setVersionProposal] = useState<ApiProposalSummary | null>(null)
  const [versionsOpen, setVersionsOpen] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)

  useSearchHotkey({
    inputRef: searchInputRef,
    onClear: () => setSearch(''),
  })

  const typeCounts = useMemo(() => {
    return proposals.reduce<Record<ApiProposalType, number>>((acc, proposal) => {
      if (proposal.type) acc[proposal.type] += 1
      return acc
    }, { presentation: 0, formal: 0 })
  }, [proposals])

  const typeItems = useMemo<TabFilterItem<ApiProposalType>[]>(() => [
    { id: 'presentation', label: 'Presentation', count: typeCounts.presentation },
    { id: 'formal', label: 'Formal', count: typeCounts.formal },
  ], [typeCounts])

  const statusCounts = useMemo(() => {
    return proposals.reduce<Record<ApiProposalStatus | 'all', number>>((acc, proposal) => {
      if (proposal.type !== typeFilter) return acc
      acc.all += 1
      acc[proposal.status] += 1
      return acc
    }, { all: 0, draft: 0, sent: 0, signed: 0 })
  }, [proposals, typeFilter])

  const statusItems = useMemo<TabFilterItem<ApiProposalStatus | 'all'>[]>(() => [
    { id: 'all', label: 'All', count: statusCounts.all },
    { id: 'draft', label: 'Draft', count: statusCounts.draft },
    { id: 'sent', label: 'Sent', count: statusCounts.sent },
    { id: 'signed', label: 'Signed', count: statusCounts.signed },
  ], [statusCounts])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return proposals.filter(p => {
      if (p.type !== typeFilter) return false
      if (typeFilter === 'formal' && statusFilter !== 'all' && p.status !== statusFilter) return false
      if (!q) return true
      return (
        (p.title ?? '').toLowerCase().includes(q) ||
        (p.brandName ?? '').toLowerCase().includes(q) ||
        (p.dealTitle ?? '').toLowerCase().includes(q)
      )
    })
  }, [proposals, search, statusFilter, typeFilter])

  const showStatusControls = typeFilter === 'formal'

  function updateFilters(nextType: ApiProposalType, nextStatus: ApiProposalStatus | 'all' = 'all') {
    if (nextType === 'presentation') {
      router.push('/proposals/presentation', { scroll: false })
      return
    }

    router.push(`/proposals/formal?status=${nextStatus}`, { scroll: false })
  }

  const open = (id: string) => router.push(`/proposals/${id}`)
  const openVersion = (proposalId: string, versionId: string) => router.push(`/proposals/${proposalId}?versionId=${versionId}`)

  return (
    <div className="p-4 md:px-6 pb-6 w-full">
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <TabFilter items={typeItems} value={typeFilter} onChange={(next) => updateFilters(next)} />
        <div className="relative min-w-[260px] flex-1">
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
        {showStatusControls && <TabFilter items={statusItems} value={statusFilter} onChange={(next) => updateFilters('formal', next)} />}
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
        <div className="overflow-hidden rounded-md border border-black/[.06] bg-white shadow-[var(--shadow-card)] dark:border-white/[.08] dark:bg-[#1c1c1f]">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Proposal</TableHead>
                {showStatusControls && <TableHead className="w-[118px] text-right">Status</TableHead>}
                <TableHead className="w-[190px] text-right">Time and version</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(p => (
                <ProposalRow
                  key={p.id}
                  p={p}
                  onOpen={() => open(p.id)}
                  onViewVersions={() => { setVersionProposal(p); setVersionsOpen(true) }}
                  onStatusChange={(status) => {
                    setStatusPendingId(p.id)
                    updateProposal.mutate({ proposalId: p.id, status }, { onSettled: () => setStatusPendingId(null) })
                  }}
                  onDownloadHtml={() => {
                    setHtmlPendingId(p.id)
                    downloadProposalHtml.mutate(p.id, {
                      onSuccess: (proposal) => downloadHtmlFile(proposal.title, proposal.version.html),
                      onSettled: () => setHtmlPendingId(null),
                    })
                  }}
                  onSignedPdfUpload={(file) => {
                    setPdfPendingId(p.id)
                    uploadSignedPdf.mutate({ proposalId: p.id, file }, { onSettled: () => setPdfPendingId(null) })
                  }}
                  showStatusControls={showStatusControls}
                  isStatusPending={statusPendingId === p.id}
                  isHtmlPending={htmlPendingId === p.id}
                  isPdfPending={pdfPendingId === p.id}
                />
              ))}
            </TableBody>
          </Table>
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
