'use client'

import { useState, useEffect, useRef, useMemo, useCallback, type ReactNode } from 'react'
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
import type { ColumnDef } from '@tanstack/react-table'
import { formatDistanceToNow } from 'date-fns'
import { useGetDeals, useGetCompanies, useGetUsers, useGetCatalogItems } from '@/lib/hooks/queries'
import { useSearchParams, useRouter } from 'next/navigation'
import { cn, formatServiceType, getAdvanceTargets, getMoveBackTargets } from '@/lib/utils'
import { formatDealMoney, formatCurrencyBreakdown, hasMultipleCurrencies, sumMoneyByCurrency } from '@/lib/currency'
import { formatDealName } from '@/lib/format-deal-name'
import type { ApiDeal, ApiCompany, ApiUser } from '@/lib/types'
import {
  KANBAN_STAGES, COLUMN_TO_STAGE, STAGE_ORDER,
  STAGE_ADVANCE_MAP, CLOSED_STAGE_IDS, STAGE_LABELS, STAGE_COLORS,
} from '@/lib/constants'
import { toast } from 'sonner'
import { Avatar } from './Avatar'
import { CreateDealModal } from './CreateDealModal'
import { CreateBrandModal } from './CreateBrandModal'
import { EditDealModal } from './EditDealModal'
import { queryKeys } from '@/lib/query-keys'
import { usePatchDealStage, useDeleteDeal, useUpdateDeal } from '@/lib/hooks/mutations'
import { useUser } from '@/lib/hooks/use-user'
import { useSearchHotkey } from '@/lib/hooks/use-search-hotkey'
import { SubTabFilter } from '@/components/ui/sub-tab-filter'
import { SearchInput } from '@/components/ui/search-input'
import { DataTable, SortableHeader } from '@/components/ui/data-table'
import { StagePill } from '@/components/StagePill'
import { usePipelineViewStore } from '@/lib/stores/pipeline-view-store'
import { DealHeatmap } from '@/components/pipeline/DealHeatmap'
import {
  MoreHorizontal, Search, Trash2, ExternalLink,
  ChevronDown, ChevronRight, User as UserIcon, Paperclip,
  Pencil, ArrowRight, ArrowLeft, LayoutGrid, List, Flame,
} from 'lucide-react'

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
    { description: `${formatDealName(dealTitle)} updated` },
  )
}

type SubTab = { id: string; name: string; count: number }

type DealAssignee = {
  id: string
  displayName: string
  shortName: string
  email?: string
  image?: string | null
}

type PipelineProps = {
  onOpenDeal: (id: string) => void
  /** Catalog parent category for the new tabbed pipeline. Undefined = All tab (no filter). */
  catalogProductType?: 'internal' | 'service' | 'reseller' | 'partnership'
  /** Drill into a specific catalog row within the active product_type. */
  catalogItemId?: string
  /** Catalog parent tabs rendered on the left of the desktop action row. */
  parentTabs?: ReactNode
  /** Catalog-item sub-tabs to render alongside the action buttons. Empty/undefined hides the row. */
  subTabs?: SubTab[]
  /** Active sub-tab id; null = "All" within the parent category. */
  activeSubTabId?: string | null
  /** Fired when user picks a sub-tab. Null = clear filter to All. */
  onSubTabChange?: (id: string | null) => void
}

function getUserLabel(user: ApiUser | undefined, fallback: string) {
  return user?.name ?? user?.email ?? fallback
}

function getUserShortName(user: ApiUser | undefined, fallback: string) {
  return user?.nickname ?? user?.firstName ?? user?.name?.split(' ')[0] ?? user?.email?.split('@')[0] ?? fallback
}

function getDealAssigneeIds(deal: ApiDeal): string[] {
  const ids = [deal.assignedTo, deal.subAccountManagerId].filter(Boolean) as string[]
  return Array.from(new Set(ids))
}

function getDealAssignees(deal: ApiDeal, users: ApiUser[] = []): DealAssignee[] {
  return getDealAssigneeIds(deal).map(id => {
    const user = users.find(u => u.id === id)
    return {
      id,
      displayName: getUserLabel(user, id),
      shortName: getUserShortName(user, id === deal.assignedTo ? '?' : id),
      email: user?.email,
      image: user?.image,
    }
  })
}

function getDealAssigneeSearchText(deal: ApiDeal, users: ApiUser[] = []) {
  return getDealAssigneeIds(deal)
    .flatMap(id => {
      const user = users.find(u => u.id === id)
      return [id, user?.name, user?.email, user?.firstName, user?.lastName, user?.nickname]
    })
    .filter(Boolean)
    .join(' ')
}

function formatRecentActivity(deal: ApiDeal) {
  const value = deal.lastActivityAt ?? deal.updatedAt ?? deal.createdAt
  if (!value) return 'No activity yet'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'No activity yet'
  return formatDistanceToNow(date, { addSuffix: true })
}

function getRecentActivityTime(deal: ApiDeal) {
  const value = deal.lastActivityAt ?? deal.updatedAt ?? deal.createdAt
  if (!value) return 0
  const time = new Date(value).getTime()
  return Number.isNaN(time) ? 0 : time
}

function AssigneeStack({ assignees, cardBgVar = 'var(--kanban-card)' }: { assignees: DealAssignee[]; cardBgVar?: string }) {
  if (!assignees.length) {
    return <span className="text-xxs font-medium text-muted-foreground">Unassigned</span>
  }

  const visible = assignees.slice(0, 3)
  const label = assignees.map(assignee => assignee.shortName).join(', ')

  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <div className="flex shrink-0 -space-x-1.5">
        {visible.map(assignee => (
          <div
            key={assignee.id}
            className="rounded-full ring-2"
            style={{ ['--tw-ring-color' as string]: cardBgVar }}
            title={assignee.displayName}
          >
            <Avatar name={assignee.displayName} email={assignee.email} src={assignee.image ?? undefined} size={20} />
          </div>
        ))}
      </div>
      <span className="min-w-0 truncate text-xxs font-medium text-muted-foreground" title={assignees.map(assignee => assignee.displayName).join(', ')}>
        {label}
      </span>
    </div>
  )
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

// --- PipelineSubTabButton ---
// Small pill button used for the catalog-item sub-filter row that sits to
// the left of the desktop action strip. Active = bg-primary/10 + text-primary
// (matches the main-tab count badge), inactive = outlined white pill.
function PipelineSubTabButton({
  active,
  onClick,
  count,
  children,
}: {
  active: boolean
  onClick: () => void
  count?: number
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'rounded-md px-2.5 py-1 text-xxs font-medium transition-colors inline-flex items-center gap-1.5 active:scale-[0.98] shrink-0',
        active
          ? 'bg-primary/10 text-primary'
          : 'bg-card border border-border text-muted-foreground hover:bg-surface-hover',
      )}
    >
      {children}
      {count !== undefined && (
        <span className={cn('tabular-nums', active ? 'text-primary/70' : 'text-slate-400')}>
          {count}
        </span>
      )}
    </button>
  )
}

