'use client'

import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { CrmUserRole, PartnerCommissionStatus } from '@symph-crm/shared'
import { BACKEND_API_URL } from '@/lib/backend-url'
import { queryKeys } from '@/lib/query-keys'
import { usePatchDealStage, useSaveDealNote, useUploadDocumentFile, useUpdateDeal, useDeleteDealNote, useDeleteDocument, useCreateContact, useDeleteContact, useDeleteDeal, useCirclebackUpload, useUpdatePartnerDealCommission } from '@/lib/hooks/mutations'
import { useGetDeal, useGetCompany, useGetActivitiesByDeal, useGetDealNotesFlat, useGetDocumentsByDeal, useGetUsers, useGetContactsByCompany, useGetProposalsByDeal, useGetPartnerDealGroups } from '@/lib/hooks/queries'
import { useUser } from '@/lib/hooks/use-user'
import { EmptyState } from './EmptyState'
import { Avatar } from './Avatar'
import { UserOption } from './UserOption'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { SearchInput } from '@/components/ui/search-input'
import { toast } from 'sonner'
import {
  cn, formatNumberWithCommas, timeAgo, formatDate,
  getDaysInStage, getBrandColor, getInitials, getStageProgressIndex, formatServiceType, formatDealTitle, toPascalCase,
} from '@/lib/utils'
import { formatDealMoneyFull, formatMoney } from '@/lib/currency'
import { getMimeLabel, supportsWordCount, isImage } from '@/lib/utils/document-utils'
import { api } from '@/lib/api'
import type { ApiDealDetail, ApiCompanyDetail, ApiDocument, ApiPartnerDealCommission, NfsDealNote } from '@/lib/types'
import {
  STAGE_LABELS, STAGE_COLORS, STAGE_ADVANCE_MAP,
  PROGRESS_STAGES, ACTIVITY_LABELS, DOC_TYPE_LABELS, ACCEPTED_FILE_TYPES,
} from '@/lib/constants'
import { Copy, Check, Pencil, Plus, Trash2 } from 'lucide-react'
import { Input } from './ui/input'
import { DocumentViewerModal } from './DocumentViewerModal'
import { PasteChip, PastePreviewModal } from './PasteChip'
import { PartialCollapse } from './PartialCollapse'
import { BillingSection } from './BillingSection'
import { EditDealModal } from './EditDealModal'
import { EditContactModal } from './EditContactModal'
import type { ApiContact } from '@/lib/hooks/queries'

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
    <div className="mt-5">
      <div className="flex items-center">
        {PROGRESS_STAGES.map((stage, i) => {
          const stageColor = STAGE_STEP_COLOR[stage.id] ?? 'var(--stage-lead)'
          return (
          <React.Fragment key={stage.id}>
            {/* Connector line between stages */}
            {i > 0 && (
              <div
                className="flex-1 h-px shrink"
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
                    ? 'font-medium text-muted-foreground'
                    : 'text-text-faint'
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

function MobileStageProgress({ currentStage }: { currentStage: string }) {
  const isLost = currentStage === 'closed_lost'
  const currentStageConfig = PROGRESS_STAGES.find(stage => stage.id === currentStage)
  const label = isLost ? 'Lost' : currentStageConfig?.label ?? STAGE_LABELS[currentStage] ?? currentStage

  return (
    <div className="mt-4 sm:hidden">
      <div className="flex items-center justify-between gap-3 mb-2">
        <span className="eyebrow-label">Stage</span>
        <span className={cn(
          'text-xs font-semibold truncate',
          isLost ? 'text-red-500' : 'text-primary'
        )}>
          {label}
        </span>
      </div>
      <SegmentedProgressBar currentStage={currentStage} />
    </div>
  )
}

function SidebarSection({
  title,
  action,
  surface = 'flat',
  children,
}: {
  title: string
  action?: React.ReactNode
  surface?: 'flat' | 'card'
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        'bg-card rounded-md border border-border shadow-[0_1px_4px_rgba(0,0,0,0.04)] p-3',
        surface === 'flat' && 'sm:bg-transparent sm:rounded-none sm:border-0 sm:shadow-none sm:p-0',
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="eyebrow-label">{title}</p>
        {action}
      </div>
      {children}
    </div>
  )
}

// ─── Sub-AM picker - shadcn Popover + Command, single-select, searchable ─────

function SubAmPicker({
  value,
  users,
  onChange,
}: {
  value: string | null
  users: import('@/lib/types').ApiUser[]
  onChange: (uid: string | null) => void
}) {
  const [open, setOpen] = React.useState(false)
  const sorted = React.useMemo(
    () => [...users].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '')),
    [users],
  )
  const selectedUser = value ? users.find(u => u.id === value) : null

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 w-full min-h-8 px-2 py-1 rounded-md border border-border bg-card hover:border-primary/40 transition-colors text-left text-ssm"
        >
          {selectedUser ? (
            <UserOption user={selectedUser} />
          ) : (
            <span className="text-slate-400">Unassigned</span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search..." />
          <CommandList>
            <CommandEmpty>No matches</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="__unassigned"
                onSelect={() => { onChange(null); setOpen(false) }}
                className="justify-between"
              >
                <span className="text-slate-400">Unassigned</span>
                {!value && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
              </CommandItem>
              {sorted.map(u => (
                <CommandItem
                  key={u.id}
                  value={`${u.name ?? ''} ${u.email ?? ''}`}
                  onSelect={() => { onChange(u.id); setOpen(false) }}
                  className="justify-between"
                >
                  <UserOption user={u} />
                  {value === u.id && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

// ─── Builder picker - Popover + Command, "add one" trigger, searchable ──────

function BuilderPicker({
  users,
  selected,
  onAdd,
}: {
  users: import('@/lib/types').ApiUser[]
  selected: string[]
  onAdd: (uid: string) => void
}) {
  const [open, setOpen] = React.useState(false)
  const available = React.useMemo(
    () => users
      .filter(u => !selected.includes(u.id))
      .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '')),
    [users, selected],
  )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex items-center justify-between w-full min-h-8 px-2 py-1 rounded-md border border-border bg-card hover:border-primary/40 transition-colors text-left text-ssm text-slate-400"
        >
          Add builder...
          <Plus size={13} className="text-slate-400 shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search builder..." />
          <CommandList>
            <CommandEmpty>No matches</CommandEmpty>
            <CommandGroup>
              {available.map(u => (
                <CommandItem
                  key={u.id}
                  value={`${u.name ?? ''} ${u.email ?? ''}`}
                  onSelect={() => { onAdd(u.id); setOpen(false) }}
                >
                  <UserOption user={u} />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-2 py-1.5 border-b border-border last:border-0">
      <span className="text-xs text-slate-400 shrink-0">{label}</span>
      <span className="text-xs font-medium text-foreground text-right">{value}</span>
    </div>
  )
}

function normalizeHexColor(value: string) {
  const trimmed = value.trim()
  const withHash = trimmed.startsWith('#') ? trimmed : `#${trimmed}`
  return /^#[0-9a-fA-F]{6}$/.test(withHash) ? withHash.toUpperCase() : null
}

function getBrandColorLayers(color: string | null | undefined) {
  const colors = (color ?? '')
    .split(/[\s,]+/)
    .map(value => normalizeHexColor(value))
    .filter(Boolean)
    .slice(0, 5) as string[]

  return colors.length > 0 ? colors : ['#FFFFFF', '#FFFFFF', '#FFFFFF']
}

function BrandColorLayers({ color }: { color: string | null | undefined }) {
  const colors = getBrandColorLayers(color)

  return (
    <div className="flex items-center gap-2">
      <span className="flex shrink-0 -space-x-1.5">
        {colors.map((layerColor, index) => (
          <span
            key={`${layerColor}-${index}`}
            className="h-5 w-5 rounded-full border border-border shadow-sm ring-1 ring-background"
            style={{ background: layerColor }}
          />
        ))}
      </span>
      <span className="min-w-0 truncate font-mono text-xxs text-muted-foreground">
        {color || 'Not set'}
      </span>
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
          : 'text-muted-foreground hover:bg-surface-hover'
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

/** Small colored stage pill - uses CSS vars so dark mode remaps to muted tones */
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
          : 'border-border text-muted-foreground hover:bg-surface-hover',
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

type TabId = 'notes' | 'resources' | 'proposals' | 'timeline' | 'people' | 'billing'
const VALID_TABS = new Set<TabId>(['notes', 'resources', 'proposals', 'timeline', 'people', 'billing'])
const PARTNER_VISIBLE_TABS = new Set<TabId>(['timeline', 'people'])

export function DealDetail({ dealId, backLabel = 'Back to Pipeline', onBack }: DealDetailProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const { userId, isSales, isPartner } = useUser()

  // Derive activeTab from URL. Partners only see Timeline and People.
  const rawTab = searchParams.get('tab') ?? ''
  const requestedTab = VALID_TABS.has(rawTab as TabId) ? (rawTab as TabId) : null
  const activeTab: TabId = isPartner
    ? (requestedTab && PARTNER_VISIBLE_TABS.has(requestedTab) ? requestedTab : 'timeline')
    : (requestedTab ?? 'notes')

  // Sync tab to URL without adding a browser history entry
  const setActiveTab = useCallback((tab: TabId) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', tab)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }, [router, pathname, searchParams])
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
  const [viewingDoc, setViewingDoc] = useState<NfsDealNote | ApiDocument | null>(null)
  const [deletingDoc, setDeletingDoc] = useState<NfsDealNote | ApiDocument | null>(null)
  const [notePasteChips, setNotePasteChips] = useState<string[]>([])
  const [notePastePreviewText, setNotePastePreviewText] = useState<string | null>(null)
  const [noteFocused, setNoteFocused] = useState(false)
  const [showAssignDropdown, setShowAssignDropdown] = useState(false)
  const [showAddPerson, setShowAddPerson] = useState(false)
  const [personForm, setPersonForm] = useState({ name: '', phone: '', email: '', title: '', role: '' })
  const [editingContact, setEditingContact] = useState<ApiContact | null>(null)
  const [deletingContact, setDeletingContact] = useState<ApiContact | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [removingBuilderId, setRemovingBuilderId] = useState<string | null>(null)
  const [editingBrandColor, setEditingBrandColor] = useState(false)
  const [brandColorDrafts, setBrandColorDrafts] = useState<string[]>(['#FFFFFF', '#FFFFFF', '#FFFFFF'])
  const [editingProposalLink, setEditingProposalLink] = useState(false)
  const [proposalLinkDraft, setProposalLinkDraft] = useState('')
  const [editingDemoLink, setEditingDemoLink] = useState(false)
  const [demoLinkDraft, setDemoLinkDraft] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const noteTextareaRef = useRef<HTMLTextAreaElement>(null)
  const circlebackFileRef = useRef<HTMLInputElement>(null)
  const [cbCorrelationKey, setCbCorrelationKey] = useState<string | null>(null)
  const [cbUploadDocId, setCbUploadDocId] = useState<string | null>(null)
  const [cbPushStatus, setCbPushStatus] = useState<'idle' | 'uploading' | 'processing' | 'done' | 'failed'>('idle')
  const [editingCommissionGroupId, setEditingCommissionGroupId] = useState<string | null>(null)
  const [commissionDraft, setCommissionDraft] = useState('')
  const [commissionStatusDraft, setCommissionStatusDraft] = useState<PartnerCommissionStatus>(PartnerCommissionStatus.Pending)
  const [commissionNotesDraft, setCommissionNotesDraft] = useState('')

  const patchStage = usePatchDealStage()
  const updateDeal = useUpdateDeal()
  const updateCommission = useUpdatePartnerDealCommission({
    onSuccess: () => setEditingCommissionGroupId(null),
  })
  const deleteDeal = useDeleteDeal({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.deals.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.deals.trash })
      onBack()
    },
  })

  // ── Queries ──────────────────────────────────────────────────────────────

  const { data: deal, isLoading, isError } = useGetDeal(dealId)
  const { data: company } = useGetCompany(deal?.companyId)
  const { data: activities = [], isLoading: loadingActivities } = useGetActivitiesByDeal(dealId, { enabled: !!deal })
  const { data: nfsNotes = [], isLoading: loadingDocs, refetch: refetchDocs } = useGetDealNotesFlat(dealId, { enabled: !!deal && !isPartner })
  const { data: documents = [], isLoading: loadingResourceDocs, refetch: refetchResourceDocs } = useGetDocumentsByDeal(dealId, { enabled: !!deal && !isPartner })
  const { data: dealProposals = [], isLoading: loadingProposals } = useGetProposalsByDeal(dealId, { enabled: !!deal && !isPartner })
  const { data: partnerDealGroups = [] } = useGetPartnerDealGroups({ enabled: !!deal && isSales })
  // ── Summary: auto-generate + poll, no manual button ───────────────────
  // Temporarily hidden per Vins: the DealDetail auto-summary feature is paused until reprioritized.
  // Keeping the original hook flow commented here makes the feature easy to restore without running
  // background summary jobs or polling `/summaries` while paused.
  // const summaryAutoTriggeredRef = useRef(false)
  // const [isSummaryGenerating, setIsSummaryGenerating] = useState(false)
  // const { data: summaries = [] } = useGetDealSummaries(dealId, {
  //   // Poll every 5s whenever no summary exists yet, stops once one appears.
  //   refetchInterval: (query) => (!query.state.data || query.state.data.length === 0) ? 5000 : false,
  // })
  // const latestSummaryFilename = summaries[0]?.filename
  // const { data: latestSummary } = useGetDealSummaryLatest(dealId, latestSummaryFilename)
  // const triggerSummary = useGenerateDealSummary({
  //   onSuccess: () => setIsSummaryGenerating(true),
  //   onSettled: () => { summaryAutoTriggeredRef.current = true },
  // })

  // Auto-trigger once when deal has notes but no summary.
  // Paused with the summary hooks above so opening a deal no longer starts summary generation.
  // useEffect(() => {
  //   if (summaryAutoTriggeredRef.current) return
  //   if (!deal || loadingDocs || nfsNotes.length === 0 || summaries.length > 0) return
  //   summaryAutoTriggeredRef.current = true
  //   triggerSummary.mutate(dealId)
  // }, [deal, nfsNotes.length, summaries.length, loadingDocs, dealId])

  // Clear generating state once summary file lands.
  // useEffect(() => {
  //   if (summaries.length > 0) setIsSummaryGenerating(false)
  // }, [summaries.length])
  const { data: users = [] } = useGetUsers()
  const deleteNfsNote = useDeleteDealNote({
    onSuccess: () => {
      refetchDocs()
      setDeletingDoc(null)
      setViewingDoc(null)
    },
  })
  const deleteDoc = useDeleteDocument({
    onSuccess: () => {
      refetchResourceDocs()
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
  const deleteContact = useDeleteContact({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.contacts.byCompany(deal?.companyId ?? '') })
      setDeletingContact(null)
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

  const openBrandColorModal = useCallback(() => {
    setBrandColorDrafts(getBrandColorLayers(deal?.clientBrandColor))
    setEditingBrandColor(true)
  }, [deal?.clientBrandColor])

  const updateBrandColorDraft = useCallback((index: number, value: string) => {
    setBrandColorDrafts(prev => prev.map((color, colorIndex) => (
      colorIndex === index ? value.toUpperCase() : color
    )))
  }, [])

  const addBrandColorDraft = useCallback(() => {
    setBrandColorDrafts(prev => prev.length >= 5 ? prev : [...prev, '#FFFFFF'])
  }, [])

  // ── User map + AM resolution ─────────────────────────────────────────────
  const userNameMap = useMemo(() => {
    const m = new Map<string, string>()
    for (const u of users) m.set(u.id, u.name || u.email)
    return m
  }, [users])

  // deal.assignedTo stores a user UUID - resolve to display name + full user
  const amDisplayName = deal?.assignedTo
    ? (userNameMap.get(deal.assignedTo) ?? deal.assignedTo)
    : null
  const amUser = deal?.assignedTo ? users.find(u => u.id === deal.assignedTo) : null
  const partnerDealGroupMap = useMemo(() => new Map(partnerDealGroups.map(group => [group.id, group])), [partnerDealGroups])
  const partnerCommissionMap = useMemo(() => {
    const map = new Map<string, ApiPartnerDealCommission>()
    for (const commission of deal?.partnerCommissions ?? []) map.set(commission.partnerDealGroupId, commission)
    return map
  }, [deal?.partnerCommissions])

  function openCommissionDialog(groupId: string) {
    const commission = partnerCommissionMap.get(groupId)
    setEditingCommissionGroupId(groupId)
    setCommissionDraft(commission?.commissionAmount ? formatNumberWithCommas(commission.commissionAmount) : '')
    setCommissionStatusDraft(commission?.commissionStatus ?? PartnerCommissionStatus.Pending)
    setCommissionNotesDraft(commission?.notes ?? '')
  }

  function saveCommission() {
    if (!editingCommissionGroupId) return
    updateCommission.mutate({
      dealId,
      partnerDealGroupId: editingCommissionGroupId,
      commissionAmount: commissionDraft.trim() || null,
      commissionStatus: commissionStatusDraft,
      notes: commissionNotesDraft.trim() || null,
    })
  }

  // ── Notes vs Resources split ─────────────────────────────────────────────
  // Notes: NFS flat notes from GET /deals/:id/notes/flat
  // Resources: docs uploaded to the /resources/ bucket path (still from Supabase documents)
  const noteDocs = nfsNotes
  const resourceDocs = documents.filter(d => d.storagePath?.includes('/resources/'))

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

  const saveNote = useSaveDealNote({
    onSuccess: () => { setNoteText(''); setNotePasteChips([]); void refetchDocs() },
  })

  const { mutate: uploadToCircleback, isPending: cbUploading } = useCirclebackUpload({
    onSuccess: (data) => {
      setCbCorrelationKey(data.correlationKey)
      setCbUploadDocId(data.uploadDocId)
      setCbPushStatus('processing')
      toast.success('Recording uploaded, transcript and notes will appear here in a few minutes')
    },
    onError: (err) => {
      setCbPushStatus('failed')
      toast.error(`Upload failed: ${err.message}`)
    },
  })

  // Poll Circleback processing status while a recording is in flight
  useEffect(() => {
    if (!cbCorrelationKey || cbPushStatus !== 'processing') return
    const interval = setInterval(async () => {
      try {
        const result = await api.get<{ status: string; crmPushStatus?: string; uploadDocId?: string }>(
          `/recordings/circleback-status?correlationKey=${encodeURIComponent(cbCorrelationKey)}`,
        )
        if (result.crmPushStatus === 'done') {
          setCbPushStatus('done')
          setCbCorrelationKey(null)
          void refetchDocs()
          toast.success('Meeting notes and transcript are ready!')
          clearInterval(interval)
        } else if (result.crmPushStatus === 'failed') {
          setCbPushStatus('failed')
          clearInterval(interval)
          toast.error('Circleback processing failed, you can retry below')
        }
      } catch {
        // keep polling on transient errors
      }
    }, 15000)
    return () => clearInterval(interval)
  }, [cbCorrelationKey, cbPushStatus, refetchDocs])

  const handleCbPlay = useCallback(async (doc: { tags?: string[] | null }) => {
    const fileTag = doc.tags?.find((t: string) => t.startsWith('file:'))
    if (!fileTag) {
      toast.error('No recording file associated with this note')
      return
    }
    const fileName = fileTag.replace('file:', '')
    try {
      const { playbackUrl } = await api.get<{ playbackUrl: string }>(
        `/recordings/circleback-play?fileName=${encodeURIComponent(fileName)}`,
      )
      window.open(playbackUrl, '_blank')
    } catch {
      toast.error('Could not load recording')
    }
  }, [])

  const uploadFiles = useUploadDocumentFile({
    onSuccess: () => { void refetchResourceDocs() },
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

  // Note: outside-click + Escape now handled by Radix Popover used by the AM picker.

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

  const handleDeleteDoc = useCallback((doc: NfsDealNote | ApiDocument) => {
    setDeletingDoc(doc)
  }, [])

  const confirmDeleteDoc = useCallback(() => {
    if (!deletingDoc) return
    // NFS notes have `category` and `filename` fields; Supabase docs do not
    if ('category' in deletingDoc && 'filename' in deletingDoc) {
      deleteNfsNote.mutate({ dealId, category: deletingDoc.category, filename: deletingDoc.filename })
    } else {
      deleteDoc.mutate(deletingDoc.id)
    }
  }, [deletingDoc, deleteNfsNote, deleteDoc, dealId])

  const handleDownloadDoc = useCallback(async (doc: ApiDocument) => {
    try {
      const AUDIO_TAGS = ['mp3', 'm4a', 'mpeg', 'mp4', 'x-m4a']
      const isVoice = doc.tags?.some(t => AUDIO_TAGS.includes(t))
      if (isVoice) {
        // Voice recordings are in Supabase Storage - need a signed URL
        const data = await api.get<{ url: string; filename: string }>(`/documents/${doc.id}/download`)
        const a = document.createElement('a')
        a.href = data.url
        a.download = data.filename
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
      } else {
        // NFS files: download directly via the /file endpoint (Content-Disposition: attachment)
        const filename = doc.storagePath?.split('/').pop() ?? doc.title
        const a = document.createElement('a')
        a.href = `${BACKEND_API_URL}/documents/${doc.id}/file`
        a.download = filename
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
      }
    } catch {
      toast.error('Download failed')
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
    <div className="px-0 pt-4 pb-6 sm:p-0">
      {/* ── Delete confirmation modal ───────────────────────────────── */}
      {deletingDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setDeletingDoc(null)}>
          <div className="bg-card rounded-md shadow-2xl border border-border w-[92vw] max-w-[400px] p-4 animate-in fade-in-0 zoom-in-95 duration-150" onClick={e => e.stopPropagation()}>
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
                <h3 className="text-sbase font-semibold text-foreground">Delete permanently?</h3>
                <p className="text-xs text-muted-foreground mt-0.5">This cannot be undone.</p>
              </div>
            </div>
            <div className="rounded-lg bg-red-50/50 dark:bg-red-500/[.06] border border-red-100 dark:border-red-500/10 px-3 py-2.5 mb-5">
              <p className="text-xs text-red-700 dark:text-red-400 font-medium truncate">{deletingDoc.title}</p>
              <p className="text-atom text-red-500/70 dark:text-red-400/60 mt-0.5">
                {'category' in deletingDoc ? 'Note' : (deletingDoc as ApiDocument).storagePath?.includes('/resources/') ? 'Resource file' : 'Note'} · Created {new Date(deletingDoc.createdAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setDeletingDoc(null)}
                className="flex-1 h-9 rounded-lg text-ssm font-medium text-muted-foreground bg-secondary hover:bg-skeleton transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteDoc}
                disabled={deleteNfsNote.isPending || deleteDoc.isPending}
                className="flex-1 h-9 rounded-lg text-ssm font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors disabled:opacity-60 flex items-center justify-center gap-1.5"
              >
                {(deleteNfsNote.isPending || deleteDoc.isPending) ? (
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
      {showEditDeal && deal && isSales && (
        <EditDealModal deal={deal} onClose={() => setShowEditDeal(false)} />
      )}

      {editingCommissionGroupId && (
        <Dialog open onOpenChange={open => { if (!open) setEditingCommissionGroupId(null) }}>
          <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
            <DialogHeader className="px-4">
              <div>
                <DialogTitle>Edit partner commission</DialogTitle>
                <DialogDescription>
                  Set commission for {partnerDealGroupMap.get(editingCommissionGroupId)?.name ?? 'this partner group'}.
                </DialogDescription>
              </div>
            </DialogHeader>
            <div className="space-y-3 p-4">
              <div className="space-y-1.5">
                <label className="eyebrow-label">Commission amount</label>
                <Input
                  value={commissionDraft}
                  onChange={event => setCommissionDraft(formatNumberWithCommas(event.target.value))}
                  placeholder="0.00"
                  inputMode="decimal"
                  className="h-11 sm:h-9 text-ssm"
                />
              </div>
              <div className="space-y-1.5">
                <label className="eyebrow-label">Notes</label>
                <Input
                  value={commissionNotesDraft}
                  onChange={event => setCommissionNotesDraft(event.target.value)}
                  placeholder="Optional internal note"
                  className="h-11 sm:h-9 text-ssm"
                />
              </div>
              <div className="flex gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => setEditingCommissionGroupId(null)}
                  className="h-9 flex-1 rounded-lg border border-border text-xs font-semibold text-slate-600 transition-colors hover:bg-surface-alt"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveCommission}
                  disabled={updateCommission.isPending}
                  className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary text-xs font-semibold text-white transition-colors hover:bg-primary/90 disabled:opacity-60"
                >
                  {updateCommission.isPending && <span className="inline-block size-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />}
                  Save commission
                </button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {editingBrandColor && (
        <Dialog open onOpenChange={open => { if (!open) setEditingBrandColor(false) }}>
          <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
            <DialogHeader className="px-4">
              <div>
                <DialogTitle>Edit brand colors</DialogTitle>
                <DialogDescription>
                  Set up to five brand colors. Saving to the backend comes later.
                </DialogDescription>
              </div>
            </DialogHeader>
            <div className="space-y-4 p-4">
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
                {brandColorDrafts.map((color, index) => {
                  const safeColor = normalizeHexColor(color) ?? '#FFFFFF'

                  return (
                    <div key={index} className="rounded-md border border-border bg-surface-alt p-2 text-center">
                      <label className="relative mx-auto block h-12 w-12 cursor-pointer rounded-full border border-border shadow-sm ring-1 ring-background" style={{ background: safeColor }}>
                        <Input
                          type="color"
                          value={safeColor}
                          onChange={event => updateBrandColorDraft(index, event.target.value)}
                          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                        />
                      </label>
                      <Input
                        value={color}
                        onChange={event => updateBrandColorDraft(index, event.target.value)}
                        placeholder="#FFFFFF"
                        className="mt-2 h-7 border-0 bg-transparent px-0 text-center font-mono text-[10px] shadow-none focus-visible:ring-0"
                      />
                    </div>
                  )
                })}
                {brandColorDrafts.length < 5 && (
                  <button
                    type="button"
                    onClick={addBrandColorDraft}
                    className="flex flex-col items-center justify-center rounded-md border border-dashed border-border bg-surface-alt p-2 text-center text-muted-foreground transition-colors hover:bg-surface-hover hover:text-primary"
                  >
                    <span className="flex h-12 w-12 items-center justify-center rounded-full border border-dashed border-border bg-card">
                      <Plus size={16} />
                    </span>
                    <span className="mt-2 text-[10px] font-medium">Add color</span>
                  </button>
                )}
              </div>
              <div className="flex gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => setEditingBrandColor(false)}
                  className="h-9 flex-1 rounded-control border border-border text-xs font-semibold text-muted-foreground transition-colors hover:bg-surface-hover"
                >
                  Close
                </button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Edit contact modal */}
      {editingContact && (
        <EditContactModal contact={editingContact} onClose={() => setEditingContact(null)} />
      )}

      {/* Delete contact confirmation */}
      {deletingContact && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-[2px] animate-in fade-in-0 duration-200"
          onClick={() => setDeletingContact(null)}
        >
          <div
            className="bg-card rounded-lg shadow-[0_8px_40px_rgba(0,0,0,0.18)] border border-border w-full max-w-[360px] mx-4 p-5 animate-in zoom-in-95 fade-in-0 duration-200"
            onClick={e => e.stopPropagation()}
          >
            <div className="text-sm font-semibold text-foreground mb-1">Remove contact?</div>
            <div className="text-xs text-muted-foreground mb-4">
              <span className="font-medium text-muted-foreground">{toPascalCase(deletingContact.name)}</span> will be removed from this deal. This cannot be undone.
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setDeletingContact(null)}
                className="flex-1 h-9 rounded-lg border border-border text-ssm font-medium text-muted-foreground hover:bg-surface-hover transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteContact.mutate(deletingContact.id)}
                disabled={deleteContact.isPending}
                className="flex-1 h-9 flex items-center justify-center gap-1.5 rounded-lg text-ssm font-medium text-white bg-red-500 hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {deleteContact.isPending && (
                  <span className="inline-block w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                )}
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete deal confirmation */}
      {showDeleteConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4"
          onClick={() => setShowDeleteConfirm(false)}
        >
          <div
            className="max-w-sm w-full rounded-md border border-border bg-card shadow-2xl p-4"
            onClick={e => e.stopPropagation()}
          >
            <p className="text-sm font-semibold text-foreground">Delete deal?</p>
            <p className="text-ssm text-muted-foreground leading-relaxed mt-1">
              This will hide the deal from CRM views and move it to Trash. It can be restored for 30 days before permanent deletion.
            </p>
            <div className="flex gap-2.5 mt-4">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 h-8 rounded-lg text-xs font-semibold border border-border text-muted-foreground hover:bg-surface-hover transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteDeal.mutate(dealId)}
                disabled={deleteDeal.isPending}
                className="flex-1 h-8 flex items-center justify-center gap-1.5 rounded-lg text-xs font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-60 transition-colors"
              >
                {deleteDeal.isPending && <span className="inline-block w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                Move to trash
              </button>
            </div>
          </div>
        </div>
      )}

      {viewingDoc && (
        <DocumentViewerModal
          doc={viewingDoc}
          onClose={() => setViewingDoc(null)}
          onDelete={isSales ? () => handleDeleteDoc(viewingDoc) : undefined}
          onDownload={'category' in viewingDoc ? undefined : () => handleDownloadDoc(viewingDoc as ApiDocument)}
          initialContent={'category' in viewingDoc ? (viewingDoc as NfsDealNote).content : undefined}
        />
      )}

      {/* Paste preview modal - ESC-closable, shows full pasted content */}
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
            className="w-full max-w-sm bg-card rounded-md border border-border shadow-2xl p-4 animate-in zoom-in-95 fade-in-0 duration-300"
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
            <p className="text-sbase font-bold text-foreground mb-1">
              Advance this deal?
            </p>
            <p className="text-ssm text-muted-foreground leading-relaxed">
              Move <span className="font-medium text-foreground">{deal.title}</span> to <span className="font-medium" style={{ color: `var(--stage-${nextStage}, #94a3b8)` }}>{STAGE_LABELS[nextStage] ?? nextStage}</span>. This can't be undone.
            </p>
            <div className="flex gap-2.5 mt-4">
              <button
                onClick={() => setShowAdvanceConfirm(false)}
                className="flex-1 h-8 rounded-lg text-xs font-semibold border border-border text-muted-foreground hover:bg-surface-hover transition-colors"
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
            className="w-full max-w-sm bg-card rounded-md border border-border shadow-2xl p-4 animate-in zoom-in-95 fade-in-0 duration-300"
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
            <p className="text-sbase font-bold text-foreground mb-1">
              Mark as Won?
            </p>
            <p className="text-ssm text-muted-foreground leading-relaxed">
              Move <span className="font-medium text-foreground">{deal.title}</span> to <span className="font-medium" style={{ color: 'var(--stage-closed_won, #16a34a)' }}>Won</span>. This can't be undone.
            </p>
            <div className="flex gap-2.5 mt-4">
              <button
                onClick={() => setShowWonConfirm(false)}
                className="flex-1 h-8 rounded-lg text-xs font-semibold border border-border text-muted-foreground hover:bg-surface-hover transition-colors"
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
            className="w-full max-w-sm bg-card rounded-md border border-border shadow-2xl p-4 animate-in zoom-in-95 fade-in-0 duration-300"
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
            <p className="text-sbase font-bold text-foreground mb-1">
              Close as Lost?
            </p>
            <p className="text-ssm text-muted-foreground leading-relaxed">
              Move <span className="font-medium text-foreground">{deal.title}</span> to <span className="font-medium" style={{ color: 'var(--stage-closed_lost, #dc2626)' }}>Lost</span>. This can't be undone.
            </p>
            <div className="flex gap-2.5 mt-4">
              <button
                onClick={() => setShowLostConfirm(false)}
                className="flex-1 h-8 rounded-lg text-xs font-semibold border border-border text-muted-foreground hover:bg-surface-hover transition-colors"
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

      {/* Remove builder confirm */}
      {removingBuilderId && (() => {
        const u = users.find(x => x.id === removingBuilderId)
        const label = u?.name || u?.email || removingBuilderId
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4"
            onClick={() => setRemovingBuilderId(null)}
          >
            <div
              className="w-full max-w-sm bg-card rounded-md border border-border shadow-2xl p-4 animate-in zoom-in-95 fade-in-0 duration-300"
              onClick={e => e.stopPropagation()}
            >
              <p className="text-sbase font-bold text-foreground mb-1">Remove builder?</p>
              <p className="text-ssm text-muted-foreground leading-relaxed">
                Remove <span className="font-medium text-foreground">{label}</span> from this deal&apos;s builders list.
              </p>
              <div className="flex gap-2.5 mt-4">
                <button
                  onClick={() => setRemovingBuilderId(null)}
                  className="flex-1 h-8 rounded-lg text-xs font-semibold border border-border text-muted-foreground hover:bg-surface-hover transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    const next = (deal.builders ?? []).filter(b => b !== removingBuilderId)
                    updateDeal.mutate({ id: dealId, data: { builders: next } }, {
                      onSettled: () => {
                        queryClient.invalidateQueries({ queryKey: queryKeys.deals.detail(dealId) })
                        queryClient.invalidateQueries({ queryKey: queryKeys.deals.all })
                        setRemovingBuilderId(null)
                      },
                    })
                  }}
                  disabled={updateDeal.isPending}
                  className="flex-1 h-8 rounded-lg text-xs font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-60 transition-colors"
                >
                  {updateDeal.isPending ? (
                    <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin mx-auto" />
                  ) : 'Remove'}
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Back */}
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-primary dark:hover:text-primary transition-colors mb-4 w-fit px-4 sm:px-6 sm:pt-4"
      >
        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><polyline points="15 18 9 12 15 6" /></svg>
        {backLabel}
      </button>

      {/* ── Mobile header (sm:hidden) ────────────────────────────────────────── */}
      <div className="sm:hidden bg-card border-y border-border p-4 mb-0 flex flex-col gap-3">
        {/* Company tag */}
        <p className="eyebrow-label leading-none truncate">
          {company?.name ?? 'No Brand'}
        </p>

        {/* Deal title */}
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold text-foreground leading-snug -mt-1 line-clamp-2">
            {formatDealTitle(deal.title)}
          </h1>
          {isSales && (
            <button
              onClick={() => setShowEditDeal(true)}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-primary hover:bg-surface-hover transition-colors shrink-0"
              title="Edit deal"
            >
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
          )}
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
          <span className="text-text-faint">·</span>
          <span className="text-sbase font-semibold tabular-nums text-primary">
            {formatDealMoneyFull(deal)}
          </span>
        </div>

        {/* Segmented progress bar */}
        <SegmentedProgressBar currentStage={deal.stage} />

        {/* Context strip: days in stage + capture date */}
        <div className="flex items-center gap-3 text-xxs text-slate-400">
          <span>{daysInStage}d in stage</span>
          <span className="text-text-faint">·</span>
          <span>Captured {formatDate(deal.createdAt)}</span>
        </div>

        {/* Action row: Advance + More */}
        <div className="flex items-center gap-2 mt-1">
          {isSales && nextStage ? (
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
            <div className="flex-1 flex items-center justify-center py-2 rounded-lg text-xs font-medium text-slate-400 bg-surface-alt">
              {deal.stage === 'closed_won' ? '🎉 Deal Won' : deal.stage === 'closed_lost' ? 'Deal Lost' : 'No next stage'}
            </div>
          )}
          <button className="w-9 h-9 flex items-center justify-center rounded-lg border border-border text-slate-500 hover:bg-surface-hover shrink-0">
            <svg width={16} height={16} viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" /></svg>
          </button>
        </div>
      </div>

      {/* ── Desktop header (hidden sm:block) ────────────────────────────────── */}
      <div className="hidden sm:block bg-[var(--bg-subtle)] border-y border-border px-7 py-5 mb-0">
        {/* Top row: brand info + value/advance */}
        <div className="flex sm:items-start sm:justify-between gap-3">
          {/* Left: Brand + deal info */}
          <div className="flex items-center gap-3.5 min-w-0">
            <div
              className="w-12 h-12 rounded-md flex items-center justify-center text-sbase font-bold shrink-0"
              style={{ background: `${brandColor}18`, color: brandColor }}
            >
              {getInitials(company?.name ?? 'No Brand')}
            </div>
            <div className="min-w-0">
              <p className="eyebrow-label leading-none mb-1">
                {company?.name ?? 'No Brand'}
              </p>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-semibold text-foreground leading-tight">
                  {formatDealTitle(deal.title)}
                </h1>
                {isSales && (
                  <button
                    onClick={() => setShowEditDeal(true)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-primary hover:bg-surface-hover transition-colors shrink-0"
                    title="Edit deal"
                  >
                    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </button>
                )}
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
            <div className="text-2xl font-semibold tabular-nums text-primary leading-tight">
              {formatDealMoneyFull(deal)}
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
            {isSales && nextStage && (
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

        <MobileStageProgress currentStage={deal.stage} />
        <div className="hidden sm:block">
          <StageProgress currentStage={deal.stage} />
        </div>
      </div>

      {/* ── Body: assignment rail + center content + properties rail ─────────── */}
      <div className="flex flex-col sm:grid sm:grid-cols-[248px_minmax(0,1fr)_240px] sm:items-stretch sm:min-h-[calc(100vh-220px)]">

        {/* Center: tabs + content */}
        <div className="flex-1 min-w-0 bg-background sm:col-start-2 sm:row-start-1 sm:rounded-none border-y sm:border-y-0 sm:border-x border-border sm:shadow-none overflow-hidden">
          {/* Tab bar - includes filters + view toggle flushed right */}
          <div className="flex items-center border-b border-border gap-0 pr-2">
            {/* Tabs */}
            <div className="flex flex-1 min-w-0 flex-wrap">
              {([
                { id: 'notes', label: 'Notes', count: noteDocs.length },
                { id: 'resources', label: 'Resources', count: resourceDocs.length },
                { id: 'proposals' as const, label: 'Proposals', count: dealProposals.length },
                { id: 'timeline', label: 'Timeline', count: activities.length },
                { id: 'people' as const, label: 'People', count: contactCount },
                { id: 'billing' as const, label: 'Billing', count: null },
              ] as const).filter(tab => !isPartner || PARTNER_VISIBLE_TABS.has(tab.id)).map(tab => (
                <button
                  key={tab.id}
                  onClick={() => { setActiveTab(tab.id); setDocSearch('') }}
                  className={cn(
                    'flex items-center gap-1.5 px-3 sm:px-4 py-3 text-xs font-medium border-b-2 -mb-px transition-colors whitespace-nowrap',
                    activeTab === tab.id
                      ? 'border-primary text-primary'
                      : 'border-transparent text-slate-500 hover:text-slate-700 hover:text-foreground'
                  )}
                >
                  {tab.label}
                  {tab.count !== null && tab.count > 0 && (
                    <span className={cn(
                      'text-atom font-semibold px-1.5 py-0.5 rounded-full min-w-[18px] text-center',
                      activeTab === tab.id
                        ? 'bg-primary/15 text-primary dark:bg-primary/20'
                        : 'bg-secondary text-slate-500'
                    )}>
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>


            {/* Right controls - search + filter + view toggle (hidden for timeline) */}
            {activeTab !== 'timeline' && activeTab !== 'billing' && activeTab !== 'people' && activeTab !== 'proposals' && (
              <div className="hidden sm:flex items-center gap-1 shrink-0">

                {/* Search input */}
                <SearchInput
                  value={docSearch}
                  onChange={e => setDocSearch(e.target.value)}
                  onClear={() => setDocSearch('')}
                  placeholder="Search..."
                  containerClassName="h-7 w-[112px]"
                  className="text-xxs"
                />

                {/* Type / ext filter - shadcn Select */}
                {activeTab === 'notes' && noteTypes.length > 1 && (
                  <Select value={noteTypeFilter} onValueChange={setNoteTypeFilter}>
                    <SelectTrigger className="h-7 w-auto min-w-[84px] text-xxs border-none bg-transparent shadow-none px-1.5 text-muted-foreground hover:text-slate-700 hover:text-foreground gap-1 focus:ring-0">
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
                    <SelectTrigger className="h-7 w-auto min-w-[80px] text-xxs border-none bg-transparent shadow-none px-1.5 text-muted-foreground hover:text-slate-700 hover:text-foreground gap-1 focus:ring-0">
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
                    <div className="w-px h-4 bg-black/[.06] mx-0.5" />
                    <button
                      onClick={() => setViewMode('list')}
                      className={cn(
                        'w-7 h-7 rounded-md flex items-center justify-center transition-colors',
                        viewMode === 'list'
                          ? 'bg-primary/10 text-primary'
                          : 'text-slate-400 hover:text-slate-600 hover:text-foreground hover:bg-surface-hover'
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
                          : 'text-slate-400 hover:text-slate-600 hover:text-foreground hover:bg-surface-hover'
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
              {/* Note Summary, auto-generated, no button.
                  Temporarily hidden per Vins: the DealDetail auto-summary UI is paused until reprioritized.
                  Original UI states preserved for restoration:
                  - No notes state: rendered `No notes to summarize`.
                  - Existing summary state: rendered `PartialCollapse` with `Note Summary` and `latestSummary.content`.
                  - Generating state: rendered `Generating summary...` plus `Aria is reading your notes`.
              */}

              {/* Circleback: analyzing banner, shown while Circleback is processing the recording */}
              {(cbPushStatus === 'uploading' || cbPushStatus === 'processing') && (
                <div className="mx-4 mt-4 mb-0">
                  <div className="rounded-md border border-primary/20 bg-primary/[.03] dark:bg-primary/[.06] px-4 py-3 flex items-center gap-3">
                    <div className="w-4 h-4 rounded-full border-2 border-primary/30 border-t-primary animate-spin shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-primary">
                        {cbPushStatus === 'uploading' ? 'Uploading recording...' : 'Analyzing recording...'}
                      </p>
                      <p className="text-xxs text-text-faint mt-0.5">
                        {cbPushStatus === 'uploading'
                          ? 'Sending to Circleback'
                          : 'Transcript and notes will appear here once ready (2-5 min)'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Circleback retry banner */}
              {cbPushStatus === 'failed' && cbUploadDocId && (
                <div className="mx-4 mb-2 flex items-center gap-2 rounded-md border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-3 py-2 text-xs text-red-700 dark:text-red-400">
                  <span className="flex-1">Recording processing failed.</span>
                  <button
                    onClick={async () => {
                      try {
                        await api.post('/recordings/circleback-retry', { uploadDocId: cbUploadDocId })
                        setCbPushStatus('processing')
                        toast.info('Retrying...')
                      } catch {
                        toast.error('Retry failed')
                      }
                    }}
                    className="font-medium underline"
                  >
                    Retry
                  </button>
                </div>
              )}

              {/* Note input, Chat-style unified container */}
              <div className="p-4 border-b border-border">
                <div
                  className={cn(
                    'rounded-md bg-card transition-all duration-150',
                    noteFocused
                      ? 'border border-border-strong shadow-card'
                      : 'border border-border',
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
                      placeholder={notePasteChips.length > 0 ? 'Add context (optional)...' : 'Add notes, paste a transcript, drop a link...'}
                      rows={1}
                      className="w-full bg-transparent border-none outline-none text-ssm text-foreground leading-[1.6] resize-none overflow-hidden placeholder:text-slate-400"
                      style={{ minHeight: '28px', maxHeight: '160px' }}
                    />
                  </div>

                  {/* Bottom toolbar */}
                  <div className="flex items-center gap-2 px-3 pb-3 pt-1">
                    {/* Hidden file input for Circleback uploads */}
                    <input
                      ref={circlebackFileRef}
                      type="file"
                      accept=".mp3,.mp4,.wav,.m4a,.mov"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (!file) return
                        setCbPushStatus('uploading')
                        uploadToCircleback({ file, dealId })
                        e.target.value = ''
                      }}
                    />
                    {/* Upload Recording button */}
                    <button
                      type="button"
                      onClick={() => circlebackFileRef.current?.click()}
                      disabled={cbUploading || cbPushStatus === 'processing'}
                      title="Upload recording for transcription"
                      className="h-7 px-2 rounded-md flex items-center gap-1 text-xxs text-muted-foreground hover:text-primary hover:bg-primary/[.06] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                          <line x1="12" y1="19" x2="12" y2="23" />
                          <line x1="8" y1="23" x2="16" y2="23" />
                        </svg>
                      <span>Upload Recording</span>
                    </button>
                    <Select value={noteType} onValueChange={setNoteType}>
                      <SelectTrigger className="h-7 w-auto min-w-[90px] text-xxs border-none bg-transparent shadow-none px-2 text-muted-foreground hover:text-slate-700 hover:text-foreground gap-1">
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
                          ? 'bg-secondary cursor-default'
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
                    const isCbMeeting = doc.tags?.includes('circleback') ?? false
                    return (
                      <div
                        key={doc.id}
                        className="group rounded-lg border border-border p-3 cursor-pointer hover:border-primary/30 hover:bg-primary/[.02] transition-all flex flex-col gap-1.5"
                        onClick={() => setViewingDoc(doc)}
                      >
                        {/* Icon + type */}
                        <div className="flex items-center justify-between">
                          <div className="text-text-faint group-hover:text-primary/50 transition-colors">
                            {isCbMeeting ? (
                              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                                <line x1="12" y1="19" x2="12" y2="23" />
                                <line x1="8" y1="23" x2="16" y2="23" />
                              </svg>
                            ) : (
                              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                <polyline points="14 2 14 8 20 8" />
                              </svg>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            {docStage && <StagePill stage={docStage} />}
                            {isCbMeeting && (
                              <button
                                onClick={(e) => { e.stopPropagation(); void handleCbPlay(doc) }}
                                className="w-6 h-6 rounded-md flex items-center justify-center text-text-faint hover:text-primary hover:bg-primary/[.06] transition-colors"
                                title="Play recording"
                              >
                                <svg width={13} height={13} viewBox="0 0 24 24" fill="currentColor">
                                  <polygon points="5 3 19 12 5 21 5 3" />
                                </svg>
                              </button>
                            )}
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDeleteDoc(doc) }}
                              className="w-6 h-6 rounded-md flex items-center justify-center text-text-faint hover:text-red-600 hover:bg-red-100 dark:hover:text-red-400 dark:hover:bg-red-500/15 transition-colors opacity-0 group-hover:opacity-100"
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
                        <p className="text-xs font-semibold text-foreground line-clamp-2 leading-snug group-hover:text-primary transition-colors">
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
                          <span className="text-atom font-medium px-1.5 py-0.5 rounded-md bg-secondary text-slate-500 shrink-0">
                            {isCbMeeting ? 'Meeting Recording' : (DOC_TYPE_LABELS[doc.type] ?? doc.type)}
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
                <div className="space-y-2 p-3">
                  {filteredNotes.map(doc => {
                    const docStage = parseDocStage(doc.tags)
                    const authorName = doc.authorId ? (userNameMap.get(doc.authorId) ?? null) : null
                    const authorUser = doc.authorId ? users.find(u => u.id === doc.authorId) : null
                    const isCbMeeting = doc.tags?.includes('circleback') ?? false
                    return (
                      <div
                        key={doc.id}
                        className="group rounded-md border border-border bg-card px-3 py-2 shadow-sm transition-colors hover:border-border-strong hover:bg-surface-hover cursor-pointer"
                        onClick={() => setViewingDoc(doc)}
                      >
                        <div className="mb-1 flex items-center justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-2">
                            {authorUser ? (
                              <Avatar name={authorUser.name || authorUser.email} email={authorUser.email ?? undefined} src={authorUser.image ?? undefined} size={20} />
                            ) : (
                              <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-atom font-semibold text-primary">
                                A
                              </span>
                            )}
                            <span className="shrink-0 text-xs font-semibold text-foreground">{authorName?.split(' ')[0] ?? 'AM'}</span>
                            <span className="shrink-0 text-xs text-text-faint">·</span>
                            <span className="shrink-0 text-xs text-muted-foreground">
                              {new Date(doc.createdAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
                            </span>
                            <span className="shrink-0 rounded-control bg-secondary px-1.5 py-0.5 text-atom font-medium text-muted-foreground">
                              {isCbMeeting ? 'Meeting Recording' : (DOC_TYPE_LABELS[doc.type] ?? doc.type)}
                            </span>
                            {docStage && <div className="shrink-0"><StagePill stage={docStage} /></div>}
                          </div>
                          <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                            {isCbMeeting && (
                              <button
                                onClick={(e) => { e.stopPropagation(); void handleCbPlay(doc) }}
                                className="h-5 w-5 rounded-control flex items-center justify-center text-slate-400 hover:text-primary hover:bg-primary/[.06] transition-colors"
                                title="Play recording"
                              >
                                <svg width={12} height={12} viewBox="0 0 24 24" fill="currentColor">
                                  <polygon points="5 3 19 12 5 21 5 3" />
                                </svg>
                              </button>
                            )}
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDeleteDoc(doc) }}
                              className="h-5 w-5 rounded-control flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-100 dark:hover:text-red-400 dark:hover:bg-red-500/15 transition-colors"
                              title="Delete"
                            >
                              <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                              </svg>
                            </button>
                            <button className="text-text-faint hover:text-foreground" type="button">
                              <svg width={14} height={14} viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" /></svg>
                            </button>
                          </div>
                        </div>
                        <p className="truncate text-xs leading-5 text-foreground">
                          {doc.excerpt || doc.title || 'Empty note'}
                        </p>
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
                <p className="eyebrow-label">Files</p>
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
                    <div key={i} className="relative group inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-secondary border border-border max-w-[180px]">
                      <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="text-slate-400 shrink-0">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                      </svg>
                      <span className="text-xxs text-muted-foreground truncate leading-tight">{file.name}</span>
                      <button
                        type="button"
                        onClick={() => setPendingFiles(prev => prev.filter((_, j) => j !== i))}
                        className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-card border border-border flex items-center justify-center text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-colors shadow-sm"
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
              {loadingResourceDocs ? (
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
                          className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-surface-hover transition-colors group cursor-pointer"
                          onClick={() => setViewingDoc(doc)}
                        >
                          {/* File type badge */}
                          <div className={cn(
                            'w-9 h-9 rounded-lg flex items-center justify-center text-atom font-bold uppercase shrink-0',
                            ext === 'PDF' ? 'bg-red-50 dark:bg-red-500/[.12] text-red-600 dark:text-red-400'
                            : ext === 'DOCX' || ext === 'DOC' ? 'bg-blue-50 dark:bg-blue-500/[.12] text-blue-600 dark:text-blue-400'
                            : ext === 'PPTX' || ext === 'PPT' ? 'bg-orange-50 dark:bg-orange-500/[.12] text-orange-600 dark:text-orange-400'
                            : ext === 'JPG' || ext === 'PNG' || ext === 'IMG' ? 'bg-purple-50 dark:bg-purple-500/[.12] text-purple-600 dark:text-purple-400'
                            : 'bg-secondary text-muted-foreground'
                          )}>
                            {ext}
                          </div>
                          {/* File info */}
                          <div className="flex-1 min-w-0">
                            <p className="text-ssm font-medium text-foreground truncate group-hover:text-primary transition-colors" title={displayName}>
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
              ) : !loadingResourceDocs && pendingFiles.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-ssm text-slate-400">No files uploaded yet</p>
                  <p className="text-xxs text-text-faint mt-1">Drop files here or click Upload to add resources</p>
                </div>
              ) : null}

              {/* Editable links */}
              <div className="flex flex-col gap-2 mb-3">
                <p className="eyebrow-label">Links</p>

                {/* Proposal Link */}
                <div className="flex items-center gap-1.5 min-w-0">
                  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="text-slate-400 shrink-0"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  {editingProposalLink ? (
                    <Input
                      autoFocus
                      type="text"
                      value={proposalLinkDraft}
                      onChange={(e) => setProposalLinkDraft(e.target.value)}
                      placeholder="https://..."
                      className="text-ssm flex-1 h-7"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') e.currentTarget.blur()
                        if (e.key === 'Escape') { setEditingProposalLink(false); return }
                      }}
                      onBlur={() => {
                        setEditingProposalLink(false)
                        let url = proposalLinkDraft.trim() || null
                        if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
                          url = 'https://' + url
                        }
                        if (url === deal.proposalLink) return
                        const prev = queryClient.getQueryData(queryKeys.deals.detail(dealId))
                        queryClient.setQueryData(queryKeys.deals.detail(dealId), (old: any) =>
                          old ? { ...old, proposalLink: url } : old
                        )
                        updateDeal.mutate({ id: dealId, data: { proposalLink: url } as any }, {
                          onError: () => queryClient.setQueryData(queryKeys.deals.detail(dealId), prev),
                          onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.deals.detail(dealId) }),
                        })
                      }}
                    />
                  ) : deal.proposalLink ? (
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      <a
                        href={deal.proposalLink.startsWith('http') ? deal.proposalLink : `https://${deal.proposalLink}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={deal.proposalLink}
                        className="text-ssm text-primary hover:underline truncate"
                      >
                        {deal.proposalLink.replace(/^https?:\/\//, '')}
                      </a>
                      <button
                        onClick={() => { setProposalLinkDraft(deal.proposalLink || ''); setEditingProposalLink(true) }}
                        className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-primary hover:bg-surface-hover transition-colors shrink-0"
                        title="Edit link"
                      >
                        <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setProposalLinkDraft(''); setEditingProposalLink(true) }}
                      className="text-ssm text-slate-400 hover:text-primary transition-colors"
                    >
                      Add proposal link
                    </button>
                  )}
                </div>

                {/* Demo Link */}
                <div className="flex items-center gap-1.5 min-w-0">
                  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="text-slate-400 shrink-0"><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" /></svg>
                  {editingDemoLink ? (
                    <Input
                      autoFocus
                      type="text"
                      value={demoLinkDraft}
                      onChange={(e) => setDemoLinkDraft(e.target.value)}
                      placeholder="https://..."
                      className="text-ssm flex-1 h-7"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') e.currentTarget.blur()
                        if (e.key === 'Escape') { setEditingDemoLink(false); return }
                      }}
                      onBlur={() => {
                        setEditingDemoLink(false)
                        let url = demoLinkDraft.trim() || null
                        if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
                          url = 'https://' + url
                        }
                        if (url === deal.demoLink) return
                        const prev = queryClient.getQueryData(queryKeys.deals.detail(dealId))
                        queryClient.setQueryData(queryKeys.deals.detail(dealId), (old: any) =>
                          old ? { ...old, demoLink: url } : old
                        )
                        updateDeal.mutate({ id: dealId, data: { demoLink: url } as any }, {
                          onError: () => queryClient.setQueryData(queryKeys.deals.detail(dealId), prev),
                          onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.deals.detail(dealId) }),
                        })
                      }}
                    />
                  ) : deal.demoLink ? (
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      <a
                        href={deal.demoLink.startsWith('http') ? deal.demoLink : `https://${deal.demoLink}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={deal.demoLink}
                        className="text-ssm text-primary hover:underline truncate"
                      >
                        {deal.demoLink.replace(/^https?:\/\//, '')}
                      </a>
                      <button
                        onClick={() => { setDemoLinkDraft(deal.demoLink || ''); setEditingDemoLink(true) }}
                        className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-primary hover:bg-surface-hover transition-colors shrink-0"
                        title="Edit link"
                      >
                        <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setDemoLinkDraft(''); setEditingDemoLink(true) }}
                      className="text-ssm text-slate-400 hover:text-primary transition-colors"
                    >
                      Add demo link
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Proposals tab ─────────────────────────────────────────────── */}
          {activeTab === 'proposals' && (
            <div className="p-4">
              {loadingProposals ? (
                <div className="py-12 text-center">
                  <p className="text-ssm text-slate-400">Loading proposals...</p>
                </div>
              ) : dealProposals.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="text-ssm font-medium text-slate-400">No proposals yet</p>
                  <p className="text-xxs text-text-faint mt-1">New proposals are created via Aria chat.</p>
                </div>
              ) : (
                <div className="bg-surface-alt border border-border rounded-lg divide-y divide-black/[.06] dark:divide-white/[.06] overflow-hidden">
                  {dealProposals.map(p => (
                    <button
                      key={p.id}
                      onClick={() => router.push(`/proposals/${p.id}`)}
                      className="w-full flex items-center gap-3 text-left px-3 py-2.5 hover:bg-card transition-colors duration-150"
                    >
                      <div className="w-8 h-8 rounded-md bg-card border border-border flex items-center justify-center shrink-0">
                        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="text-slate-400">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <path d="M14 2v6h6" />
                        </svg>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-ssm font-semibold text-foreground truncate">{p.title}</div>
                        {p.changeNote && (
                          <div className="text-xxs text-slate-500 mt-0.5 truncate">{p.changeNote}</div>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xxs text-slate-500 shrink-0 font-mono">
                        <span>v{p.currentVersion}</span>
                        <span className="text-slate-300">·</span>
                        <span>{new Date(p.updatedAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Billing tab ───────────────────────────────────────────────── */}
          {activeTab === 'billing' && (
            <div className="p-4">
              <BillingSection dealId={dealId} currency={deal.currency} />
            </div>
          )}

          {/* ── People tab ───────────────────────────────────────────────── */}
          {activeTab === 'people' && (
            <div className="p-3 space-y-2.5">
              {/* Add Person button / inline form */}
              {!showAddPerson ? (
                <button
                  onClick={() => setShowAddPerson(true)}
                  className="flex items-center gap-1.5 w-full px-3.5 py-2.5 text-xs font-medium text-primary hover:bg-primary/[.06] rounded-lg border border-dashed border-border transition-colors"
                >
                  <Plus size={14} />
                  Add Person
                </button>
              ) : (
                <div className="rounded-lg border border-border bg-card p-3.5 space-y-2.5">
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
                          title: [personForm.role, personForm.title.trim()].filter(Boolean).join(' - ') || null,
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
                      className="h-8 px-3.5 text-xs font-medium text-slate-500 hover:text-slate-700 hover:text-foreground transition-colors"
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
                      className="rounded-lg border border-border bg-card p-4"
                    >
                      {/* Header: avatar + name + role + actions */}
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                          style={{ background: color }}
                        >
                          {initials}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-foreground truncate">
                              {toPascalCase(person.name)}
                            </span>
                            {person.title && (
                              <span className="eyebrow-label rounded-md bg-secondary px-2 py-0.5 whitespace-nowrap">
                                {person.title.split(' - ')[0]}
                              </span>
                            )}
                          </div>
                          <div className="text-xxs text-slate-400 mt-0.5">
                            {person.updatedAt ? 'Added ' + timeAgo(person.updatedAt) : 'Contact'}
                          </div>
                        </div>
                        {/* Edit + delete actions */}
                        {isSales && (
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => setEditingContact(person)}
                              className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-primary hover:bg-primary/10 transition-colors"
                              title="Edit contact"
                            >
                              <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => setDeletingContact(person)}
                              className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                              title="Remove contact"
                            >
                              <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                              </svg>
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Contact info sections */}
                      {(person.email || person.phone) && (
                        <div className="mt-3 pt-3 border-t border-border space-y-3">
                          {person.email && (
                            <div>
                              <div className="eyebrow-label mb-1">Email</div>
                              <div className="flex items-center justify-between">
                                <span className="text-ssm text-foreground truncate">{person.email}</span>
                                <CopyButton value={person.email} />
                              </div>
                            </div>
                          )}
                          {person.phone && (
                            <div>
                              <div className="eyebrow-label mb-1">Phone</div>
                              <div className="flex items-center justify-between">
                                <span className="text-ssm text-foreground">{person.phone}</span>
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
                          <div className="w-px flex-1 bg-skeleton" />
                        )}
                      </div>
                      {/* Content */}
                      <div className={cn('flex-1 min-w-0 pb-4', i === activities.length - 1 && 'pb-0')}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="text-xs font-medium text-foreground">
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

        {/* ── Right properties rail ────────── */}
        <div className="w-full sm:w-auto sm:col-start-3 sm:row-start-1 sm:shrink-0 flex flex-col gap-4 px-4 sm:px-4 pt-4 sm:py-5 bg-[var(--bg-subtle)] sm:border-l sm:border-border">

          {/* Deal Info */}
          {!isPartner && (
          <SidebarSection title="Deal Info">
            <InfoRow
              label="Deal Size"
              value={
                <span className="text-primary font-semibold">{formatDealMoneyFull(deal)}</span>
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
                        : 'bg-secondary text-slate-500'
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
                <div className="flex flex-wrap gap-1.5 items-center">
                  {(deal.servicesTags ?? []).filter(Boolean).map(s => (
                    <span key={s} className="text-atom font-medium px-1.5 py-0.5 rounded-lg bg-primary/10 text-primary">
                      {formatServiceType(s)}
                    </span>
                  ))}
                  {deal.servicesTags?.includes('internal_products') && deal.catalogItemName && (
                    <span className="text-atom font-semibold px-1.5 py-0.5 rounded-lg bg-violet-500/10 text-violet-500 dark:text-violet-400">
                      {deal.catalogItemName}
                    </span>
                  )}
                </div>
              </div>
            )}
          </SidebarSection>
          )}

          {!isPartner && isSales && (deal.partnerDealGroupIds ?? []).length > 0 && (
            <SidebarSection title="Partner Commissions">
              <div className="space-y-2">
                {(deal.partnerDealGroupIds ?? []).map(groupId => {
                  const group = partnerDealGroupMap.get(groupId)
                  const commission = partnerCommissionMap.get(groupId)
                  return (
                    <div key={groupId} className="rounded-md border border-border p-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-xxs font-semibold text-foreground">{group?.name ?? 'Partner group'}</p>
                          <p className="mt-0.5 text-atom text-slate-400">{commission?.commissionStatus ? toPascalCase(commission.commissionStatus) : 'No commission set'}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => openCommissionDialog(groupId)}
                          className="rounded-md px-2 py-1 text-xxs font-semibold text-primary transition-colors hover:bg-primary/10"
                        >
                          {commission?.commissionAmount ? formatMoney(commission.commissionAmount, deal.currency) : 'Set'}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </SidebarSection>
          )}

          {!isPartner && (
            <div className="bg-card rounded-md border border-amber-200 dark:border-amber-500/30 shadow-[0_1px_4px_rgba(0,0,0,0.04)] p-3">
              <p className="eyebrow-label text-warning-foreground mb-2">Next Step</p>
              <div className="bg-amber-50 dark:bg-amber-500/10 rounded-lg p-3 border border-amber-100 dark:border-amber-500/20">
                <p className="eyebrow-label text-warning-foreground mb-1">Action Required</p>
                <p className="text-ssm text-foreground leading-snug">Initial outreach - intro email + schedule call</p>
                <p className="text-xxs text-amber-600 dark:text-amber-400 mt-1.5">Due Mar 22, 2026</p>
              </div>
            </div>
          )}

        </div>

        {/* ── Left assignment + actions rail ────────── */}
        <div className="w-full sm:w-auto sm:col-start-1 sm:row-start-1 sm:shrink-0 px-4 sm:px-4 pb-4 sm:pb-5 bg-[var(--bg-subtle)] sm:border-r sm:border-border">
          <div className="flex flex-col gap-4 rounded-b-md border border-t-0 border-border bg-card p-3 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">

          {/* Account Manager */}
          <SidebarSection title="Account Manager">
            <div className="relative">
              {deal.stage === 'closed_lost' || !isSales ? (
                /* Locked: lost deals cannot have AM reassigned (won deals can) */
                <div className="flex items-center gap-2.5 px-1 py-1 -mx-1 rounded-lg">
                  {amDisplayName ? (
                    <>
                      <Avatar
                        name={amDisplayName}
                        email={amUser?.email ?? undefined}
                        src={amUser?.image ?? undefined}
                        size={28}
                      />
                      <div className="text-left min-w-0 flex-1">
                        <p className="text-xs font-semibold text-foreground truncate">{amDisplayName}</p>
                        <p className="text-atom text-slate-400">Account Manager</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="w-[34px] h-[34px] rounded-full border-2 border-dashed border-border flex items-center justify-center shrink-0">
                        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="text-text-faint">
                          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
                        </svg>
                      </div>
                      <span className="text-xs text-slate-400">Unassigned</span>
                    </>
                  )}
                  {/* Lock indicator */}
                  <div className="ml-auto shrink-0" title="Cannot reassign AM - deal is lost">
                    <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="text-text-faint">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                  </div>
                </div>
              ) : (
                /* Normal: click to assign - Popover + Command, searchable */
                <Popover open={showAssignDropdown} onOpenChange={setShowAssignDropdown}>
                  <PopoverTrigger asChild>
                    <button className="flex items-center gap-2.5 w-full rounded-lg hover:bg-surface-hover px-1 py-1 -mx-1 transition-colors group">
                      {amDisplayName ? (
                        <>
                          <Avatar
                            name={amDisplayName}
                            email={amUser?.email ?? undefined}
                            src={amUser?.image ?? undefined}
                            size={28}
                          />
                          <div className="text-left min-w-0 flex-1">
                            <p className="text-xs font-semibold text-foreground truncate">{amDisplayName}</p>
                            <p className="text-atom text-slate-400">Account Manager</p>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="w-[34px] h-[34px] rounded-full border-2 border-dashed border-border flex items-center justify-center shrink-0">
                            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="text-text-faint">
                              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
                            </svg>
                          </div>
                          <span className="text-xs text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors">
                            Click to assign
                          </span>
                        </>
                      )}
                      <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="text-text-faint shrink-0 ml-auto">
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search..." />
                      <CommandList>
                        <CommandEmpty>No matches</CommandEmpty>
                        <CommandGroup>
                          {amDisplayName && (
                            <CommandItem
                              value="__unassign"
                              onSelect={() => handleAssignAM('')}
                              className="text-red-500"
                            >
                              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="mr-2 shrink-0">
                                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                              </svg>
                              Unassign
                            </CommandItem>
                          )}
                          {users
                            .filter(u => u.role === CrmUserRole.Sales)
                            .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))
                            .map(u => (
                              <CommandItem
                                key={u.id}
                                value={`${u.name ?? ''} ${u.email ?? ''}`}
                                onSelect={() => handleAssignAM(u.id)}
                                className="justify-between"
                              >
                                <UserOption user={u} />
                                {u.id === deal.assignedTo && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
                              </CommandItem>
                            ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              )}
            </div>
          </SidebarSection>

          {/* Sub Account Manager */}
          <SidebarSection title="Sub Account Manager">
            {isSales ? (
              <SubAmPicker
                value={deal.subAccountManagerId ?? null}
                users={users.filter(u => u.role === CrmUserRole.Sales)}
                onChange={(uid) => {
                  updateDeal.mutate({ id: dealId, data: { subAccountManagerId: uid } }, {
                    onSettled: () => {
                      queryClient.invalidateQueries({ queryKey: queryKeys.deals.detail(dealId) })
                      queryClient.invalidateQueries({ queryKey: queryKeys.deals.all })
                    },
                  })
                }}
              />
            ) : (() => {
              const subAmUser = deal.subAccountManagerId ? users.find(u => u.id === deal.subAccountManagerId) : null
              return subAmUser ? <UserOption user={subAmUser} /> : <span className="text-ssm text-slate-400">Unassigned</span>
            })()}
          </SidebarSection>

          {!isPartner && (
          <>
          {/* Builders */}
          <SidebarSection title="Builders">
            <div className="space-y-1.5">
              {(deal.builders ?? []).length === 0 ? (
                <p className="text-xxs text-slate-400">No builders assigned</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {(deal.builders ?? []).map(uid => {
                    const u = users.find(x => x.id === uid)
                    return (
                      <span
                        key={uid}
                        className="inline-flex items-center gap-1.5 pl-1 pr-1 py-0.5 rounded-full text-xxs font-medium bg-secondary text-foreground"
                      >
                        {u ? (
                          <Avatar
                            name={u.name ?? undefined}
                            email={u.email ?? undefined}
                            src={u.image ?? undefined}
                            size={18}
                          />
                        ) : (
                          <span className="w-[18px] h-[18px] rounded-full bg-skeleton" />
                        )}
                        <span className="pr-1">{u?.name || u?.email || uid}</span>
                        {isSales && (
                          <button
                            onClick={() => setRemovingBuilderId(uid)}
                            className="rounded-full hover:bg-skeleton p-0.5 text-slate-400 hover:text-red-500 transition-colors"
                            title="Remove builder"
                          >
                            <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                          </button>
                        )}
                      </span>
                    )
                  })}
                </div>
              )}
              {isSales && (
                <BuilderPicker
                  users={users}
                  selected={deal.builders ?? []}
                  onAdd={(uid) => {
                    const next = [...(deal.builders ?? []), uid]
                    updateDeal.mutate({ id: dealId, data: { builders: next } }, {
                      onSettled: () => {
                        queryClient.invalidateQueries({ queryKey: queryKeys.deals.detail(dealId) })
                        queryClient.invalidateQueries({ queryKey: queryKeys.deals.all })
                      },
                    })
                  }}
                />
              )}
            </div>
          </SidebarSection>

          {/* Client Brand Color */}
          <SidebarSection
            title="Client Brand Color"
            action={isSales && (
              <button
                type="button"
                onClick={openBrandColorModal}
                className="inline-flex items-center gap-1 rounded-control px-1.5 py-0.5 text-xxs font-medium text-muted-foreground transition-colors hover:bg-surface-hover hover:text-primary"
              >
                <Pencil size={10} />
                Edit
              </button>
            )}
          >
            <BrandColorLayers color={deal.clientBrandColor} />
          </SidebarSection>

          {/* Quick Actions */}
          <SidebarSection title="Quick Actions">
            <div className="flex flex-col -mx-2">

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
                  <div className="border-t border-border my-1" />
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
            <div className="bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 rounded-md p-4">
              <p className="eyebrow-label text-red-600 mb-1">\u2691 Flagged</p>
              <p className="text-xs text-red-700 dark:text-red-400">{deal.flagReason || 'No reason specified'}</p>
            </div>
          )}

          </>
          )}
          </div>
        </div>
      </div>
    </div>
  )
}
