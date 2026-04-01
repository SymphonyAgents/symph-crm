'use client'

import { useState, useCallback, useRef, useMemo, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { queryKeys } from '@/lib/query-keys'
import { usePatchDealStage, useCreateDocument, useUploadDocumentFile, useUpdateDeal } from '@/lib/hooks/mutations'
import { useGetDeal, useGetCompany, useGetActivitiesByDeal, useGetDocumentsByDeal, useGetUsers } from '@/lib/hooks/queries'
import { useUser } from '@/lib/hooks/use-user'
import { EmptyState } from './EmptyState'
import { Avatar } from './Avatar'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import {
  cn, formatCurrencyFull, timeAgo, formatDate,
  getDaysInStage, getBrandColor, getInitials, getStageProgressIndex,
} from '@/lib/utils'
import type { ApiDealDetail, ApiCompanyDetail, ApiDocument } from '@/lib/types'
import {
  STAGE_LABELS, STAGE_COLORS, STAGE_ADVANCE_MAP,
  PROGRESS_STAGES, ACTIVITY_LABELS, DOC_TYPE_LABELS, ACCEPTED_FILE_TYPES,
} from '@/lib/constants'
import { DocumentViewerModal } from './DocumentViewerModal'
import { PasteChip, PastePreviewModal } from './PasteChip'

// ── Sub-components ───────────────────────────────────────────────────────────

function StageProgress({ currentStage }: { currentStage: string }) {
  const isLost = currentStage === 'closed_lost'
  const currentIdx = isLost ? -1 : getStageProgressIndex(currentStage)

  return (
    <div className="mt-5 px-1">
      {/* Row 1: circles + connector lines */}
      <div className="flex items-center">
        {PROGRESS_STAGES.map((stage, i) => (
          <>
            {/* Connector (between steps) */}
            {i > 0 && (
              <div
                key={`line-${stage.id}`}
                className="flex-1 h-[1.5px] mx-0.5"
                style={{ background: i <= currentIdx ? 'var(--primary)' : 'var(--color-border, #e2e8f0)' }}
              />
            )}
            {/* Step circle */}
            <div
              key={stage.id}
              className={cn(
                'w-[26px] h-[26px] rounded-full flex items-center justify-center text-[10px] font-semibold shrink-0 transition-all',
                i < currentIdx
                  ? 'bg-primary text-white'
                  : i === currentIdx
                  ? 'bg-white dark:bg-[#1e1e21] border-2 border-primary text-primary shadow-sm'
                  : 'bg-white dark:bg-[#1e1e21] border border-slate-200 dark:border-white/10 text-slate-400'
              )}
            >
              {i < currentIdx ? (
                <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                i + 1
              )}
            </div>
          </>
        ))}
        {isLost && (
          <div className="ml-3 shrink-0">
            <span className="text-[11px] font-semibold text-red-500 bg-red-50 dark:bg-red-950/30 px-2.5 py-0.5 rounded-full border border-red-100 dark:border-red-500/20">
              Lost
            </span>
          </div>
        )}
      </div>
      {/* Row 2: labels — aligned under each circle */}
      <div className="hidden sm:flex items-start mt-1.5">
        {PROGRESS_STAGES.map((stage, i) => (
          <>
            {i > 0 && <div key={`spacer-${stage.id}`} className="flex-1" />}
            <span
              key={`label-${stage.id}`}
              className={cn(
                'text-[10px] font-medium whitespace-nowrap w-[26px] text-center shrink-0',
                i === currentIdx ? 'text-primary font-semibold' : i < currentIdx ? 'text-slate-500' : 'text-slate-300 dark:text-slate-600'
              )}
            >
              {stage.label}
            </span>
          </>
        ))}
      </div>
    </div>
  )
}

function SidebarSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-[#1e1e21] rounded-xl border border-black/[.06] dark:border-white/[.08] shadow-[0_1px_4px_rgba(0,0,0,0.04)] p-4">
      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-3">{title}</p>
      {children}
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-2 py-1.5 border-b border-black/[.04] dark:border-white/[.05] last:border-0">
      <span className="text-[12px] text-slate-400 shrink-0">{label}</span>
      <span className="text-[12px] font-medium text-slate-800 dark:text-white text-right">{value}</span>
    </div>
  )
}

