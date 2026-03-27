'use client'

import { useState } from 'react'
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
import { cn } from '@/lib/utils'
import { formatPeso } from '@/lib/utils'
import { Avatar } from './Avatar'
import { queryKeys } from '@/lib/query-keys'
import { usePatchDealStage } from '@/lib/hooks/mutations'

// --- Types ---
type ApiDeal = {
  id: string
  companyId: string
  title: string
  stage: string
  value: string | null
  servicesTags: string[] | null
  outreachCategory: string | null
  assignedTo: string | null
  lastActivityAt: string | null
}

type PipelineProps = {
  onOpenDeal: (id: string) => void
}

/**
 * 7 consolidated stages — mirrors PipelineBar in Dashboard.
 * Granular DB stages are grouped so the board isn't 11 columns wide.
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
  lead:         'lead',
  discovery:    'discovery',
  assessment:   'assessment',
  demo_prop:    'proposal_demo',
  followup:     'followup',
  closed_won:   'closed_won',
  closed_lost:  'closed_lost',
}

const CLOSED_IDS = new Set(['closed_won', 'closed_lost'])

// Sub-stage label for individual deal cards (show granular stage inside grouped column)
const SUB_STAGE_LABEL: Record<string, string> = {
  lead: 'Lead', discovery: 'Discovery', assessment: 'Assessment',
  qualified: 'Qualified', demo: 'Demo', proposal: 'Proposal',
  proposal_demo: 'Demo + Proposal', negotiation: 'Negotiation',
  followup: 'Follow-up', closed_won: 'Won', closed_lost: 'Lost',
}

// --- DealCard (unchanged) ---
function DealCard({ deal, colColor, onClick }: { deal: ApiDeal; colColor: string; onClick: () => void }) {
  const isWon = deal.stage === 'closed_won'
  const isLost = deal.stage === 'closed_lost'
  const outreach = deal.outreachCategory || 'outbound'
  const services = deal.servicesTags || []
  const amName = deal.assignedTo || 'Unassigned'

  return (
    <div
      onClick={onClick}
      className={cn(
        'rounded-lg p-3.5 cursor-pointer transition-all duration-150',
        isWon
          ? 'bg-[rgba(22,163,74,0.05)] dark:bg-[rgba(22,163,74,0.08)] border border-[rgba(22,163,74,0.22)]'
          : isLost
          ? 'bg-white dark:bg-[#222225] border border-[rgba(220,38,38,0.15)] opacity-70'
          : 'bg-white dark:bg-[#222225] border border-black/[.08] dark:border-white/[.1]'
      )}
      onMouseEnter={(e) => {
        if (!isWon && !isLost) {
          e.currentTarget.style.borderColor = colColor
          e.currentTarget.style.boxShadow = `0 0 0 3px ${colColor}20`
        }
      }}
      onMouseLeave={(e) => {
        if (!isWon && !isLost) {
          e.currentTarget.style.borderColor = ''
          e.currentTarget.style.boxShadow = ''
        }
      }}
    >
      {/* Sub-stage label + outreach badge */}
      <div className="flex items-center justify-between mb-1.5">
        <span
          className="text-[11px] font-semibold uppercase tracking-[0.05em]"
          style={{ color: colColor }}
        >
          {SUB_STAGE_LABEL[deal.stage] ?? deal.stage.replace(/_/g, ' ')}
        </span>
        <span className={cn(
          'text-[10px] font-semibold px-2 py-0.5 rounded-full',
          outreach === 'inbound'
            ? 'bg-[rgba(22,163,74,0.1)] text-[#16a34a]'
            : 'bg-[rgba(124,58,237,0.1)] text-[#8b5cf6]'
        )}>
          {outreach === 'inbound' ? 'Inbound' : 'Outbound'}
        </span>
      </div>

      {/* Deal title */}
      <div className="text-[14px] font-bold text-slate-900 dark:text-white leading-snug mb-2.5">
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

// --- DraggableDealCard — wraps DealCard without touching it ---
function DraggableDealCard({
  deal,
  colColor,
  onClick,
}: {
  deal: ApiDeal
  colColor: string
  onClick: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: deal.id,
  })
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
      <DealCard deal={deal} colColor={colColor} onClick={onClick} />
    </div>
  )
}

