'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { formatPeso } from '@/lib/utils'
import { Avatar } from './Avatar'
import { queryKeys } from '@/lib/query-keys'
import { usePatchDealStage, useDeleteDeal, useUpdateDeal } from '@/lib/hooks/mutations'
import { useUser } from '@/lib/hooks/use-user'
import {
  MoreHorizontal, Search, X, Trash2, ExternalLink,
  ChevronDown, ChevronRight, User as UserIcon,
} from 'lucide-react'

// --- Types ---
type ApiDeal = {
  id: string
  companyId: string
  title: string
  stage: string
  value: string | null
  servicesTags: string[] | null
  outreachCategory: string | null
  pricingModel: string | null
  assignedTo: string | null
  lastActivityAt: string | null
}

type ApiCompany = { id: string; name: string }
type ApiUser = { id: string; name: string; email: string }

type PipelineProps = {
  onOpenDeal: (id: string) => void
}

/**
 * 7 consolidated stages — mirrors PipelineBar in Dashboard.
 */
const KANBAN_STAGES = [
  { id: 'lead',         label: 'Lead',           color: '#94a3b8', matches: ['lead'] },
  { id: 'discovery',   label: 'Discovery',       color: '#2563eb', matches: ['discovery'] },
  { id: 'assessment',  label: 'Assessment',      color: '#7c3aed', matches: ['assessment', 'qualified'] },
  { id: 'demo_prop',   label: 'Demo + Proposal', color: '#d97706', matches: ['demo', 'proposal', 'proposal_demo'] },
  { id: 'followup',    label: 'Follow-up',       color: '#f59e0b', matches: ['negotiation', 'followup'] },
  { id: 'closed_won',  label: 'Won',             color: '#16a34a', matches: ['closed_won'] },
  { id: 'closed_lost', label: 'Lost',            color: '#dc2626', matches: ['closed_lost'] },
]

/** Maps droppable column id → the primary DB stage value sent to the API */
const COLUMN_TO_STAGE: Record<string, string> = {
  lead: 'lead', discovery: 'discovery', assessment: 'assessment',
  demo_prop: 'proposal_demo', followup: 'followup',
  closed_won: 'closed_won', closed_lost: 'closed_lost',
}

/** Stage ordering for forward-only drag constraint */
const STAGE_ORDER: Record<string, number> = {
  lead: 0, discovery: 1, assessment: 2, qualified: 2,
  demo: 3, proposal: 3, proposal_demo: 3,
  negotiation: 4, followup: 4,
  closed_won: 5, closed_lost: 5,
}

/** Maps a stage to the next stage when advancing */
const STAGE_ADVANCE_MAP: Record<string, string> = {
  lead: 'discovery', discovery: 'assessment',
  assessment: 'proposal_demo', qualified: 'proposal_demo',
  demo: 'proposal_demo', proposal: 'proposal_demo',
  proposal_demo: 'followup', negotiation: 'followup',
  followup: 'closed_won',
}

const CLOSED_IDS = new Set(['closed_won', 'closed_lost'])

