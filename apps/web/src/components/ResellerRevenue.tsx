'use client'

import { useState, useMemo } from 'react'
import { useGetDeals } from '@/lib/hooks/queries'
import { cn } from '@/lib/utils'
import type { ApiDeal } from '@/lib/types'
import { STAGE_LABELS } from '@/lib/constants'
import { DollarSign, TrendingUp, Percent, Package, Filter } from 'lucide-react'

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmt(val: number): string {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 0,
  }).format(val)
}

function getSellingPrice(deal: ApiDeal): number {
  const cost = parseFloat(deal.costPrice ?? '')
  const margin = parseFloat(deal.marginPercent ?? '')
  if (!isNaN(cost) && cost > 0) {
    if (!isNaN(margin) && margin > 0 && margin < 100) {
      return cost / (1 - margin / 100)
    }
    return cost
  }
  // Fallback to value field
  return parseFloat(deal.value ?? '0') || 0
}

function getCostPrice(deal: ApiDeal): number {
  return parseFloat(deal.costPrice ?? '0') || 0
}

function getProfit(deal: ApiDeal): number {
  return getSellingPrice(deal) - getCostPrice(deal)
}

function getMargin(deal: ApiDeal): number | null {
  const m = parseFloat(deal.marginPercent ?? '')
  if (!isNaN(m) && m > 0) return m
  const selling = getSellingPrice(deal)
  const cost = getCostPrice(deal)
  if (selling > 0 && cost > 0 && selling > cost) {
    return ((selling - cost) / selling) * 100
  }
  return null
}

// ─── Product badge ───────────────────────────────────────────────────────────

const PRODUCT_COLORS: Record<string, string> = {
  GWS: 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300',
  GCP: 'bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300',
  Josys: 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300',
}

function ProductBadge({ tag }: { tag: string }) {
  const cls = PRODUCT_COLORS[tag]
  if (!cls) return null
  return (
    <span className={cn('text-atom font-semibold px-1.5 py-px rounded-full', cls)}>{tag}</span>
  )
}

// ─── Summary card ────────────────────────────────────────────────────────────

