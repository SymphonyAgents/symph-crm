'use client'

import { useState, useMemo } from 'react'
import { useGetDeals, useGetCompanies, useGetUsers } from '@/lib/hooks/queries'
import { usePatchDealStage, useDeleteDeal } from '@/lib/hooks/mutations'
import { cn, formatPeso } from '@/lib/utils'
import type { ApiDeal, ApiUser } from '@/lib/types'
import { STAGE_LABELS, STAGE_ORDER, STAGE_COLORS } from '@/lib/constants'
import {
  ShoppingBag,
  Plus,
  Trash2,
  MoreHorizontal,
  Paperclip,
} from 'lucide-react'
import { Avatar } from './Avatar'
import { toast } from 'sonner'
import { CreateDealModal } from '@/components/CreateDealModal'

// Reseller product badge colors
const PRODUCT_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  GWS: { bg: 'bg-blue-50 dark:bg-blue-950/40', text: 'text-blue-700 dark:text-blue-300', label: 'Google Workspace' },
  GCP: { bg: 'bg-orange-50 dark:bg-orange-950/40', text: 'text-orange-700 dark:text-orange-300', label: 'Google Cloud' },
  Josys: { bg: 'bg-purple-50 dark:bg-purple-950/40', text: 'text-purple-700 dark:text-purple-300', label: 'Josys' },
}

function formatCurrency(val: string | null | undefined): string {
  if (!val) return '--'
  const n = parseFloat(val)
  if (isNaN(n)) return '--'
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 }).format(n)
}

function getDealValue(deal: ApiDeal): number {
  return parseFloat(deal.value ?? '0') || 0
}

function computeSellingPrice(costPrice: string | null, marginPercent: string | null): number | null {
  const cost = parseFloat(costPrice ?? '')
  const margin = parseFloat(marginPercent ?? '')
  if (isNaN(cost) || cost <= 0) return null
  if (isNaN(margin) || margin <= 0 || margin >= 100) return cost
  return cost / (1 - margin / 100)
}

function computeProfit(costPrice: string | null, marginPercent: string | null): number | null {
  const cost = parseFloat(costPrice ?? '')
  const selling = computeSellingPrice(costPrice, marginPercent)
  if (selling === null || isNaN(cost)) return null
  return selling - cost
}

type ResellerDealCardProps = {
  deal: ApiDeal
  brandName: string
  colColor: string
  users: ApiUser[]
  onOpen: (id: string) => void
  onStageChange: (id: string, stage: string) => void
  onDelete: (id: string) => void
  stages: { slug: string; label: string }[]
}