// --- CardActionsMenu ---
function CardActionsMenu({
  currentStage,
  onOpen,
  onDelete,
  onAdvance,
  onAssign,
  isSales,
  users,
}: {
  currentStage: string
  onOpen: () => void
  onDelete: () => void
  onAdvance: () => void
  onAssign: (name: string) => void
  isSales: boolean
  users: ApiUser[]
}) {
  const [open, setOpen] = useState(false)
  const [showAssign, setShowAssign] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const canAdvance = !!STAGE_ADVANCE_MAP[currentStage]

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setShowAssign(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o); setShowAssign(false) }}
        className="w-6 h-6 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[.08] transition-colors opacity-0 group-hover:opacity-100"
      >
        <MoreHorizontal size={14} />
      </button>
      {open && (
        <div className="absolute right-0 top-7 z-50 min-w-[160px] bg-white dark:bg-[#1e1e21] border border-black/[.08] dark:border-white/[.1] rounded-lg shadow-lg py-1 animate-in fade-in-0 zoom-in-95 duration-100">
          {/* Assign */}
          <button
            onClick={(e) => { e.stopPropagation(); setShowAssign(v => !v) }}
            className="flex items-center justify-between w-full px-3 py-1.5 text-[12px] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[.06] transition-colors"
          >
            <span className="flex items-center gap-2"><UserIcon size={12} /> Assign</span>
            <ChevronRight size={11} className={cn('text-slate-400 transition-transform duration-150', showAssign && 'rotate-90')} />
          </button>
          {showAssign && (
            <div className="border-t border-black/[.04] dark:border-white/[.06] max-h-[144px] overflow-y-auto">
              {users.length === 0 ? (
                <div className="px-3 py-2 text-[11px] text-slate-400 italic">No team members</div>
              ) : (
                users.map(u => (
                  <button
                    key={u.id}
                    onClick={(e) => { e.stopPropagation(); setOpen(false); setShowAssign(false); onAssign(u.name || u.email) }}
                    className="flex items-center gap-2 w-full px-3 py-1.5 text-[12px] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[.06] transition-colors"
                  >
                    <Avatar name={u.name || u.email} size={16} />
                    {u.name || u.email}
                  </button>
                ))
              )}
            </div>
          )}

          {/* Advance */}
          {canAdvance && (
            <button
              onClick={(e) => { e.stopPropagation(); setOpen(false); onAdvance() }}
              className="flex items-center gap-2 w-full px-3 py-1.5 text-[12px] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[.06] transition-colors"
            >
              <ChevronRight size={12} /> Advance
            </button>
          )}

          {/* Open deal */}
          <button
            onClick={(e) => { e.stopPropagation(); setOpen(false); onOpen() }}
            className="flex items-center gap-2 w-full px-3 py-1.5 text-[12px] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[.06] transition-colors"
          >
            <ExternalLink size={12} /> Open deal
          </button>

          {/* Delete */}
          {isSales && (
            <button
              onClick={(e) => { e.stopPropagation(); setOpen(false); onDelete() }}
              className="flex items-center gap-2 w-full px-3 py-1.5 text-[12px] text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
            >
              <Trash2 size={12} /> Delete
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// --- DealCard ---
function DealCard({
  deal,
  colColor,
  brandName,
  onClick,
  onDelete,
  onAdvance,
  onAssign,
  isSales,
  users,
}: {
  deal: ApiDeal
  colColor: string
  brandName: string
  onClick: () => void
  onDelete?: () => void
  onAdvance?: () => void
  onAssign?: (name: string) => void
  isSales?: boolean
  users?: ApiUser[]
}) {
  const isWon = deal.stage === 'closed_won'
  const isLost = deal.stage === 'closed_lost'
  const outreach = deal.outreachCategory || 'outbound'
  const services = deal.servicesTags || []
  const amName = deal.assignedTo || 'Unassigned'

  return (
    <div
      onClick={onClick}
      className={cn(
        'group rounded-lg p-3.5 cursor-pointer transition-colors duration-150',
        isWon
          ? 'bg-[rgba(22,163,74,0.05)] dark:bg-[rgba(22,163,74,0.08)] border border-[rgba(22,163,74,0.22)]'
          : isLost
          ? 'bg-white dark:bg-[#222225] border border-[rgba(220,38,38,0.15)] opacity-70'
          : 'bg-white dark:bg-[#222225] border border-black/[.08] dark:border-white/[.1]'
      )}
      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = colColor + '14' }}
      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '' }}
    >
      {/* Brand name + outreach badge + actions */}
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-[0.05em] text-slate-400 truncate max-w-[120px]">
          {brandName}
        </span>
        <div className="flex items-center gap-1">
          {onDelete !== undefined && onAdvance !== undefined && onAssign !== undefined && (
            <CardActionsMenu
              currentStage={deal.stage}
              onOpen={onClick}
              onDelete={onDelete}
              onAdvance={onAdvance}
              onAssign={onAssign}
              isSales={isSales ?? false}
              users={users ?? []}
            />
          )}
          <span className={cn(
            'text-[10px] font-semibold px-2 py-0.5 rounded-full',
            outreach === 'inbound'
              ? 'bg-[rgba(22,163,74,0.1)] text-[#16a34a]'
              : 'bg-slate-100 dark:bg-white/[.06] text-slate-500'
          )}>
            {outreach === 'inbound' ? 'Inbound' : 'Outbound'}
          </span>
        </div>
      </div>

      {/* Deal title */}
      <div className="text-[12.5px] font-semibold text-slate-900 dark:text-white leading-snug mb-2.5">
        {deal.title}
      </div>

      {/* Services tags */}
      {services.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2.5">
          {services.slice(0, 3).map(s => (
            <span
              key={s}
              className="text-[10px] font-medium px-2 py-0.5 rounded-full"
              style={{ background: `${colColor}18`, color: colColor }}
            >
              {s}
            </span>
          ))}
          {services.length > 3 && (
            <span className="text-[10px] text-slate-400">+{services.length - 3}</span>
          )}
        </div>
      )}

      {/* Value + AM */}
      <div className="flex items-center justify-between pt-2 border-t border-black/[.05] dark:border-white/[.08]">
        <span className="text-[15px] font-bold tabular-nums" style={{ color: colColor }}>
          {deal.value ? formatPeso(parseFloat(deal.value)) : '—'}
        </span>
        <div className="flex items-center gap-1">
          <Avatar name={amName} size={20} />
          <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400">{amName}</span>
        </div>
      </div>
    </div>
  )
}

