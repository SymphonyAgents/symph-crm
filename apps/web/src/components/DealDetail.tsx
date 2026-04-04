'use client'

import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { queryKeys } from '@/lib/query-keys'
import { usePatchDealStage, useCreateDocument, useUploadDocumentFile, useUpdateDeal, useDeleteDocument, useCreateContact, useDeleteDeal } from '@/lib/hooks/mutations'
import { useGetDeal, useGetCompany, useGetActivitiesByDeal, useGetDocumentsByDeal, useGetUsers, useGetContactsByCompany } from '@/lib/hooks/queries'
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
  getDaysInStage, getBrandColor, getInitials, getStageProgressIndex, formatServiceType, formatDealTitle, toPascalCase,
} from '@/lib/utils'
import { getMimeLabel, supportsWordCount, isImage } from '@/lib/utils/document-utils'
import { api } from '@/lib/api'
import type { ApiDealDetail, ApiCompanyDetail, ApiDocument } from '@/lib/types'
import {
  STAGE_LABELS, STAGE_COLORS, STAGE_ADVANCE_MAP,
  PROGRESS_STAGES, ACTIVITY_LABELS, DOC_TYPE_LABELS, ACCEPTED_FILE_TYPES,
} from '@/lib/constants'
import { Copy, Check, Plus, Trash2 } from 'lucide-react'
import { Input } from './ui/input'
import { DocumentViewerModal } from './DocumentViewerModal'
import { PasteChip, PastePreviewModal } from './PasteChip'
import { BillingSection } from './BillingSection'
import { EditDealModal } from './EditDealModal'

function stageToast(fromStage: string, toStage: string, dealTitle: string) {
  const fromColor = STAGE_COLORS[fromStage] ?? '#94a3b8'
  const toColor = STAGE_COLORS[toStage] ?? '#94a3b8'
  const fromLabel = STAGE_LABELS[fromStage] ?? fromStage
  const toLabel = STAGE_LABELS[toStage] ?? toStage
  toast(
    <span className="flex items-center gap-1.5">
      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: fromColor }} />
      {fromLabel}
      <span className="text-slate-400">→</span>
      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: toColor }} />
      {toLabel}
    </span>,
    { description: `${toPascalCase(dealTitle)} updated` },
  )
}

// ── Sub-components ───────────────────────────────────────────────────────────

// Maps PROGRESS_STAGES ids → CSS variable names for dot colors
const STAGE_STEP_COLOR: Record<string, string> = {
  lead:       'var(--stage-lead)',
  discovery:  'var(--stage-discovery)',
  assessment: 'var(--stage-assessment)',
  demo_prop:  'var(--stage-demo)',
  followup:   'var(--stage-followup)',
  won:        'var(--stage-closed_won)',
}