// --- DroppableColumn — wraps each stage column ---
function DroppableColumn({
  col,
  children,
}: {
  col: (typeof KANBAN_STAGES)[number]
  children: React.ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({ id: col.id })

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'w-[252px] shrink-0 flex flex-col overflow-hidden rounded-lg transition-all duration-150',
        'bg-[rgba(0,0,0,0.02)] dark:bg-white/[.02]',
        isOver
          ? 'border-2 border-dashed'
          : 'border border-black/[.07] dark:border-white/[.08]',
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

export function Pipeline({ onOpenDeal }: PipelineProps) {
  const [activeDealId, setActiveDealId] = useState<string | null>(null)
  const queryClient = useQueryClient()

  const { data: deals = [], isLoading } = useQuery({
    queryKey: queryKeys.deals.all,
    queryFn: fetchDeals,
  })

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  )

  const patchStage = usePatchDealStage()

  const activeDeals = deals.filter(d => !CLOSED_IDS.has(d.stage))
  const totalValue = activeDeals.reduce((s, d) => s + (parseFloat(d.value || '0') || 0), 0)

  // Group deals into 7 consolidated columns
  const columnDeals = KANBAN_STAGES.map(col => ({
    ...col,
    deals: deals.filter(d => col.matches.includes(d.stage)),
    total: deals
      .filter(d => col.matches.includes(d.stage))
      .reduce((s, d) => s + (parseFloat(d.value || '0') || 0), 0),
  }))

  // The deal and its column color for the drag overlay
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

    // No-op if already in the same column
    const currentCol = KANBAN_STAGES.find(c => c.matches.includes(deal.stage))
    if (currentCol?.id === over.id) return

    // Snapshot for rollback
    const previousDeals = queryClient.getQueryData<ApiDeal[]>(queryKeys.deals.all)

    // Optimistic update
    queryClient.setQueryData<ApiDeal[]>(queryKeys.deals.all, old =>
      old?.map(d => d.id === deal.id ? { ...d, stage: targetStage } : d) ?? [],
    )

    patchStage.mutate(
      { id: deal.id, stage: targetStage },
      {
        onError: () => {
          queryClient.setQueryData(queryKeys.deals.all, previousDeals)
        },
        onSettled: () => {
          queryClient.invalidateQueries({ queryKey: queryKeys.deals.all })
        },
      },
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Stats + actions */}
      <div className="flex items-center justify-between px-4 py-2.5 shrink-0">
        {isLoading ? (
          <div className="h-4 w-40 bg-slate-100 dark:bg-white/[.06] rounded animate-pulse" />
        ) : (
          <span className="text-[13px] font-medium text-slate-900 dark:text-white">
            {activeDeals.length} active deals
            {totalValue > 0 && (
              <> &middot; <span className="tabular-nums">P{(totalValue / 1_000_000).toFixed(1)}M</span></>
            )}
          </span>
        )}
        <div className="flex gap-2">
          <button className="bg-white dark:bg-[#1e1e21] border border-black/[.08] dark:border-white/[.08] rounded-lg px-3 py-[5px] text-[12px] font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[.04] dark:bg-white/[.03] transition-colors duration-150 cursor-pointer">
            Filter
          </button>
          <button className="hidden sm:block bg-white dark:bg-[#1e1e21] border border-black/[.08] dark:border-white/[.08] rounded-lg px-3 py-[5px] text-[12px] font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[.04] dark:bg-white/[.03] transition-colors duration-150 cursor-pointer">
            Group by AM
          </button>
        </div>
      </div>

      {/* Board */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        {isLoading ? (
          <div className="flex gap-2.5 h-full px-4 pb-4" style={{ minWidth: 'max-content' }}>
            {KANBAN_STAGES.map(col => (
              <div
                key={col.id}
                className="w-[252px] shrink-0 flex flex-col overflow-hidden rounded-lg border border-black/[.07] dark:border-white/[.08] bg-[rgba(0,0,0,0.02)] dark:bg-white/[.02]"
              >
                {/* Column header skeleton */}
                <div className="px-3.5 py-3 shrink-0 border-b border-black/[.06] dark:border-white/[.08] bg-white/60 dark:bg-white/[.04]">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0 animate-pulse bg-slate-200 dark:bg-white/[.1]" />
                    <div className="h-3 w-20 bg-slate-100 dark:bg-white/[.06] rounded animate-pulse flex-1" />
                    <div className="h-5 w-6 bg-slate-100 dark:bg-white/[.06] rounded-full animate-pulse" />
                  </div>
                </div>
                {/* Card skeletons */}
                <div className="flex flex-col gap-2 flex-1 overflow-y-auto p-2.5">
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
            sensors={sensors}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div className="flex gap-2.5 h-full px-4 pb-4" style={{ minWidth: 'max-content' }}>
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
                    {col.total > 0 && (
                      <div className="text-[12px] text-slate-400 tabular-nums mt-1 pl-[18px]">
                        P{(col.total / 1_000_000).toFixed(1)}M
                      </div>
                    )}
                  </div>

                  {/* Cards */}
                  <div className="flex flex-col gap-2 flex-1 overflow-y-auto p-2.5">
                    {col.deals.length === 0 ? (
                      <div className="py-8 text-center text-[12px] text-slate-300">
                        No deals
                      </div>
                    ) : (
                      col.deals.map(d => (
                        <DraggableDealCard
                          key={d.id}
                          deal={d}
                          colColor={col.color}
                          onClick={() => onOpenDeal(d.id)}
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