// --- CardActionsMenu ---
function CardActionsMenu({
  deal,
  currentStage,
  onDelete,
  onAdvance,
  onAdvanceTo,
  onMoveTo,
  onAssign,
  onEdit,
  isSales,
  users,
  isAdvancing,
}: {
  deal: ApiDeal
  currentStage: string
  onDelete: () => void
  onAdvance: () => void
  onAdvanceTo: (stage: string) => void
  onMoveTo: (stage: string) => void
  onAssign: (id: string, name: string) => void
  onEdit: () => void
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
        className="w-10 h-10 sm:w-6 sm:h-6 rounded-md flex items-center justify-center text-text-faint transition-colors hover:bg-surface-hover hover:text-foreground"
      >
        <MoreHorizontal size={14} />
      </button>
      {open && (
        <div data-search-escape-blocker="true" className="absolute right-0 top-7 z-50 min-w-[180px] bg-card border border-border rounded-lg shadow-lg py-1 animate-in fade-in-0 zoom-in-95 duration-100">
          {/* Assign, locked for won/lost deals */}
          {isSales && isTerminal ? (
            <div
              className="flex items-center justify-between w-full px-3 py-1.5 text-ssm text-text-faint cursor-not-allowed select-none"
              title="Cannot reassign AM — deal is won/lost"
            >
              <span className="flex items-center gap-2">
                <UserIcon size={14} /> Assign
              </span>
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-faint">
                <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            </div>
          ) : isSales ? (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); setShowAssign(v => !v); setShowAdvanceTo(false); setShowMoveTo(false) }}
                className="flex items-center justify-between w-full px-3 py-1.5 text-ssm text-muted-foreground hover:bg-surface-hover transition-colors"
              >
                <span className="flex items-center gap-2"><UserIcon size={14} /> Assign</span>
                <ChevronRight size={12} className={cn('text-slate-400 transition-transform duration-150', showAssign && 'rotate-90')} />
              </button>
              {showAssign && (
                <div className="border-t border-border max-h-[144px] overflow-y-auto">
                  {users.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-slate-400 italic">No team members</div>
                  ) : (
                    users.map(u => (
                      <button
                        key={u.id}
                        onClick={(e) => { e.stopPropagation(); setOpen(false); setShowAssign(false); onAssign(u.id, u.name || u.email) }}
                        className="flex items-center gap-2 w-full px-3 py-1.5 text-ssm text-muted-foreground hover:bg-surface-hover transition-colors"
                      >
                        <Avatar name={u.name || u.email} src={u.image ?? undefined} size={18} />
                        {u.name || u.email}
                      </button>
                    ))
                  )}
                </div>
              )}
            </>
          ) : null}

          {/* Advance (next stage, no confirmation, shows spinner) */}
          {isSales && canAdvance && (
            <button
              onClick={(e) => { e.stopPropagation(); onAdvance() }}
              disabled={isAdvancing}
              className="flex items-center gap-2 w-full px-3 py-1.5 text-ssm text-muted-foreground hover:bg-surface-hover transition-colors disabled:opacity-50"
            >
              {isAdvancing ? <Spinner size={14} /> : <ChevronRight size={14} />}
              {isAdvancing ? 'Advancing…' : 'Advance'}
            </button>
          )}

          {/* Advance to... (choose target stage) */}
          {isSales && advanceTargets.length > 1 && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); setShowAdvanceTo(v => !v); setShowAssign(false); setShowMoveTo(false) }}
                className="flex items-center justify-between w-full px-3 py-1.5 text-ssm text-muted-foreground hover:bg-surface-hover transition-colors"
              >
                <span className="flex items-center gap-2"><ChevronRight size={14} /> Advance to…</span>
                <ChevronDown size={12} className={cn('text-slate-400 transition-transform duration-150', showAdvanceTo && 'rotate-180')} />
              </button>
              {showAdvanceTo && (
                <div className="border-t border-border max-h-[200px] overflow-y-auto">
                  {advanceTargets.map(t => (
                    <button
                      key={t.id}
                      onClick={(e) => { e.stopPropagation(); setOpen(false); onAdvanceTo(t.dbStage) }}
                      className="flex items-center gap-2 w-full px-3 py-1.5 text-ssm text-muted-foreground hover:bg-surface-hover transition-colors"
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
          {isSales && moveBackTargets.length > 0 && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); setShowMoveTo(v => !v); setShowAssign(false); setShowAdvanceTo(false) }}
                className="flex items-center justify-between w-full px-3 py-1.5 text-ssm text-muted-foreground hover:bg-surface-hover transition-colors"
              >
                <span className="flex items-center gap-2"><ChevronDown size={14} className="rotate-90" /> Move back…</span>
                <ChevronDown size={12} className={cn('text-slate-400 transition-transform duration-150', showMoveTo && 'rotate-180')} />
              </button>
              {showMoveTo && (
                <div className="border-t border-border max-h-[200px] overflow-y-auto">
                  {moveBackTargets.map(t => (
                    <button
                      key={t.id}
                      onClick={(e) => { e.stopPropagation(); setOpen(false); onMoveTo(t.dbStage) }}
                      className="flex items-center gap-2 w-full px-3 py-1.5 text-ssm text-muted-foreground hover:bg-surface-hover transition-colors"
                    >
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: t.color }} />
                      {t.label}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Edit deal */}
          {isSales && (
            <button
              onClick={(e) => { e.stopPropagation(); setOpen(false); onEdit() }}
              className="flex items-center gap-2 w-full px-3 py-1.5 text-ssm text-muted-foreground hover:bg-surface-hover transition-colors"
            >
              <Pencil size={14} /> Edit deal
            </button>
          )}

          {/* Delete */}
          {isSales && (
            <button
              onClick={(e) => { e.stopPropagation(); setOpen(false); onDelete() }}
              className="flex items-center gap-2 w-full px-3 py-1.5 text-ssm text-danger-foreground transition-colors hover:bg-danger-dim"
            >
              <Trash2 size={14} /> Delete
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
  productIconUrl,
  productLoading,
  onClick,
  onDelete,
  onAdvance,
  onAdvanceTo,
  onMoveTo,
  onAssign,
  onEdit,
  isSales,
  users,
  isAdvancing,
}: {
  deal: ApiDeal
  colColor: string
  brandName: string
  productIconUrl?: string | null
  productLoading?: boolean
  onClick: () => void
  onDelete?: () => void
  onAdvance?: () => void
  onAdvanceTo?: (stage: string) => void
  onMoveTo?: (stage: string) => void
  onAssign?: (id: string, name: string) => void
  onEdit?: () => void
  isSales?: boolean
  users?: ApiUser[]
  isAdvancing?: boolean
}) {
  const isWon = deal.stage === 'closed_won'
  const isLost = deal.stage === 'closed_lost'
  const outreach = deal.outreachCategory || 'outbound'
  const allServices = deal.servicesTags || []
  // Internal-products is rendered separately (icon or name fallback) so it doesn't
  // double up as a generic service pill alongside the product reference.
  const hasCatalogItem = allServices.includes('internal_products') && !!deal.catalogItemName
  const services = allServices.filter(s => s !== 'internal_products')
  const assignees = getDealAssignees(deal, users ?? [])

  return (
    <div
      onClick={onClick}
      className={cn(
        'group rounded-control border p-2.5 cursor-pointer shadow-[var(--shadow-card)] transition-[background-color,border-color,box-shadow] duration-100 hover:bg-[var(--kanban-card-hover)] hover:border-[var(--kanban-card-hover-border)] hover:ring-1 hover:ring-[var(--kanban-card-hover-ring)] hover:shadow-[var(--shadow-md)]',
        isWon
          ? 'border-success/20 bg-[var(--kanban-card)]'
          : isLost
          ? 'border-danger/20 bg-[var(--kanban-card)] opacity-70'
          : 'border-border bg-[var(--kanban-card)]'
      )}
    >
      {/* Brand name + outreach badge + actions */}
      <div className="flex items-center justify-between">
        <span className="eyebrow-label truncate max-w-[120px]">
          {brandName}
        </span>
        <div className="flex items-center gap-1">
          {isSales && onDelete !== undefined && onAdvance !== undefined && onAssign !== undefined && onAdvanceTo !== undefined && onMoveTo !== undefined && onEdit !== undefined && (
            <CardActionsMenu
              deal={deal}
              currentStage={deal.stage}
              onDelete={onDelete}
              onAdvance={onAdvance}
              onAdvanceTo={onAdvanceTo}
              onMoveTo={onMoveTo}
              onAssign={onAssign}
              onEdit={onEdit}
              isSales={isSales ?? false}
              users={users ?? []}
              isAdvancing={isAdvancing ?? false}
            />
          )}
          <span className={cn(
            'text-atom font-semibold px-1.5 py-px rounded-full leading-tight',
            outreach === 'inbound'
              ? 'bg-[rgba(22,163,74,0.1)] text-[#16a34a]'
              : 'bg-secondary text-slate-500'
          )}>
            {outreach === 'inbound' ? 'Inbound' : 'Outbound'}
          </span>
        </div>
      </div>

      {/* Deal title */}
      <div className="text-xs font-medium text-foreground leading-snug mb-2.5">
        {formatDealName(deal.title)}
      </div>

      {/* Services tags + catalog-item reference (icon, skeleton while loading, name fallback) */}
      {(services.length > 0 || hasCatalogItem) && (
        <div className="flex flex-wrap gap-1.5 mb-2.5 items-center">
          {hasCatalogItem && (
            productLoading ? (
              <span
                className="rounded-sm bg-skeleton animate-pulse shrink-0"
                style={{ width: 18, height: 18 }}
                aria-label="Loading product icon"
              />
            ) : productIconUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={productIconUrl}
                alt={deal.catalogItemName ?? ''}
                title={deal.catalogItemName ?? ''}
                width={18}
                height={18}
                className="rounded-sm object-contain shrink-0"
                style={{ width: 18, height: 18 }}
              />
            ) : (
              <span className="text-atom font-semibold px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-500">
                {deal.catalogItemName}
              </span>
            )
          )}
          {services.slice(0, 3).map(s => (
            <span
              key={s}
              className="text-atom font-medium px-2 py-0.5 rounded-full"
              style={{ background: `${colColor}18`, color: colColor }}
            >
              {formatServiceType(s)}
            </span>
          ))}
          {services.length > 3 && (
            <span className="text-atom text-slate-400">+{services.length - 3}</span>
          )}
        </div>
      )}

      {/* Value + AM + doc indicator */}
      <div className="flex items-center justify-between pt-2 border-t border-border">
        <span className="text-[11.5px] font-bold tabular-nums text-muted-foreground">
          {formatDealMoney(deal)}
        </span>
        <div className="flex items-center gap-2">
          {(deal.documentCount ?? 0) > 0 && (
            <div
              className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-secondary"
              title={`${deal.documentCount} resource${(deal.documentCount ?? 0) !== 1 ? 's' : ''} attached`}
            >
              <Paperclip size={10} className="text-slate-400 shrink-0" />
              <span className="text-atom font-medium text-slate-500 tabular-nums">
                {deal.documentCount}
              </span>
            </div>
          )}
          <AssigneeStack assignees={assignees} />
        </div>
      </div>
    </div>
  )
}

// --- DraggableDealCard —wraps DealCard without touching it ---
function DraggableDealCard({
  deal, colColor, brandName, productIconUrl, productLoading, onClick, onDelete, onAdvance, onAdvanceTo, onMoveTo, onAssign, onEdit, isSales, users, isAdvancing,
}: {
  deal: ApiDeal
  colColor: string
  brandName: string
  productIconUrl?: string | null
  productLoading?: boolean
  onClick: () => void
  onDelete?: () => void
  onAdvance?: () => void
  onAdvanceTo?: (stage: string) => void
  onMoveTo?: (stage: string) => void
  onAssign?: (id: string, name: string) => void
  onEdit?: () => void
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
        productIconUrl={productIconUrl}
        productLoading={productLoading}
        onClick={onClick}
        onDelete={onDelete}
        onAdvance={onAdvance}
        onAdvanceTo={onAdvanceTo}
        onMoveTo={onMoveTo}
        onAssign={onAssign}
        onEdit={onEdit}
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
        'w-[268px] shrink-0 flex flex-col overflow-hidden rounded-lg bg-bg-subtle transition-all duration-150 self-stretch',
        isOver ? 'border-2 border-dashed' : 'border border-border',
      )}
      style={isOver ? { borderColor: col.color } : undefined}
    >
      {children}
    </div>
  )
}

// --- MobileActionSheet ---
function MobileActionSheet({
  deal,
  brandName,
  onClose,
  onDelete,
  onAdvanceTo,
  onMoveTo,
  onAssign,
  onEdit,
  onViewDeal,
  isSales,
  users,
  showAdvance,
  setShowAdvance,
  showMoveBack,
  setShowMoveBack,
  showAssign,
  setShowAssign,
}: {
  deal: ApiDeal
  brandName: string
  onClose: () => void
  onDelete: () => void
  onAdvanceTo: (stage: string) => void
  onMoveTo: (stage: string) => void
  onAssign: (id: string, name: string) => void
  onEdit: () => void
  onViewDeal: () => void
  isSales: boolean
  users: ApiUser[]
  showAdvance: boolean
  setShowAdvance: (v: boolean) => void
  showMoveBack: boolean
  setShowMoveBack: (v: boolean) => void
  showAssign: boolean
  setShowAssign: (v: boolean) => void
}) {
  const isTerminal = deal.stage === 'closed_won' || deal.stage === 'closed_lost'
  const advanceTargets = getAdvanceTargets(deal.stage)
  const moveBackTargets = getMoveBackTargets(deal.stage)

  return (
    <div className="fixed inset-0 z-50 md:hidden" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 animate-in fade-in-0 duration-200" />
      <div
        className="absolute bottom-0 left-0 right-0 bg-card rounded-t-xl max-h-[70vh] overflow-y-auto animate-in slide-in-from-bottom duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Context label */}
        <div className="px-4 pt-4 pb-3 border-b border-border">
          <p className="eyebrow-label">{brandName}</p>
          <p className="text-sm font-semibold text-foreground mt-0.5">{formatDealName(deal.title)}</p>
        </div>

        {/* Actions */}
        <div>
          {/* Assign */}
          {isSales && !isTerminal && (
            <>
              <button
                onClick={() => { setShowAssign(!showAssign); setShowAdvance(false); setShowMoveBack(false) }}
                className="flex items-center justify-between w-full py-3.5 px-4 text-sm text-muted-foreground border-b border-border active:bg-surface-hover"
              >
                <span className="flex items-center gap-3"><UserIcon size={16} /> Assign</span>
                <ChevronRight size={14} className={cn('text-slate-400 transition-transform duration-150', showAssign && 'rotate-90')} />
              </button>
              {showAssign && (
                <div className="border-b border-border bg-surface-alt">
                  {users.length === 0 ? (
                    <div className="px-4 py-3 text-xs text-slate-400">No team members</div>
                  ) : (
                    users.map(u => (
                      <button
                        key={u.id}
                        onClick={() => { onAssign(u.id, u.name || u.email); onClose() }}
                        className="flex items-center gap-3 w-full py-2.5 px-6 text-sm text-muted-foreground active:bg-surface-hover"
                      >
                        <Avatar name={u.name || u.email} src={u.image ?? undefined} size={22} />
                        {u.name || u.email}
                      </button>
                    ))
                  )}
                </div>
              )}
            </>
          )}

          {/* Advance to... */}
          {isSales && advanceTargets.length > 0 && (
            <>
              <button
                onClick={() => { setShowAdvance(!showAdvance); setShowMoveBack(false); setShowAssign(false) }}
                className="flex items-center justify-between w-full py-3.5 px-4 text-sm text-muted-foreground border-b border-border active:bg-surface-hover"
              >
                <span className="flex items-center gap-3"><ArrowRight size={16} /> Advance to...</span>
                <ChevronDown size={14} className={cn('text-slate-400 transition-transform duration-150', showAdvance && 'rotate-180')} />
              </button>
              {showAdvance && (
                <div className="border-b border-border bg-surface-alt">
                  {advanceTargets.map(t => (
                    <button
                      key={t.id}
                      onClick={() => { onAdvanceTo(t.dbStage); onClose() }}
                      className="flex items-center gap-3 w-full py-2.5 px-6 text-sm text-muted-foreground active:bg-surface-hover"
                    >
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: t.color }} />
                      {t.label}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Move back... */}
          {isSales && moveBackTargets.length > 0 && (
            <>
              <button
                onClick={() => { setShowMoveBack(!showMoveBack); setShowAdvance(false); setShowAssign(false) }}
                className="flex items-center justify-between w-full py-3.5 px-4 text-sm text-muted-foreground border-b border-border active:bg-surface-hover"
              >
                <span className="flex items-center gap-3"><ArrowLeft size={16} /> Move back...</span>
                <ChevronDown size={14} className={cn('text-slate-400 transition-transform duration-150', showMoveBack && 'rotate-180')} />
              </button>
              {showMoveBack && (
                <div className="border-b border-border bg-surface-alt">
                  {moveBackTargets.map(t => (
                    <button
                      key={t.id}
                      onClick={() => { onMoveTo(t.dbStage); onClose() }}
                      className="flex items-center gap-3 w-full py-2.5 px-6 text-sm text-muted-foreground active:bg-surface-hover"
                    >
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: t.color }} />
                      {t.label}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          {/* View deal */}
          <button
            onClick={() => { onViewDeal(); onClose() }}
            className="flex items-center gap-3 w-full py-3.5 px-4 text-sm text-muted-foreground border-b border-border active:bg-surface-hover"
          >
            <ExternalLink size={16} /> View deal
          </button>

          {/* Edit deal */}
          {isSales && (
            <button
              onClick={() => { onEdit(); onClose() }}
              className="flex items-center gap-3 w-full py-3.5 px-4 text-sm text-muted-foreground border-b border-border active:bg-surface-hover"
            >
              <Pencil size={16} /> Edit deal
            </button>
          )}

          {/* Delete */}
          {isSales && (
            <button
              onClick={() => { onDelete(); onClose() }}
              className="flex items-center gap-3 w-full py-3.5 px-4 text-sm text-danger-foreground border-b border-border active:bg-danger-dim"
            >
              <Trash2 size={16} /> Delete
            </button>
          )}
        </div>

        {/* Bottom safe area */}
        <div className="h-6" />
      </div>
    </div>
  )
}

// --- Pipeline ---
export function Pipeline({
  onOpenDeal,
  catalogProductType,
  catalogItemId,
  parentTabs,
  subTabs,
  activeSubTabId,
  onSubTabChange,
}: PipelineProps) {
  const [activeDealId, setActiveDealId] = useState<string | null>(null)
  const viewMode = usePipelineViewStore(state => state.viewMode)
  const setViewMode = usePipelineViewStore(state => state.setViewMode)
  const search = usePipelineViewStore(state => state.search)
  const setSearch = usePipelineViewStore(state => state.setSearch)
  const amFilter = usePipelineViewStore(state => state.assigneeFilterUserId)
  const setAmFilter = usePipelineViewStore(state => state.setAssigneeFilterUserId)
  const defaultSearchForUser = usePipelineViewStore(state => state.defaultSearchForUser)
  const [searchOpen, setSearchOpen] = useState(false)
  const [amDropdownOpen, setAmDropdownOpen] = useState(false)
  const [deleteConfirmDealId, setDeleteConfirmDealId] = useState<string | null>(null)
  const [moveConfirm, setMoveConfirm] = useState<{ dealId: string; currentStage: string; targetStage: string; dealTitle: string } | null>(null)
  const [advancingDealId, setAdvancingDealId] = useState<string | null>(null)
  const [showCreateDeal, setShowCreateDeal] = useState(false)
  const [showCreateBrand, setShowCreateBrand] = useState(false)
  const [editingDeal, setEditingDeal] = useState<ApiDeal | null>(null)
  const [mobileStageFilter, setMobileStageFilter] = useState<string | null>(null)
  const [mobileActionDeal, setMobileActionDeal] = useState<ApiDeal | null>(null)
  const [mobileShowAdvance, setMobileShowAdvance] = useState(false)
  const [mobileShowMoveBack, setMobileShowMoveBack] = useState(false)
  const [mobileShowAssign, setMobileShowAssign] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const amDropdownRef = useRef<HTMLDivElement>(null)
  const defaultedSearchRef = useRef(false)
  const queryClient = useQueryClient()
  const searchParams = useSearchParams()
  const router = useRouter()
  const scrolledRef = useRef(false)
  const { isSales, userId, user } = useUser()

  const { data: allDeals = [], isLoading: dealsLoading } = useGetDeals()
  // Tab + sub-tab filters are purely client-side — one cached request, instant swaps.
  const deals = useMemo(() => {
    let result = allDeals
    if (catalogProductType) result = result.filter(d => d.catalogItemType === catalogProductType)
    if (catalogItemId) result = result.filter(d => d.catalogItemId === catalogItemId)
    return result
  }, [allDeals, catalogProductType, catalogItemId])
  const { data: companies = [], isLoading: companiesLoading } = useGetCompanies()
  const { data: users = [], isLoading: usersLoading } = useGetUsers()
  const { data: catalog = [], isLoading: catalogLoading } = useGetCatalogItems()
  // Pipeline renders as soon as deals/companies/users land. Catalog (the
  // product icon source) lazy-fills via a skeleton placeholder per card.
  const isLoading = dealsLoading || companiesLoading || usersLoading

  // slug -> display name map for matching service tags by their friendly label
  const catalogNameBySlug = useMemo(() => {
    const m = new Map<string, string>()
    for (const c of catalog) if (c.slug) m.set(c.slug, c.name)
    return m
  }, [catalog])
  const catalogNameById = useMemo(() => {
    const m = new Map<string, string>()
    for (const c of catalog) m.set(c.id, c.name)
    return m
  }, [catalog])
  const catalogIconById = useMemo(() => {
    const m = new Map<string, string | null>()
    for (const c of catalog) m.set(c.id, c.iconUrl ?? null)
    return m
  }, [catalog])

  const companyMap = useMemo(() => {
    const m = new Map<string, string>()
    for (const c of companies) m.set(c.id, c.name)
    return m
  }, [companies])

  const deleteDeal = useDeleteDeal()
  const patchStage = usePatchDealStage()
  const updateDeal = useUpdateDeal()

  const currentUserSearchLabel = useMemo(() => {
    if (!userId) return ''
    const matchingUser = users.find(u => u.id === userId)
    return getUserLabel(matchingUser, user?.name ?? user?.email ?? userId)
  }, [userId, user?.name, user?.email, users])

  useEffect(() => {
    if (!userId || !currentUserSearchLabel || defaultedSearchRef.current) return
    defaultedSearchRef.current = true
    defaultSearchForUser(userId, currentUserSearchLabel)
    setSearchOpen(true)
  }, [currentUserSearchLabel, defaultSearchForUser, userId])

  // Cmd/Ctrl+F opens the search panel + focuses; Escape closes + clears.
  // Panel mounts the input lazily, so we need a small focus delay.
  useSearchHotkey({
    inputRef: searchInputRef,
    onTrigger: () => setSearchOpen(true),
    onClear: search ? () => { setSearchOpen(false); setSearch('') } : undefined,
    focusDelay: 50,
  })

  // Close AM dropdown on outside click
  useEffect(() => {
    if (!amDropdownOpen) return
    function handleClick(e: MouseEvent) {
      if (amDropdownRef.current && !amDropdownRef.current.contains(e.target as Node)) setAmDropdownOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [amDropdownOpen])

  // amOptions: unique primary and sub-assigned AMs across all deals, UUIDs resolved to display names
  const amOptions = useMemo(() => {
    const ids = new Set<string>()
    if (userId) ids.add(userId)
    for (const d of deals) {
      for (const id of getDealAssigneeIds(d)) ids.add(id)
    }
    return Array.from(ids)
      .map(id => {
        const user = users.find(u => u.id === id)
        return { id, label: getUserLabel(user, id) }
      })
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [deals, userId, users])

  const filteredDeals = useMemo(() => {
    let result = deals
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(d => {
        const amLabel = getDealAssigneeSearchText(d, users)
        // Match against service-tag display names (slug → catalog row name)
        const tagDisplay = (d.servicesTags ?? []).map(s => catalogNameBySlug.get(s) ?? s)
        const productName = d.catalogItemId ? (catalogNameById.get(d.catalogItemId) ?? '') : ''
        return (
          (d.title ?? '').toLowerCase().includes(q) ||
          (d.stage ?? '').toLowerCase().includes(q) ||
          (d.servicesTags ?? []).some(s => s.toLowerCase().includes(q)) ||
          tagDisplay.some(name => name.toLowerCase().includes(q)) ||
          productName.toLowerCase().includes(q) ||
          amLabel.toLowerCase().includes(q) ||
          (companyMap.get(d.companyId) || '').toLowerCase().includes(q)
        )
      })
    }
    if (amFilter) {
      result = result.filter(d => getDealAssigneeIds(d).includes(amFilter))
    }
    return result
  }, [deals, search, amFilter, users, companyMap, catalogNameBySlug, catalogNameById])

  // Mobile: further filter by stage when a pill is selected
  const mobileFilteredDeals = useMemo(() => {
    if (!mobileStageFilter) return filteredDeals
    const col = KANBAN_STAGES.find(c => c.id === mobileStageFilter)
    if (!col) return filteredDeals
    return filteredDeals.filter(d => col.matches.includes(d.stage))
  }, [filteredDeals, mobileStageFilter])

  const handleDeleteDeal = useCallback((dealId: string) => {
    if (!isSales) return
    setDeleteConfirmDealId(dealId)
  }, [isSales])

  const confirmDelete = useCallback(() => {
    if (!isSales || !deleteConfirmDealId) return
    deleteDeal.mutate(deleteConfirmDealId, {
      onSettled: () => setDeleteConfirmDealId(null),
    })
  }, [deleteConfirmDealId, deleteDeal, isSales, queryClient])

  /** Advance to the immediate next stage (no confirmation, spinner in menu) */
  const handleAdvanceDeal = useCallback((dealId: string, currentStage: string) => {
    if (!isSales) return
    const nextStage = STAGE_ADVANCE_MAP[currentStage]
    if (!nextStage) return
    setAdvancingDealId(dealId)
    const previousDeals = queryClient.getQueryData<ApiDeal[]>(queryKeys.deals.all)
    queryClient.setQueryData<ApiDeal[]>(queryKeys.deals.all, old =>
      old?.map(d => d.id === dealId ? { ...d, stage: nextStage } : d) ?? []
    )
    const dealTitle = deals.find(d => d.id === dealId)?.title ?? 'Deal'
    patchStage.mutate({ id: dealId, stage: nextStage }, {
      onSuccess: () => stageToast(currentStage, nextStage, dealTitle),
      onError: () => queryClient.setQueryData(queryKeys.deals.all, previousDeals),
      onSettled: () => {
        setAdvancingDealId(null)
        queryClient.invalidateQueries({ queryKey: queryKeys.deals.all })
      },
    })
  }, [deals, isSales, patchStage, queryClient])

  /**
   * Advance to a specific forward stage.
   * All intermediate stages are applied sequentially so activity logs stay correct.
   */
  const handleAdvanceTo = useCallback(async (dealId: string, targetStage: string) => {
    if (!isSales) return
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
    const origStage = deal.stage
    try {
      for (const stage of stages) {
        await new Promise<void>((resolve, reject) => {
          patchStage.mutate({ id: dealId, stage }, {
            onSuccess: () => resolve(),
            onError: (err) => reject(err),
          })
        })
      }
      stageToast(origStage, targetStage, deal.title)
    } catch {
      queryClient.setQueryData(queryKeys.deals.all, previousDeals)
    } finally {
      setAdvancingDealId(null)
      queryClient.invalidateQueries({ queryKey: queryKeys.deals.all })
    }
  }, [deals, isSales, patchStage, queryClient])

  // Move deal back to a previous stage — shows confirmation modal
  const handleMoveTo = useCallback((dealId: string, targetStage: string) => {
    if (!isSales) return
    const deal = deals.find(d => d.id === dealId)
    if (!deal) return
    setMoveConfirm({ dealId, currentStage: deal.stage, targetStage, dealTitle: deal.title })
  }, [deals, isSales])

  const confirmMove = useCallback(() => {
    if (!isSales || !moveConfirm) return
    const { dealId, targetStage, dealTitle } = moveConfirm
    const deal = deals.find(d => d.id === dealId)
    const fromStage = deal?.stage ?? 'lead'
    const previousDeals = queryClient.getQueryData<ApiDeal[]>(queryKeys.deals.all)
    queryClient.setQueryData<ApiDeal[]>(queryKeys.deals.all, old =>
      old?.map(d => d.id === dealId ? { ...d, stage: targetStage } : d) ?? []
    )
    patchStage.mutate({ id: dealId, stage: targetStage }, {
      onSuccess: () => stageToast(fromStage, targetStage, dealTitle),
      onError: () => queryClient.setQueryData(queryKeys.deals.all, previousDeals),
      onSettled: () => {
        setMoveConfirm(null)
        queryClient.invalidateQueries({ queryKey: queryKeys.deals.all })
      },
    })
  }, [deals, isSales, moveConfirm, patchStage, queryClient])

  const handleAssignDeal = useCallback((dealId: string, userId: string, displayName: string) => {
    if (!isSales) return
    const previousDeals = queryClient.getQueryData<ApiDeal[]>(queryKeys.deals.all)
    // Optimistic update: show display name immediately in the UI
    queryClient.setQueryData<ApiDeal[]>(queryKeys.deals.all, old =>
      old?.map(d => d.id === dealId ? { ...d, assignedTo: displayName } : d) ?? []
    )
    // Send the actual user UUID to the API (FK constraint requires UUID)
    updateDeal.mutate({ id: dealId, data: { assignedTo: userId } }, {
      onError: () => queryClient.setQueryData(queryKeys.deals.all, previousDeals),
    })
  }, [isSales, updateDeal, queryClient])

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
  const activeTotals = sumMoneyByCurrency(activeDeals)
  const mixedActiveTotals = hasMultipleCurrencies(activeTotals)
  const activeTotalValue = Object.values(activeTotals).reduce((sum, total) => sum + total, 0)

  const columnDeals = KANBAN_STAGES.map(col => {
    const colDeals = filteredDeals.filter(d => col.matches.includes(d.stage))
    const totals = sumMoneyByCurrency(colDeals)
    return {
      ...col,
      deals: colDeals,
      totals,
      totalValue: Object.values(totals).reduce((sum, total) => sum + total, 0),
      totalLabel: formatCurrencyBreakdown(totals),
    }
  })

  const recentActivityDeals = useMemo(
    () => [...filteredDeals].sort((a, b) => getRecentActivityTime(b) - getRecentActivityTime(a)),
    [filteredDeals],
  )

  const listColumns = useMemo<ColumnDef<ApiDeal>[]>(() => [
    {
      id: 'number',
      header: () => <span>#</span>,
      cell: ({ row }) => <span className="text-xxs tabular-nums text-text-faint">{row.index + 1}</span>,
      enableSorting: false,
      size: 44,
    },
    {
      accessorFn: deal => formatDealName(deal.title),
      id: 'deal',
      header: ({ column }) => <SortableHeader column={column}>Deal</SortableHeader>,
      cell: ({ row }) => (
        <div className="min-w-0">
          <div className="truncate text-ssm font-medium text-foreground">{formatDealName(row.original.title)}</div>
          <div className="mt-0.5 truncate text-xxs text-slate-400">{companyMap.get(row.original.companyId) ?? 'No Brand'}</div>
        </div>
      ),
      size: 280,
    },
    {
      accessorFn: deal => getRecentActivityTime(deal),
      id: 'recentActivity',
      header: ({ column }) => <SortableHeader column={column}>Recent activity</SortableHeader>,
      cell: ({ row }) => <span className="whitespace-nowrap text-xs tabular-nums text-muted-foreground">{formatRecentActivity(row.original)}</span>,
      size: 180,
    },
    {
      accessorFn: deal => deal.stage,
      id: 'stage',
      header: ({ column }) => <SortableHeader column={column}>Stage</SortableHeader>,
      cell: ({ row }) => <StagePill stage={row.original.stage} />,
      size: 140,
    },
    {
      accessorFn: deal => formatDealMoney(deal),
      id: 'value',
      header: () => <span>Value</span>,
      cell: ({ row }) => <span className="text-ssm font-medium tabular-nums text-muted-foreground">{formatDealMoney(row.original)}</span>,
      enableSorting: false,
      size: 140,
    },
    {
      accessorFn: deal => getDealAssigneeSearchText(deal, users),
      id: 'assignees',
      header: () => <span>AM</span>,
      cell: ({ row }) => <AssigneeStack assignees={getDealAssignees(row.original, users)} cardBgVar="var(--card)" />,
      enableSorting: false,
      size: 180,
    },
    {
      accessorFn: deal => deal.catalogItemName ?? '',
      id: 'service',
      header: ({ column }) => <SortableHeader column={column}>Service</SortableHeader>,
      cell: ({ row }) => (
        <span className="text-ssm text-muted-foreground">
          {row.original.catalogItemName ?? row.original.servicesTags?.[0] ?? 'Uncategorized'}
        </span>
      ),
      size: 180,
    },
    {
      id: 'actions',
      header: () => null,
      cell: ({ row }) => {
        const deal = row.original
        return (
          <div className="flex justify-end">
            <CardActionsMenu
              deal={deal}
              currentStage={deal.stage}
              onDelete={() => handleDeleteDeal(deal.id)}
              onAdvance={() => handleAdvanceDeal(deal.id, deal.stage)}
              onAdvanceTo={(stage) => handleAdvanceTo(deal.id, stage)}
              onMoveTo={(stage) => handleMoveTo(deal.id, stage)}
              onAssign={(id, name) => handleAssignDeal(deal.id, id, name)}
              onEdit={() => setEditingDeal(deal)}
              isSales={isSales}
              users={users}
              isAdvancing={advancingDealId === deal.id}
            />
          </div>
        )
      },
      enableSorting: false,
      size: 52,
    },
  ], [advancingDealId, companyMap, handleAdvanceDeal, handleAdvanceTo, handleAssignDeal, handleDeleteDeal, handleMoveTo, isSales, users])

  const activeDeal = activeDealId ? deals.find(d => d.id === activeDealId) ?? null : null
  const activeDealColColor = activeDeal
    ? (KANBAN_STAGES.find(c => c.matches.includes(activeDeal.stage))?.color ?? '#94a3b8')
    : '#94a3b8'

  function handleDragStart(event: DragStartEvent) {
    setActiveDealId(event.active.id as string)
  }

  function handleDragEnd(event: DragEndEvent) {
    if (!isSales) return
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
    // Backward drag — show confirmation modal instead of direct move
    if (targetOrder < currentOrder) {
      setMoveConfirm({ dealId: deal.id, currentStage: deal.stage, targetStage, dealTitle: deal.title })
      return
    }
    const previousDeals = queryClient.getQueryData<ApiDeal[]>(queryKeys.deals.all)
    const origStage = deal.stage
    queryClient.setQueryData<ApiDeal[]>(queryKeys.deals.all, old =>
      old?.map(d => d.id === deal.id ? { ...d, stage: targetStage } : d) ?? []
    )
    patchStage.mutate({ id: deal.id, stage: targetStage }, {
      onSuccess: () => stageToast(origStage, targetStage, deal.title),
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
          onCreated={() => setShowCreateDeal(false)}
        />
      )}
      {showCreateBrand && (
        <CreateBrandModal
          onClose={() => setShowCreateBrand(false)}
          onCreated={() => setShowCreateBrand(false)}
        />
      )}

      {/* ── Desktop action row — parent tabs left, actions right ── */}
      <div className="hidden md:flex flex-col gap-2 px-4 py-2.5 shrink-0">
        <div className="flex items-end justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-2">
            <div className="flex items-center gap-2">
              {/* New Deal / New Brand (sales only) */}
              {isSales && (
                <>
                  <button
                    onClick={() => setShowCreateDeal(true)}
                    className="rounded-control px-3 py-[5px] text-xs font-medium text-white transition-colors flex items-center gap-1.5"
                    style={{ background: 'linear-gradient(135deg, var(--primary), var(--color-primary-accent))' }}
                  >
                    + New Deal
                  </button>
                  <button
                    onClick={() => setShowCreateBrand(true)}
                    className="bg-card border border-border rounded-control px-3 py-[5px] text-xs font-medium text-muted-foreground hover:bg-surface-hover transition-colors flex items-center gap-1.5"
                  >
                    + New Brand
                  </button>
                </>
              )}

              {/* AM filter dropdown */}
              <div ref={amDropdownRef} className="relative">
                <button
                  onClick={() => setAmDropdownOpen(o => !o)}
                  className={cn(
                    'bg-card border rounded-control px-3 py-[5px] text-xs font-medium hover:bg-surface-hover transition-colors duration-150 cursor-pointer flex items-center gap-1.5',
                    amFilter
                      ? 'border-primary/30 text-primary'
                      : 'border-border text-muted-foreground',
                  )}
                >
                  {amFilter ? (amOptions.find(o => o.id === amFilter)?.label ?? 'AM') : 'All AMs'}
                  <ChevronDown size={12} />
                </button>
                {amDropdownOpen && (
                  <div data-search-escape-blocker="true" className="absolute left-0 top-9 z-50 min-w-[160px] bg-card border border-border rounded-md shadow-lg py-1 animate-in fade-in-0 zoom-in-95 duration-100 max-h-[240px] overflow-y-auto">
                    <button
                      onClick={() => { setAmFilter(null); setAmDropdownOpen(false) }}
                      className={cn(
                        'w-full px-3 py-1.5 text-xs text-left hover:bg-surface-hover transition-colors',
                        !amFilter ? 'font-semibold text-primary' : 'text-muted-foreground',
                      )}
                    >
                      All AMs
                    </button>
                    {amOptions.map(o => (
                      <button
                        key={o.id}
                        onClick={() => { setAmFilter(o.id); setAmDropdownOpen(false) }}
                        className={cn(
                          'w-full px-3 py-1.5 text-xs text-left hover:bg-surface-hover transition-colors',
                          amFilter === o.id ? 'font-semibold text-primary' : 'text-muted-foreground',
                        )}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="min-w-0 overflow-x-auto">
              {parentTabs}
            </div>
          </div>

          {/* View/search controls (right) */}
          <div className="flex shrink-0 items-center gap-2">
            <div className="flex items-center rounded-control border border-border bg-card p-0.5">
              <button
                type="button"
                onClick={() => setViewMode('kanban')}
                className={cn(
                  'inline-flex h-7 items-center gap-1.5 rounded-control px-2 text-xs font-medium transition-colors',
                  viewMode === 'kanban'
                    ? 'bg-secondary text-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
                aria-pressed={viewMode === 'kanban'}
              >
                <LayoutGrid size={12} /> Board
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={cn(
                  'inline-flex h-7 items-center gap-1.5 rounded-control px-2 text-xs font-medium transition-colors',
                  viewMode === 'list'
                    ? 'bg-secondary text-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
                aria-pressed={viewMode === 'list'}
              >
                <List size={12} /> List
              </button>
              <button
                type="button"
                onClick={() => setViewMode('heatmap')}
                className={cn(
                  'inline-flex h-7 items-center gap-1.5 rounded-control px-2 text-xs font-medium transition-colors',
                  viewMode === 'heatmap'
                    ? 'bg-secondary text-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
                aria-pressed={viewMode === 'heatmap'}
              >
                <Flame size={12} /> Heatmap
              </button>
            </div>

            {/* Search result count — only when actively searching */}
            {search.trim() && (
              <span className="text-xs text-muted-foreground mr-1">
                Showing <span className="font-semibold text-primary tabular-nums">{filteredDeals.length}</span> result{filteredDeals.length !== 1 ? 's' : ''}
              </span>
            )}
            {/* Search */}
            <SearchInput
              ref={searchInputRef}
              value={search}
              onChange={e => setSearch(e.target.value)}
              onClear={() => setSearch('')}
              placeholder="Search deals…"
              containerClassName="w-[220px] h-8"
            />
          </div>
        </div>

        {subTabs && subTabs.length > 0 && onSubTabChange && (
          <div className="flex min-w-0 items-center overflow-x-auto">
            <SubTabFilter
              items={[{ id: 'all', label: 'All' }, ...subTabs.map(s => ({ id: s.id, label: s.name, count: s.count }))]}
              value={activeSubTabId ?? 'all'}
              onChange={(next) => onSubTabChange(next === 'all' ? null : next)}
            />
          </div>
        )}
      </div>

      {/* ── Desktop board/list (hidden on mobile) ── */}
      <div className="hidden md:block flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex gap-2.5 px-4 pb-4" style={{ minWidth: 'max-content' }}>
            {KANBAN_STAGES.map(col => (
              <div key={col.id} className="w-[268px] shrink-0 flex flex-col overflow-hidden rounded-lg border border-border bg-bg-subtle">
                <div className="px-3.5 py-3 shrink-0 border-b border-border bg-surface-alt">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0 animate-pulse bg-skeleton" />
                    <div className="h-3 w-20 bg-skeleton rounded animate-pulse flex-1" />
                    <div className="h-5 w-6 bg-skeleton rounded-full animate-pulse" />
                  </div>
                </div>
                <div className="flex flex-col gap-2 p-2.5">
                  {[1, 2].map(i => (
                    <div key={i} className="rounded-control p-2.5 bg-[var(--kanban-card)] border border-border animate-pulse">
                      <div className="h-2.5 w-16 bg-skeleton rounded mb-2" />
                      <div className="h-4 w-full bg-skeleton rounded mb-1" />
                      <div className="h-3 w-3/4 bg-skeleton rounded mb-3" />
                      <div className="flex gap-1.5 mb-3">
                        <div className="h-4 w-12 bg-skeleton rounded-full" />
                        <div className="h-4 w-16 bg-skeleton rounded-full" />
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t border-border">
                        <div className="h-4 w-16 bg-skeleton rounded" />
                        <div className="h-5 w-5 bg-skeleton rounded-full" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : viewMode === 'heatmap' ? (
          <DealHeatmap deals={filteredDeals} companyMap={companyMap} onOpenDeal={onOpenDeal} />
        ) : viewMode === 'list' ? (
          <div className="px-4 pb-4">
            <div className="overflow-hidden rounded-md border border-border bg-card">
              <div className="flex items-center justify-between border-b border-border px-3.5 py-2.5">
                <div>
                  <div className="text-ssm font-semibold text-foreground">Recent activity</div>
                  <div className="mt-0.5 text-xxs text-slate-400">Newest deal movement first, filtered by the selected AM.</div>
                </div>
                <span className="rounded-full border border-border bg-secondary px-2 py-0.5 text-xxs font-semibold tabular-nums text-muted-foreground">
                  {recentActivityDeals.length}
                </span>
              </div>
              <DataTable
                columns={listColumns}
                data={recentActivityDeals}
                emptyMessage="No deals found"
                emptyDescription="Change the AM filter or search term to widen the list."
                rowClassName={() => 'odd:bg-card even:bg-bg-subtle/60 dark:odd:bg-card dark:even:bg-white/[0.03] hover:!bg-surface-hover'}
                cellClassName="py-1"
                onRowClick={(deal) => onOpenDeal(deal.id)}
              />
            </div>
          </div>
        ) : (
          <DndContext
            sensors={isSales ? sensors : []}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div className="flex items-stretch gap-2.5 px-4 pb-4 min-h-full" style={{ minWidth: 'max-content' }}>
              {columnDeals.map(col => (
                <DroppableColumn key={col.id} col={col}>
                  {/* Column header */}
                  <div className="px-3.5 py-3 shrink-0 border-b border-border bg-surface-alt">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: col.color }} />
                      <span className="text-ssm font-semibold text-muted-foreground flex-1 leading-none">{col.label}</span>
                      <span className="rounded-full border border-border bg-card px-2 py-0.5 text-xxs font-semibold tabular-nums text-muted-foreground">
                        {col.deals.length}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1 pl-[18px]">
                      <span className="text-xs tabular-nums font-medium" style={{ color: col.totalValue > 0 ? col.color : undefined, opacity: col.totalValue > 0 ? 1 : 0.4 }}>
                        {col.totalLabel}
                      </span>
                      {!mixedActiveTotals && activeTotalValue > 0 && col.totalValue > 0 && !CLOSED_STAGE_IDS.has(col.id) && (
                        <span className="text-atom text-slate-400 tabular-nums">
                          ({Math.round((col.totalValue / activeTotalValue) * 100)}%)
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Cards */}
                  <div className="flex flex-col gap-2 p-2.5">
                    {col.deals.length === 0 ? (
                      <div className="py-8 text-center text-xs text-text-faint">
                        No deals
                      </div>
                    ) : (
                      col.deals.map(d => (
                        <DraggableDealCard
                          key={d.id}
                          deal={d}
                          colColor={col.color}
                          brandName={companyMap.get(d.companyId) ?? 'No Brand'}
                          productIconUrl={d.catalogItemId ? catalogIconById.get(d.catalogItemId) ?? null : null}
                          productLoading={catalogLoading}
                          users={users}
                          onClick={() => onOpenDeal(d.id)}
                          onDelete={() => handleDeleteDeal(d.id)}
                          onAdvance={() => handleAdvanceDeal(d.id, d.stage)}
                          onAdvanceTo={(stage) => handleAdvanceTo(d.id, stage)}
                          onMoveTo={(stage) => handleMoveTo(d.id, stage)}
                          onAssign={(id, name) => handleAssignDeal(d.id, id, name)}
                          onEdit={() => setEditingDeal(d)}
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
                <div className="opacity-85 scale-[1.02] shadow-2xl rounded-control pointer-events-none">
                  <DealCard
                    deal={activeDeal}
                    colColor={activeDealColColor}
                    brandName={companyMap.get(activeDeal.companyId) ?? 'No Brand'}
                    productIconUrl={activeDeal.catalogItemId ? catalogIconById.get(activeDeal.catalogItemId) ?? null : null}
                    productLoading={catalogLoading}
                    onClick={() => {}}
                  />
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        )}
      </div>

      {/* ── Mobile pipeline view (hidden on desktop) ── */}
      <div className="flex flex-col flex-1 overflow-hidden md:hidden">
        {/* Mobile header */}
        <div className="px-4 pt-3 pb-2.5 shrink-0">
          <div className="flex flex-col gap-2.5 mb-2.5">
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-foreground">Deals</h1>
              {!isLoading && (
                <span className="bg-secondary text-slate-500 text-xxs font-semibold tabular-nums px-2 py-0.5 rounded-full">
                  {filteredDeals.length}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1">
              {searchOpen ? (
                <SearchInput
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  onClear={() => { setSearchOpen(false); setSearch('') }}
                  placeholder="Search..."
                  autoFocus
                  containerClassName="w-[160px] h-11"
                />
              ) : (
                <button
                  onClick={() => setSearchOpen(true)}
                  className="w-11 h-11 rounded-control flex items-center justify-center text-slate-500 border border-border bg-card"
                >
                  <Search size={14} />
                </button>
              )}
              {isSales && (
                <>
                  <button
                    onClick={() => setShowCreateBrand(true)}
                    className="h-11 rounded-control px-3 text-xs font-medium text-muted-foreground border border-border bg-card"
                  >
                    + Brand
                  </button>
                  <button
                    onClick={() => setShowCreateDeal(true)}
                    className="h-11 rounded-control px-3 text-xs font-medium text-white"
                    style={{ background: 'linear-gradient(135deg, var(--primary), var(--color-primary-accent))' }}
                  >
                    + Deal
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Mobile sub-tabs — horizontal scroll, same pill style as desktop. */}
          {subTabs && subTabs.length > 0 && onSubTabChange && (
            <div className="-mx-4 overflow-x-auto px-4 pb-2">
              <SubTabFilter
                items={[{ id: 'all', label: 'All' }, ...subTabs.map(s => ({ id: s.id, label: s.name, count: s.count }))]}
                value={activeSubTabId ?? 'all'}
                onChange={(next) => onSubTabChange(next === 'all' ? null : next)}
              />
            </div>
          )}

          {/* Stage filter pills */}
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-4 px-4 pb-1">
            <button
              onClick={() => setMobileStageFilter(null)}
              className={cn(
                'rounded-full text-xxs font-semibold px-3.5 py-2.5 whitespace-nowrap shrink-0 transition-colors duration-150',
                mobileStageFilter === null
                  ? 'bg-primary text-white'
                  : 'bg-secondary text-muted-foreground'
              )}
            >
              All stages
            </button>
            {KANBAN_STAGES.map(col => {
              const count = filteredDeals.filter(d => col.matches.includes(d.stage)).length
              return (
                <button
                  key={col.id}
                  onClick={() => setMobileStageFilter(col.id)}
                  className={cn(
                    'rounded-full text-xxs font-semibold px-3.5 py-2.5 whitespace-nowrap shrink-0 transition-colors duration-150 flex items-center gap-1.5',
                    mobileStageFilter === col.id
                      ? 'bg-primary text-white'
                      : 'bg-secondary text-muted-foreground'
                  )}
                >
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: col.color }} />
                  {col.label}
                  {count > 0 && <span className="tabular-nums">{count}</span>}
                </button>
              )
            })}
          </div>
        </div>

        {/* Mobile deal cards list */}
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {isLoading ? (
            <div className="flex flex-col gap-2.5">
              {[1, 2, 3].map(i => (
                <div key={i} className="rounded-lg p-3.5 bg-card border border-border animate-pulse">
                  <div className="h-2.5 w-20 bg-skeleton rounded mb-2" />
                  <div className="h-4 w-full bg-skeleton rounded mb-3" />
                  <div className="h-3 w-16 bg-skeleton rounded-full mb-3" />
                  <div className="border-t border-border pt-2.5 flex items-center justify-between">
                    <div className="h-4 w-16 bg-skeleton rounded" />
                    <div className="h-5 w-5 bg-skeleton rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : mobileFilteredDeals.length === 0 ? (
            <div className="py-12 text-center text-xs text-text-faint">
              No deals found
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {mobileFilteredDeals.map(d => {
                const brandName = companyMap.get(d.companyId) ?? 'No Brand'
                const stageCol = KANBAN_STAGES.find(c => c.matches.includes(d.stage))
                const stageColor = stageCol?.color ?? '#94a3b8'
                const stageLabel = STAGE_LABELS[d.stage] ?? d.stage
                const outreach = d.outreachCategory || 'outbound'
                const allServices = d.servicesTags || []
                const hasCatalogItem = allServices.includes('internal_products') && !!d.catalogItemName
                const services = allServices.filter(s => s !== 'internal_products')
                const productIconUrl = d.catalogItemId ? catalogIconById.get(d.catalogItemId) ?? null : null
                const assignees = getDealAssignees(d, users)

                return (
                  <div
                    key={d.id}
                    onClick={() => setMobileActionDeal(d)}
                    className="rounded-lg p-3 bg-card border border-border active:bg-surface-hover transition-colors cursor-pointer"
                  >
                    {/* Top: stage dot + brand + outreach pill + stage pill */}
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: stageColor }} />
                        <span className="eyebrow-label truncate">
                          {brandName}
                        </span>
                        <span className={cn(
                          'text-atom font-semibold px-1.5 py-px rounded-full leading-tight shrink-0',
                          outreach === 'inbound'
                            ? 'bg-[rgba(22,163,74,0.1)] text-[#16a34a]'
                            : 'bg-secondary text-slate-500'
                        )}>
                          {outreach === 'inbound' ? 'Inbound' : 'Outbound'}
                        </span>
                      </div>
                      <span
                        className="text-atom font-semibold px-2 py-0.5 rounded-full shrink-0"
                        style={{
                          background: `color-mix(in srgb, ${stageColor} 12%, transparent)`,
                          color: stageColor,
                        }}
                      >
                        {stageLabel}
                      </span>
                    </div>

                    {/* Deal title */}
                    <p className="text-sm font-medium text-foreground leading-snug mb-1.5">
                      {formatDealName(d.title)}
                    </p>

                    {/* Service tag + catalog-item reference (icon, skeleton while loading, name fallback) */}
                    {(services.length > 0 || hasCatalogItem) && (
                      <div className="flex flex-wrap gap-1.5 mb-2.5 items-center">
                        {hasCatalogItem && (
                          catalogLoading ? (
                            <span
                              className="rounded-sm bg-skeleton animate-pulse shrink-0"
                              style={{ width: 18, height: 18 }}
                              aria-label="Loading product icon"
                            />
                          ) : productIconUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={productIconUrl}
                              alt={d.catalogItemName ?? ''}
                              title={d.catalogItemName ?? ''}
                              width={18}
                              height={18}
                              className="rounded-sm object-contain shrink-0"
                              style={{ width: 18, height: 18 }}
                            />
                          ) : (
                            <span className="text-atom font-semibold px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-500">
                              {d.catalogItemName}
                            </span>
                          )
                        )}
                        {services.slice(0, 2).map(s => (
                          <span
                            key={s}
                            className="text-atom font-medium px-2 py-0.5 rounded-full"
                            style={{ background: `${stageColor}18`, color: stageColor }}
                          >
                            {formatServiceType(s)}
                          </span>
                        ))}
                        {services.length > 2 && (
                          <span className="text-atom text-slate-400">+{services.length - 2}</span>
                        )}
                      </div>
                    )}

                    {/* Divider + bottom row */}
                    <div className="flex items-center justify-between pt-2 border-t border-border">
                      <span className="text-sm font-bold tabular-nums" style={{ color: stageColor }}>
                        {formatDealMoney(d)}
                      </span>
                      <AssigneeStack assignees={assignees} cardBgVar="var(--card)" />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Mobile action sheet */}
      {mobileActionDeal && (
        <MobileActionSheet
          deal={mobileActionDeal}
          brandName={companyMap.get(mobileActionDeal.companyId) ?? 'No Brand'}
          onClose={() => { setMobileActionDeal(null); setMobileShowAdvance(false); setMobileShowMoveBack(false); setMobileShowAssign(false) }}
          onDelete={() => handleDeleteDeal(mobileActionDeal.id)}
          onAdvanceTo={(stage) => handleAdvanceTo(mobileActionDeal.id, stage)}
          onMoveTo={(stage) => handleMoveTo(mobileActionDeal.id, stage)}
          onAssign={(id, name) => handleAssignDeal(mobileActionDeal.id, id, name)}
          onEdit={() => setEditingDeal(mobileActionDeal)}
          onViewDeal={() => onOpenDeal(mobileActionDeal.id)}
          isSales={isSales}
          users={users}
          showAdvance={mobileShowAdvance}
          setShowAdvance={setMobileShowAdvance}
          showMoveBack={mobileShowMoveBack}
          setShowMoveBack={setMobileShowMoveBack}
          showAssign={mobileShowAssign}
          setShowAssign={setMobileShowAssign}
        />
      )}

      {/* Delete confirmation modal */}
      {deleteConfirmDealId && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm px-4 flex items-center justify-center"
          onClick={() => setDeleteConfirmDealId(null)}
        >
          <div
            className="max-w-sm w-full rounded-md border border-border bg-card shadow-2xl p-4 animate-in zoom-in-95 fade-in-0 duration-300"
            onClick={e => e.stopPropagation()}
          >
            <p className="text-sm font-semibold text-foreground">Move deal to trash?</p>
            <p className="text-ssm text-muted-foreground leading-relaxed mt-1">This will hide the deal from CRM views. It can be restored from Trash for 30 days before permanent deletion.</p>
            <div className="flex gap-2.5 mt-4">
              <button
                onClick={() => setDeleteConfirmDealId(null)}
                className="flex-1 h-8 rounded-control text-xs font-semibold border border-border text-muted-foreground hover:bg-surface-hover transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleteDeal.isPending}
                className="flex-1 h-8 flex items-center justify-center gap-1.5 rounded-control text-xs font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-60 transition-colors"
              >
                <>{deleteDeal.isPending && <span className="inline-block w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />}Move to trash</>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Move-back confirmation modal */}
      {moveConfirm && (() => {
        const currentCol = KANBAN_STAGES.find(c => c.matches.includes(moveConfirm.currentStage))
        const targetCol = KANBAN_STAGES.find(c => c.matches.includes(moveConfirm.targetStage))
        return (
          <div
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm px-4 flex items-center justify-center"
            onClick={() => setMoveConfirm(null)}
          >
            <div
              className="max-w-sm w-full rounded-md border border-border bg-card shadow-2xl p-4 animate-in zoom-in-95 fade-in-0 duration-300"
              onClick={e => e.stopPropagation()}
            >
              {/* Stage transition indicator */}
              <div className="flex items-center gap-2 mb-4">
                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: currentCol?.color ?? '#94a3b8' }} />
                <span className="text-xs font-semibold" style={{ color: currentCol?.color ?? '#94a3b8' }}>{currentCol?.label ?? moveConfirm.currentStage}</span>
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="text-slate-300">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: targetCol?.color ?? '#94a3b8' }} />
                <span className="text-xs font-semibold" style={{ color: targetCol?.color ?? '#94a3b8' }}>{targetCol?.label ?? moveConfirm.targetStage}</span>
              </div>
              <p className="text-sm font-semibold text-foreground">Move deal back?</p>
              <p className="text-ssm text-muted-foreground leading-relaxed mt-1">
                Move <span className="font-semibold text-foreground">{moveConfirm.dealTitle}</span> back to{' '}
                <span className="font-semibold" style={{ color: targetCol?.color }}>
                  {targetCol?.label ?? moveConfirm.targetStage}
                </span>.
              </p>
              <div className="flex gap-2.5 mt-4">
                <button
                  onClick={() => setMoveConfirm(null)}
                  className="flex-1 h-8 rounded-control text-xs font-semibold border border-border text-muted-foreground hover:bg-surface-hover transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmMove}
                  disabled={patchStage.isPending}
                  className="flex-1 h-8 flex items-center justify-center gap-1.5 rounded-control text-xs font-semibold text-white bg-primary hover:bg-primary/90 disabled:opacity-60 transition-colors"
                >
                  <>{patchStage.isPending && <span className="inline-block w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />}Move</>
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Edit Deal Modal */}
      {editingDeal && (
        <EditDealModal
          deal={editingDeal as import('@/lib/types').ApiDealDetail}
          onClose={() => setEditingDeal(null)}
        />
      )}
    </div>
  )
}