// --- DraggableDealCard —wraps DealCard without touching it ---
function DraggableDealCard({
  deal, colColor, brandName, onClick, onDelete, onAdvance, onAssign, isSales, users,
}: {
  deal: ApiDeal
  colColor: string
  brandName: string
  onClick: () => void
  onDelete?: () => void
  onAdvance?: () => void
  onAssign?: (name: string) => void
  isSales?: boolean
  users?: ApiUser[]
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: deal.id })
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn('touch-none', isDragging && 'opacity-0 transition-opacity duration-150')}
      {...attributes}
      {...listeners}
    >
      <DealCard
        deal={deal}
        colColor={colColor}
        brandName={brandName}
        onClick={onClick}
        onDelete={onDelete}
        onAdvance={onAdvance}
        onAssign={onAssign}
        isSales={isSales}
        users={users}
      />
    </div>
  )
}

// --- DroppableColumn ---
function DroppableColumn({ col, children }: { col: (typeof KANBAN_STAGES)[number]; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: col.id })
  return (
    <div
      ref={setNodeRef}
      data-stage-id={col.id}
      className={cn(
        'w-[252px] shrink-0 flex flex-col rounded-lg transition-all duration-150',
        'bg-[rgba(0,0,0,0.02)] dark:bg-white/[.02]',
        isOver ? 'border-2 border-dashed' : 'border border-black/[.07] dark:border-white/[.08]',
      )}
      style={isOver ? { borderColor: col.color } : undefined}
    >
      {children}
    </div>
  )
}

// --- Fetch ---
async function fetchDeals(): Promise<ApiDeal[]> {
  const res = await fetch('/api/deals')
  if (!res.ok) throw new Error('Failed to fetch deals')
  return res.json()
}
async function fetchCompanies(): Promise<ApiCompany[]> {
  const res = await fetch('/api/companies')
  if (!res.ok) throw new Error('Failed to fetch companies')
  return res.json()
}
async function fetchUsers(): Promise<ApiUser[]> {
  const res = await fetch('/api/users')
  if (!res.ok) throw new Error('Failed to fetch users')
  return res.json()
}