function ResellerDealCard({ deal, brandName, colColor, users, onOpen, onStageChange, onDelete, stages }: ResellerDealCardProps) {
  const [showMenu, setShowMenu] = useState(false)
  const [showStageMenu, setShowStageMenu] = useState(false)
  const products = (deal.servicesTags ?? []).filter(t => ['GWS', 'GCP', 'Josys'].includes(t))
  const outreach = deal.outreachCategory || 'outbound'
  const resolvedAm = users.find(u => u.id === deal.assignedTo)
  const amShortName = resolvedAm
    ? (resolvedAm.nickname ?? resolvedAm.firstName ?? resolvedAm.name?.split(' ')[0] ?? resolvedAm.email?.split('@')[0] ?? '?')
    : (deal.assignedTo ? '?' : 'UN')
  const amName = resolvedAm?.name ?? resolvedAm?.email ?? deal.assignedTo ?? 'Unassigned'

  return (
    <div
      className="group bg-white dark:bg-[#222225] rounded-lg border border-black/[.08] dark:border-white/[.1] p-3 cursor-pointer transition-colors duration-150"
      style={{ borderColor: `${colColor}22` }}
      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = colColor + '14' }}
      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '' }}
      onClick={() => onOpen(deal.id)}
    >
      <div className="flex items-center justify-between">
        <span className="text-xxs font-semibold uppercase tracking-[0.05em] text-slate-400 truncate max-w-[120px]">
          {brandName}
        </span>
        <div className="flex items-center gap-1">
          <div className="relative">
            <button
              onClick={(e) => { e.stopPropagation(); setShowMenu(o => !o); setShowStageMenu(false) }}
              className="w-6 h-6 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[.08] transition-colors"
            >
              <MoreHorizontal size={14} />
            </button>
            {showMenu && (
              <div
                className="absolute right-0 top-7 z-50 min-w-[180px] bg-white dark:bg-[#1e1e21] border border-black/[.08] dark:border-white/[.1] rounded-lg shadow-lg py-1 animate-in fade-in-0 zoom-in-95 duration-100"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={(e) => { e.stopPropagation(); setShowStageMenu(v => !v) }}
                  className="flex items-center justify-between w-full px-3 py-1.5 text-ssm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[.06] transition-colors"
                >
                  <span>Move to...</span>
                  <span className="text-slate-400">›</span>
                </button>
                {showStageMenu && (
                  <div className="border-t border-black/[.04] dark:border-white/[.06] max-h-[200px] overflow-y-auto">
                    {stages.filter(s => s.slug !== deal.stage).map(s => (
                      <button
                        key={s.slug}
                        className="w-full text-left px-3 py-1.5 text-xs hover:bg-slate-50 dark:hover:bg-white/[.04] text-slate-700 dark:text-slate-300 transition-colors"
                        onClick={() => { onStageChange(deal.id, s.slug); setShowMenu(false); setShowStageMenu(false) }}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); setShowMenu(false); onDelete(deal.id) }}
                  className="flex items-center gap-2 w-full px-3 py-1.5 text-ssm text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                >
                  <Trash2 size={14} /> Delete
                </button>
              </div>
            )}
          </div>
          <span className={cn(
            'text-atom font-semibold px-1.5 py-px rounded-full leading-tight',
            outreach === 'inbound'
              ? 'bg-[rgba(22,163,74,0.1)] text-[#16a34a]'
              : 'bg-slate-100 dark:bg-white/[.06] text-slate-500'
          )}>
            {outreach === 'inbound' ? 'Inbound' : 'Outbound'}
          </span>
        </div>
      </div>

      <div className="text-xs font-semibold text-slate-900 dark:text-white leading-snug mb-2.5">
        {deal.title}
      </div>

      {products.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2.5 items-center">
          {products.slice(0, 3).map(p => {
            const cfg = PRODUCT_COLORS[p]
            if (!cfg) return null
            return (
              <span
                key={p}
                className={cn('text-atom font-medium px-2 py-0.5 rounded-full', cfg.bg, cfg.text)}
                title={cfg.label}
              >
                {p}
              </span>
            )
          })}
        </div>
      )}

      <div className="flex items-center justify-between pt-2 border-t border-black/[.05] dark:border-white/[.08]">
        <span className="text-sbase font-bold tabular-nums" style={{ color: colColor }}>
          {formatPeso(getDealValue(deal))}
        </span>
        <div className="flex items-center gap-2">
          {(deal.documentCount ?? 0) > 0 && (
            <div
              className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-white/[.08]"
              title={`${deal.documentCount} resource${(deal.documentCount ?? 0) !== 1 ? 's' : ''} attached`}
            >
              <Paperclip size={10} className="text-slate-400 shrink-0" />
              <span className="text-atom font-medium text-slate-500 tabular-nums">
                {deal.documentCount}
              </span>
            </div>
          )}
          <div className="flex items-center gap-1">
            <Avatar name={amName} email={resolvedAm?.email ?? undefined} src={resolvedAm?.image ?? undefined} size={20} />
            <span className="text-xxs font-medium text-slate-600 dark:text-slate-400">{amShortName}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

type ResellerPipelineProps = {
  onOpenDeal: (id: string) => void
}

export function ResellerPipeline({ onOpenDeal }: ResellerPipelineProps) {
  const { data: allDeals = [], isLoading } = useGetDeals({ dealType: 'reseller' })
  const { data: companies = [] } = useGetCompanies()
  const { data: users = [] } = useGetUsers()
  const patchStage = usePatchDealStage()
  const deleteDeal = useDeleteDeal()
  const [showCreate, setShowCreate] = useState(false)
  const [filterProduct, setFilterProduct] = useState<string | null>(null)

  // Derive active stages from current deals (reuse same stage list as agency pipeline)
  // Filter + group deals
  const filteredDeals = useMemo(() => {
    if (!filterProduct) return allDeals
    return allDeals.filter(d => (d.servicesTags ?? []).includes(filterProduct))
  }, [allDeals, filterProduct])

  const companyNameById = useMemo(() => {
    return new Map(companies.map(c => [c.id, c.name]))
  }, [companies])

  const byStage = useMemo(() => {
    const stageOrder = Object.keys(STAGE_ORDER)
    const map: Record<string, ApiDeal[]> = {}
    for (const stage of stageOrder) map[stage] = []
    for (const deal of filteredDeals) {
      const s = deal.stage ?? 'lead'
      if (!map[s]) map[s] = []
      map[s].push(deal)
    }
    return map
  }, [filteredDeals])

  const ORDERED_STAGES = Object.keys(STAGE_ORDER)
  const REQUIRED_RESELLER_STAGES = new Set(['lead', 'parked', 'closed_won', 'closed_lost'])
  const visibleStages = ORDERED_STAGES.filter(s => REQUIRED_RESELLER_STAGES.has(s) || (byStage[s]?.length ?? 0) > 0)

  const stagesMeta = ORDERED_STAGES.map(s => ({ slug: s, label: STAGE_LABELS[s] ?? s }))

  // Summary stats
  const totalBilling = allDeals.reduce((sum, d) => {
    const selling = computeSellingPrice(d.costPrice, d.marginPercent) ?? parseFloat(d.value ?? '0') ?? 0
    return sum + (isNaN(selling) ? 0 : selling)
  }, 0)
  const totalProfit = allDeals.reduce((sum, d) => {
    const p = computeProfit(d.costPrice, d.marginPercent) ?? 0
    return sum + (isNaN(p) ? 0 : p)
  }, 0)
  const activeCount = allDeals.filter(d => !['parked', 'closed_won', 'closed_lost'].includes(d.stage ?? '')).length

  const PRODUCTS = ['GWS', 'GCP', 'Josys']

  function handleStageChange(id: string, stage: string) {
    patchStage.mutate({ id, stage }, {
      onSuccess: () => toast.success('Stage updated'),
      onError: () => toast.error('Failed to update stage'),
    })
  }

  function handleDelete(id: string) {
    if (!confirm('Delete this reseller deal?')) return
    deleteDeal.mutate(id, {
      onSuccess: () => toast.success('Deal deleted'),
      onError: () => toast.error('Failed to delete'),
    })
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-5 pb-4 border-b border-black/[.06] dark:border-white/[.08] shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center">
              <ShoppingBag size={15} className="text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-900 dark:text-white">Reseller Pipeline</h1>
              <p className="text-atom text-slate-400">GWS · GCP · Josys</p>
            </div>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold bg-primary text-white hover:bg-primary/90 transition-colors"
          >
            <Plus size={13} />
            New Deal
          </button>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-6 text-xs">
          <div>
            <span className="text-slate-400">Active</span>
            <span className="ml-1.5 font-bold text-slate-900 dark:text-white">{activeCount}</span>
          </div>
          <div>
            <span className="text-slate-400">Total billing</span>
            <span className="ml-1.5 font-bold text-slate-900 dark:text-white">{formatCurrency(String(totalBilling))}</span>
          </div>
          <div>
            <span className="text-slate-400">Gross profit</span>
            <span className="ml-1.5 font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(String(totalProfit))}</span>
          </div>
        </div>

        {/* Product filters */}
        <div className="flex items-center gap-2 mt-3">
          <button
            onClick={() => setFilterProduct(null)}
            className={cn(
              'h-6 px-2.5 rounded-full text-atom font-semibold transition-colors',
              !filterProduct
                ? 'bg-primary text-white'
                : 'bg-slate-100 dark:bg-white/[.06] text-slate-500 hover:text-slate-700 dark:hover:text-white'
            )}
          >
            All
          </button>
          {PRODUCTS.map(p => {
            const cfg = PRODUCT_COLORS[p]
            const active = filterProduct === p
            return (
              <button
                key={p}
                onClick={() => setFilterProduct(active ? null : p)}
                className={cn(
                  'h-6 px-2.5 rounded-full text-atom font-semibold transition-colors',
                  active ? `${cfg.bg} ${cfg.text} ring-1 ring-current` : 'bg-slate-100 dark:bg-white/[.06] text-slate-500 hover:text-slate-700 dark:hover:text-white'
                )}
              >
                {p}
              </button>
            )
          })}
        </div>
      </div>

      {/* Kanban board */}
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center text-sm text-slate-400">Loading reseller deals...</div>
      ) : (
        <div className="flex-1 flex overflow-x-auto gap-3 p-4">
          {visibleStages.map(stage => {
            const stageDeals = byStage[stage] ?? []
            const stageBilling = stageDeals.reduce((sum, d) => {
              const selling = computeSellingPrice(d.costPrice, d.marginPercent) ?? parseFloat(d.value ?? '0') ?? 0
              return sum + (isNaN(selling) ? 0 : selling)
            }, 0)

            return (
              <div key={stage} className="shrink-0 w-[240px] flex flex-col">
                {/* Column header */}
                <div className="flex items-center justify-between mb-2 px-1">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {STAGE_LABELS[stage] ?? stage}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {stageBilling > 0 && (
                      <span className="text-atom text-slate-400">
                        {formatCurrency(String(stageBilling))}
                      </span>
                    )}
                    <span className="text-atom bg-slate-100 dark:bg-white/[.07] text-slate-500 rounded-full px-1.5 py-px font-semibold">
                      {stageDeals.length}
                    </span>
                  </div>
                </div>

                {/* Cards */}
                <div className="flex flex-col gap-2 flex-1">
                  {stageDeals.length === 0 ? (
                    <div className="flex-1 border-2 border-dashed border-slate-200 dark:border-white/[.06] rounded-lg flex items-center justify-center min-h-[80px]">
                      <span className="text-atom text-slate-300 dark:text-slate-600">Empty</span>
                    </div>
                  ) : (
                    stageDeals.map(deal => (
                      <ResellerDealCard
                        key={deal.id}
                        deal={deal}
                        brandName={companyNameById.get(deal.companyId) ?? 'No Brand'}
                        colColor={STAGE_COLORS[stage] ?? '#94a3b8'}
                        users={users}
                        onOpen={onOpenDeal}
                        onStageChange={handleStageChange}
                        onDelete={handleDelete}
                        stages={stagesMeta}
                      />
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showCreate && (
        <CreateDealModal
          companies={companies}
          defaultDealType="reseller"
          onClose={() => setShowCreate(false)}
          onCreated={() => setShowCreate(false)}
        />
      )}
    </div>
  )
}
