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
import { useQueryClient } from '@tanstack/react-query'
import { useGetDeals, useGetCompanies, useGetUsers } from '@/lib/hooks/queries'
import { useSearchParams, useRouter } from 'next/navigation'
import { cn, formatPeso, getAdvanceTargets, getMoveBackTargets, toPascalCase } from '@/lib/utils'
import type { ApiDeal, ApiCompany, ApiUser } from '@/lib/types'
import {
  KANBAN_STAGES, COLUMN_TO_STAGE, STAGE_ORDER,
  STAGE_ADVANCE_MAP, CLOSED_STAGE_IDS,
} from '@/lib/constants'
import { Avatar } from './Avatar'
import { CreateDealModal } from './CreateDealModal'
import { CreateBrandModal } from './CreateBrandModal'
import { queryKeys } from '@/lib/query-keys'
import { usePatchDealStage, useDeleteDeal, useUpdateDeal } from '@/lib/hooks/mutations'
import { useUser } from '@/lib/hooks/use-user'
import {
  MoreHorizontal, Search, X, Trash2, ExternalLink,
  ChevronDown, ChevronRight, User as UserIcon, Paperclip,
} from 'lucide-react'

type PipelineProps = {
  onOpenDeal: (id: string) => void
}

// --- Spinner ---
function Spinner({ size = 14 }: { size?: number }) {
  return (
    <div
      className="rounded-full border-2 border-current/30 border-t-current animate-spin"
      style={{ width: size, height: size }}
    />
  )
}