function QuickActionRow({
  icon,
  label,
  onClick,
  variant = 'default',
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
  variant?: 'default' | 'success' | 'danger'
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-2.5 w-full px-2 py-2 text-[12.5px] rounded-lg transition-colors text-left',
        variant === 'success'
          ? 'text-[#16a34a] hover:bg-[rgba(22,163,74,0.06)]'
          : variant === 'danger'
          ? 'text-red-600 hover:bg-red-50 dark:hover:bg-red-500/[.08]'
          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[.04]'
      )}
    >
      <span className="w-5 h-5 flex items-center justify-center shrink-0 text-slate-400">
        {icon}
      </span>
      {label}
    </button>
  )
}

/** Accepted upload MIME types for resource files */
const RESOURCE_ACCEPT_LIST = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/html',
  'text/markdown',
  'text/plain',
  'text/csv',
  'image/jpeg',
  'image/png',
  'image/webp',
]
const RESOURCE_ACCEPT = RESOURCE_ACCEPT_LIST.join(',')

type DealDetailProps = {
  dealId: string
  onBack: () => void
  onOpenDeal: (id: string) => void
}

// ── Main component ───────────────────────────────────────────────────────────

export function DealDetail({ dealId, onBack }: DealDetailProps) {
  const [activeTab, setActiveTab] = useState<'notes' | 'resources' | 'timeline'>('notes')
  const [noteText, setNoteText] = useState('')
  const [noteType, setNoteType] = useState<string>('general')
  const [addingNote, setAddingNote] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [viewingDoc, setViewingDoc] = useState<ApiDocument | null>(null)
  const [notePasteChips, setNotePasteChips] = useState<string[]>([])
  const [notePastePreviewText, setNotePastePreviewText] = useState<string | null>(null)
  const [noteFocused, setNoteFocused] = useState(false)
  const [showAssignDropdown, setShowAssignDropdown] = useState(false)
  const assignRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const noteTextareaRef = useRef<HTMLTextAreaElement>(null)

  const queryClient = useQueryClient()
  const router = useRouter()
  const { userId, isSales } = useUser()
  const patchStage = usePatchDealStage()
  const updateDeal = useUpdateDeal()

  // ── Queries ──────────────────────────────────────────────────────────────

  const { data: deal, isLoading, isError } = useGetDeal(dealId)
  const { data: company } = useGetCompany(deal?.companyId)
  const { data: activities = [], isLoading: loadingActivities } = useGetActivitiesByDeal(dealId, { enabled: !!deal })
  const { data: documents = [], isLoading: loadingDocs, refetch: refetchDocs } = useGetDocumentsByDeal(dealId, { enabled: !!deal })
  const { data: users = [] } = useGetUsers()

  // ── Derived values ───────────────────────────────────────────────────────

  const stageColor = deal ? (STAGE_COLORS[deal.stage] ?? '#94a3b8') : '#94a3b8'
  const stageLabel = deal ? (STAGE_LABELS[deal.stage] ?? deal.stage) : ''
  const nextStage = deal ? STAGE_ADVANCE_MAP[deal.stage] : undefined
  const isTerminal = deal ? (deal.stage === 'closed_won' || deal.stage === 'closed_lost') : false
  const daysInStage = deal ? getDaysInStage(activities, deal.createdAt) : 0
  const brandColor = getBrandColor(company?.name ?? deal?.companyId)

  // ── User map + AM resolution ─────────────────────────────────────────────
  const userNameMap = useMemo(() => {
    const m = new Map<string, string>()
    for (const u of users) m.set(u.id, u.name || u.email)
    return m
  }, [users])

  // deal.assignedTo stores a user UUID — resolve to display name + full user
  const amDisplayName = deal?.assignedTo
    ? (userNameMap.get(deal.assignedTo) ?? deal.assignedTo)
    : null
  const amUser = deal?.assignedTo ? users.find(u => u.id === deal.assignedTo) : null

  // ── Notes vs Resources split ─────────────────────────────────────────────
  // Resources: docs uploaded to the /resources/ bucket path
  // Notes: everything else (inline notes and /notes/ uploads)
  const resourceDocs = documents.filter(d => d.storagePath?.includes('/resources/'))
  const noteDocs = documents.filter(d => !d.storagePath?.includes('/resources/'))

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleAdvance = useCallback(() => {
    if (!deal || !nextStage) return
    const prev = queryClient.getQueryData(queryKeys.deals.detail(dealId))
    patchStage.mutate({ id: dealId, stage: nextStage }, {
      onError: () => queryClient.setQueryData(queryKeys.deals.detail(dealId), prev),
      onSettled: () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.deals.detail(dealId) })
        queryClient.invalidateQueries({ queryKey: queryKeys.deals.all })
      },
    })
  }, [deal, nextStage, dealId, patchStage, queryClient])

  const handleMarkWon = useCallback(() => {
    if (!confirm('Mark this deal as Won?')) return
    patchStage.mutate({ id: dealId, stage: 'closed_won' }, {
      onSettled: () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.deals.detail(dealId) })
        queryClient.invalidateQueries({ queryKey: queryKeys.deals.all })
      },
    })
  }, [dealId, patchStage, queryClient])

  const handleMarkLost = useCallback(() => {
    if (!confirm('Close this deal as Lost?')) return
    patchStage.mutate({ id: dealId, stage: 'closed_lost' }, {
      onSettled: () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.deals.detail(dealId) })
        queryClient.invalidateQueries({ queryKey: queryKeys.deals.all })
      },
    })
  }, [dealId, patchStage, queryClient])

  const saveNote = useCreateDocument({
    onSuccess: () => { setNoteText(''); setNotePasteChips([]); void refetchDocs() },
  })

  const uploadFiles = useUploadDocumentFile({
    onSuccess: () => { void refetchDocs() },
    onSettled: () => {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    },
  })

  const handleAddNote = useCallback(() => {
    // Join typed text + all paste chips
    const parts = [...(noteText.trim() ? [noteText.trim()] : []), ...notePasteChips].filter(Boolean)
    const combined = parts.join('\n\n')
    if (!combined || !deal || !userId) return
    const title = combined.split('\n')[0].slice(0, 100) || 'Note'
    setAddingNote(true)
    saveNote.mutate(
      { dealId, type: noteType, title, content: combined, authorId: userId },
      { onSettled: () => setAddingNote(false) },
    )
  }, [noteText, notePasteChips, noteType, deal, dealId, userId, saveNote])

  const handleNotePaste = useCallback((e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const text = e.clipboardData.getData('text/plain')
    if (text && (text.length > 80 || text.includes('\n'))) {
      e.preventDefault()
      setNotePasteChips(prev => [...prev, text])
    }
  }, [])

  // Auto-resize note textarea
  useEffect(() => {
    const el = noteTextareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 160) + 'px'
  }, [noteText])

  // Close assign dropdown on outside click or Escape
  useEffect(() => {
    if (!showAssignDropdown) return
    function handleOutside(e: MouseEvent) {
      if (assignRef.current && !assignRef.current.contains(e.target as Node)) {
        setShowAssignDropdown(false)
      }
    }
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setShowAssignDropdown(false)
    }
    document.addEventListener('mousedown', handleOutside)
    document.addEventListener('keydown', handleEsc)
    return () => {
      document.removeEventListener('mousedown', handleOutside)
      document.removeEventListener('keydown', handleEsc)
    }
  }, [showAssignDropdown])

  const handleAssignAM = useCallback((assignUserId: string) => {
    setShowAssignDropdown(false)
    const newValue = assignUserId || null
    const prev = queryClient.getQueryData(queryKeys.deals.detail(dealId))
    queryClient.setQueryData(queryKeys.deals.detail(dealId), (old: any) =>
      old ? { ...old, assignedTo: newValue } : old
    )
    updateDeal.mutate({ id: dealId, data: { assignedTo: newValue } }, {
      onError: () => queryClient.setQueryData(queryKeys.deals.detail(dealId), prev),
      onSettled: () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.deals.detail(dealId) })
        queryClient.invalidateQueries({ queryKey: queryKeys.deals.all })
      },
    })
  }, [dealId, updateDeal, queryClient])

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files?.length || !deal || !userId) return
    setUploading(true)
    uploadFiles.mutate({ dealId, authorId: userId, files: Array.from(files) })
  }, [deal, dealId, userId, uploadFiles])

  // ── Render: loading / error ───────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
          <p className="text-[12px] text-slate-400">Loading deal&hellip;</p>
        </div>
      </div>
    )
  }

  if (isError || !deal) {
    return (
      <div className="p-4 md:p-6 h-full flex flex-col">
        <button onClick={onBack} className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 mb-3 w-fit">
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><polyline points="15 18 9 12 15 6" /></svg>
          Back to Pipeline
        </button>
        <div className="flex-1 flex items-center justify-center">
          <EmptyState
            title="Deal not found"
            description="This deal may have been deleted or the link is invalid."
            action={
              <button onClick={onBack} className="px-4 py-2 rounded-lg bg-primary text-white text-[12px] font-semibold">
                Back to Pipeline
              </button>
            }
          />
        </div>
      </div>
    )
  }

  // ── Render: deal content ──────────────────────────────────────────────────

  return (
    <div className="p-4 md:p-6">
      {/* Document viewer modal */}
      {viewingDoc && (
        <DocumentViewerModal doc={viewingDoc} onClose={() => setViewingDoc(null)} />
      )}

      {/* Paste preview modal — ESC-closable, shows full pasted content */}
      {notePastePreviewText && (
        <PastePreviewModal text={notePastePreviewText} onClose={() => setNotePastePreviewText(null)} />
      )}

      {/* Back */}
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-[12px] font-medium text-slate-500 dark:text-slate-300 hover:text-primary dark:hover:text-primary transition-colors mb-4 w-fit"
      >
        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><polyline points="15 18 9 12 15 6" /></svg>
        Back to Pipeline
      </button>

      {/* ── Header card ─────────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-[#1e1e21] rounded-xl border border-black/[.06] dark:border-white/[.08] shadow-[0_1px_4px_rgba(0,0,0,0.04)] p-5 mb-4">
        {/* Top row: brand info + value/advance */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          {/* Left: Brand + deal info */}
          <div className="flex items-center gap-3.5 min-w-0">
            <div
              className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center text-[14px] sm:text-[15px] font-bold shrink-0"
              style={{ background: `${brandColor}18`, color: brandColor }}
            >
              {getInitials(company?.name ?? 'No Brand')}
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide leading-none mb-1">
                {company?.name ?? 'No Brand'}
              </p>
              <h1 className="text-[18px] sm:text-[20px] font-bold text-slate-900 dark:text-white leading-tight">
                {deal.title}
              </h1>
              <p className="text-[12px] text-slate-400 mt-0.5">
                {[company?.name, company?.industry].filter(Boolean).join(' \u00B7 ') || 'No brand assigned'}
              </p>
            </div>
          </div>

          {/* Right: Value → stage → advance (stacked, right-aligned) */}
          <div className="flex flex-col items-end gap-1.5 sm:shrink-0">
            <div className="text-[22px] sm:text-[26px] font-bold tabular-nums text-primary leading-tight">
              {formatCurrencyFull(deal.value)}
            </div>
            <span
              className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
              style={{ background: `${stageColor}18`, color: stageColor }}
            >
              {stageLabel}
            </span>
            {nextStage && (
              <button
                onClick={handleAdvance}
                disabled={patchStage.isPending}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg font-semibold text-[12px] text-white transition-opacity disabled:opacity-60 shrink-0 mt-0.5"
                style={{ background: 'linear-gradient(135deg, var(--primary), var(--color-primary-accent))' }}
              >
                {patchStage.isPending ? (
                  <div className="w-3 h-3 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                ) : (
                  <>
                    Advance
                    <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Stage progress */}
        <StageProgress currentStage={deal.stage} />
      </div>

      {/* ── Body: left content + right sidebar ─────────── */}
      <div className="flex flex-col sm:flex-row gap-4 items-start">

        {/* Left: tabs + content */}
        <div className="flex-1 min-w-0 bg-white dark:bg-[#1e1e21] rounded-xl border border-black/[.06] dark:border-white/[.08] shadow-[0_1px_4px_rgba(0,0,0,0.04)] overflow-hidden">
          {/* Tab bar */}
          <div className="flex border-b border-black/[.06] dark:border-white/[.08]">
            {([
              { id: 'notes', label: 'Notes', count: noteDocs.length },
              { id: 'resources', label: 'Resources', count: resourceDocs.length },
              { id: 'timeline', label: 'Timeline', count: activities.length },
            ] as const).map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-1.5 px-4 py-3 text-[13px] font-medium border-b-2 -mb-px transition-colors',
                  activeTab === tab.id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                )}
              >
                {tab.label}
                {tab.count !== null && tab.count > 0 && (
                  <span className={cn(
                    'text-[10px] font-semibold px-1.5 py-0.5 rounded-full min-w-[18px] text-center',
                    activeTab === tab.id
                      ? 'bg-primary text-white'
                      : 'bg-slate-100 dark:bg-white/[.08] text-slate-500'
                  )}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* ── Notes tab ─────────────────────────────────────────────────── */}
          {activeTab === 'notes' && (
            <div>
              {/* Note input — Chat-style unified container */}
              <div className="p-4 border-b border-black/[.05] dark:border-white/[.06]">
                <div
                  className={cn(
                    'rounded-xl bg-white dark:bg-[#1e1e21] transition-all duration-150',
                    noteFocused
                      ? 'border border-black/20 dark:border-white/20 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_0_0_3px_rgba(0,0,0,0.05)] dark:shadow-none'
                      : 'border border-black/[.08] dark:border-white/[.08]',
                  )}
                >
                  {/* Paste chips inside the container */}
                  {notePasteChips.length > 0 && (
                    <div className="flex flex-wrap pt-1">
                      {notePasteChips.map((chip, i) => (
                        <PasteChip
                          key={i}
                          text={chip}
                          onRemove={() => setNotePasteChips(prev => prev.filter((_, idx) => idx !== i))}
                          onClick={() => setNotePastePreviewText(chip)}
                        />
                      ))}
                    </div>
                  )}

                  {/* Borderless textarea */}
                  <div className={cn('px-4 pb-2', notePasteChips.length > 0 ? 'pt-3' : 'pt-4')}>
                    <textarea
                      ref={noteTextareaRef}
                      value={noteText}
                      onChange={e => setNoteText(e.target.value)}
                      onPaste={handleNotePaste}
                      onFocus={() => setNoteFocused(true)}
                      onBlur={() => setNoteFocused(false)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault()
                          handleAddNote()
                        }
                      }}
                      placeholder={notePasteChips.length > 0 ? 'Add context (optional)…' : 'Add notes, paste a transcript, drop a link…'}
                      rows={1}
                      className="w-full bg-transparent border-none outline-none text-[13px] text-slate-900 dark:text-white leading-[1.6] resize-none overflow-hidden placeholder:text-slate-400"
                      style={{ minHeight: '28px', maxHeight: '160px' }}
                    />
                  </div>

                  {/* Bottom toolbar */}
                  <div className="flex items-center gap-2 px-3 pb-3 pt-1">
                    <Select value={noteType} onValueChange={setNoteType}>
                      <SelectTrigger className="h-7 w-auto min-w-[90px] text-[11px] border-none bg-transparent shadow-none px-2 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white gap-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="general" className="text-[12px]">Note</SelectItem>
                        <SelectItem value="discovery" className="text-[12px]">Discovery</SelectItem>
                        <SelectItem value="meeting" className="text-[12px]">Meeting Notes</SelectItem>
                        <SelectItem value="transcript_raw" className="text-[12px]">Transcript</SelectItem>
                        <SelectItem value="proposal" className="text-[12px]">Proposal</SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="flex-1" />
                    <button
                      onClick={handleAddNote}
                      disabled={(!noteText.trim() && notePasteChips.length === 0) || addingNote}
                      className={cn(
                        'w-8 h-8 rounded-lg flex items-center justify-center transition-colors duration-150 active:scale-[0.94]',
                        (!noteText.trim() && notePasteChips.length === 0) || addingNote
                          ? 'bg-slate-100 dark:bg-white/[.06] cursor-default'
                          : 'bg-primary hover:bg-primary/90 cursor-pointer',
                      )}
                    >
                      {addingNote ? (
                        <div className="w-3.5 h-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                      ) : (
                        <svg width={14} height={14} viewBox="0 0 24 24" fill="none"
                          stroke={((!noteText.trim() && notePasteChips.length === 0) || addingNote) ? '#94a3b8' : '#fff'}
                          strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                          <line x1="12" y1="19" x2="12" y2="5" />
                          <polyline points="5 12 12 5 19 12" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Notes list */}
              {loadingDocs ? (
                <div className="p-8 flex items-center justify-center">
                  <div className="w-5 h-5 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
                </div>
              ) : noteDocs.length === 0 ? (
                <div className="py-10 text-center">
                  <p className="text-[13px] text-slate-400">No notes yet</p>
                  <p className="text-[11px] text-slate-300 mt-0.5">Add the first note above</p>
                </div>
              ) : (
                <div className="divide-y divide-black/[.04] dark:divide-white/[.05]">
                  {noteDocs.map(doc => (
                    <div
                      key={doc.id}
                      className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-white/[.02] transition-colors group cursor-pointer"
                      onClick={() => setViewingDoc(doc)}
                    >
                      {/* Obsidian-style file icon */}
                      <div className="mt-0.5 shrink-0 text-slate-300 dark:text-slate-600 group-hover:text-primary/50 transition-colors">
                        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                          <line x1="16" y1="13" x2="8" y2="13" />
                          <line x1="16" y1="17" x2="8" y2="17" />
                          <polyline points="10 9 9 9 8 9" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        {/* Note name — primary, Obsidian-style */}
                        <p className="text-[13px] font-semibold text-slate-800 dark:text-white truncate leading-tight group-hover:text-primary transition-colors">
                          {doc.title}
                        </p>
                        {doc.excerpt && (
                          <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-2 leading-relaxed">
                            {doc.excerpt}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-white/[.06] text-slate-500">
                            {DOC_TYPE_LABELS[doc.type] ?? doc.type}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {new Date(doc.createdAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
                          </span>
                        </div>
                      </div>
                      {/* View hint */}
                      <div className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity mt-0.5">
                        <span className="text-[10px] font-medium text-primary flex items-center gap-0.5">
                          View
                          <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                            <polyline points="9 18 15 12 9 6" />
                          </svg>
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Resources tab ─────────────────────────────────────────────── */}
          {activeTab === 'resources' && (
            <div className="p-4">
              {/* Upload zone */}
              <div className="mb-4">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={RESOURCE_ACCEPT}
                  multiple
                  onChange={handleFileUpload}
                  className="hidden"
                  id="resource-upload"
                />
                <label
                  htmlFor="resource-upload"
                  className={cn(
                    'flex flex-col items-center gap-2 py-5 px-4 border-2 border-dashed rounded-lg cursor-pointer transition-colors',
                    uploading
                      ? 'border-primary/30 bg-primary/5'
                      : 'border-slate-200 dark:border-white/[.1] hover:border-primary/40 hover:bg-primary/[.02]'
                  )}
                  onDragOver={e => { e.preventDefault(); e.stopPropagation() }}
                  onDragEnter={e => { e.preventDefault(); e.stopPropagation() }}
                  onDrop={e => {
                    e.preventDefault()
                    e.stopPropagation()
                    const files = e.dataTransfer?.files
                    if (!files?.length || !deal || !userId) return
                    const accepted = Array.from(files).filter(f => RESOURCE_ACCEPT_LIST.includes(f.type))
                    if (!accepted.length) return
                    setUploading(true)
                    uploadFiles.mutate({ dealId, authorId: userId, files: accepted })
                  }}
                >
                  {uploading ? (
                    <div className="w-5 h-5 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
                  ) : (
                    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="text-slate-400">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                  )}
                  <div className="text-center">
                    <p className="text-[12px] font-medium text-slate-600 dark:text-slate-300">
                      {uploading ? 'Uploading\u2026' : 'Drop files here or click to upload'}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      PDF, DOCX, HTML, Images — text/markdown files go to Notes
                    </p>
                  </div>
                </label>
              </div>

              {/* Uploaded resource files list */}
              {loadingDocs ? (
                <div className="flex items-center justify-center py-6">
                  <div className="w-5 h-5 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
                </div>
              ) : resourceDocs.length > 0 ? (
                <div className="mb-4">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Uploaded Files</p>
                  <div className="divide-y divide-black/[.04] dark:divide-white/[.05] border border-black/[.06] dark:border-white/[.08] rounded-lg overflow-hidden">
                    {resourceDocs.map(doc => {
                      const ext = doc.tags?.find(t => !['resources', 'notes'].includes(t))?.toUpperCase() ?? 'FILE'
                      const isImg = ['JPEG', 'JPG', 'PNG', 'WEBP', 'GIF'].includes(ext)
                      return (
                        <div
                          key={doc.id}
                          className="flex items-center gap-3 px-3.5 py-2.5 hover:bg-slate-50 dark:hover:bg-white/[.02] transition-colors group cursor-pointer"
                          onClick={() => setViewingDoc(doc)}
                        >
                          {/* File type indicator */}
                          <div className={cn(
                            'w-8 h-8 rounded-md flex items-center justify-center shrink-0 text-[9px] font-bold',
                            isImg
                              ? 'bg-purple-50 dark:bg-purple-500/[.12] text-purple-600 dark:text-purple-400'
                              : 'bg-slate-100 dark:bg-white/[.06] text-slate-500 dark:text-slate-400'
                          )}>
                            {ext.slice(0, 4)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[12px] font-medium text-slate-800 dark:text-white truncate group-hover:text-primary transition-colors">
                              {doc.title}
                            </p>
                            <p className="text-[10px] text-slate-400 mt-0.5">
                              {new Date(doc.createdAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                              {doc.wordCount ? ` · ${doc.wordCount} words extracted` : ''}
                            </p>
                          </div>
                          {/* View arrow */}
                          <div className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                            <span className="text-[10px] font-medium text-primary flex items-center gap-0.5">
                              View
                              <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                                <polyline points="9 18 15 12 9 6" />
                              </svg>
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : null}

              {/* Quick links from deal fields */}
              {(deal.proposalLink || deal.demoLink) && (
                <div className="flex flex-col gap-2 mb-3">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Links</p>
                  {deal.proposalLink && (
                    <a
                      href={deal.proposalLink.startsWith('http') ? deal.proposalLink : `https://${deal.proposalLink}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-[13px] text-primary hover:underline font-medium"
                    >
                      <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                      View Proposal
                    </a>
                  )}
                  {deal.demoLink && (
                    <a
                      href={deal.demoLink.startsWith('http') ? deal.demoLink : `https://${deal.demoLink}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-[13px] text-primary hover:underline font-medium"
                    >
                      <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" /></svg>
                      Demo Recording
                    </a>
                  )}
                </div>
              )}

              {/* Empty state */}
              {!deal.proposalLink && !deal.demoLink && resourceDocs.length === 0 && !loadingDocs && (
                <div className="py-4 text-center">
                  <p className="text-[11px] text-slate-300 dark:text-slate-600">
                    Uploaded files and links will appear here
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ── Timeline tab ──────────────────────────────────────────────── */}
          {activeTab === 'timeline' && (
            <div>
              {loadingActivities ? (
                <div className="p-8 flex items-center justify-center">
                  <div className="w-5 h-5 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
                </div>
              ) : activities.length === 0 ? (
                <EmptyState
                  icon="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  title="No activity yet"
                  description="Actions on this deal will appear here"
                  compact
                />
              ) : (
                <div className="px-4 py-3">
                  {activities.map((a, i) => (
                    <div key={a.id} className="flex gap-3">
                      {/* Vertical line + dot */}
                      <div className="flex flex-col items-center shrink-0">
                        <div className="w-2 h-2 rounded-full bg-primary/60 shrink-0 mt-1.5" />
                        {i < activities.length - 1 && (
                          <div className="w-px flex-1 bg-slate-200 dark:bg-white/[.08]" />
                        )}
                      </div>
                      {/* Content */}
                      <div className={cn('flex-1 min-w-0 pb-4', i === activities.length - 1 && 'pb-0')}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="text-[12px] font-medium text-slate-800 dark:text-white">
                            {ACTIVITY_LABELS[a.type] ?? a.type.replace(/_/g, ' ')}
                          </div>
                          <div className="text-[10px] text-slate-400 shrink-0">{timeAgo(a.createdAt)}</div>
                        </div>
                        {a.actorId && (
                          <div className="text-[10px] text-slate-400 mt-0.5">by {a.actorId}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Right sidebar ────────── */}
        <div className="w-full sm:w-[260px] sm:shrink-0 flex flex-col gap-3">

          {/* Deal Info */}
          <SidebarSection title="Deal Info">
            <InfoRow
              label="Deal Size"
              value={
                <span className="text-primary font-bold">{formatCurrencyFull(deal.value)}</span>
              }
            />
            {deal.outreachCategory && (
              <InfoRow
                label="Category"
                value={
                  <span
                    className={cn(
                      'text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize',
                      deal.outreachCategory === 'inbound'
                        ? 'bg-[rgba(22,163,74,0.1)] text-[#16a34a]'
                        : 'bg-slate-100 dark:bg-white/[.06] text-slate-500'
                    )}
                  >
                    {deal.outreachCategory}
                  </span>
                }
              />
            )}
            {company?.industry && (
              <InfoRow label="Industry" value={company.industry} />
            )}
            <InfoRow label="Date Captured" value={formatDate(deal.createdAt)} />
            <InfoRow label="Days in Stage" value={`${daysInStage}d`} />
            {deal.pricingModel && (
              <InfoRow label="Pricing" value={<span className="capitalize">{deal.pricingModel}</span>} />
            )}
            {deal.servicesTags && deal.servicesTags.length > 0 && (
              <div className="pt-2">
                <span className="text-[10px] text-slate-400 block mb-1.5">Services</span>
                <div className="flex flex-wrap gap-1">
                  {deal.servicesTags.map(s => (
                    <span key={s} className="text-[10px] font-medium px-1.5 py-0.5 rounded-lg bg-primary/10 text-primary">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </SidebarSection>

          {/* Account Manager */}
          <SidebarSection title="Account Manager">
            <div ref={assignRef} className="relative">
              {/* Current AM — click to open assign dropdown */}
              <button
                onClick={() => setShowAssignDropdown(v => !v)}
                className="flex items-center gap-2.5 w-full rounded-lg hover:bg-slate-50 dark:hover:bg-white/[.04] px-1 py-1 -mx-1 transition-colors group"
              >
                {amDisplayName ? (
                  <>
                    <Avatar
                      name={amDisplayName}
                      email={amUser?.email ?? undefined}
                      src={amUser?.image ?? undefined}
                      size={34}
                    />
                    <div className="text-left min-w-0 flex-1">
                      <p className="text-[13px] font-semibold text-slate-800 dark:text-white truncate">{amDisplayName}</p>
                      <p className="text-[11px] text-slate-400">Account Manager</p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="w-[34px] h-[34px] rounded-full border-2 border-dashed border-slate-200 dark:border-white/[.12] flex items-center justify-center shrink-0">
                      <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="text-slate-300 dark:text-slate-600">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
                      </svg>
                    </div>
                    <span className="text-[12px] text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors">
                      Click to assign
                    </span>
                  </>
                )}
                <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="text-slate-300 dark:text-slate-600 shrink-0 ml-auto">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              {/* Assign dropdown */}
              {showAssignDropdown && (
                <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white dark:bg-[#1e1e21] border border-black/[.08] dark:border-white/[.1] rounded-lg shadow-lg overflow-hidden animate-in fade-in-0 zoom-in-95 duration-100">
                  {users.length === 0 ? (
                    <div className="px-3 py-3 text-[11px] text-slate-400 italic text-center">No team members found</div>
                  ) : (
                    <div className="max-h-[180px] overflow-y-auto py-1">
                      {amDisplayName && (
                        <button
                          onClick={() => handleAssignAM('')}
                          className="flex items-center gap-2 w-full px-3 py-1.5 text-[12px] text-red-500 hover:bg-red-50 dark:hover:bg-red-500/[.08] transition-colors"
                        >
                          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                          Unassign
                        </button>
                      )}
                      {users.map(u => (
                        <button
                          key={u.id}
                          onClick={() => handleAssignAM(u.id)}
                          className={cn(
                            'flex items-center gap-2 w-full px-3 py-1.5 text-[12px] transition-colors',
                            u.id === deal.assignedTo
                              ? 'text-primary bg-primary/[.06]'
                              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[.06]'
                          )}
                        >
                          <Avatar name={u.name || u.email} email={u.email ?? undefined} src={u.image ?? undefined} size={18} />
                          <span className="truncate">{u.name || u.email}</span>
                          {u.id === deal.assignedTo && (
                            <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="ml-auto shrink-0"><polyline points="20 6 9 17 4 12" /></svg>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </SidebarSection>

          {/* Quick Actions */}
          <SidebarSection title="Quick Actions">
            <div className="flex flex-col -mx-2">
              <QuickActionRow
                icon={<svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>}
                label="Schedule Demo"
                onClick={() => toast.info('Schedule Demo \u2014 coming soon')}
              />
              <QuickActionRow
                icon={<svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>}
                label="Build Proposal"
                onClick={() => router.push('/proposals')}
              />
              <QuickActionRow
                icon={<svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>}
                label="Send Contract"
                onClick={() => toast.info('Send Contract \u2014 coming soon')}
              />
              {!isTerminal && isSales && (
                <>
                  <div className="border-t border-black/[.04] dark:border-white/[.06] my-1" />
                  <QuickActionRow
                    icon={<svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><polyline points="20 6 9 17 4 12" /></svg>}
                    label="Mark as Won"
                    onClick={handleMarkWon}
                    variant="success"
                  />
                  <QuickActionRow
                    icon={<svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>}
                    label="Close as Lost"
                    onClick={handleMarkLost}
                    variant="danger"
                  />
                </>
              )}
            </div>
          </SidebarSection>

          {/* Deal flags */}
          {deal.isFlagged && (
            <div className="bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 rounded-xl p-4">
              <p className="text-[10px] font-semibold text-red-600 uppercase tracking-wide mb-1">\u2691 Flagged</p>
              <p className="text-[12px] text-red-700 dark:text-red-400">{deal.flagReason || 'No reason specified'}</p>
            </div>
          )}

          {/* Next Step (static placeholder — will be dynamic later) */}
          <div className="bg-white dark:bg-[#1e1e21] rounded-xl border border-amber-200 dark:border-amber-500/30 shadow-[0_1px_4px_rgba(0,0,0,0.04)] p-4">
            <p className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-2">Next Step</p>
            <div className="bg-amber-50 dark:bg-amber-500/10 rounded-lg p-3 border border-amber-100 dark:border-amber-500/20">
              <p className="text-[10px] font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide mb-1">Action Required</p>
              <p className="text-[13px] text-slate-700 dark:text-slate-200 leading-snug">Initial outreach — intro email + schedule call</p>
              <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1.5">Due Mar 22, 2026</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
