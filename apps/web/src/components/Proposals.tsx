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
import { getProposalTitleFromUploadFile, isHtmlProposalFile } from '@/lib/utils/proposal-utils'
import { useGetAllProposals, useGetDeals, useGetProposalVersions } from '@/lib/hooks/queries'
import { useCreateProposal, useDownloadProposalHtml, useSaveProposalVersion, useUpdateProposalMeta, useUploadSignedProposalPdf } from '@/lib/hooks/mutations'
import { useSearchHotkey } from '@/lib/hooks/use-search-hotkey'
import { DataTableSkeleton } from '@/components/ui/data-table'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { TabFilter, type TabFilterItem } from '@/components/ui/tab-filter'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AvatarFallback, AvatarImage, AvatarRoot } from '@/components/ui/avatar'
import { SearchInput } from '@/components/ui/search-input'
import { StatusPill, type StatusPillTone } from '@/components/ui/status-pill'
import { Combobox } from '@/components/ui/combobox'
import type { ApiDeal, ApiProposalStatus, ApiProposalSummary, ApiProposalType, ApiProposalVersion } from '@/lib/types'

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
  onUploadHtmlVersion,
  onSignedPdfUpload,
  isHtmlPending,
  isPdfPending,
}: {
  p: ApiProposalSummary
  onViewVersions: () => void
  onDownloadHtml: () => void
  onUploadHtmlVersion: () => void
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
          className="inline-flex h-7 w-7 items-center justify-center rounded-control border border-border bg-card text-muted-foreground shadow-sm transition-colors hover:border-border-strong hover:bg-surface-hover hover:text-foreground active:scale-[0.96]"
        >
          <MoreVertical className="h-4 w-4" strokeWidth={1.8} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-44 rounded-md p-1">
        <button
          type="button"
          onClick={onViewVersions}
          className="flex h-8 w-full items-center gap-2 rounded-md px-2.5 text-left text-xs font-medium text-popover-foreground transition-colors hover:bg-surface-hover"
        >
          <History className="h-3.5 w-3.5" strokeWidth={1.8} />
          View versions
        </button>
        <button
          type="button"
          onClick={onDownloadHtml}
          disabled={isHtmlPending}
          className="flex h-8 w-full items-center gap-2 rounded-md px-2.5 text-left text-xs font-medium text-popover-foreground transition-colors hover:bg-surface-hover disabled:cursor-not-allowed disabled:text-text-faint"
        >
          {isHtmlPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.8} /> : <Download className="h-3.5 w-3.5" strokeWidth={1.8} />}
          Download HTML
        </button>
        <button
          type="button"
          onClick={onUploadHtmlVersion}
          className="flex h-8 w-full items-center gap-2 rounded-md px-2.5 text-left text-xs font-medium text-popover-foreground transition-colors hover:bg-surface-hover"
        >
          <Upload className="h-3.5 w-3.5" strokeWidth={1.8} />
          Upload HTML version
        </button>
        <label className={cn(
          'flex h-8 w-full items-center gap-2 rounded-md px-2.5 text-left text-xs font-medium transition-colors',
          canUploadPdf && !isPdfPending
            ? 'cursor-pointer text-popover-foreground hover:bg-surface-hover'
            : 'cursor-not-allowed text-text-faint',
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
              ? 'text-popover-foreground hover:bg-surface-hover'
              : 'pointer-events-none text-text-faint',
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
  onUploadHtmlVersion,
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
  onUploadHtmlVersion: () => void
  onSignedPdfUpload: (file: File) => void
  showStatusControls: boolean
  isStatusPending: boolean
  isHtmlPending: boolean
  isPdfPending: boolean
}) {
  return (
    <TableRow
      onClick={onOpen}
      className="cursor-pointer transition-colors hover:bg-surface-alt"
    >
      <TableCell className="py-3.5">
        <div className="flex min-w-0 items-center gap-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-secondary">
            <FileIcon size={16} className="text-slate-400" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-ssm font-medium text-foreground">{p.title}</div>
            <div className="mt-1.5 flex min-w-0 items-center gap-1.5 text-xxs text-slate-500">
              <AvatarRoot className="h-4 w-4 border border-border">
                {p.creatorImage && <AvatarImage src={p.creatorImage} alt={p.creatorName || p.creatorEmail || 'Creator'} />}
                <AvatarFallback className="bg-secondary text-[8px] text-muted-foreground">
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
        <TableCell className="w-[118px] py-3.5" onClick={(event) => event.stopPropagation()}>
          <div className="flex items-center justify-end gap-1.5">
            {p.signedPdfFileName && <StatusPill tone="emerald">PDF</StatusPill>}
            <Select value={p.status} onValueChange={(value) => onStatusChange(value as ApiProposalStatus)} disabled={isStatusPending}>
              <SelectTrigger
                aria-label="Proposal status"
                size="sm"
                className="h-7 w-auto gap-1 border-transparent bg-transparent p-0 text-xs font-medium shadow-none disabled:opacity-70 [&_svg]:h-3 [&_svg]:w-3"
              >
                <StatusPill tone={STATUS_TONES[p.status]}>
                  <SelectValue />
                </StatusPill>
              </SelectTrigger>
              <SelectContent align="start" className="min-w-[92px] rounded-md">
                <SelectItem value="draft" className="text-xs font-medium">Draft</SelectItem>
                <SelectItem value="sent" className="text-xs font-medium">Sent</SelectItem>
                <SelectItem value="signed" className="text-xs font-medium">Signed</SelectItem>
              </SelectContent>
            </Select>
            {isStatusPending && <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" strokeWidth={1.8} />}
          </div>
        </TableCell>
      )}
      <TableCell className="w-[190px] py-3.5" onClick={(event) => event.stopPropagation()}>
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
            onUploadHtmlVersion={onUploadHtmlVersion}
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
                <div key={item} className="h-14 rounded-md bg-secondary animate-pulse" />
              ))}
            </div>
          ) : versions.length === 0 ? (
            <div className="rounded-md border border-border px-4 py-8 text-center">
              <History className="mx-auto mb-2 h-5 w-5 text-text-faint" strokeWidth={1.6} />
              <p className="text-ssm font-medium text-foreground">No versions yet</p>
              <p className="mt-1 text-xxs text-muted-foreground">Saved proposal versions will appear here.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {versions.map((version) => (
                <div key={version.id} className="flex flex-col gap-3 rounded-md border border-border bg-card px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-medium text-foreground">v{version.version}</span>
                      {version.wordCount != null && <span className="text-xxs text-slate-400 tabular-nums">{version.wordCount.toLocaleString()} words</span>}
                    </div>
                    <p className="mt-0.5 truncate text-xxs text-muted-foreground">
                      {version.changeNote || version.excerpt || 'Saved version'}
                    </p>
                    <p className="mt-1 text-atom text-text-faint">{relTime(version.createdAt)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onViewVersion(version)}
                    className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 text-xxs font-medium text-primary-foreground transition-colors hover:bg-primary-hover active:scale-[0.96]"
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

type UploadHtmlVersionDialogProps = {
  proposal: ApiProposalSummary | null
  open: boolean
  onOpenChange: (open: boolean) => void
  isPending: boolean
  onUpload: (input: { html: string; changeNote: string }) => void
}

function UploadHtmlVersionDialog({ proposal, open, onOpenChange, isPending, onUpload }: UploadHtmlVersionDialogProps) {
  const [file, setFile] = useState<File | null>(null)
  const [changeNote, setChangeNote] = useState('Uploaded HTML version')
  const [fileError, setFileError] = useState<string | null>(null)
  const isValidHtml = isHtmlProposalFile(file)
  const canSubmit = Boolean(proposal && file && isValidHtml) && !isPending

  function reset() {
    setFile(null)
    setChangeNote('Uploaded HTML version')
    setFileError(null)
  }

  function handleFileChange(nextFile: File | null) {
    setFile(nextFile)
    if (!nextFile) {
      setFileError(null)
      return
    }
    if (!isHtmlProposalFile(nextFile)) {
      setFileError('Upload an HTML file only (.html or .htm).')
      return
    }
    setFileError(null)
  }

  async function handleSubmit() {
    if (!canSubmit || !file) return
    const html = await file.text()
    onUpload({ html, changeNote: changeNote.trim() || 'Uploaded HTML version' })
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { onOpenChange(next); if (!next) reset() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="min-w-0">
            <DialogTitle>Upload HTML version</DialogTitle>
            <DialogDescription className="mt-1 truncate">{proposal?.title ?? 'Select a proposal'}</DialogDescription>
          </div>
        </DialogHeader>
        <div className="space-y-4 p-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-foreground">HTML file</label>
            <input
              type="file"
              accept=".html,.htm,text/html"
              onChange={event => handleFileChange(event.target.files?.[0] ?? null)}
              className="block w-full rounded-md border border-border bg-card px-3 py-2 text-xs text-muted-foreground file:mr-3 file:rounded-control file:border-0 file:bg-secondary file:px-2.5 file:py-1 file:text-xs file:font-medium file:text-foreground hover:bg-surface-hover"
            />
            {fileError && <p className="mt-1 text-xxs text-danger-foreground">{fileError}</p>}
            {file && !fileError && <p className="mt-1 truncate text-xxs text-text-faint">{file.name}</p>}
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-foreground">Change note</label>
            <input
              value={changeNote}
              onChange={event => setChangeNote(event.target.value)}
              className="h-9 w-full rounded-md border border-border bg-card px-3 text-xs text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-1 focus:ring-primary-ring"
              placeholder="Uploaded HTML version"
            />
          </div>
        </div>
        <div className="flex items-center gap-2 border-t border-border p-4">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="h-9 flex-1 rounded-md border border-border text-xs font-medium text-muted-foreground transition-colors hover:bg-surface-hover"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => { void handleSubmit() }}
            disabled={!canSubmit}
            className={cn(
              'flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md text-xs font-medium text-white transition-colors disabled:cursor-not-allowed disabled:opacity-60',
              canSubmit && 'bg-primary hover:bg-primary/90',
              !canSubmit && 'bg-secondary text-muted-foreground',
            )}
          >
            {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.8} />}
            Upload version
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

type UploadProposalDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  deals: ApiDeal[]
  dealsLoading: boolean
  onCreated: (proposalId: string) => void
}

function UploadProposalDialog({ open, onOpenChange, deals, dealsLoading, onCreated }: UploadProposalDialogProps) {
  const createProposal = useCreateProposal()
  const [file, setFile] = useState<File | null>(null)
  const [dealId, setDealId] = useState('')
  const [title, setTitle] = useState('')
  const [type, setType] = useState<ApiProposalType>('formal')
  const [changeNote, setChangeNote] = useState('Uploaded HTML proposal')
  const [fileError, setFileError] = useState<string | null>(null)
  const isValidHtml = isHtmlProposalFile(file)
  const dealOptions = useMemo(() => deals.map(deal => ({
    value: deal.id,
    label: `${deal.title}${deal.brandName ? ` · ${deal.brandName}` : ''}`,
  })), [deals])
  const canSubmit = Boolean(file && isValidHtml && dealId && title.trim()) && !createProposal.isPending

  function reset() {
    setFile(null)
    setDealId('')
    setTitle('')
    setType('formal')
    setChangeNote('Uploaded HTML proposal')
    setFileError(null)
  }

  function handleFileChange(nextFile: File | null) {
    setFile(nextFile)
    if (!nextFile) {
      setFileError(null)
      setTitle('')
      return
    }
    if (!isHtmlProposalFile(nextFile)) {
      setFileError('Upload an HTML file only (.html or .htm).')
      setTitle('')
      return
    }
    setFileError(null)
    setTitle(getProposalTitleFromUploadFile(nextFile.name))
  }

  async function handleSubmit() {
    if (!canSubmit || !file) return
    const html = await file.text()
    createProposal.mutate(
      {
        dealId,
        title: title.trim(),
        type,
        html,
        changeNote: changeNote.trim() || 'Uploaded HTML proposal',
      },
      {
        onSuccess: proposal => {
          reset()
          onOpenChange(false)
          onCreated(proposal.id)
        },
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { onOpenChange(next); if (!next) reset() }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div>
            <DialogTitle>Upload HTML proposal</DialogTitle>
            <DialogDescription>Choose an HTML file and assign it to a deal.</DialogDescription>
          </div>
        </DialogHeader>
        <div className="space-y-4 p-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-foreground">HTML file</label>
            <input
              type="file"
              accept=".html,.htm,text/html"
              onChange={event => handleFileChange(event.target.files?.[0] ?? null)}
              className="block w-full rounded-md border border-border bg-card px-3 py-2 text-xs text-muted-foreground file:mr-3 file:rounded-control file:border-0 file:bg-secondary file:px-2.5 file:py-1 file:text-xs file:font-medium file:text-foreground hover:bg-surface-hover"
            />
            {fileError && <p className="mt-1 text-xxs text-danger-foreground">{fileError}</p>}
            {file && !fileError && <p className="mt-1 text-xxs text-text-faint">{file.name}</p>}
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-foreground">Deal</label>
            <Combobox
              options={dealOptions}
              value={dealId}
              onValueChange={setDealId}
              placeholder={dealsLoading ? 'Loading deals...' : 'Search deals...'}
              className={cn('h-9 text-xs', dealsLoading && 'pointer-events-none opacity-60')}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-foreground">Title from filename</label>
            <div className="flex h-9 items-center rounded-md border border-border bg-secondary px-3 text-xs text-muted-foreground">
              <span className="truncate">{title || 'Select an HTML file to generate the title'}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-foreground">Type</label>
              <Select value={type} onValueChange={value => setType(value as ApiProposalType)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="formal" className="text-xs">Formal</SelectItem>
                  <SelectItem value="presentation" className="text-xs">Presentation</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-foreground">Change note</label>
              <input
                value={changeNote}
                onChange={event => setChangeNote(event.target.value)}
                className="h-9 w-full rounded-md border border-border bg-card px-3 text-xs text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-1 focus:ring-primary-ring"
                placeholder="Uploaded HTML proposal"
              />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 border-t border-border p-4">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="h-9 flex-1 rounded-md border border-border text-xs font-medium text-muted-foreground transition-colors hover:bg-surface-hover"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => { void handleSubmit() }}
            disabled={!canSubmit}
            className={cn(
              'flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md text-xs font-medium text-white transition-colors disabled:cursor-not-allowed disabled:opacity-60',
              canSubmit && 'bg-primary hover:bg-primary/90',
              !canSubmit && 'bg-secondary text-muted-foreground',
            )}
          >
            {createProposal.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Upload proposal
          </button>
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
  const { data: deals = [], isLoading: dealsLoading } = useGetDeals()
  const updateProposal = useUpdateProposalMeta()
  const downloadProposalHtml = useDownloadProposalHtml()
  const saveVersion = useSaveProposalVersion()
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
  const [uploadOpen, setUploadOpen] = useState(false)
  const [uploadVersionProposal, setUploadVersionProposal] = useState<ApiProposalSummary | null>(null)
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
      <div className="mb-4 flex flex-col gap-1">
        <div className="text-ssm font-medium text-foreground">Proposals</div>
        <div className="text-xxs text-slate-400 tabular-nums">
          {proposals.length} proposal{proposals.length !== 1 ? 's' : ''} · {statusCounts.signed} signed · Generated proposal versions across brands and deals
        </div>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <TabFilter items={typeItems} value={typeFilter} onChange={(next) => updateFilters(next)} />
        <SearchInput
          ref={searchInputRef}
          value={search}
          onChange={e => setSearch(e.target.value)}
          onClear={() => setSearch('')}
          placeholder="Search proposals, brands, deals…"
          containerClassName="min-w-[260px] flex-1"
        />
        {showStatusControls && <TabFilter items={statusItems} value={statusFilter} onChange={(next) => updateFilters('formal', next)} />}
        <button
          type="button"
          onClick={() => setUploadOpen(true)}
          className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
        >
          <Upload size={14} /> Upload Proposal
        </button>
      </div>

      {/* Body */}
      {isLoading ? (
        <div className="bg-card border border-border rounded-md shadow-[var(--shadow-card)] overflow-hidden">
          <DataTableSkeleton />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-md py-16 text-center">
          <FileIcon size={32} className="text-text-faint mx-auto mb-3" />
          <div className="text-ssm font-medium text-foreground">
            {search ? 'No matches' : 'No proposals yet'}
          </div>
          <div className="text-xxs text-slate-500 mt-1">
            {search ? 'Try another search term.' : 'New proposals are created via Aria chat.'}
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-md border border-border bg-card shadow-[var(--shadow-card)]">
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
                  onUploadHtmlVersion={() => setUploadVersionProposal(p)}
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

      <UploadProposalDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        deals={deals}
        dealsLoading={dealsLoading}
        onCreated={(proposalId) => open(proposalId)}
      />

      <UploadHtmlVersionDialog
        proposal={uploadVersionProposal}
        open={Boolean(uploadVersionProposal)}
        onOpenChange={(next) => { if (!next) setUploadVersionProposal(null) }}
        isPending={saveVersion.isPending}
        onUpload={(input) => {
          if (!uploadVersionProposal) return
          saveVersion.mutate(
            { proposalId: uploadVersionProposal.id, html: input.html, changeNote: input.changeNote },
            { onSuccess: () => setUploadVersionProposal(null) },
          )
        }}
      />

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