// --- CardActionsMenu ---
function CardActionsMenu({
  deal,
  currentStage,
  onOpen,
  onDelete,
  onAdvance,
  onAdvanceTo,
  onMoveTo,
  onAssign,
  isSales,
  users,
  isAdvancing,
}: {
  deal: ApiDeal
  currentStage: string
  onOpen: () => void
  onDelete: () => void
  onAdvance: () => void
  onAdvanceTo: (stage: string) => void
  onMoveTo: (stage: string) => void
  onAssign: (id: string, name: string) => void
  isSales: boolean
  users: ApiUser[]
  isAdvancing: boolean
}) {
  const [open, setOpen] = useState(false)
  const [showAssign, setShowAssign] = useState(false)
  const [showAdvanceTo, setShowAdvanceTo] = useState(false)
  const [showMoveTo, setShowMoveTo] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const isTerminal = currentStage === 'closed_won' || currentStage === 'closed_lost'
  const canAdvance = !!STAGE_ADVANCE_MAP[currentStage]
  const advanceTargets = getAdvanceTargets(currentStage)
  const moveBackTargets = getMoveBackTargets(currentStage)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setShowAssign(false)
        setShowAdvanceTo(false)
        setShowMoveTo(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o); setShowAssign(false); setShowAdvanceTo(false); setShowMoveTo(false) }}
        className="w-6 h-6 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[.08] transition-colors"
      >
        <MoreHorizontal size={14} />
      </button>
      {open && (
        <div className="absolute right-0 top-7 z-50 min-w-[180px] bg-white dark:bg-[#1e1e21] border border-black/[.08] dark:border-white/[.1] rounded-lg shadow-lg py-1 animate-in fade-in-0 zoom-in-95 duration-100">
          {/* Assign — locked for won/lost deals */}
          {isTerminal ? (
            <div
              className="flex items-center justify-between w-full px-3 py-1.5 text-[12px] text-slate-400 dark:text-slate-600 cursor-not-allowed select-none"
              title="Cannot reassign AM — deal is won/lost"
            >
              <span className="flex items-center gap-2">
                <UserIcon size={12} /> Assign
              </span>
              <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-300 dark:text-slate-600">
                <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            </div>
          ) : (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); setShowAssign(v => !v); setShowAdvanceTo(false); setShowMoveTo(false) }}
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
                        onClick={(e) => { e.stopPropagation(); setOpen(false); setShowAssign(false); onAssign(u.id, u.name || u.email) }}
                        className="flex items-center gap-2 w-full px-3 py-1.5 text-[12px] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[.06] transition-colors"
                      >
                        <Avatar name={u.name || u.email} src={u.image ?? undefined} size={16} />
                        {u.name || u.email}
                      </button>
                    ))
                  )}
                </div>
              )}
            </>
          )}

          {/* Advance (next stage, no confirmation, shows spinner) */}
          {canAdvance && (
            <button
              onClick={(e) => { e.stopPropagation(); onAdvance() }}
              disabled={isAdvancing}
              className="flex items-center gap-2 w-full px-3 py-1.5 text-[12px] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[.06] transition-colors disabled:opacity-50"
            >
              {isAdvancing ? <Spinner size={12} /> : <ChevronRight size={12} />}
              {isAdvancing ? 'Advancing…' : 'Advance'}
            </button>
          )}

          {/* Advance to... (choose target stage) */}
          {advanceTargets.length > 1 && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); setShowAdvanceTo(v => !v); setShowAssign(false); setShowMoveTo(false) }}
                className="flex items-center justify-between w-full px-3 py-1.5 text-[12px] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[.06] transition-colors"
              >
                <span className="flex items-center gap-2"><ChevronRight size={12} /> Advance to…</span>
                <ChevronDown size={11} className={cn('text-slate-400 transition-transform duration-150', showAdvanceTo && 'rotate-180')} />
              </button>
              {showAdvanceTo && (
                <div className="border-t border-black/[.04] dark:border-white/[.06] max-h-[200px] overflow-y-auto">
                  {advanceTargets.map(t => (
                    <button
                      key={t.id}
                      onClick={(e) => { e.stopPropagation(); setOpen(false); onAdvanceTo(t.dbStage) }}
                      className="flex items-center gap-2 w-full px-3 py-1.5 text-[12px] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[.06] transition-colors"
                    >
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: t.color }} />
                      {t.label}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Move to previous stage */}
          {moveBackTargets.length > 0 && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); setShowMoveTo(v => !v); setShowAssign(false); setShowAdvanceTo(false) }}
                className="flex items-center justify-between w-full px-3 py-1.5 text-[12px] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[.06] transition-colors"
              >
                <span className="flex items-center gap-2"><ChevronDown size={12} className="rotate-90" /> Move back…</span>
                <ChevronDown size={11} className={cn('text-slate-400 transition-transform duration-150', showMoveTo && 'rotate-180')} />
              </button>
              {showMoveTo && (
                <div className="border-t border-black/[.04] dark:border-white/[.06] max-h-[200px] overflow-y-auto">
                  {moveBackTargets.map(t => (
                    <button
                      key={t.id}
                      onClick={(e) => { e.stopPropagation(); setOpen(false); onMoveTo(t.dbStage) }}
                      className="flex items-center gap-2 w-full px-3 py-1.5 text-[12px] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[.06] transition-colors"
                    >
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: t.color }} />
                      {t.label}
                    </button>
                  ))}
                </div>
              )}
            </>
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
  onAdvanceTo,
  onMoveTo,
  onAssign,
  isSales,
  users,
  isAdvancing,
}: {
  deal: ApiDeal
  colColor: string
  brandName: string
  onClick: () => void
  onDelete?: () => void
  onAdvance?: () => void
  onAdvanceTo?: (stage: string) => void
  onMoveTo?: (stage: string) => void
  onAssign?: (id: string, name: string) => void
  isSales?: boolean
  users?: ApiUser[]
  isAdvancing?: boolean
}) {
  const isWon = deal.stage === 'closed_won'
  const isLost = deal.stage === 'closed_lost'
  const outreach = deal.outreachCategory || 'outbound'
  const services = deal.servicesTags || []
  // Resolve UUID to display name — deal.assignedTo stores a user ID from the API
  const resolvedAm = users?.find(u => u.id === deal.assignedTo)
  // Kanban card: prefer nickname → firstName → first word of name → email prefix
  const amShortName = resolvedAm
    ? (resolvedAm.nickname ?? resolvedAm.firstName ?? resolvedAm.name?.split(' ')[0] ?? resolvedAm.email?.split('@')[0] ?? '?')
    : (deal.assignedTo ? '?' : '—')
  const amName = resolvedAm?.name ?? resolvedAm?.email ?? deal.assignedTo ?? 'Unassigned'

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
          {onDelete !== undefined && onAdvance !== undefined && onAssign !== undefined && onAdvanceTo !== undefined && onMoveTo !== undefined && (
            <CardActionsMenu
              deal={deal}
              currentStage={deal.stage}
              onOpen={onClick}
              onDelete={onDelete}
              onAdvance={onAdvance}
              onAdvanceTo={onAdvanceTo}
              onMoveTo={onMoveTo}
              onAssign={onAssign}
              isSales={isSales ?? false}
              users={users ?? []}
              isAdvancing={isAdvancing ?? false}
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
        {toPascalCase(deal.title)}
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

      {/* Value + AM + doc indicator */}
      <div className="flex items-center justify-between pt-2 border-t border-black/[.05] dark:border-white/[.08]">
        <span className="text-[15px] font-bold tabular-nums" style={{ color: colColor }}>
          {deal.value ? formatPeso(parseFloat(deal.value)) : '—'}
        </span>
        <div className="flex items-center gap-2">
          {(deal.documentCount ?? 0) > 0 && (
            <div
              className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-white/[.08]"
              title={`${deal.documentCount} resource${(deal.documentCount ?? 0) !== 1 ? 's' : ''} attached`}
            >
              <Paperclip size={10} className="text-slate-400 shrink-0" />
              <span className="text-[10px] font-medium text-slate-500 tabular-nums">
                {deal.documentCount}
              </span>
            </div>
          )}
          <div className="flex items-center gap-1">
            <Avatar name={amName} email={resolvedAm?.email ?? undefined} src={resolvedAm?.image ?? undefined} size={20} />
            <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400">{amShortName}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// --- DraggableDealCard —wraps DealCard without touching it ---
function DraggableDealCard({
  deal, colColor, brandName, onClick, onDelete, onAdvance, onAdvanceTo, onMoveTo, onAssign, isSales, users, isAdvancing,
}: {
  deal: ApiDeal
  colColor: string
  brandName: string
  onClick: () => void
  onDelete?: () => void
  onAdvance?: () => void
  onAdvanceTo?: (stage: string) => void
  onMoveTo?: (stage: string) => void
  onAssign?: (id: string, name: string) => void
  isSales?: boolean
  users?: ApiUser[]
  isAdvancing?: boolean
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
        onAdvanceTo={onAdvanceTo}
        onMoveTo={onMoveTo}
        onAssign={onAssign}
        isSales={isSales}
        users={users}
        isAdvancing={isAdvancing}
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

// --- Pipeline ---
export function Pipeline({ onOpenDeal }: PipelineProps) {
  const [activeDealId, setActiveDealId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [amFilter, setAmFilter] = useState<string | null>(null)
  const [amDropdownOpen, setAmDropdownOpen] = useState(false)
  const [deleteConfirmDealId, setDeleteConfirmDealId] = useState<string | null>(null)
  const [moveConfirm, setMoveConfirm] = useState<{ dealId: string; targetStage: string; dealTitle: string } | null>(null)
  const [advancingDealId, setAdvancingDealId] = useState<string | null>(null)
  const [showCreateDeal, setShowCreateDeal] = useState(false)
  const [showCreateBrand, setShowCreateBrand] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const amDropdownRef = useRef<HTMLDivElement>(null)
  const queryClient = useQueryClient()
  const searchParams = useSearchParams()
  const router = useRouter()
  const scrolledRef = useRef(false)
  const { isSales } = useUser()

  const { data: deals = [], isLoading } = useGetDeals()
  const { data: companies = [] } = useGetCompanies()
  const { data: users = [] } = useGetUsers()

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

  // amOptions: unique AMs across all deals, UUIDs resolved to display names
  const amOptions = useMemo(() => {
    const ids = new Set<string>()
    for (const d of deals) {
      if (d.assignedTo) ids.add(d.assignedTo)
    }
    return Array.from(ids)
      .map(id => {
        const user = users.find(u => u.id === id)
        return { id, label: user?.name ?? user?.email ?? id }
      })
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [deals, users])

  const filteredDeals = useMemo(() => {
    let result = deals
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(d => {
        const amLabel = amOptions.find(o => o.id === d.assignedTo)?.label ?? ''
        return (
          d.title.toLowerCase().includes(q) ||
          d.stage.toLowerCase().includes(q) ||
          (d.servicesTags ?? []).some(s => s.toLowerCase().includes(q)) ||
          amLabel.toLowerCase().includes(q) ||
          (companyMap.get(d.companyId) || '').toLowerCase().includes(q)
        )
      })
    }
    if (amFilter) {
      result = result.filter(d => d.assignedTo === amFilter)
    }
    return result
  }, [deals, search, amFilter, amOptions, companyMap])

  const handleDeleteDeal = useCallback((dealId: string) => {
    setDeleteConfirmDealId(dealId)
  }, [])

  const confirmDelete = useCallback(() => {
    if (!deleteConfirmDealId) return
    deleteDeal.mutate(deleteConfirmDealId, {
      onSettled: () => {
        setDeleteConfirmDealId(null)
        queryClient.invalidateQueries({ queryKey: queryKeys.deals.all })
      },
    })
  }, [deleteConfirmDealId, deleteDeal, queryClient])

  /** Advance to the immediate next stage (no confirmation, spinner in menu) */
  const handleAdvanceDeal = useCallback((dealId: string, currentStage: string) => {
    const nextStage = STAGE_ADVANCE_MAP[currentStage]
    if (!nextStage) return
    setAdvancingDealId(dealId)
    const previousDeals = queryClient.getQueryData<ApiDeal[]>(queryKeys.deals.all)
    queryClient.setQueryData<ApiDeal[]>(queryKeys.deals.all, old =>
      old?.map(d => d.id === dealId ? { ...d, stage: nextStage } : d) ?? []
    )
    patchStage.mutate({ id: dealId, stage: nextStage }, {
      onError: () => queryClient.setQueryData(queryKeys.deals.all, previousDeals),
      onSettled: () => {
        setAdvancingDealId(null)
        queryClient.invalidateQueries({ queryKey: queryKeys.deals.all })
      },
    })
  }, [patchStage, queryClient])

  /**
   * Advance to a specific forward stage.
   * All intermediate stages are applied sequentially so activity logs stay correct.
   */
  const handleAdvanceTo = useCallback(async (dealId: string, targetStage: string) => {
    const deal = deals.find(d => d.id === dealId)
    if (!deal) return
    setAdvancingDealId(dealId)
    // Build the chain of intermediate stages
    const stages: string[] = []
    let current = deal.stage
    while (current && current !== targetStage) {
      const next = STAGE_ADVANCE_MAP[current]
      if (!next) break
      stages.push(next)
      current = next
    }
    // If the target wasn't reached through the chain, just jump directly
    if (stages[stages.length - 1] !== targetStage) {
      stages.push(targetStage)
    }
    // Optimistic UI: jump to target
    const previousDeals = queryClient.getQueryData<ApiDeal[]>(queryKeys.deals.all)
    queryClient.setQueryData<ApiDeal[]>(queryKeys.deals.all, old =>
      old?.map(d => d.id === dealId ? { ...d, stage: targetStage } : d) ?? []
    )
    try {
      // Apply each intermediate stage sequentially
      for (const stage of stages) {
        await new Promise<void>((resolve, reject) => {
          patchStage.mutate({ id: dealId, stage }, {
            onSuccess: () => resolve(),
            onError: (err) => reject(err),
          })
        })
      }
    } catch {
      queryClient.setQueryData(queryKeys.deals.all, previousDeals)
    } finally {
      setAdvancingDealId(null)
      queryClient.invalidateQueries({ queryKey: queryKeys.deals.all })
    }
  }, [deals, patchStage, queryClient])

  /** Move deal back to a previous stage — shows confirmation modal */
  const handleMoveTo = useCallback((dealId: string, targetStage: string) => {
    const deal = deals.find(d => d.id === dealId)
    if (!deal) return
    setMoveConfirm({ dealId, targetStage, dealTitle: deal.title })
  }, [deals])

  const confirmMove = useCallback(() => {
    if (!moveConfirm) return
    const { dealId, targetStage } = moveConfirm
    const previousDeals = queryClient.getQueryData<ApiDeal[]>(queryKeys.deals.all)
    queryClient.setQueryData<ApiDeal[]>(queryKeys.deals.all, old =>
      old?.map(d => d.id === dealId ? { ...d, stage: targetStage } : d) ?? []
    )
    patchStage.mutate({ id: dealId, stage: targetStage }, {
      onError: () => queryClient.setQueryData(queryKeys.deals.all, previousDeals),
      onSettled: () => {
        setMoveConfirm(null)
        queryClient.invalidateQueries({ queryKey: queryKeys.deals.all })
      },
    })
  }, [moveConfirm, patchStage, queryClient])

  const handleAssignDeal = useCallback((dealId: string, userId: string, displayName: string) => {
    const previousDeals = queryClient.getQueryData<ApiDeal[]>(queryKeys.deals.all)
    // Optimistic update: show display name immediately in the UI
    queryClient.setQueryData<ApiDeal[]>(queryKeys.deals.all, old =>
      old?.map(d => d.id === dealId ? { ...d, assignedTo: displayName } : d) ?? []
    )
    // Send the actual user UUID to the API (FK constraint requires UUID)
    updateDeal.mutate({ id: dealId, data: { assignedTo: userId } }, {
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

  const activeDeals = filteredDeals.filter(d => !CLOSED_STAGE_IDS.has(d.stage))
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
    // Backward drag → show confirmation modal instead of direct move
    if (targetOrder < currentOrder) {
      setMoveConfirm({ dealId: deal.id, targetStage, dealTitle: deal.title })
      return
    }
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
      {/* Modals */}
      {showCreateDeal && (
        <CreateDealModal
          companies={companies}
          onClose={() => setShowCreateDeal(false)}
          onCreated={() => {
            queryClient.invalidateQueries({ queryKey: queryKeys.deals.all })
            setShowCreateDeal(false)
          }}
        />
      )}
      {showCreateBrand && (
        <CreateBrandModal
          onClose={() => setShowCreateBrand(false)}
          onCreated={() => {
            queryClient.invalidateQueries({ queryKey: queryKeys.companies.all })
            setShowCreateBrand(false)
          }}
        />
      )}

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

          {/* New Deal / New Brand (sales only) */}
          {isSales && (
            <>
              <button
                onClick={() => setShowCreateBrand(true)}
                className="bg-white dark:bg-[#1e1e21] border border-black/[.08] dark:border-white/[.08] rounded-lg px-3 py-[5px] text-[12px] font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[.04] transition-colors flex items-center gap-1.5"
              >
                + New Brand
              </button>
              <button
                onClick={() => setShowCreateDeal(true)}
                className="rounded-lg px-3 py-[5px] text-[12px] font-medium text-white transition-colors flex items-center gap-1.5"
                style={{ background: 'linear-gradient(135deg, var(--primary), var(--color-primary-accent))' }}
              >
                + New Deal
              </button>
            </>
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
              {amFilter ? (amOptions.find(o => o.id === amFilter)?.label ?? 'AM') : 'All AMs'}
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
                {amOptions.map(o => (
                  <button
                    key={o.id}
                    onClick={() => { setAmFilter(o.id); setAmDropdownOpen(false) }}
                    className={cn(
                      'w-full px-3 py-1.5 text-[12px] text-left hover:bg-slate-50 dark:hover:bg-white/[.06] transition-colors',
                      amFilter === o.id ? 'font-semibold text-primary' : 'text-slate-700 dark:text-slate-300'
                    )}
                  >
                    {o.label}
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
                      {totalValue > 0 && col.total > 0 && !CLOSED_STAGE_IDS.has(col.id) && (
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
                          onAdvanceTo={(stage) => handleAdvanceTo(d.id, stage)}
                          onMoveTo={(stage) => handleMoveTo(d.id, stage)}
                          onAssign={(id, name) => handleAssignDeal(d.id, id, name)}
                          isSales={isSales}
                          isAdvancing={advancingDealId === d.id}
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

      {/* Delete confirmation modal */}
      {deleteConfirmDealId && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/30 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full sm:w-[420px] bg-white dark:bg-[#1e1e21] rounded-lg shadow-xl p-4 animate-in slide-in-from-bottom duration-150">
            <h2 className="text-[14px] font-semibold text-slate-900 dark:text-white mb-1">Delete deal?</h2>
            <p className="text-[12px] text-slate-600 dark:text-slate-400 mb-4">This action cannot be undone. The deal will be permanently removed from your pipeline.</p>
            <div className="flex items-center gap-2 justify-end">
              <button
                onClick={() => setDeleteConfirmDealId(null)}
                className="px-3.5 py-1.5 text-[12px] font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[.06] rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleteDeal.isPending}
                className="px-3.5 py-1.5 text-[12px] font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-60 rounded-lg transition-colors active:scale-[0.98]"
              >
                {deleteDeal.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Move-back confirmation modal */}
      {moveConfirm && (() => {
        const targetCol = KANBAN_STAGES.find(c => c.matches.includes(moveConfirm.targetStage))
        return (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/30 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="w-full sm:w-[420px] bg-white dark:bg-[#1e1e21] rounded-lg shadow-xl p-4 animate-in slide-in-from-bottom duration-150">
              <h2 className="text-[14px] font-semibold text-slate-900 dark:text-white mb-1">Move deal back?</h2>
              <p className="text-[12px] text-slate-600 dark:text-slate-400 mb-4">
                Moving <span className="font-semibold text-slate-900 dark:text-white">{moveConfirm.dealTitle}</span> to{' '}
                <span className="font-semibold" style={{ color: targetCol?.color }}>
                  {targetCol?.label ?? moveConfirm.targetStage}
                </span>?
              </p>
              <div className="flex items-center gap-2 justify-end">
                <button
                  onClick={() => setMoveConfirm(null)}
                  className="px-3.5 py-1.5 text-[12px] font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[.06] rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmMove}
                  disabled={patchStage.isPending}
                  className="px-3.5 py-1.5 text-[12px] font-semibold text-white bg-primary hover:bg-primary/90 disabled:opacity-60 rounded-lg transition-colors active:scale-[0.98]"
                >
                  {patchStage.isPending ? 'Moving…' : 'Move'}
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