function SummaryCard({ label, value, sub, icon: Icon, color }: {
  label: string
  value: string
  sub?: string
  icon: React.ElementType
  color: string
}) {
  return (
    <div className="bg-white dark:bg-[#232428] rounded-xl border border-black/[.06] dark:border-white/[.07] p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</span>
        <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center', color)}>
          <Icon size={14} />
        </div>
      </div>
      <p className="text-lg font-bold text-slate-900 dark:text-white">{value}</p>
      {sub && <p className="text-atom text-slate-400 mt-0.5">{sub}</p>}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ResellerRevenue() {
  const { data: deals = [], isLoading } = useGetDeals({ dealType: 'reseller' })
  const [filterProduct, setFilterProduct] = useState<string | null>(null)
  const [filterStage, setFilterStage] = useState<string>('active')

  const PRODUCTS = ['GWS', 'GCP', 'Josys']
  const TERMINAL = new Set(['closed_won', 'closed_lost'])

  const filteredDeals = useMemo(() => {
    let d = deals
    if (filterProduct) d = d.filter(deal => (deal.servicesTags ?? []).includes(filterProduct))
    if (filterStage === 'active') d = d.filter(deal => !TERMINAL.has(deal.stage ?? ''))
    else if (filterStage === 'won') d = d.filter(deal => deal.stage === 'closed_won')
    else if (filterStage === 'lost') d = d.filter(deal => deal.stage === 'closed_lost')
    return d
  }, [deals, filterProduct, filterStage])

  // Totals across ALL deals (not filtered) for summary cards
  const activeDeals = deals.filter(d => !TERMINAL.has(d.stage ?? ''))
  const totalBilling = activeDeals.reduce((s, d) => s + getSellingPrice(d), 0)
  const totalCost = activeDeals.reduce((s, d) => s + getCostPrice(d), 0)
  const totalProfit = totalBilling - totalCost
  const avgMargin = activeDeals.length > 0
    ? activeDeals.reduce((s, d) => s + (getMargin(d) ?? 0), 0) / activeDeals.length
    : 0

  // Product breakdown
  const byProduct = useMemo(() => {
    const map: Record<string, { billing: number; cost: number; count: number }> = {
      GWS: { billing: 0, cost: 0, count: 0 },
      GCP: { billing: 0, cost: 0, count: 0 },
      Josys: { billing: 0, cost: 0, count: 0 },
      Other: { billing: 0, cost: 0, count: 0 },
    }
    for (const d of activeDeals) {
      const tags = (d.servicesTags ?? []).filter(t => PRODUCTS.includes(t))
      const targets = tags.length > 0 ? tags : ['Other']
      for (const t of targets) {
        if (!map[t]) map[t] = { billing: 0, cost: 0, count: 0 }
        map[t].billing += getSellingPrice(d) / targets.length
        map[t].cost += getCostPrice(d) / targets.length
        map[t].count += 1 / targets.length
      }
    }
    return map
  }, [activeDeals])

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="px-6 pt-5 pb-4 border-b border-black/[.06] dark:border-white/[.08]">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center">
            <TrendingUp size={15} className="text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-900 dark:text-white">Reseller Revenue</h1>
            <p className="text-atom text-slate-400">Margin-based billing breakdown</p>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <SummaryCard
            label="Total billing"
            value={fmt(totalBilling)}
            sub={`${activeDeals.length} active deals`}
            icon={DollarSign}
            color="bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400"
          />
          <SummaryCard
            label="Total cost"
            value={fmt(totalCost)}
            sub="Vendor cost"
            icon={Package}
            color="bg-slate-100 dark:bg-white/[.06] text-slate-600 dark:text-slate-400"
          />
          <SummaryCard
            label="Gross profit"
            value={fmt(totalProfit)}
            sub={totalBilling > 0 ? `${((totalProfit / totalBilling) * 100).toFixed(1)}% of billing` : undefined}
            icon={TrendingUp}
            color="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400"
          />
          <SummaryCard
            label="Avg margin"
            value={`${avgMargin.toFixed(1)}%`}
            sub="Gross margin"
            icon={Percent}
            color="bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400"
          />
        </div>

        {/* Product breakdown row */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {PRODUCTS.map(p => {
            const stats = byProduct[p]
            const profit = stats.billing - stats.cost
            return (
              <div key={p} className={cn('rounded-lg border p-3', PRODUCT_COLORS[p]?.split(' ').slice(0, 2).join(' ') ?? '', 'border-current/20')}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold">{p}</span>
                  <span className="text-atom">{Math.round(stats.count)} deal{Math.round(stats.count) !== 1 ? 's' : ''}</span>
                </div>
                <p className="text-sm font-bold">{fmt(stats.billing)}</p>
                <p className="text-atom">{fmt(profit)} profit</p>
              </div>
            )
          })}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            <Filter size={11} className="text-slate-400" />
            <span className="text-atom text-slate-400 font-medium">Product:</span>
          </div>
          <button
            onClick={() => setFilterProduct(null)}
            className={cn('h-6 px-2.5 rounded-full text-atom font-semibold transition-colors', !filterProduct ? 'bg-primary text-white' : 'bg-slate-100 dark:bg-white/[.06] text-slate-500 hover:text-slate-700 dark:hover:text-white')}
          >
            All
          </button>
          {PRODUCTS.map(p => (
            <button
              key={p}
              onClick={() => setFilterProduct(filterProduct === p ? null : p)}
              className={cn('h-6 px-2.5 rounded-full text-atom font-semibold transition-colors', filterProduct === p ? 'bg-primary text-white' : 'bg-slate-100 dark:bg-white/[.06] text-slate-500 hover:text-slate-700')}
            >
              {p}
            </button>
          ))}
          <div className="w-px h-4 bg-slate-200 dark:bg-white/[.08] mx-1" />
          <div className="flex items-center gap-1.5">
            <span className="text-atom text-slate-400 font-medium">Stage:</span>
          </div>
          {[
            { key: 'active', label: 'Active' },
            { key: 'won', label: 'Won' },
            { key: 'lost', label: 'Lost' },
            { key: 'all', label: 'All' },
          ].map(s => (
            <button
              key={s.key}
              onClick={() => setFilterStage(s.key)}
              className={cn('h-6 px-2.5 rounded-full text-atom font-semibold transition-colors', filterStage === s.key ? 'bg-primary text-white' : 'bg-slate-100 dark:bg-white/[.06] text-slate-500 hover:text-slate-700')}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Deals table */}
      <div className="flex-1 px-6 py-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-sm text-slate-400">Loading...</div>
        ) : filteredDeals.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-sm text-slate-400">No reseller deals found</div>
        ) : (
          <div className="bg-white dark:bg-[#232428] rounded-xl border border-black/[.06] dark:border-white/[.07] overflow-hidden">
            {/* Table header */}
            <div className="grid grid-cols-[1fr_80px_110px_110px_90px_80px] gap-3 px-4 py-2.5 bg-slate-50 dark:bg-white/[.02] border-b border-black/[.05] dark:border-white/[.05] text-atom font-semibold text-slate-500 uppercase tracking-wide">
              <span>Deal</span>
              <span>Product</span>
              <span className="text-right">Cost price</span>
              <span className="text-right">Billing price</span>
              <span className="text-right">Gross profit</span>
              <span className="text-right">Margin</span>
            </div>

            {filteredDeals.map((deal, i) => {
              const selling = getSellingPrice(deal)
              const cost = getCostPrice(deal)
              const profit = selling - cost
              const margin = getMargin(deal)
              const products = (deal.servicesTags ?? []).filter(t => PRODUCTS.includes(t))
              const stageLabel = STAGE_LABELS[deal.stage ?? ''] ?? deal.stage ?? ''
              const isWon = deal.stage === 'closed_won'
              const isLost = deal.stage === 'closed_lost'

              return (
                <div
                  key={deal.id}
                  className={cn(
                    'grid grid-cols-[1fr_80px_110px_110px_90px_80px] gap-3 px-4 py-3 border-b border-black/[.03] dark:border-white/[.03] last:border-0 hover:bg-slate-50 dark:hover:bg-white/[.02] transition-colors',
                    i % 2 === 0 ? '' : 'bg-slate-50/40 dark:bg-white/[.01]'
                  )}
                >
                  {/* Deal info */}
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">{deal.title}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className={cn(
                        'text-atom font-medium',
                        isWon ? 'text-emerald-600' : isLost ? 'text-red-500' : 'text-slate-400'
                      )}>
                        {stageLabel}
                      </span>
                    </div>
                  </div>

                  {/* Products */}
                  <div className="flex flex-wrap gap-1 items-start">
                    {products.length > 0 ? products.map(p => <ProductBadge key={p} tag={p} />) : (
                      <span className="text-atom text-slate-300 dark:text-slate-600">--</span>
                    )}
                  </div>

                  {/* Cost price */}
                  <p className="text-xs text-right text-slate-600 dark:text-slate-300 font-mono">
                    {cost > 0 ? fmt(cost) : '--'}
                  </p>

                  {/* Billing price */}
                  <p className="text-xs text-right font-semibold text-slate-900 dark:text-white font-mono">
                    {selling > 0 ? fmt(selling) : '--'}
                  </p>

                  {/* Gross profit */}
                  <p className={cn('text-xs text-right font-semibold font-mono', profit > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400')}>
                    {profit > 0 ? fmt(profit) : '--'}
                  </p>

                  {/* Margin % */}
                  <p className={cn('text-xs text-right font-mono', margin !== null ? 'text-slate-700 dark:text-slate-300' : 'text-slate-300')}>
                    {margin !== null ? `${margin.toFixed(1)}%` : '--'}
                  </p>
                </div>
              )
            })}

            {/* Totals row */}
            <div className="grid grid-cols-[1fr_80px_110px_110px_90px_80px] gap-3 px-4 py-3 bg-slate-50 dark:bg-white/[.03] border-t border-black/[.06] dark:border-white/[.06]">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Total</span>
                <span className="text-atom text-slate-400">{filteredDeals.length} deal{filteredDeals.length !== 1 ? 's' : ''}</span>
              </div>
              <div />
              <p className="text-xs text-right font-bold text-slate-700 dark:text-slate-300 font-mono">
                {fmt(filteredDeals.reduce((s, d) => s + getCostPrice(d), 0))}
              </p>
              <p className="text-xs text-right font-bold text-slate-900 dark:text-white font-mono">
                {fmt(filteredDeals.reduce((s, d) => s + getSellingPrice(d), 0))}
              </p>
              <p className="text-xs text-right font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                {fmt(filteredDeals.reduce((s, d) => s + getProfit(d), 0))}
              </p>
              <div />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
