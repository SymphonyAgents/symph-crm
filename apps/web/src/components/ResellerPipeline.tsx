'use client'

import { useState, useMemo } from 'react'
import { useGetDeals, useGetCompanies } from '@/lib/hooks/queries'
import { usePatchDealStage, useDeleteDeal } from '@/lib/hooks/mutations'
import { cn } from '@/lib/utils'
import type { ApiDeal } from '@/lib/types'
import { STAGE_LABELS, STAGE_ORDER } from '@/lib/constants'
import {
  ShoppingBag,
  Plus,
  Trash2,
  ChevronRight,
  DollarSign,
  Percent,
} from 'lucide-react'
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
  onOpen: (id: string) => void
  onStageChange: (id: string, stage: string) => void
  onDelete: (id: string) => void
  stages: { slug: string; label: string }[]
}

function ResellerDealCard({ deal, onOpen, onStageChange, onDelete, stages }: ResellerDealCardProps) {
  const [showStageMenu, setShowStageMenu] = useState(false)
  const products = (deal.servicesTags ?? []).filter(t => ['GWS', 'GCP', 'Josys'].includes(t))
  const sellingPrice = computeSellingPrice(deal.costPrice, deal.marginPercent)
  const profit = computeProfit(deal.costPrice, deal.marginPercent)
  const marginPct = parseFloat(deal.marginPercent ?? '')

  return (
    <div
      className="bg-white dark:bg-[#232428] rounded-lg border border-black/[.06] dark:border-white/[.07] p-3 cursor-pointer hover:shadow-md transition-all duration-150 group"
      onClick={() => onOpen(deal.id)}
    >
      {/* Product badges */}
      {products.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {products.map(p => {
            const cfg = PRODUCT_COLORS[p]
            if (!cfg) return null
            return (
              <span
                key={p}
                className={cn('text-atom font-semibold px-1.5 py-px rounded-full', cfg.bg, cfg.text)}
                title={cfg.label}
              >
                {p}
              </span>
            )
          })}
        </div>
      )}

      {/* Title */}
      <p className="text-sm font-semibold text-slate-900 dark:text-white leading-snug line-clamp-2 mb-2">
        {deal.title}
      </p>

      {/* Revenue breakdown */}
      <div className="space-y-1 text-xs text-slate-500 dark:text-slate-400">
        {deal.costPrice && (
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1"><DollarSign size={11} /> Cost</span>
            <span className="font-medium text-slate-700 dark:text-slate-300">{formatCurrency(deal.costPrice)}</span>
          </div>
        )}
        {!isNaN(marginPct) && marginPct > 0 && (
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1"><Percent size={11} /> Margin</span>
            <span className="font-medium text-emerald-600 dark:text-emerald-400">{marginPct.toFixed(1)}%</span>
          </div>
        )}
        {sellingPrice !== null && (
          <div className="flex items-center justify-between border-t border-black/[.04] dark:border-white/[.05] pt-1 mt-1">
            <span className="font-semibold text-slate-600 dark:text-slate-300">Billing price</span>
            <span className="font-bold text-slate-900 dark:text-white">{formatCurrency(String(sellingPrice))}</span>
          </div>
        )}
        {profit !== null && profit > 0 && (
          <div className="flex items-center justify-between">
            <span>Gross profit</span>
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrency(String(profit))}</span>
          </div>
        )}
      </div>

      {/* Stage move + delete */}
      <div className="flex items-center justify-between mt-3 pt-2 border-t border-black/[.04] dark:border-white/[.05]">
        <div className="relative">
          <button
            className="text-atom text-slate-400 hover:text-slate-600 dark:hover:text-white flex items-center gap-0.5 transition-colors"
            onClick={(e) => { e.stopPropagation(); setShowStageMenu(s => !s) }}
          >
            <ChevronRight size={12} />
            <span>Move</span>
          </button>
          {showStageMenu && (
            <div
              className="absolute bottom-full left-0 mb-1 z-50 bg-white dark:bg-[#2a2b30] border border-black/[.07] dark:border-white/[.08] rounded-lg shadow-lg py-1 min-w-[140px]"
              onClick={e => e.stopPropagation()}
            >
              {stages.filter(s => s.slug !== deal.stage).map(s => (
                <button
                  key={s.slug}
                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-slate-50 dark:hover:bg-white/[.04] text-slate-700 dark:text-slate-300 transition-colors"
                  onClick={() => { onStageChange(deal.id, s.slug); setShowStageMenu(false) }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          className="text-atom text-slate-300 hover:text-red-500 dark:text-slate-600 dark:hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
          onClick={(e) => { e.stopPropagation(); onDelete(deal.id) }}
          title="Delete deal"
        >
          <Trash2 size={12} />
        </button>
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

  // Only show stages that have at least 1 deal, plus lead always
  const ORDERED_STAGES = Object.keys(STAGE_ORDER)
  const visibleStages = ORDERED_STAGES.filter(s => s === 'lead' || (byStage[s]?.length ?? 0) > 0)

  const activeStages = visibleStages.filter(s => !['closed_won', 'closed_lost'].includes(s))
  const terminalStages = visibleStages.filter(s => ['closed_won', 'closed_lost'].includes(s))

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
  const activeCount = allDeals.filter(d => !['closed_won', 'closed_lost'].includes(d.stage ?? '')).length

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
          {activeStages.map(stage => {
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

          {/* Terminal stages (Won/Lost) as collapsed columns */}
          {terminalStages.length > 0 && (
            <div className="shrink-0 w-[200px] flex flex-col gap-2">
              {terminalStages.map(stage => {
                const stageDeals = byStage[stage] ?? []
                const isWon = stage === 'closed_won'
                return (
                  <div key={stage} className={cn('rounded-lg border p-3', isWon ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40' : 'bg-slate-50 dark:bg-white/[.02] border-slate-200 dark:border-white/[.06]')}>
                    <div className="flex items-center justify-between mb-2">
                      <span className={cn('text-xs font-semibold', isWon ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-500')}>
                        {STAGE_LABELS[stage]}
                      </span>
                      <span className="text-atom bg-white/60 dark:bg-white/[.05] rounded-full px-1.5 py-px font-semibold text-slate-500">
                        {stageDeals.length}
                      </span>
                    </div>
                    {stageDeals.map(deal => (
                      <div
                        key={deal.id}
                        className="text-xs text-slate-600 dark:text-slate-400 py-1 cursor-pointer hover:text-slate-900 dark:hover:text-white truncate"
                        onClick={() => onOpenDeal(deal.id)}
                      >
                        {deal.title}
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          )}
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
