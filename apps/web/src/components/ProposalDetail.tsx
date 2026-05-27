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
 * Proposal HTML owns its export behavior. The iframe sandbox allows scripts,
 * modals, and downloads so proposals can either open print or save a PDF.
 */

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Download, Eye, History, Loader2, MoreVertical, Upload } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useGetProposalHead, useGetProposalVersion, useGetProposalVersions } from '@/lib/hooks/queries'
import { useSaveProposalVersion, useUpdateProposalMeta, useUploadSignedProposalPdf } from '@/lib/hooks/mutations'
import { DataTableSkeleton } from '@/components/ui/data-table'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AvatarFallback, AvatarImage, AvatarRoot } from '@/components/ui/avatar'
import type { ApiProposalStatus, ApiProposalVersion } from '@/lib/types'

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

function initials(name?: string | null, email?: string | null) {
  const source = name || email || 'User'
  const parts = source.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  return source.slice(0, 2).toUpperCase()
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
}

const STATUS_CLASSES: Record<ApiProposalStatus, string> = {
  draft: 'bg-slate-100 text-slate-600 dark:bg-white/[.06] dark:text-slate-300',
  sent: 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400',
  signed: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400',
}

function ProposalActionsMenu({
  proposalId,
  status,
  hasPdf,
  onViewVersions,
  onSignedPdfUpload,
  isPdfPending,
}: {
  proposalId: string
  status: ApiProposalStatus
  hasPdf: boolean
  onViewVersions: () => void
  onSignedPdfUpload: (file: File) => void
  isPdfPending: boolean
}) {
  const canUploadPdf = status === 'signed'

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
          href={hasPdf ? `/proposals/${proposalId}/signed-pdf` : undefined}
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

function ProposalVersionsDialog({
  title,
  proposalId,
  versions,
  isLoading,
  open,
  onOpenChange,
  onViewVersion,
}: {
  title: string
  proposalId: string
  versions: ApiProposalVersion[]
  isLoading: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
  onViewVersion: (versionId: string) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80dvh] w-[calc(100vw-2rem)] max-w-[560px] overflow-hidden rounded-lg">
        <DialogHeader className="px-4 sm:px-6">
          <div className="min-w-0">
            <DialogTitle>Proposal versions</DialogTitle>
            <DialogDescription className="mt-1 truncate">{title}</DialogDescription>
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
                    <p className="mt-1 text-atom text-slate-400 dark:text-slate-500">
                      {new Date(version.createdAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onViewVersion(version.id)}
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

interface ProposalDetailProps {
  proposalId: string
  versionId?: string
  onBack: () => void
  onOpenDeal: (dealId: string) => void
}

export function ProposalDetail({ proposalId, versionId, onBack, onOpenDeal }: ProposalDetailProps) {
  const router = useRouter()
  const { data, isLoading, error } = useGetProposalHead(proposalId)
  const { data: selectedVersion, isLoading: isVersionLoading, error: versionError } = useGetProposalVersion(proposalId, versionId, { enabled: !!versionId })
  const { data: versions = [], isLoading: isVersionsLoading } = useGetProposalVersions(proposalId)
  const [isEditing, setIsEditing] = useState(false)
  const [showVersions, setShowVersions] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const saveVersion = useSaveProposalVersion()
  const updateProposal = useUpdateProposalMeta()
  const uploadSignedPdf = useUploadSignedProposalPdf()

  useEffect(() => {
    if (!data?.title) return

    const previousTitle = document.title
    document.title = data.title

    return () => {
      document.title = previousTitle
    }
  }, [data?.title])

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

  function handleStatusChange(status: ApiProposalStatus) {
    updateProposal.mutate({ proposalId, status })
  }

  function handleSignedPdfUpload(file: File) {
    uploadSignedPdf.mutate({ proposalId, file })
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

  if (isLoading || isVersionLoading) {
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

  if (error || versionError || !data) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 px-6 text-center">
        <div className="text-ssm font-semibold text-slate-700 dark:text-slate-200">
          {error?.message ?? versionError?.message ?? 'Proposal not found'}
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

  const activeVersion = selectedVersion ?? data.version

  return (
    <div className="h-full flex flex-col overflow-hidden bg-slate-50 dark:bg-[#0f0f12]">
      {/* Sticky header */}
      <div className="shrink-0 bg-white dark:bg-[#1c1c1f] border-b border-black/[.06] dark:border-white/[.08]">
        <div className="flex flex-col gap-3 px-4 py-3 md:mx-auto md:w-full md:max-w-[1400px] md:flex-row md:items-center md:px-6">
          <button
            onClick={onBack}
            className="shrink-0 flex items-center gap-1.5 h-7 px-2 -ml-2 rounded-md text-xs font-medium text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[.05] transition-colors duration-150"
          >
            <ChevronLeftIcon size={14} />
            <span>Proposals</span>
          </button>

          <div className="hidden h-5 w-px shrink-0 bg-black/[.08] dark:bg-white/[.08] md:block" />

          <div className="min-w-0 flex-1">
            <div className="text-ssm font-semibold text-slate-900 dark:text-white truncate" title={data.title}>
              {data.title}
            </div>
            <div className="text-xxs text-slate-500 mt-0.5 truncate flex items-center gap-1.5">
              <span className="font-mono">v{activeVersion.version}</span>
              {versionId && <span className="text-slate-400">Viewing saved version</span>}
              <span className="text-slate-300">·</span>
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <AvatarRoot className="h-4 w-4 border border-black/[.06] dark:border-white/[.08]">
                  {data.creatorImage && <AvatarImage src={data.creatorImage} alt={data.creatorName || data.creatorEmail || 'Creator'} />}
                  <AvatarFallback className="bg-slate-100 text-[8px] text-slate-500 dark:bg-white/[.06] dark:text-slate-300">
                    {initials(data.creatorName, data.creatorEmail)}
                  </AvatarFallback>
                </AvatarRoot>
                <span className="truncate" title={data.creatorName || data.creatorEmail || 'Creator'}>
                  {data.creatorName || data.creatorEmail || 'Creator'}
                </span>
              </span>
              {activeVersion.wordCount != null && (
                <>
                  <span className="text-slate-300">·</span>
                  <span className="font-mono">{activeVersion.wordCount.toLocaleString()} words</span>
                </>
              )}
              {activeVersion.changeNote && (
                <>
                  <span className="text-slate-300">·</span>
                  <span className="text-slate-400 truncate" title={activeVersion.changeNote}>
                    {activeVersion.changeNote}
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="hidden lg:block text-xxs text-slate-400 shrink-0 font-mono">
            {fmtDate(data.updatedAt)}
          </div>

          <div className="flex w-full min-w-0 flex-wrap items-center gap-2 md:w-auto md:flex-nowrap md:justify-end">
            {!isEditing && (
              <div className="flex items-center gap-2">
                <Select value={data.status} onValueChange={(value) => handleStatusChange(value as ApiProposalStatus)} disabled={updateProposal.isPending}>
                  <SelectTrigger
                    aria-label="Proposal status"
                    size="sm"
                    className={cn(
                      'h-5 w-[78px] rounded-md border-transparent px-2 text-xxs font-semibold leading-none shadow-none disabled:opacity-70 [&_svg]:h-3 [&_svg]:w-3',
                      STATUS_CLASSES[data.status],
                    )}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent align="start" className="min-w-[92px] rounded-md">
                    <SelectItem value="draft" className="text-xs font-semibold">Draft</SelectItem>
                    <SelectItem value="sent" className="text-xs font-semibold">Sent</SelectItem>
                    <SelectItem value="signed" className="text-xs font-semibold">Signed</SelectItem>
                  </SelectContent>
                </Select>
                {updateProposal.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" strokeWidth={1.8} />}
              </div>
            )}

            {!isEditing && (
              <ProposalActionsMenu
                proposalId={proposalId}
                status={data.status}
                hasPdf={Boolean(data.signedPdfFileName)}
                onViewVersions={() => setShowVersions(true)}
                onSignedPdfUpload={handleSignedPdfUpload}
                isPdfPending={uploadSignedPdf.isPending}
              />
            )}

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
      </div>

      <ProposalVersionsDialog
        title={data.title}
        proposalId={proposalId}
        versions={versions}
        isLoading={isVersionsLoading}
        open={showVersions}
        onOpenChange={setShowVersions}
        onViewVersion={(nextVersionId) => {
          setShowVersions(false)
          router.push(`/proposals/${proposalId}?versionId=${nextVersionId}`)
        }}
      />

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
          srcDoc={activeVersion.html ?? ''}
          title={data.title}
          // Edit mode: add allow-same-origin so we can access contentDocument for contenteditable.
          // View mode: no allow-same-origin, iframe can't read parent DOM or cookies.
          // allow-modals: required so legacy proposal HTML can open the print dialog.
          // allow-downloads: required so html2canvas/jsPDF proposal exports can save with the proposal filename.
          sandbox={isEditing
            ? 'allow-scripts allow-forms allow-popups allow-modals allow-downloads allow-same-origin'
            : 'allow-scripts allow-forms allow-popups allow-modals allow-downloads'
          }
          className="w-full h-full border-0 bg-white"
          onLoad={injectContentEditable}
        />
      </div>
    </div>
  )
}