// --- Pipeline ---
export function Pipeline({ onOpenDeal }: PipelineProps) {
  const [activeDealId, setActiveDealId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [amFilter, setAmFilter] = useState<string | null>(null)
  const [amDropdownOpen, setAmDropdownOpen] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const amDropdownRef = useRef<HTMLDivElement>(null)
  const queryClient = useQueryClient()
  const searchParams = useSearchParams()
  const router = useRouter()
  const scrolledRef = useRef(false)
  const { isSales } = useUser()

  const { data: deals = [], isLoading } = useQuery({
    queryKey: queryKeys.deals.all,
    queryFn: fetchDeals,
  })

  const { data: companies = [] } = useQuery({
    queryKey: queryKeys.companies.all,
    queryFn: fetchCompanies,
  })

  const { data: users = [] } = useQuery({
    queryKey: ['users'] as const,
    queryFn: fetchUsers,
  })

  const companyMap = useMemo(() => {
    const m = new Map<string, string>()
    for (const c of companies) m.set(c.id, c.name)
    return m
  }, [companies])

  const deleteDeal = useDeleteDeal()
  const patchStage = usePatchDealStage()
  const updateDeal = useUpdateDeal()

  // Ctrl+F to open search
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault()
        setSearchOpen(true)
        setTimeout(() => searchInputRef.current?.focus(), 50)
      }
      if (e.key === 'Escape' && searchOpen) {
        setSearchOpen(false)
        setSearch('')
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [searchOpen])

  // Close AM dropdown on outside click
  useEffect(() => {
    if (!amDropdownOpen) return
    function handleClick(e: MouseEvent) {
      if (amDropdownRef.current && !amDropdownRef.current.contains(e.target as Node)) setAmDropdownOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [amDropdownOpen])

  const amNames = useMemo(() => {
    const names = new Set<string>()
    for (const d of deals) {
      if (d.assignedTo) names.add(d.assignedTo)
    }
    return Array.from(names).sort()
  }, [deals])

  const filteredDeals = useMemo(() => {
    let result = deals
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(d =>
        d.title.toLowerCase().includes(q) ||
        d.stage.toLowerCase().includes(q) ||
        (d.servicesTags ?? []).some(s => s.toLowerCase().includes(q)) ||
        (d.assignedTo || '').toLowerCase().includes(q)
      )
    }
    if (amFilter) {
      result = result.filter(d => d.assignedTo === amFilter)
    }
    return result
  }, [deals, search, amFilter])

  const handleDeleteDeal = useCallback((dealId: string) => {
    if (!confirm('Delete this deal? This action cannot be undone.')) return
    deleteDeal.mutate(dealId, {
      onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.deals.all }),
    })
  }, [deleteDeal, queryClient])

  const handleAdvanceDeal = useCallback((dealId: string, currentStage: string) => {
    const nextStage = STAGE_ADVANCE_MAP[currentStage]
    if (!nextStage) return
    const previousDeals = queryClient.getQueryData<ApiDeal[]>(queryKeys.deals.all)
    queryClient.setQueryData<ApiDeal[]>(queryKeys.deals.all, old =>
      old?.map(d => d.id === dealId ? { ...d, stage: nextStage } : d) ?? []
    )
    patchStage.mutate({ id: dealId, stage: nextStage }, {
      onError: () => queryClient.setQueryData(queryKeys.deals.all, previousDeals),
      onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.deals.all }),
    })
  }, [patchStage, queryClient])

  const handleAssignDeal = useCallback((dealId: string, assignedTo: string) => {
    const previousDeals = queryClient.getQueryData<ApiDeal[]>(queryKeys.deals.all)
    queryClient.setQueryData<ApiDeal[]>(queryKeys.deals.all, old =>
      old?.map(d => d.id === dealId ? { ...d, assignedTo } : d) ?? []
    )
    updateDeal.mutate({ id: dealId, data: { assignedTo } }, {
      onError: () => queryClient.setQueryData(queryKeys.deals.all, previousDeals),
      onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.deals.all }),
    })
  }, [updateDeal, queryClient])

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  // Scroll to the stage column referenced by ?stage= param, then clear it
  useEffect(() => {
    if (isLoading || scrolledRef.current) return
    const stageId = searchParams.get('stage')
    if (!stageId) return
    scrolledRef.current = true
    const timer = setTimeout(() => {
      const el = document.querySelector(`[data-stage-id="${stageId}"]`)
      if (el) el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
      router.replace('/pipeline')
    }, 100)
    return () => clearTimeout(timer)
  }, [isLoading, searchParams, router])

  const activeDeals = filteredDeals.filter(d => !CLOSED_IDS.has(d.stage))
  const totalValue = activeDeals.reduce((s, d) => s + (parseFloat(d.value || '0') || 0), 0)

  const columnDeals = KANBAN_STAGES.map(col => ({
    ...col,
    deals: filteredDeals.filter(d => col.matches.includes(d.stage)),
    total: filteredDeals
      .filter(d => col.matches.includes(d.stage))
      .reduce((s, d) => s + (parseFloat(d.value || '0') || 0), 0),
  }))

  const activeDeal = activeDealId ? deals.find(d => d.id === activeDealId) ?? null : null
  const activeDealColColor = activeDeal
    ? (KANBAN_STAGES.find(c => c.matches.includes(activeDeal.stage))?.color ?? '#94a3b8')
    : '#94a3b8'

  function handleDragStart(event: DragStartEvent) {
    setActiveDealId(event.active.id as string)
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveDealId(null)
    if (!over) return
    const deal = deals.find(d => d.id === (active.id as string))
    if (!deal) return
    const targetStage = COLUMN_TO_STAGE[over.id as string]
    if (!targetStage) return
    const currentCol = KANBAN_STAGES.find(c => c.matches.includes(deal.stage))
    if (currentCol?.id === over.id) return
    const currentOrder = STAGE_ORDER[deal.stage] ?? 0
    const targetOrder = STAGE_ORDER[targetStage] ?? 0
    if (targetOrder < currentOrder) return
    const previousDeals = queryClient.getQueryData<ApiDeal[]>(queryKeys.deals.all)
    queryClient.setQueryData<ApiDeal[]>(queryKeys.deals.all, old =>
      old?.map(d => d.id === deal.id ? { ...d, stage: targetStage } : d) ?? []
    )
    patchStage.mutate({ id: deal.id, stage: targetStage }, {
      onError: () => queryClient.setQueryData(queryKeys.deals.all, previousDeals),
      onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.deals.all }),
    })
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Stats + actions */}
      <div className="flex items-center justify-between gap-2 px-4 py-2.5 shrink-0">
        {isLoading ? (
          <div className="h-4 w-40 bg-slate-100 dark:bg-white/[.06] rounded animate-pulse" />
        ) : (
          <span className="text-[13px] font-medium text-slate-900 dark:text-white shrink-0">
            {activeDeals.length} active deal{activeDeals.length !== 1 ? 's' : ''}
            {totalValue > 0 && (
              <> &middot; <span className="tabular-nums">{formatPeso(totalValue)}</span></>
            )}
            {(search || amFilter) && (
              <span className="text-slate-400 ml-1">(filtered)</span>
            )}
          </span>
        )}
        <div className="flex gap-2 items-center">
          {/* Search */}
          {searchOpen ? (
            <div className="flex items-center gap-1.5 bg-white dark:bg-[#1e1e21] border border-black/[.08] dark:border-white/[.08] rounded-lg px-2.5 py-[5px] w-[200px]">
              <Search size={13} className="text-slate-400 shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search deals…"
                className="flex-1 bg-transparent text-[12px] text-slate-900 dark:text-white placeholder:text-slate-400 min-w-0 outline-none focus:outline-none"
              />
              <button
                onClick={() => { setSearchOpen(false); setSearch('') }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X size={13} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => { setSearchOpen(true); setTimeout(() => searchInputRef.current?.focus(), 50) }}
              className="bg-white dark:bg-[#1e1e21] border border-black/[.08] dark:border-white/[.08] rounded-lg px-3 py-[5px] text-[12px] font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[.04] transition-colors duration-150 cursor-pointer flex items-center gap-1.5"
              title="Search (Ctrl+F)"
            >
              <Search size={12} /> Search
            </button>
          )}

          {/* AM filter dropdown */}
          <div ref={amDropdownRef} className="relative">
            <button
              onClick={() => setAmDropdownOpen(o => !o)}
              className={cn(
                'bg-white dark:bg-[#1e1e21] border rounded-lg px-3 py-[5px] text-[12px] font-medium hover:bg-slate-50 dark:hover:bg-white/[.04] transition-colors duration-150 cursor-pointer flex items-center gap-1.5',
                amFilter
                  ? 'border-primary/30 text-primary'
                  : 'border-black/[.08] dark:border-white/[.08] text-slate-700 dark:text-slate-300'
              )}
            >
              {amFilter || 'All AMs'}
              <ChevronDown size={12} />
            </button>
            {amDropdownOpen && (
              <div className="absolute right-0 top-9 z-50 min-w-[160px] bg-white dark:bg-[#1e1e21] border border-black/[.08] dark:border-white/[.1] rounded-lg shadow-lg py-1 animate-in fade-in-0 zoom-in-95 duration-100 max-h-[240px] overflow-y-auto">
                <button
                  onClick={() => { setAmFilter(null); setAmDropdownOpen(false) }}
                  className={cn(
                    'w-full px-3 py-1.5 text-[12px] text-left hover:bg-slate-50 dark:hover:bg-white/[.06] transition-colors',
                    !amFilter ? 'font-semibold text-primary' : 'text-slate-700 dark:text-slate-300'
                  )}
                >
                  All AMs
                </button>
                {amNames.map(name => (
                  <button
                    key={name}
                    onClick={() => { setAmFilter(name); setAmDropdownOpen(false) }}
                    className={cn(
                      'w-full px-3 py-1.5 text-[12px] text-left hover:bg-slate-50 dark:hover:bg-white/[.06] transition-colors',
                      amFilter === name ? 'font-semibold text-primary' : 'text-slate-700 dark:text-slate-300'
                    )}
                  >
                    {name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Board */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex gap-2.5 px-4 pb-4" style={{ minWidth: 'max-content' }}>
            {KANBAN_STAGES.map(col => (
              <div key={col.id} className="w-[252px] shrink-0 flex flex-col rounded-lg border border-black/[.07] dark:border-white/[.08] bg-[rgba(0,0,0,0.02)] dark:bg-white/[.02]">
                <div className="px-3.5 py-3 shrink-0 border-b border-black/[.06] dark:border-white/[.08] bg-white/60 dark:bg-white/[.04]">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0 animate-pulse bg-slate-200 dark:bg-white/[.1]" />
                    <div className="h-3 w-20 bg-slate-100 dark:bg-white/[.06] rounded animate-pulse flex-1" />
                    <div className="h-5 w-6 bg-slate-100 dark:bg-white/[.06] rounded-full animate-pulse" />
                  </div>
                </div>
                <div className="flex flex-col gap-2 p-2.5">
                  {[1, 2].map(i => (
                    <div key={i} className="rounded-lg p-3.5 bg-white dark:bg-[#1e1e21] border border-black/[.06] dark:border-white/[.08] animate-pulse">
                      <div className="h-2.5 w-16 bg-slate-100 dark:bg-white/[.06] rounded mb-2" />
                      <div className="h-4 w-full bg-slate-100 dark:bg-white/[.06] rounded mb-1" />
                      <div className="h-3 w-3/4 bg-slate-100 dark:bg-white/[.06] rounded mb-3" />
                      <div className="flex gap-1.5 mb-3">
                        <div className="h-4 w-12 bg-slate-100 dark:bg-white/[.06] rounded-full" />
                        <div className="h-4 w-16 bg-slate-100 dark:bg-white/[.06] rounded-full" />
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t border-black/[.04] dark:border-white/[.06]">
                        <div className="h-4 w-16 bg-slate-100 dark:bg-white/[.06] rounded" />
                        <div className="h-5 w-5 bg-slate-100 dark:bg-white/[.06] rounded-full" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <DndContext
            sensors={isSales ? sensors : []}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div className="flex gap-2.5 px-4 pb-4" style={{ minWidth: 'max-content' }}>
              {columnDeals.map(col => (
                <DroppableColumn key={col.id} col={col}>
                  {/* Column header */}
                  <div className="px-3.5 py-3 shrink-0 border-b border-black/[.06] dark:border-white/[.08] bg-white/60 dark:bg-white/[.04]">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: col.color }} />
                      <span className="text-[12.5px] font-semibold text-slate-700 dark:text-slate-300 flex-1 leading-none">{col.label}</span>
                      <span className="bg-white dark:bg-[#1e1e21] border border-black/[.07] dark:border-white/[.08] text-slate-500 text-[11px] font-semibold tabular-nums px-2 py-0.5 rounded-full">
                        {col.deals.length}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1 pl-[18px]">
                      <span className="text-[12px] tabular-nums font-medium" style={{ color: col.total > 0 ? col.color : undefined, opacity: col.total > 0 ? 1 : 0.4 }}>
                        {col.total > 0 ? formatPeso(col.total) : '—'}
                      </span>
                      {totalValue > 0 && col.total > 0 && !CLOSED_IDS.has(col.id) && (
                        <span className="text-[10px] text-slate-400 tabular-nums">
                          ({Math.round((col.total / totalValue) * 100)}%)
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Cards */}
                  <div className="flex flex-col gap-2 p-2.5">
                    {col.deals.length === 0 ? (
                      <div className="py-8 text-center text-[12px] text-slate-300 dark:text-white/20">
                        No deals
                      </div>
                    ) : (
                      col.deals.map(d => (
                        <DraggableDealCard
                          key={d.id}
                          deal={d}
                          colColor={col.color}
                          brandName={companyMap.get(d.companyId) ?? 'No Brand'}
                          users={users}
                          onClick={() => onOpenDeal(d.id)}
                          onDelete={() => handleDeleteDeal(d.id)}
                          onAdvance={() => handleAdvanceDeal(d.id, d.stage)}
                          onAssign={(name) => handleAssignDeal(d.id, name)}
                          isSales={isSales}
                        />
                      ))
                    )}
                  </div>
                </DroppableColumn>
              ))}
            </div>

            {/* Drag ghost overlay */}
            <DragOverlay>
              {activeDeal ? (
                <div className="opacity-85 scale-[1.02] shadow-2xl rounded-lg pointer-events-none">
                  <DealCard
                    deal={activeDeal}
                    colColor={activeDealColColor}
                    brandName={companyMap.get(activeDeal.companyId) ?? 'No Brand'}
                    onClick={() => {}}
                  />
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        )}
      </div>
    </div>
  )
}