function StageProgress({ currentStage }: { currentStage: string }) {
  const isLost = currentStage === 'closed_lost'
  const currentIdx = isLost ? -1 : getStageProgressIndex(currentStage)

  return (
    <div className="mt-5 px-1">
      <div className="flex items-center">
        {PROGRESS_STAGES.map((stage, i) => {
          const stageColor = STAGE_STEP_COLOR[stage.id] ?? 'var(--stage-lead)'
          return (
          <React.Fragment key={stage.id}>
            {/* Connector line between stages */}
            {i > 0 && (
              <div
                className="flex-1 h-[1.5px] mx-2 shrink"
                style={{
                  background: i <= currentIdx
                    ? 'var(--primary)'
                    : 'color-mix(in srgb, var(--foreground) 12%, transparent)',
                }}
              />
            )}
            {/* Dot + label */}
            <div key={stage.id} className="flex items-center gap-1.5 shrink-0">
              <div
                className={cn(
                  'rounded-full shrink-0 transition-all',
                  i < currentIdx
                    ? 'w-2.5 h-2.5'
                    : i === currentIdx
                    ? 'w-3 h-3 ring-2 ring-offset-1 dark:ring-offset-[#191a1c]'
                    : 'w-2.5 h-2.5 opacity-30'
                )}
                style={i === currentIdx
                  ? { background: stageColor, '--tw-ring-color': `color-mix(in srgb, ${stageColor} 35%, transparent)` } as React.CSSProperties
                  : { background: stageColor }
                }
              />
              <span
                className={cn(
                  'text-xs whitespace-nowrap',
                  i === currentIdx
                    ? 'font-semibold text-primary'
                    : i < currentIdx
                    ? 'font-medium text-slate-500 dark:text-slate-400'
                    : 'text-slate-400 dark:text-slate-500'
                )}
              >
                {stage.label}
              </span>
            </div>
          </React.Fragment>
          )
        })}
        {isLost && (
          <div className="ml-3 shrink-0">
            <span className="text-xxs font-semibold text-red-500 bg-red-50 dark:bg-red-950/30 px-2.5 py-0.5 rounded-full border border-red-100 dark:border-red-500/20">
              Lost
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

function SegmentedProgressBar({ currentStage }: { currentStage: string }) {
  const isLost = currentStage === 'closed_lost'
  const currentIdx = isLost ? -1 : getStageProgressIndex(currentStage)
  return (
    <div className="flex gap-[3px] h-1">
      {PROGRESS_STAGES.map((stage, i) => (
        <div
          key={stage.id}
          className="flex-1 rounded-full transition-all"
          style={{
            background: STAGE_STEP_COLOR[stage.id] ?? 'var(--stage-lead)',
            opacity: isLost ? 0.2 : i <= currentIdx ? 1 : 0.2,
          }}
        />
      ))}
    </div>
  )
}

function SidebarSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-[#1e1e21] rounded-xl border border-black/[.06] dark:border-white/[.08] shadow-[0_1px_4px_rgba(0,0,0,0.04)] p-4">
      <p className="text-atom font-semibold text-slate-400 uppercase tracking-wider mb-3">{title}</p>
      {children}
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-2 py-1.5 border-b border-black/[.04] dark:border-white/[.05] last:border-0">
      <span className="text-xs text-slate-400 shrink-0">{label}</span>
      <span className="text-xs font-medium text-slate-800 dark:text-white text-right">{value}</span>
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
        'flex items-center gap-2.5 w-full px-2 py-2 text-ssm rounded-lg transition-colors text-left',
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

/** Parse deal_stage:xxx tag from a document's tags array */
function parseDocStage(tags?: string[] | null): string | null {
  if (!tags) return null
  const tag = tags.find(t => t.startsWith('deal_stage:'))
  return tag ? tag.slice('deal_stage:'.length) : null
}

/** Small colored stage pill — uses CSS vars so dark mode remaps to muted tones */
function StagePill({ stage }: { stage: string }) {
  const label = STAGE_LABELS[stage] ?? stage
  return (
    <span
      className="text-atom font-semibold px-1.5 py-0.5 rounded-md shrink-0"
      style={{
        color: `var(--stage-${stage}, #94a3b8)`,
        background: `color-mix(in srgb, var(--stage-${stage}, #94a3b8) 12%, transparent)`,
      }}
    >
      {label}
    </span>
  )
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={e => {
        e.stopPropagation()
        navigator.clipboard.writeText(value)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }}
      className={cn(
        'shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xxs font-medium transition-colors',
        copied
          ? 'border-green-200 dark:border-green-800 text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-500/10'
          : 'border-black/[.08] dark:border-white/[.1] text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/[.04]',
      )}
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}

// Accepted upload MIME types for resource files
const RESOURCE_ACCEPT_LIST = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/html',
  'text/markdown',
  'text/plain',
  'text/csv',
  'image/jpeg',
  'image/png',
  'image/webp',
  'audio/mp4',
  'audio/x-m4a',
  'audio/mpeg',
]
const RESOURCE_ACCEPT = RESOURCE_ACCEPT_LIST.join(',')

type ViewMode = 'list' | 'grid'

type DealDetailProps = {
  dealId: string
  backLabel?: string
  onBack: () => void
  onOpenDeal: (id: string) => void
}

// ── Main component ───────────────────────────────────────────────────────────

export function DealDetail({ dealId, backLabel = 'Back to Pipeline', onBack }: DealDetailProps) {
  const [activeTab, setActiveTab] = useState<'notes' | 'resources' | 'timeline' | 'people' | 'billing'>('notes')
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [noteTypeFilter, setNoteTypeFilter] = useState<string>('all')
  const [resourceExtFilter, setResourceExtFilter] = useState<string>('all')
  const [docSearch, setDocSearch] = useState('')
  const [noteText, setNoteText] = useState('')
  const [noteType, setNoteType] = useState<string>('general')
  const [addingNote, setAddingNote] = useState(false)
  const [showAdvanceConfirm, setShowAdvanceConfirm] = useState(false)
  const [showWonConfirm, setShowWonConfirm] = useState(false)
  const [showLostConfirm, setShowLostConfirm] = useState(false)
  const [showEditDeal, setShowEditDeal] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [viewingDoc, setViewingDoc] = useState<ApiDocument | null>(null)
  const [deletingDoc, setDeletingDoc] = useState<ApiDocument | null>(null)
  const [notePasteChips, setNotePasteChips] = useState<string[]>([])
  const [notePastePreviewText, setNotePastePreviewText] = useState<string | null>(null)
  const [noteFocused, setNoteFocused] = useState(false)
  const [showAssignDropdown, setShowAssignDropdown] = useState(false)
  const [showAddPerson, setShowAddPerson] = useState(false)
  const [personForm, setPersonForm] = useState({ name: '', phone: '', email: '', title: '', role: '' })
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const assignRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const noteTextareaRef = useRef<HTMLTextAreaElement>(null)

  const queryClient = useQueryClient()
  const router = useRouter()
  const { userId, isSales } = useUser()
  const patchStage = usePatchDealStage()
  const updateDeal = useUpdateDeal()
  const deleteDeal = useDeleteDeal({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.deals.all })
      onBack()
    },
  })

  // ── Queries ──────────────────────────────────────────────────────────────

  const { data: deal, isLoading, isError } = useGetDeal(dealId)
  const { data: company } = useGetCompany(deal?.companyId)
  const { data: activities = [], isLoading: loadingActivities } = useGetActivitiesByDeal(dealId, { enabled: !!deal })
  const { data: documents = [], isLoading: loadingDocs, refetch: refetchDocs } = useGetDocumentsByDeal(dealId, { enabled: !!deal })
  const { data: users = [] } = useGetUsers()
  const deleteDoc = useDeleteDocument({
    onSuccess: () => {
      refetchDocs()
      queryClient.invalidateQueries({ queryKey: queryKeys.documents.byDeal(dealId) })
      setDeletingDoc(null)
      setViewingDoc(null)
    },
  })
  const { data: dbContacts = [] } = useGetContactsByCompany(deal?.companyId ?? undefined)
  const createContact = useCreateContact({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.contacts.byCompany(deal?.companyId ?? '') })
      setShowAddPerson(false)
      setPersonForm({ name: '', phone: '', email: '', title: '', role: '' })
    },
  })

  // ── Derived values ───────────────────────────────────────────────────────

  const stageColor = deal ? (STAGE_COLORS[deal.stage] ?? '#94a3b8') : '#94a3b8'
  const stageLabel = deal ? (STAGE_LABELS[deal.stage] ?? deal.stage) : ''
  const nextStage = deal ? STAGE_ADVANCE_MAP[deal.stage] : undefined
  const isTerminal = deal ? (deal.stage === 'closed_won' || deal.stage === 'closed_lost') : false
  const daysInStage = deal ? getDaysInStage(activities, deal.createdAt) : 0
  const brandColor = getBrandColor(company?.name ?? deal?.companyId)
  const contactCount = dbContacts.length

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

  // ── Filtered docs ────────────────────────────────────────────────────────
  const filteredNotes = useMemo(() => {
    let docs = noteTypeFilter === 'all' ? noteDocs : noteDocs.filter(d => d.type === noteTypeFilter)
    if (docSearch.trim()) {
      const q = docSearch.toLowerCase()
      docs = docs.filter(d => d.title.toLowerCase().includes(q))
    }
    return docs
  }, [noteDocs, noteTypeFilter, docSearch])

  const filteredResources = useMemo(() => {
    let docs = resourceExtFilter === 'all' ? resourceDocs : resourceDocs.filter(d => {
      const ext = d.tags?.find(t => !['resources', 'notes'].includes(t) && !t.startsWith('deal_stage:'))?.toUpperCase() ?? ''
      if (resourceExtFilter === 'image') return ['JPEG', 'JPG', 'PNG', 'WEBP', 'GIF'].includes(ext)
      return ext === resourceExtFilter.toUpperCase()
    })
    if (docSearch.trim()) {
      const q = docSearch.toLowerCase()
      docs = docs.filter(d => d.title.toLowerCase().includes(q))
    }
    return docs
  }, [resourceDocs, resourceExtFilter, docSearch])

  // ── Unique note types for filter ─────────────────────────────────────────
  const noteTypes = useMemo(() => {
    const types = new Set(noteDocs.map(d => d.type))
    return Array.from(types)
  }, [noteDocs])

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleAdvance = useCallback(() => {
    if (!deal || !nextStage) return
    const prev = queryClient.getQueryData(queryKeys.deals.detail(dealId))
    patchStage.mutate({ id: dealId, stage: nextStage }, {
      onSuccess: () => stageToast(deal.stage, nextStage, deal.title),
      onError: () => queryClient.setQueryData(queryKeys.deals.detail(dealId), prev),
      onSettled: () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.deals.detail(dealId) })
        queryClient.invalidateQueries({ queryKey: queryKeys.deals.all })
      },
    })
  }, [deal, nextStage, dealId, patchStage, queryClient])

  const handleMarkWon = useCallback(() => {
    setShowWonConfirm(true)
  }, [])

  const handleMarkLost = useCallback(() => {
    setShowLostConfirm(true)
  }, [])

  const confirmMarkWon = useCallback(() => {
    setShowWonConfirm(false)
    patchStage.mutate({ id: dealId, stage: 'closed_won' }, {
      onSuccess: () => stageToast(deal?.stage ?? 'lead', 'closed_won', deal?.title ?? 'Deal'),
      onSettled: () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.deals.detail(dealId) })
        queryClient.invalidateQueries({ queryKey: queryKeys.deals.all })
      },
    })
  }, [deal, dealId, patchStage, queryClient])

  const confirmMarkLost = useCallback(() => {
    setShowLostConfirm(false)
    patchStage.mutate({ id: dealId, stage: 'closed_lost' }, {
      onSuccess: () => stageToast(deal?.stage ?? 'lead', 'closed_lost', deal?.title ?? 'Deal'),
      onSettled: () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.deals.detail(dealId) })
        queryClient.invalidateQueries({ queryKey: queryKeys.deals.all })
      },
    })
  }, [deal, dealId, patchStage, queryClient])

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
      {
        dealId,
        type: noteType,
        title,
        content: combined,
        authorId: userId,
        tags: [`deal_stage:${deal.stage}`],
      },
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
    if (!files?.length) return
    setPendingFiles(prev => [...prev, ...Array.from(files).filter(f => RESOURCE_ACCEPT_LIST.includes(f.type))])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [])

  const handleConfirmUpload = useCallback(() => {
    if (!pendingFiles.length || !deal || !userId) return
    setUploading(true)
    uploadFiles.mutate({ dealId, authorId: userId, files: pendingFiles, dealStage: deal.stage })
    setPendingFiles([])
  }, [pendingFiles, deal, dealId, userId, uploadFiles])

  const handleDeleteDoc = useCallback((doc: ApiDocument) => {
    setDeletingDoc(doc)
  }, [])

  const confirmDeleteDoc = useCallback(() => {
    if (!deletingDoc) return
    deleteDoc.mutate(deletingDoc.id)
  }, [deletingDoc, deleteDoc])

  const handleDownloadDoc = useCallback(async (doc: ApiDocument) => {
    try {
      const data = await api.get<{ url: string; filename: string }>(`/documents/${doc.id}/download`)
      window.open(data.url, '_blank')
    } catch {
      toast.error('Download failed — storage may not be configured')
    }
  }, [])

  // ── Render: loading / error ───────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
          <p className="text-xs text-slate-400">Loading deal&hellip;</p>
        </div>
      </div>
    )
  }

  if (isError || !deal) {
    return (
      <div className="p-4 md:p-6 h-full flex flex-col">
        <button onClick={onBack} className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 mb-3 w-fit">
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><polyline points="15 18 9 12 15 6" /></svg>
          {backLabel}
        </button>
        <div className="flex-1 flex items-center justify-center">
          <EmptyState
            title="Deal not found"
            description="This deal may have been deleted or the link is invalid."
            action={
              <button onClick={onBack} className="px-4 py-2 rounded-lg bg-primary text-white text-xs font-semibold">
                {backLabel}
              </button>
            }
          />
        </div>
      </div>
    )
  }

  // ── View toggle icons ─────────────────────────────────────────────────────
  const ListIcon = () => (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  )
  const GridIcon = () => (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
    </svg>
  )

  // ── Render: deal content ──────────────────────────────────────────────────

  return (
    <div className="px-0 pt-4 pb-6 sm:p-4 md:p-6">
      {/* ── Delete confirmation modal ───────────────────────────────── */}
      {deletingDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setDeletingDoc(null)}>
          <div className="bg-white dark:bg-[#1a1d21] rounded-xl shadow-2xl border border-black/[.08] dark:border-white/[.08] w-[92vw] max-w-[400px] p-4 animate-in fade-in-0 zoom-in-95 duration-150" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-50 dark:bg-red-500/10 flex items-center justify-center shrink-0">
                <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="text-red-500">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  <line x1="10" y1="11" x2="10" y2="17" />
                  <line x1="14" y1="11" x2="14" y2="17" />
                </svg>
              </div>
              <div>
                <h3 className="text-sbase font-semibold text-slate-900 dark:text-white">Delete permanently?</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">This cannot be undone.</p>
              </div>
            </div>
            <div className="rounded-lg bg-red-50/50 dark:bg-red-500/[.06] border border-red-100 dark:border-red-500/10 px-3 py-2.5 mb-5">
              <p className="text-xs text-red-700 dark:text-red-400 font-medium truncate">{deletingDoc.title}</p>
              <p className="text-atom text-red-500/70 dark:text-red-400/60 mt-0.5">
                {deletingDoc.storagePath?.includes('/resources/') ? 'Resource file' : 'Note'} · Created {new Date(deletingDoc.createdAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setDeletingDoc(null)}
                className="flex-1 h-9 rounded-lg text-ssm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-white/[.06] hover:bg-slate-200 dark:hover:bg-white/[.10] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteDoc}
                disabled={deleteDoc.isPending}
                className="flex-1 h-9 rounded-lg text-ssm font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors disabled:opacity-60 flex items-center justify-center gap-1.5"
              >
                {deleteDoc.isPending ? (
                  <div className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                ) : (
                  'Delete forever'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Document viewer modal */}
      {showEditDeal && deal && (
        <EditDealModal deal={deal} onClose={() => setShowEditDeal(false)} />
      )}

      {/* Delete deal confirmation */}
      {showDeleteConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4"
          onClick={() => setShowDeleteConfirm(false)}
        >
          <div
            className="max-w-sm w-full rounded-xl border border-black/[.06] dark:border-white/[.08] bg-white dark:bg-[#1e1e21] shadow-2xl p-4"
            onClick={e => e.stopPropagation()}
          >
            <p className="text-sm font-semibold text-slate-900 dark:text-white">Delete deal?</p>
            <p className="text-ssm text-slate-600 dark:text-slate-400 leading-relaxed mt-1">
              This action cannot be undone. The deal will be permanently removed from your pipeline.
            </p>
            <div className="flex gap-2.5 mt-4">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 h-8 rounded-lg text-xs font-semibold border border-black/[.08] dark:border-white/[.1] text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[.04] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteDeal.mutate(dealId)}
                disabled={deleteDeal.isPending}
                className="flex-1 h-8 flex items-center justify-center gap-1.5 rounded-lg text-xs font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-60 transition-colors"
              >
                {deleteDeal.isPending && <span className="inline-block w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {viewingDoc && (
        <DocumentViewerModal
          doc={viewingDoc}
          onClose={() => setViewingDoc(null)}
          onDelete={handleDeleteDoc}
          onDownload={handleDownloadDoc}
        />
      )}

      {/* Paste preview modal — ESC-closable, shows full pasted content */}
      {notePastePreviewText && (
        <PastePreviewModal text={notePastePreviewText} onClose={() => setNotePastePreviewText(null)} />
      )}

      {/* Advance confirmation dialog */}
      {showAdvanceConfirm && nextStage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4"
          onClick={() => setShowAdvanceConfirm(false)}
        >
          <div
            className="w-full max-w-sm bg-white dark:bg-[#1e1e21] rounded-xl border border-black/[.06] dark:border-white/[.08] shadow-2xl p-4 animate-in zoom-in-95 fade-in-0 duration-300"
            onClick={e => e.stopPropagation()}
          >
            {/* Stage transition indicator */}
            <div className="flex items-center gap-2 mb-4">
              <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: `var(--stage-${deal.stage}, #94a3b8)` }} />
              <span className="text-xs font-semibold" style={{ color: `var(--stage-${deal.stage}, #94a3b8)` }}>{stageLabel}</span>
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="text-slate-300">
                <polyline points="9 18 15 12 9 6" />
              </svg>
              <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: `var(--stage-${nextStage}, #94a3b8)` }} />
              <span className="text-xs font-semibold" style={{ color: `var(--stage-${nextStage}, #94a3b8)` }}>{STAGE_LABELS[nextStage] ?? nextStage}</span>
            </div>
            <p className="text-sbase font-bold text-slate-900 dark:text-white mb-1">
              Advance this deal?
            </p>
            <p className="text-ssm text-slate-600 dark:text-slate-400 leading-relaxed">
              Move <span className="font-medium text-slate-700 dark:text-slate-200">{deal.title}</span> to <span className="font-medium" style={{ color: `var(--stage-${nextStage}, #94a3b8)` }}>{STAGE_LABELS[nextStage] ?? nextStage}</span>. This can't be undone.
            </p>
            <div className="flex gap-2.5 mt-4">
              <button
                onClick={() => setShowAdvanceConfirm(false)}
                className="flex-1 h-8 rounded-lg text-xs font-semibold border border-black/[.08] dark:border-white/[.1] text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[.04] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => { setShowAdvanceConfirm(false); handleAdvance() }}
                disabled={patchStage.isPending}
                className="flex-1 h-8 rounded-lg text-xs font-semibold text-white disabled:opacity-60 transition-opacity"
                style={{ background: 'linear-gradient(135deg, var(--primary), var(--color-primary-accent))' }}
              >
                {patchStage.isPending ? (
                  <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin mx-auto" />
                ) : 'Advance'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Won confirmation dialog */}
      {showWonConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4"
          onClick={() => setShowWonConfirm(false)}
        >
          <div
            className="w-full max-w-sm bg-white dark:bg-[#1e1e21] rounded-xl border border-black/[.06] dark:border-white/[.08] shadow-2xl p-4 animate-in zoom-in-95 fade-in-0 duration-300"
            onClick={e => e.stopPropagation()}
          >
            {/* Stage transition indicator */}
            <div className="flex items-center gap-2 mb-4">
              <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: `var(--stage-${deal.stage}, #94a3b8)` }} />
              <span className="text-xs font-semibold" style={{ color: `var(--stage-${deal.stage}, #94a3b8)` }}>{stageLabel}</span>
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="text-slate-300">
                <polyline points="9 18 15 12 9 6" />
              </svg>
              <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: 'var(--stage-closed_won, #16a34a)' }} />
              <span className="text-xs font-semibold" style={{ color: 'var(--stage-closed_won, #16a34a)' }}>Won</span>
            </div>
            <p className="text-sbase font-bold text-slate-900 dark:text-white mb-1">
              Mark as Won?
            </p>
            <p className="text-ssm text-slate-600 dark:text-slate-400 leading-relaxed">
              Move <span className="font-medium text-slate-700 dark:text-slate-200">{deal.title}</span> to <span className="font-medium" style={{ color: 'var(--stage-closed_won, #16a34a)' }}>Won</span>. This can't be undone.
            </p>
            <div className="flex gap-2.5 mt-4">
              <button
                onClick={() => setShowWonConfirm(false)}
                className="flex-1 h-8 rounded-lg text-xs font-semibold border border-black/[.08] dark:border-white/[.1] text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[.04] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmMarkWon}
                disabled={patchStage.isPending}
                className="flex-1 h-8 rounded-lg text-xs font-semibold text-white bg-green-600 hover:bg-green-700 disabled:opacity-60 transition-colors"
              >
                {patchStage.isPending ? (
                  <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin mx-auto" />
                ) : 'Mark as Won'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lost confirmation dialog */}
      {showLostConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4"
          onClick={() => setShowLostConfirm(false)}
        >
          <div
            className="w-full max-w-sm bg-white dark:bg-[#1e1e21] rounded-xl border border-black/[.06] dark:border-white/[.08] shadow-2xl p-4 animate-in zoom-in-95 fade-in-0 duration-300"
            onClick={e => e.stopPropagation()}
          >
            {/* Stage transition indicator */}
            <div className="flex items-center gap-2 mb-4">
              <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: `var(--stage-${deal.stage}, #94a3b8)` }} />
              <span className="text-xs font-semibold" style={{ color: `var(--stage-${deal.stage}, #94a3b8)` }}>{stageLabel}</span>
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="text-slate-300">
                <polyline points="9 18 15 12 9 6" />
              </svg>
              <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: 'var(--stage-closed_lost, #dc2626)' }} />
              <span className="text-xs font-semibold" style={{ color: 'var(--stage-closed_lost, #dc2626)' }}>Lost</span>
            </div>
            <p className="text-sbase font-bold text-slate-900 dark:text-white mb-1">
              Close as Lost?
            </p>
            <p className="text-ssm text-slate-600 dark:text-slate-400 leading-relaxed">
              Move <span className="font-medium text-slate-700 dark:text-slate-200">{deal.title}</span> to <span className="font-medium" style={{ color: 'var(--stage-closed_lost, #dc2626)' }}>Lost</span>. This can't be undone.
            </p>
            <div className="flex gap-2.5 mt-4">
              <button
                onClick={() => setShowLostConfirm(false)}
                className="flex-1 h-8 rounded-lg text-xs font-semibold border border-black/[.08] dark:border-white/[.1] text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[.04] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmMarkLost}
                disabled={patchStage.isPending}
                className="flex-1 h-8 rounded-lg text-xs font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-60 transition-colors"
              >
                {patchStage.isPending ? (
                  <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin mx-auto" />
                ) : 'Close as Lost'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Back */}
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-xs font-medium text-slate-500 dark:text-slate-300 hover:text-primary dark:hover:text-primary transition-colors mb-4 w-fit px-4 sm:px-0"
      >
        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><polyline points="15 18 9 12 15 6" /></svg>
        {backLabel}
      </button>

      {/* ── Mobile header (sm:hidden) ────────────────────────────────────────── */}
      <div className="sm:hidden bg-white dark:bg-[#1e1e21] border-y border-black/[.06] dark:border-white/[.08] p-4 mb-0 flex flex-col gap-3">
        {/* Company tag */}
        <p className="text-xxs font-semibold text-slate-400 uppercase tracking-wide leading-none truncate">
          {company?.name ?? 'No Brand'}
        </p>

        {/* Deal title */}
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold text-slate-900 dark:text-white leading-snug -mt-1 line-clamp-2">
            {formatDealTitle(deal.title)}
          </h1>
          <button
            onClick={() => setShowEditDeal(true)}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-primary hover:bg-slate-100 dark:hover:bg-white/[.06] transition-colors shrink-0"
            title="Edit deal"
          >
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
          {isSales && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors shrink-0"
              title="Delete deal"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>

        {/* Stage dot + deal value */}
        <div className="flex items-center gap-2">
          <div
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ background: `var(--stage-${deal.stage}, ${stageColor})` }}
          />
          <span
            className="text-xs font-semibold"
            style={{ color: `var(--stage-${deal.stage}, ${stageColor})` }}
          >
            {stageLabel}
          </span>
          <span className="text-slate-300 dark:text-slate-600">·</span>
          <span className="text-sbase font-bold tabular-nums text-primary">
            {formatCurrencyFull(deal.value)}
          </span>
        </div>

        {/* Segmented progress bar */}
        <SegmentedProgressBar currentStage={deal.stage} />

        {/* Context strip: days in stage + capture date */}
        <div className="flex items-center gap-3 text-xxs text-slate-400">
          <span>{daysInStage}d in stage</span>
          <span className="text-slate-300 dark:text-slate-600">·</span>
          <span>Captured {formatDate(deal.createdAt)}</span>
        </div>

        {/* Action row: Advance + More */}
        <div className="flex items-center gap-2 mt-1">
          {nextStage ? (
            <button
              onClick={() => setShowAdvanceConfirm(true)}
              disabled={patchStage.isPending}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg font-semibold text-ssm text-white disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg, var(--primary), var(--color-primary-accent))' }}
            >
              {patchStage.isPending ? (
                <div className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              ) : (
                <>
                  Advance to {STAGE_LABELS[nextStage] ?? nextStage}
                  <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </>
              )}
            </button>
          ) : (
            <div className="flex-1 flex items-center justify-center py-2 rounded-lg text-xs font-medium text-slate-400 bg-slate-50 dark:bg-white/[.04]">
              {deal.stage === 'closed_won' ? '🎉 Deal Won' : deal.stage === 'closed_lost' ? 'Deal Lost' : 'No next stage'}
            </div>
          )}
          <button className="w-9 h-9 flex items-center justify-center rounded-lg border border-black/[.08] dark:border-white/[.1] text-slate-500 hover:bg-slate-50 dark:hover:bg-white/[.04] shrink-0">
            <svg width={16} height={16} viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" /></svg>
          </button>
        </div>
      </div>

      {/* ── Desktop header (hidden sm:block) ────────────────────────────────── */}
      <div className="hidden sm:block bg-white dark:bg-[#1e1e21] rounded-xl border border-black/[.06] dark:border-white/[.08] shadow-[0_1px_4px_rgba(0,0,0,0.04)] p-5 mb-4">
        {/* Top row: brand info + value/advance */}
        <div className="flex sm:items-start sm:justify-between gap-3">
          {/* Left: Brand + deal info */}
          <div className="flex items-center gap-3.5 min-w-0">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center text-sbase font-bold shrink-0"
              style={{ background: `${brandColor}18`, color: brandColor }}
            >
              {getInitials(company?.name ?? 'No Brand')}
            </div>
            <div className="min-w-0">
              <p className="text-xxs font-semibold text-slate-400 uppercase tracking-wide leading-none mb-1">
                {company?.name ?? 'No Brand'}
              </p>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900 dark:text-white leading-tight">
                  {formatDealTitle(deal.title)}
                </h1>
                <button
                  onClick={() => setShowEditDeal(true)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-primary hover:bg-slate-100 dark:hover:bg-white/[.06] transition-colors shrink-0"
                  title="Edit deal"
                >
                  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </button>
                {isSales && (
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors shrink-0"
                    title="Delete deal"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {[company?.name, company?.industry].filter(Boolean).join(' \u00B7 ') || 'No brand assigned'}
              </p>
            </div>
          </div>

          {/* Right: Value → stage → advance (stacked, right-aligned) */}
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <div className="text-2xl font-bold tabular-nums text-primary leading-tight">
              {formatCurrencyFull(deal.value)}
            </div>
            <span
              className="text-xxs font-semibold px-2 py-0.5 rounded-full"
              style={{
                color: `var(--stage-${deal.stage}, ${stageColor})`,
                background: `color-mix(in srgb, var(--stage-${deal.stage}, ${stageColor}) 12%, transparent)`,
              }}
            >
              {stageLabel}
            </span>
            {nextStage && (
              <button
                onClick={() => setShowAdvanceConfirm(true)}
                disabled={patchStage.isPending}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg font-semibold text-xs text-white transition-opacity disabled:opacity-60 shrink-0 mt-0.5"
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

        {/* Stage progress — desktop only */}
        <StageProgress currentStage={deal.stage} />
      </div>

      {/* ── Body: left content + right sidebar ─────────── */}
      <div className="flex flex-col sm:flex-row sm:gap-4 sm:items-start">

        {/* Left: tabs + content */}
        <div className="flex-1 min-w-0 bg-white dark:bg-[#1e1e21] sm:rounded-xl border-y sm:border border-black/[.06] dark:border-white/[.08] sm:shadow-[0_1px_4px_rgba(0,0,0,0.04)] overflow-hidden">
          {/* Tab bar — includes filters + view toggle flushed right */}
          <div className="flex items-center border-b border-black/[.06] dark:border-white/[.08] gap-0 pr-2">
            {/* Tabs */}
            <div className="flex flex-1 min-w-0 flex-wrap">
              {([
                { id: 'notes', label: 'Notes', count: noteDocs.length },
                { id: 'resources', label: 'Resources', count: resourceDocs.length },
                { id: 'timeline', label: 'Timeline', count: activities.length },
                { id: 'people' as const, label: 'People', count: contactCount },
                { id: 'billing' as const, label: 'Billing', count: null },
              ] as const).map(tab => (
                <button
                  key={tab.id}
                  onClick={() => { setActiveTab(tab.id); setDocSearch('') }}
                  className={cn(
                    'flex items-center gap-1.5 px-3 sm:px-4 py-3 text-xs font-medium border-b-2 -mb-px transition-colors whitespace-nowrap',
                    activeTab === tab.id
                      ? 'border-primary text-primary'
                      : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                  )}
                >
                  {tab.label}
                  {tab.count !== null && tab.count > 0 && (
                    <span className={cn(
                      'text-atom font-semibold px-1.5 py-0.5 rounded-full min-w-[18px] text-center',
                      activeTab === tab.id
                        ? 'bg-primary/15 text-primary dark:bg-primary/20'
                        : 'bg-slate-100 dark:bg-white/[.08] text-slate-500'
                    )}>
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Right controls — search + filter + view toggle (hidden for timeline) */}
            {activeTab !== 'timeline' && activeTab !== 'billing' && activeTab !== 'people' && (
              <div className="hidden sm:flex items-center gap-1 shrink-0">

                {/* Search input */}
                <div className="flex items-center gap-1 h-7 bg-slate-50 dark:bg-white/[.04] border border-black/[.06] dark:border-white/[.07] rounded-md px-2">
                  <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="text-slate-400 shrink-0">
                    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  <input
                    type="text"
                    value={docSearch}
                    onChange={e => setDocSearch(e.target.value)}
                    placeholder="Search…"
                    className="bg-transparent text-xxs text-slate-700 dark:text-slate-300 placeholder:text-slate-400 outline-none w-[72px]"
                  />
                  {docSearch && (
                    <button onClick={() => setDocSearch('')} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 shrink-0">
                      <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  )}
                </div>

                {/* Type / ext filter — shadcn Select */}
                {activeTab === 'notes' && noteTypes.length > 1 && (
                  <Select value={noteTypeFilter} onValueChange={setNoteTypeFilter}>
                    <SelectTrigger className="h-7 w-auto min-w-[84px] text-xxs border-none bg-transparent shadow-none px-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white gap-1 focus:ring-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" className="text-xs">All types</SelectItem>
                      {noteTypes.map(t => (
                        <SelectItem key={t} value={t} className="text-xs">{DOC_TYPE_LABELS[t] ?? t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {activeTab === 'resources' && (
                  <Select value={resourceExtFilter} onValueChange={setResourceExtFilter}>
                    <SelectTrigger className="h-7 w-auto min-w-[80px] text-xxs border-none bg-transparent shadow-none px-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white gap-1 focus:ring-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" className="text-xs">All files</SelectItem>
                      <SelectItem value="pdf" className="text-xs">PDF</SelectItem>
                      <SelectItem value="docx" className="text-xs">DOCX</SelectItem>
                      <SelectItem value="image" className="text-xs">Images</SelectItem>
                    </SelectContent>
                  </Select>
                )}

                {/* Divider + List/Grid toggle (notes tab only) */}
                {activeTab === 'notes' && (
                  <>
                    <div className="w-px h-4 bg-black/[.06] dark:bg-white/[.08] mx-0.5" />
                    <button
                      onClick={() => setViewMode('list')}
                      className={cn(
                        'w-7 h-7 rounded-md flex items-center justify-center transition-colors',
                        viewMode === 'list'
                          ? 'bg-primary/10 text-primary'
                          : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[.04]'
                      )}
                      title="List view"
                    >
                      <ListIcon />
                    </button>
                    <button
                      onClick={() => setViewMode('grid')}
                      className={cn(
                        'w-7 h-7 rounded-md flex items-center justify-center transition-colors',
                        viewMode === 'grid'
                          ? 'bg-primary/10 text-primary'
                          : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[.04]'
                      )}
                      title="Grid view"
                    >
                      <GridIcon />
                    </button>
                  </>
                )}
              </div>
            )}
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
                      className="w-full bg-transparent border-none outline-none text-ssm text-slate-900 dark:text-white leading-[1.6] resize-none overflow-hidden placeholder:text-slate-400"
                      style={{ minHeight: '28px', maxHeight: '160px' }}
                    />
                  </div>

                  {/* Bottom toolbar */}
                  <div className="flex items-center gap-2 px-3 pb-3 pt-1">
                    <Select value={noteType} onValueChange={setNoteType}>
                      <SelectTrigger className="h-7 w-auto min-w-[90px] text-xxs border-none bg-transparent shadow-none px-2 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white gap-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="general" className="text-xs">Note</SelectItem>
                        <SelectItem value="discovery" className="text-xs">Discovery</SelectItem>
                        <SelectItem value="meeting" className="text-xs">Meeting Notes</SelectItem>
                        <SelectItem value="transcript_raw" className="text-xs">Transcript</SelectItem>
                        <SelectItem value="proposal" className="text-xs">Proposal</SelectItem>
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

              {/* Notes list / grid */}
              {loadingDocs ? (
                <div className="p-8 flex items-center justify-center">
                  <div className="w-5 h-5 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
                </div>
              ) : filteredNotes.length === 0 ? (
                <div className="py-10 text-center">
                  <p className="text-ssm text-slate-400">
                    {noteTypeFilter !== 'all' ? 'No notes match this filter' : 'No notes yet'}
                  </p>
                  <p className="text-xxs text-slate-300 mt-0.5">
                    {noteTypeFilter !== 'all' ? '' : 'Add the first note above'}
                  </p>
                </div>
              ) : viewMode === 'grid' ? (
                /* Grid view */
                <div className="p-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {filteredNotes.map(doc => {
                    const docStage = parseDocStage(doc.tags)
                    const authorName = doc.authorId ? (userNameMap.get(doc.authorId) ?? null) : null
                    const authorUser = doc.authorId ? users.find(u => u.id === doc.authorId) : null
                    return (
                      <div
                        key={doc.id}
                        className="group rounded-lg border border-black/[.06] dark:border-white/[.08] p-3 cursor-pointer hover:border-primary/30 hover:bg-primary/[.02] transition-all flex flex-col gap-1.5"
                        onClick={() => setViewingDoc(doc)}
                      >
                        {/* Icon + type */}
                        <div className="flex items-center justify-between">
                          <div className="text-slate-300 dark:text-slate-600 group-hover:text-primary/50 transition-colors">
                            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
                              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                              <polyline points="14 2 14 8 20 8" />
                            </svg>
                          </div>
                          <div className="flex items-center gap-1">
                            {docStage && <StagePill stage={docStage} />}
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDeleteDoc(doc) }}
                              className="w-6 h-6 rounded-md flex items-center justify-center text-slate-400 dark:text-slate-500 hover:text-red-600 hover:bg-red-100 dark:hover:text-red-400 dark:hover:bg-red-500/15 transition-colors opacity-0 group-hover:opacity-100"
                              title="Delete"
                            >
                              <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                              </svg>
                            </button>
                          </div>
                        </div>
                        {/* Title */}
                        <p className="text-xs font-semibold text-slate-800 dark:text-white line-clamp-2 leading-snug group-hover:text-primary transition-colors">
                          {doc.title}
                        </p>
                        {/* Excerpt */}
                        {doc.excerpt && (
                          <p className="text-atom text-slate-400 line-clamp-2 leading-relaxed flex-1">
                            {doc.excerpt}
                          </p>
                        )}
                        {/* Footer: type badge + author + date */}
                        <div className="flex items-center gap-1.5 mt-auto pt-1 flex-wrap">
                          <span className="text-atom font-medium px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-white/[.06] text-slate-500 shrink-0">
                            {DOC_TYPE_LABELS[doc.type] ?? doc.type}
                          </span>
                          {authorUser && (
                            <div className="flex items-center gap-1 min-w-0">
                              <Avatar name={authorUser.name || authorUser.email} email={authorUser.email ?? undefined} src={authorUser.image ?? undefined} size={12} />
                              <span className="text-atom text-slate-400 truncate">{authorName?.split(' ')[0]}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                /* List view */
                <div className="divide-y divide-black/[.04] dark:divide-white/[.05]">
                  {filteredNotes.map(doc => {
                    const docStage = parseDocStage(doc.tags)
                    const authorName = doc.authorId ? (userNameMap.get(doc.authorId) ?? null) : null
                    const authorUser = doc.authorId ? users.find(u => u.id === doc.authorId) : null
                    return (
                      <div
                        key={doc.id}
                        className="flex items-start gap-3 px-4 py-3 w-full min-w-0 overflow-hidden hover:bg-slate-50 dark:hover:bg-white/[.02] transition-colors group cursor-pointer"
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
                          {/* Note name */}
                          <p className="text-ssm font-semibold text-slate-800 dark:text-white truncate leading-tight group-hover:text-primary transition-colors">
                            {doc.title}
                          </p>
                          {/* Excerpt */}
                          {doc.excerpt ? (
                            <p className="text-atom text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                              {doc.excerpt}
                            </p>
                          ) : (
                            <p className="text-atom text-slate-300 dark:text-slate-600 italic mt-0.5">
                              Empty note
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            {authorUser && (
                              <div className="flex items-center gap-1 shrink-0">
                                <Avatar name={authorUser.name || authorUser.email} email={authorUser.email ?? undefined} src={authorUser.image ?? undefined} size={14} />
                                <span className="text-atom text-slate-400">{authorName?.split(' ')[0] ?? 'AM'}</span>
                              </div>
                            )}
                            <span className="text-atom font-medium px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-white/[.06] text-slate-500 shrink-0">
                              {DOC_TYPE_LABELS[doc.type] ?? doc.type}
                            </span>
                            {docStage && <StagePill stage={docStage} />}
                            <span className="text-atom text-slate-400">
                              {new Date(doc.createdAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
                            </span>
                          </div>
                        </div>
                        {/* Actions */}
                        <div className="shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity mt-0.5">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeleteDoc(doc) }}
                            className="w-6 h-6 rounded-md flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-100 dark:hover:text-red-400 dark:hover:bg-red-500/15 transition-colors"
                            title="Delete"
                          >
                            <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                          </button>
                          <span className="text-atom font-medium text-primary flex items-center gap-0.5">
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
              )}
            </div>
          )}

          {/* ── Resources tab ─────────────────────────────────────────────── */}
          {activeTab === 'resources' && (
            <div
              className={cn(
                'p-4 transition-colors',
                isDragging && 'bg-primary/[.03] ring-2 ring-inset ring-primary/20 rounded-lg'
              )}
              onDragOver={e => { e.preventDefault(); e.stopPropagation(); setIsDragging(true) }}
              onDragEnter={e => { e.preventDefault(); e.stopPropagation(); setIsDragging(true) }}
              onDragLeave={e => {
                e.preventDefault()
                e.stopPropagation()
                const rect = e.currentTarget.getBoundingClientRect()
                const { clientX: x, clientY: y } = e
                if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
                  setIsDragging(false)
                }
              }}
              onDrop={e => {
                e.preventDefault()
                e.stopPropagation()
                setIsDragging(false)
                const files = e.dataTransfer?.files
                if (!files?.length) return
                const accepted = Array.from(files).filter(f => RESOURCE_ACCEPT_LIST.includes(f.type))
                if (!accepted.length) return
                setPendingFiles(prev => [...prev, ...accepted])
              }}
            >
              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept={RESOURCE_ACCEPT}
                multiple
                onChange={handleFileUpload}
                className="hidden"
                id="resource-upload"
              />

              {/* Header with upload button */}
              <div className="flex items-center justify-between mb-3">
                <p className="text-atom font-semibold text-slate-400 uppercase tracking-wider">Files</p>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-primary hover:bg-primary/[.06] border border-dashed border-primary/30 transition-colors disabled:opacity-50"
                >
                  {uploading ? (
                    <span className="w-3 h-3 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
                  ) : (
                    <Plus size={13} />
                  )}
                  Upload or Drop files
                </button>
              </div>

              {/* Pending file chips + confirm upload */}
              {pendingFiles.length > 0 && (
                <div className="mb-4 flex flex-wrap gap-2 items-start">
                  {pendingFiles.map((file, i) => (
                    <div key={i} className="relative group inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-white/[.06] border border-black/[.08] dark:border-white/[.10] max-w-[180px]">
                      <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="text-slate-400 shrink-0">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                      </svg>
                      <span className="text-xxs text-slate-600 dark:text-slate-300 truncate leading-tight">{file.name}</span>
                      <button
                        type="button"
                        onClick={() => setPendingFiles(prev => prev.filter((_, j) => j !== i))}
                        className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-white dark:bg-[#2a2c30] border border-black/[.12] dark:border-white/[.15] flex items-center justify-center text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-colors shadow-sm"
                      >
                        <svg width={9} height={9} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round">
                          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={handleConfirmUpload}
                    disabled={uploading}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold text-xs text-white disabled:opacity-60 transition-opacity"
                    style={{ background: 'linear-gradient(135deg, var(--primary), var(--color-primary-accent))' }}
                  >
                    {uploading ? (
                      <div className="w-3 h-3 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    ) : (
                      <>
                        Upload {pendingFiles.length} file{pendingFiles.length !== 1 ? 's' : ''}
                        <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="17 8 12 3 7 8" />
                          <line x1="12" y1="3" x2="12" y2="15" />
                        </svg>
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Uploaded resource files */}
              {loadingDocs ? (
                <div className="flex items-center justify-center py-6">
                  <div className="w-5 h-5 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
                </div>
              ) : filteredResources.length > 0 ? (
                <div className="mb-4">
                  <div className="flex flex-col gap-1">
                    {filteredResources.map(doc => {
                      const extRaw = doc.tags?.find(t => !['resources', 'notes'].includes(t) && !t.startsWith('deal_stage:'))
                      const ext = getMimeLabel(extRaw, doc.title)
                      const displayName = doc.title
                      const docStage = parseDocStage(doc.tags)
                      const authorUser = doc.authorId ? users.find(u => u.id === doc.authorId) : null
                      const authorName = doc.authorId ? (userNameMap.get(doc.authorId) ?? null) : null
                      return (
                        <div
                          key={doc.id}
                          className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-50 dark:hover:bg-white/[.02] transition-colors group cursor-pointer"
                          onClick={() => setViewingDoc(doc)}
                        >
                          {/* File type badge */}
                          <div className={cn(
                            'w-9 h-9 rounded-lg flex items-center justify-center text-atom font-bold uppercase shrink-0',
                            ext === 'PDF' ? 'bg-red-50 dark:bg-red-500/[.12] text-red-600 dark:text-red-400'
                            : ext === 'DOCX' || ext === 'DOC' ? 'bg-blue-50 dark:bg-blue-500/[.12] text-blue-600 dark:text-blue-400'
                            : ext === 'PPTX' || ext === 'PPT' ? 'bg-orange-50 dark:bg-orange-500/[.12] text-orange-600 dark:text-orange-400'
                            : ext === 'JPG' || ext === 'PNG' || ext === 'IMG' ? 'bg-purple-50 dark:bg-purple-500/[.12] text-purple-600 dark:text-purple-400'
                            : 'bg-slate-100 dark:bg-white/[.06] text-slate-500 dark:text-slate-400'
                          )}>
                            {ext}
                          </div>
                          {/* File info */}
                          <div className="flex-1 min-w-0">
                            <p className="text-ssm font-medium text-slate-800 dark:text-white truncate group-hover:text-primary transition-colors" title={displayName}>
                              {displayName}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5">
                              {authorUser && (
                                <div className="flex items-center gap-1">
                                  <Avatar name={authorUser.name || authorUser.email} email={authorUser.email ?? undefined} src={authorUser.image ?? undefined} size={12} />
                                  <span className="text-atom text-slate-400">{authorName?.split(' ')[0] ?? 'AM'}</span>
                                </div>
                              )}
                              {docStage && <StagePill stage={docStage} />}
                              <span className="text-atom text-slate-400">
                                {new Date(doc.createdAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                              </span>
                            </div>
                          </div>
                          {/* Actions */}
                          <div className="shrink-0 flex items-center gap-2">
                            <button
                              onClick={(e) => { e.stopPropagation(); setViewingDoc(doc) }}
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-primary hover:bg-primary/10 transition-colors"
                              title="View"
                            >
                              <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                <circle cx="12" cy="12" r="3" />
                              </svg>
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDownloadDoc(doc) }}
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-primary hover:bg-primary/10 transition-colors"
                              title="Download"
                            >
                              <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                <polyline points="7 10 12 15 17 10" />
                                <line x1="12" y1="15" x2="12" y2="3" />
                              </svg>
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDeleteDoc(doc) }}
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-100 dark:hover:text-red-400 dark:hover:bg-red-500/15 transition-colors"
                              title="Delete"
                            >
                              <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : !loadingDocs && pendingFiles.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-ssm text-slate-400">No files uploaded yet</p>
                  <p className="text-xxs text-slate-300 dark:text-slate-600 mt-1">Drop files here or click Upload to add resources</p>
                </div>
              ) : null}

              {/* Quick links from deal fields */}
              {(deal.proposalLink || deal.demoLink) && (
                <div className="flex flex-col gap-2 mb-3">
                  <p className="text-atom font-semibold text-slate-400 uppercase tracking-wider">Links</p>
                  {deal.proposalLink && (
                    <a
                      href={deal.proposalLink.startsWith('http') ? deal.proposalLink : `https://${deal.proposalLink}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-ssm text-primary hover:underline font-medium"
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
                      className="flex items-center gap-2 text-ssm text-primary hover:underline font-medium"
                    >
                      <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" /></svg>
                      Demo Recording
                    </a>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Billing tab ───────────────────────────────────────────────── */}
          {activeTab === 'billing' && (
            <div className="p-4">
              {deal.stage === 'closed_won' ? (
                <BillingSection dealId={dealId} />
              ) : (
                <div className="py-12 text-center">
                  <p className="text-ssm font-medium text-slate-400">Billing not available yet</p>
                  <p className="text-xxs text-slate-300 dark:text-slate-600 mt-1">Mark this deal as Won to enable billing</p>
                </div>
              )}
            </div>
          )}

          {/* ── People tab ───────────────────────────────────────────────── */}
          {activeTab === 'people' && (
            <div className="p-3 space-y-2.5">
              {/* Add Person button / inline form */}
              {!showAddPerson ? (
                <button
                  onClick={() => setShowAddPerson(true)}
                  className="flex items-center gap-1.5 w-full px-3.5 py-2.5 text-xs font-medium text-primary hover:bg-primary/[.06] rounded-lg border border-dashed border-black/[.1] dark:border-white/[.1] transition-colors"
                >
                  <Plus size={14} />
                  Add Person
                </button>
              ) : (
                <div className="rounded-lg border border-black/[.06] dark:border-white/[.08] bg-white dark:bg-[#1e1e21] p-3.5 space-y-2.5">
                  <Input
                    autoFocus
                    type="text"
                    placeholder="Full name *"
                    value={personForm.name}
                    onChange={e => setPersonForm(f => ({ ...f, name: e.target.value }))}
                    className="text-ssm"
                  />
                  <Input
                    type="tel"
                    placeholder="Phone (optional)"
                    value={personForm.phone}
                    onChange={e => setPersonForm(f => ({ ...f, phone: e.target.value }))}
                    className="text-ssm"
                  />
                  <Input
                    type="email"
                    placeholder="Email (optional)"
                    value={personForm.email}
                    onChange={e => setPersonForm(f => ({ ...f, email: e.target.value }))}
                    className="text-ssm"
                  />
                  <Input
                    type="text"
                    placeholder="Notes / description (optional)"
                    value={personForm.title}
                    onChange={e => setPersonForm(f => ({ ...f, title: e.target.value }))}
                    className="text-ssm"
                  />
                  <Select
                    value={personForm.role || undefined}
                    onValueChange={v => setPersonForm(f => ({ ...f, role: v }))}
                  >
                    <SelectTrigger className="text-ssm">
                      <SelectValue placeholder="Role (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="poc" className="text-ssm">POC</SelectItem>
                      <SelectItem value="stakeholder" className="text-ssm">Stakeholder</SelectItem>
                      <SelectItem value="champion" className="text-ssm">Champion</SelectItem>
                      <SelectItem value="blocker" className="text-ssm">Blocker</SelectItem>
                      <SelectItem value="technical" className="text-ssm">Technical</SelectItem>
                      <SelectItem value="executive" className="text-ssm">Executive</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => {
                        if (!personForm.name.trim() || !deal?.companyId) return
                        createContact.mutate({
                          companyId: deal.companyId,
                          name: personForm.name.trim(),
                          phone: personForm.phone.trim() || null,
                          email: personForm.email.trim() || null,
                          title: [personForm.role, personForm.title.trim()].filter(Boolean).join(' — ') || null,
                        })
                      }}
                      disabled={!personForm.name.trim() || createContact.isPending}
                      className="flex items-center gap-1.5 h-8 px-3.5 text-xs font-semibold text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{ background: 'linear-gradient(135deg, var(--primary), var(--color-primary-accent))' }}
                    >
                      <>{createContact.isPending && <span className="inline-block w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />}Add Person</>
                    </button>
                    <button
                      onClick={() => {
                        setShowAddPerson(false)
                        setPersonForm({ name: '', phone: '', email: '', title: '', role: '' })
                      }}
                      className="h-8 px-3.5 text-xs font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {dbContacts.length === 0 && !showAddPerson ? (
                <div className="py-8 text-center text-ssm text-slate-400">
                  No contacts found for this deal
                </div>
              ) : (
                dbContacts.map(person => {
                  const initials = getInitials(person.name)
                  const color = getBrandColor(person.name)
                  return (
                    <div
                      key={person.id}
                      className="rounded-lg border border-black/[.06] dark:border-white/[.08] bg-white dark:bg-[#1e1e21] p-4"
                    >
                      {/* Header: avatar + name + role */}
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                          style={{ background: color }}
                        >
                          {initials}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                              {toPascalCase(person.name)}
                            </span>
                            {person.title && (
                              <span className="text-atom font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-white/[.08] text-slate-500 dark:text-slate-400 whitespace-nowrap uppercase tracking-wide">
                                {person.title}
                              </span>
                            )}
                          </div>
                          <div className="text-xxs text-slate-400 mt-0.5">
                            {person.updatedAt ? 'Added ' + timeAgo(person.updatedAt) : 'Contact'}
                          </div>
                        </div>
                      </div>

                      {/* Contact info sections */}
                      {(person.email || person.phone) && (
                        <div className="mt-3 pt-3 border-t border-black/[.06] dark:border-white/[.06] space-y-3">
                          {person.email && (
                            <div>
                              <div className="text-atom font-semibold text-slate-400 uppercase tracking-wide mb-1">Email</div>
                              <div className="flex items-center justify-between">
                                <span className="text-ssm text-slate-800 dark:text-white truncate">{person.email}</span>
                                <CopyButton value={person.email} />
                              </div>
                            </div>
                          )}
                          {person.phone && (
                            <div>
                              <div className="text-atom font-semibold text-slate-400 uppercase tracking-wide mb-1">Phone</div>
                              <div className="flex items-center justify-between">
                                <span className="text-ssm text-slate-800 dark:text-white">{person.phone}</span>
                                <CopyButton value={person.phone} />
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })
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
                          <div className="text-xs font-medium text-slate-800 dark:text-white">
                            {ACTIVITY_LABELS[a.type] ?? a.type.replace(/_/g, ' ')}
                          </div>
                          <div className="text-atom text-slate-400 shrink-0">{timeAgo(a.createdAt)}</div>
                        </div>
                        {a.actorId && (
                          <div className="text-atom text-slate-400 mt-0.5">by {a.actorId}</div>
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
        <div className="w-full sm:w-[260px] sm:shrink-0 flex flex-col gap-3 px-4 sm:px-0 pt-4 sm:pt-0">

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
                      'text-atom font-semibold px-2 py-0.5 rounded-full capitalize',
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
                <span className="text-atom text-slate-400 block mb-1.5">Services</span>
                <div className="flex flex-wrap gap-1">
                  {deal.servicesTags.map(s => (
                    <span key={s} className="text-atom font-medium px-1.5 py-0.5 rounded-lg bg-primary/10 text-primary">
                      {formatServiceType(s)}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </SidebarSection>

          {/* Account Manager */}
          <SidebarSection title="Account Manager">
            <div ref={assignRef} className="relative">
              {isTerminal ? (
                /* Locked: won/lost deals cannot have AM reassigned */
                <div className="flex items-center gap-2.5 px-1 py-1 -mx-1 rounded-lg">
                  {amDisplayName ? (
                    <>
                      <Avatar
                        name={amDisplayName}
                        email={amUser?.email ?? undefined}
                        src={amUser?.image ?? undefined}
                        size={34}
                      />
                      <div className="text-left min-w-0 flex-1">
                        <p className="text-ssm font-semibold text-slate-800 dark:text-white truncate">{amDisplayName}</p>
                        <p className="text-xxs text-slate-400">Account Manager</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="w-[34px] h-[34px] rounded-full border-2 border-dashed border-slate-200 dark:border-white/[.12] flex items-center justify-center shrink-0">
                        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="text-slate-300 dark:text-slate-600">
                          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
                        </svg>
                      </div>
                      <span className="text-xs text-slate-400">Unassigned</span>
                    </>
                  )}
                  {/* Lock indicator */}
                  <div className="ml-auto shrink-0" title={`Cannot reassign AM — deal is ${deal.stage === 'closed_won' ? 'won' : 'lost'}`}>
                    <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="text-slate-300 dark:text-slate-600">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                  </div>
                </div>
              ) : (
                /* Normal: click to assign */
                <>
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
                          <p className="text-ssm font-semibold text-slate-800 dark:text-white truncate">{amDisplayName}</p>
                          <p className="text-xxs text-slate-400">Account Manager</p>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="w-[34px] h-[34px] rounded-full border-2 border-dashed border-slate-200 dark:border-white/[.12] flex items-center justify-center shrink-0">
                          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="text-slate-300 dark:text-slate-600">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
                          </svg>
                        </div>
                        <span className="text-xs text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors">
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
                        <div className="px-3 py-3 text-xxs text-slate-400 italic text-center">No team members found</div>
                      ) : (
                        <div className="max-h-[180px] overflow-y-auto py-1">
                          {amDisplayName && (
                            <button
                              onClick={() => handleAssignAM('')}
                              className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-500/[.08] transition-colors"
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
                                'flex items-center gap-2 w-full px-3 py-1.5 text-xs transition-colors',
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
                </>
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
              <p className="text-atom font-semibold text-red-600 uppercase tracking-wide mb-1">\u2691 Flagged</p>
              <p className="text-xs text-red-700 dark:text-red-400">{deal.flagReason || 'No reason specified'}</p>
            </div>
          )}

          {/* Next Step (static placeholder — will be dynamic later) */}
          <div className="bg-white dark:bg-[#1e1e21] rounded-xl border border-amber-200 dark:border-amber-500/30 shadow-[0_1px_4px_rgba(0,0,0,0.04)] p-4">
            <p className="text-atom font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-2">Next Step</p>
            <div className="bg-amber-50 dark:bg-amber-500/10 rounded-lg p-3 border border-amber-100 dark:border-amber-500/20">
              <p className="text-atom font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide mb-1">Action Required</p>
              <p className="text-ssm text-slate-700 dark:text-slate-200 leading-snug">Initial outreach — intro email + schedule call</p>
              <p className="text-xxs text-amber-600 dark:text-amber-400 mt-1.5">Due Mar 22, 2026</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
