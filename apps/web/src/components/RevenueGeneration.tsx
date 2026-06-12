'use client'

import { useMemo, useState, useCallback, useRef, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { useGetDeals, useGetUsers } from '@/lib/hooks/queries'
import { useUpdateDeal, useUpsertBilling, type UpsertBillingInput } from '@/lib/hooks/mutations'
import { queryKeys } from '@/lib/query-keys'
import { cn, formatCurrency } from '@/lib/utils'
import {
  buildResellerSummary,
  formatPhp,
  getResellerBillingPrice,
  getResellerCostPrice,
  getResellerGrossProfit,
  getResellerMargin,
  getResellerProducts,
  isActiveResellerDeal,
  RESELLER_PRODUCTS,
  type ResellerProduct,
} from '@/lib/revenue/reseller'
import { StagePill } from '@/components/StagePill'
import { Avatar } from '@/components/Avatar'
import {
  Dialog,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from '@/components/ui/dialog'
import { TrendingUp, Building2, Rocket, Archive, ChevronRight, DollarSign, Package, Percent, Plus } from 'lucide-react'
import Link from 'next/link'
import type { ApiDeal, ApiUser } from '@/lib/types'

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTH_KEYS = ['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11', '2026-12']
const MONTH_LABELS = ['May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const TARGET_MONTHLY = 22_000_000

const STARTUP_TAG = 'internal_products'
const EXISTING_TAG = 'existing_client'

function dealStartupCategory(deal: ApiDeal): 'hireai' | 'agency' | null {
  if (!deal.servicesTags?.includes(STARTUP_TAG)) return null
  const name = (deal.catalogItemName ?? '').toLowerCase()
  if (name.includes('hireai') || name.includes('hire ai')) return 'hireai'
  return 'agency'
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function numVal(v: string | null | undefined): number {
  if (!v) return 0
  const n = parseFloat(v.replace(/,/g, ''))
  return isNaN(n) ? 0 : n
}

function formatMoneyInput(value: string): string {
  const raw = value.replace(/[^0-9.]/g, '')
  const [whole = '', ...decimalParts] = raw.split('.')
  const formattedWhole = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  const decimal = decimalParts.join('')
  return decimalParts.length > 0 ? `${formattedWhole}.${decimal}` : formattedWhole
}

function phpFmt(n: number): string {
  if (n === 0) return ', '
  // formatCurrency already prefixes with 'P' — swap it for the proper peso sign.
  return '₱' + formatCurrency(n).slice(1)
}

/** Get the revenue for a deal in a specific month.
 * Priority: monthlyRevenue[monthKey] > mrr > value/contractLength > value/12 */
function dealMonthValue(deal: ApiDeal, monthKey: string): number {
  // Per-month override
  if (deal.monthlyRevenue && deal.monthlyRevenue[monthKey] !== undefined) {
    return deal.monthlyRevenue[monthKey]
  }
  // Flat MRR
  const mrr = numVal(deal.mrr)
  if (mrr > 0) return mrr
  // Value / contract length
  const v = numVal(deal.value)
  if (v <= 0) return 0
  const len = deal.contractLength && deal.contractLength > 0 ? deal.contractLength : 12
  return Math.round(v / len)
}

// ─── Inline Editable Cell ─────────────────────────────────────────────────────

function EditableMonthCell({
  deal,
  monthKey,
  onSave,
}: {
  deal: ApiDeal
  monthKey: string
  onSave: (dealId: string, monthKey: string, value: number) => void
}) {
  const currentValue = dealMonthValue(deal, monthKey)
  const hasOverride = deal.monthlyRevenue && deal.monthlyRevenue[monthKey] !== undefined
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  function startEdit() {
    setDraft(currentValue > 0 ? String(currentValue) : '')
    setEditing(true)
  }

  function commitEdit() {
    setEditing(false)
    const newVal = parseFloat(draft.replace(/,/g, '')) || 0
    if (newVal !== currentValue) {
      onSave(deal.id, monthKey, newVal)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') commitEdit()
    if (e.key === 'Escape') setEditing(false)
    // Tab moves to next cell naturally
    if (e.key === 'Tab') commitEdit()
  }

  if (editing) {
    return (
      <td className="px-1 py-1">
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={handleKeyDown}
          className="w-full h-7 px-2 text-right text-ssm tabular-nums rounded border border-primary/30 bg-card bg-secondary text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
        />
      </td>
    )
  }

  return (
    <td
      className="px-3 py-2 text-right text-ssm tabular-nums cursor-pointer hover:bg-primary/[.04] dark:hover:bg-primary/[.06] transition-colors"
      onClick={startEdit}
      title="Click to edit"
    >
      {currentValue > 0 ? (
        <span className={hasOverride ? 'text-primary font-medium' : 'text-foreground'}>
          {phpFmt(currentValue)}
        </span>
      ) : (
        <span className="text-text-faint">, </span>
      )}
    </td>
  )
}

// ─── Shared Section Components ────────────────────────────────────────────────

function SectionHeader({ icon, title, color }: { icon: React.ReactNode; title: string; color: string }) {
  return (
    <div className={`flex items-center gap-2.5 px-4 py-3 rounded-md ${color} mb-3`}>
      <div className="shrink-0">{icon}</div>
      <span className="text-sm font-semibold">{title}</span>
    </div>
  )
}

function MonthHeaders() {
  return (
    <>
      {MONTH_LABELS.map(m => (
        <th key={m} className="px-3 py-2.5 eyebrow-label text-right min-w-[90px] whitespace-nowrap">{m}</th>
      ))}
    </>
  )
}

function AddRevenueIconButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Add revenue"
      title="Add revenue"
      className="ml-auto flex h-5 w-5 items-center justify-center rounded-md bg-primary/10 text-primary transition-colors hover:bg-primary/15 dark:bg-primary/20 dark:text-blue-300 dark:hover:bg-primary/25"
    >
      <Plus size={13} strokeWidth={2.4} />
    </button>
  )
}

function OwnerCell({ user }: { user: ApiUser | undefined }) {
  if (!user) {
    return <span className="text-xs text-text-faint">Unassigned</span>
  }

  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <Avatar name={user.name || user.email} email={user.email ?? undefined} src={user.image ?? undefined} size={18} />
      <span className="truncate text-xs text-muted-foreground">{(user.name || user.email).split(' ')[0]}</span>
    </div>
  )
}

function RevenueBillingModal({
  deal,
  onClose,
  onSave,
  isSaving,
}: {
  deal: ApiDeal
  onClose: () => void
  onSave: (dealId: string, data: UpsertBillingInput) => void
  isSaving: boolean
}) {
  const [billingType, setBillingType] = useState<'annual' | 'monthly' | 'milestone'>('monthly')
  const [amount, setAmount] = useState('')
  const [contractStart, setContractStart] = useState('')
  const [contractEnd, setContractEnd] = useState('')

  useEffect(() => {
    setBillingType('monthly')
    setAmount('')
    setContractStart('')
    setContractEnd('')
  }, [deal.id])

  const amountLabel = billingType === 'annual'
    ? 'Annual total'
    : billingType === 'monthly'
    ? 'Monthly amount'
    : 'Milestone total'

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    onSave(deal.id, {
      billingType,
      contractStart: contractStart || null,
      contractEnd: contractEnd || null,
      amount: amount.replace(/,/g, '') || null,
    })
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogPortal>
        <DialogOverlay className="z-40 bg-black/45" />
        <DialogPrimitive.Content
          className="fixed left-[50%] top-[50%] z-50 w-full max-w-[420px] translate-x-[-50%] translate-y-[-50%] bg-card rounded-lg shadow-lg border border-border mx-4 animate-in zoom-in-95 fade-in-0 duration-150 ease-out data-[state=closed]:animate-out data-[state=closed]:zoom-out-95 data-[state=closed]:fade-out-0 data-[state=closed]:duration-100 data-[state=closed]:ease-in"
          onOpenAutoFocus={event => event.preventDefault()}
        >
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <div className="min-w-0">
              <DialogTitle className="text-sm font-semibold text-foreground">Add Billing</DialogTitle>
              <DialogDescription className="mt-0.5 truncate text-xs text-slate-400">
                {deal.title}
              </DialogDescription>
              <p className="mt-0.5 truncate text-xxs text-text-faint">
                Brand: {deal.brandName ?? 'No brand assigned'}
              </p>
            </div>
            <DialogPrimitive.Close className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:bg-surface-hover  transition-colors">
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </DialogPrimitive.Close>
          </div>

          <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-4">
          <div className="mb-3">
            <label className="mb-1.5 block eyebrow-label text-muted-foreground">
              Billing type
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { value: 'monthly', label: 'Monthly' },
                { value: 'annual', label: 'Annual' },
                { value: 'milestone', label: 'Milestone' },
              ].map(option => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setBillingType(option.value as 'annual' | 'monthly' | 'milestone')}
                  className={cn(
                    'h-8 rounded-md text-xs font-semibold transition-colors',
                    billingType === option.value
                      ? 'bg-primary/10 text-primary dark:bg-primary/20 dark:text-blue-300'
                      : 'border border-border text-slate-600 hover:bg-surface-hover border-border text-muted-foreground ',
                  )}
                >
                  {option.label}
              </button>
            ))}
          </div>
          </div>

          <div>
            <label className="mb-1 block eyebrow-label text-muted-foreground">
              {amountLabel}
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={event => setAmount(formatMoneyInput(event.target.value))}
              placeholder="0.00"
              className="h-9 w-full rounded-md border border-border bg-transparent px-2 text-xs tabular-nums text-slate-800 outline-none transition-shadow focus:ring-1 focus:ring-inset focus:ring-primary/30 border-border text-foreground"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block eyebrow-label text-muted-foreground">Start</label>
              <input
                type="date"
                value={contractStart}
                onChange={event => setContractStart(event.target.value)}
                className="h-9 w-full rounded-md border border-border bg-transparent px-2 text-xs text-slate-800 outline-none transition-shadow focus:ring-1 focus:ring-inset focus:ring-primary/30 border-border text-foreground"
              />
            </div>
            <div>
              <label className="mb-1 block eyebrow-label text-muted-foreground">End</label>
              <input
                type="date"
                value={contractEnd}
                onChange={event => setContractEnd(event.target.value)}
                className="h-9 w-full rounded-md border border-border bg-transparent px-2 text-xs text-slate-800 outline-none transition-shadow focus:ring-1 focus:ring-inset focus:ring-primary/30 border-border text-foreground"
              />
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-9 rounded-lg border border-border text-ssm font-medium text-muted-foreground hover:bg-surface-hover  transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 h-9 flex items-center justify-center gap-1.5 rounded-lg text-ssm font-medium text-white transition-colors disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, var(--primary), var(--color-primary-accent))' }}
            >
              <>{isSaving && <span className="inline-block w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />}Save Billing</>
            </button>
          </div>
        </form>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  )
}

const RESELLER_PRODUCT_STYLES: Record<ResellerProduct, string> = {
  GWS: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
  GCP: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
  Josys: 'bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300',
}

const RESELLER_PRODUCT_CARD_STYLES: Record<ResellerProduct, string> = {
  GWS: 'bg-blue-50/70 border-blue-200 text-blue-950 dark:bg-blue-950/20 dark:border-blue-900/60 dark:text-blue-100',
  GCP: 'bg-amber-50/70 border-amber-200 text-amber-950 dark:bg-amber-950/20 dark:border-amber-900/60 dark:text-amber-100',
  Josys: 'bg-violet-50/70 border-violet-200 text-violet-950 dark:bg-violet-950/20 dark:border-violet-900/60 dark:text-violet-100',
}

function ResellerProductBadge({ product }: { product: ResellerProduct }) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xxs font-bold', RESELLER_PRODUCT_STYLES[product])}>
      {product}
    </span>
  )
}

function EmptyValue({ align = 'right' }: { align?: 'left' | 'right' }) {
  return (
    <span className={cn('block text-text-faint', align === 'right' && 'text-right')}>
      --
    </span>
  )
}

function ResellerMetricCard({
  label,
  value,
  sub,
  icon: Icon,
  tone,
}: {
  label: string
  value: string
  sub: string
  icon: React.ElementType
  tone: 'blue' | 'slate' | 'emerald' | 'amber'
}) {
  const iconClass = {
    blue: 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400',
    slate: 'bg-secondary text-slate-600  text-muted-foreground',
    emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400',
    amber: 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400',
  }[tone]

  return (
    <div className="rounded-md border border-border bg-card p-4 shadow-card">
      <div className="mb-2 flex items-start justify-between gap-3">
        <p className="text-xs font-semibold text-muted-foreground">{label}</p>
        <div className={cn('flex h-8 w-8 items-center justify-center rounded-md', iconClass)}>
          <Icon size={16} />
        </div>
      </div>
      <p className="text-base font-bold tabular-nums text-foreground">{value}</p>
      <p className="mt-1 text-xs text-text-faint">{sub}</p>
    </div>
  )
}

function ResellerSummaryCards({ deals }: { deals: ApiDeal[] }) {
  const summary = buildResellerSummary(deals)
  const profitPct = summary.totalBilling > 0 ? (summary.grossProfit / summary.totalBilling) * 100 : 0

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <ResellerMetricCard
          label="Total billing"
          value={formatPhp(summary.totalBilling)}
          sub={`${summary.activeDeals.length} active deals`}
          icon={DollarSign}
          tone="blue"
        />
        <ResellerMetricCard
          label="Total cost"
          value={formatPhp(summary.totalCost)}
          sub="Vendor cost"
          icon={Package}
          tone="slate"
        />
        <ResellerMetricCard
          label="Gross profit"
          value={formatPhp(summary.grossProfit)}
          sub={`${profitPct.toFixed(1)}% of billing`}
          icon={TrendingUp}
          tone="emerald"
        />
        <ResellerMetricCard
          label="Avg margin"
          value={`${summary.avgMargin.toFixed(1)}%`}
          sub="Gross margin"
          icon={Percent}
          tone="amber"
        />
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {RESELLER_PRODUCTS.map(product => {
          const stats = summary.byProduct[product]
          const count = Math.round(stats.count)

          return (
            <div key={product} className={cn('rounded-md border px-4 py-3', RESELLER_PRODUCT_CARD_STYLES[product])}>
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="text-xs font-bold">{product}</p>
                <p className="text-xs text-current/70">
                  {count} deal{count === 1 ? '' : 's'}
                </p>
              </div>
              <p className="text-base font-bold tabular-nums">{formatPhp(stats.billing)}</p>
              <p className="mt-1 text-xs text-current/75">{formatPhp(stats.profit)} profit</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ResellerPricingTable({ deals }: { deals: ApiDeal[] }) {
  const totalCost = deals.reduce((sum, deal) => sum + getResellerCostPrice(deal), 0)
  const totalBilling = deals.reduce((sum, deal) => sum + getResellerBillingPrice(deal), 0)
  const totalProfit = deals.reduce((sum, deal) => sum + getResellerGrossProfit(deal), 0)

  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full min-w-[980px] border-collapse text-left">
        <thead>
          <tr className="border-b border-border bg-surface-alt">
            <th className="px-4 py-2.5 eyebrow-label">Deal</th>
            <th className="px-3 py-2.5 eyebrow-label">Product</th>
            <th className="px-3 py-2.5 text-right eyebrow-label">Cost price</th>
            <th className="px-3 py-2.5 text-right eyebrow-label">Billing price</th>
            <th className="px-3 py-2.5 text-right eyebrow-label">Gross profit</th>
            <th className="px-3 py-2.5 text-right eyebrow-label">Margin</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-black/[.04] dark:divide-white/[.04]">
          {deals.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-4 py-10 text-center text-ssm text-slate-400">
                No reseller deals found
              </td>
            </tr>
          ) : deals.map((deal, index) => {
            const products = getResellerProducts(deal)
            const cost = getResellerCostPrice(deal)
            const billing = getResellerBillingPrice(deal)
            const profit = getResellerGrossProfit(deal)
            const margin = getResellerMargin(deal)

            return (
              <tr
                key={deal.id}
                className={cn(
                  'transition-colors hover:bg-surface-hover',
                  index % 2 === 0 ? '' : 'bg-surface-alt',
                )}
              >
                <td className="px-4 py-2.5">
                  <Link
                    href={`/deals/${deal.id}?from=revenue`}
                    className="group inline-flex max-w-[520px]"
                  >
                    <span className="truncate text-ssm font-medium text-slate-800 transition-colors group-hover:text-primary text-foreground">
                      {deal.title}
                    </span>
                  </Link>
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex flex-wrap gap-1.5">
                    {products.length > 0
                      ? products.map(product => <ResellerProductBadge key={product} product={product} />)
                      : <EmptyValue align="left" />}
                  </div>
                </td>
                <td className="px-3 py-2.5 text-right text-ssm font-semibold tabular-nums text-muted-foreground">
                  {cost > 0 ? formatPhp(cost) : <EmptyValue />}
                </td>
                <td className="px-3 py-2.5 text-right text-ssm font-bold tabular-nums text-foreground">
                  {billing > 0 ? formatPhp(billing) : <EmptyValue />}
                </td>
                <td className={cn(
                  'px-3 py-2.5 text-right text-ssm font-bold tabular-nums',
                  profit > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-text-faint',
                )}>
                  {profit > 0 ? formatPhp(profit) : '--'}
                </td>
                <td className="px-3 py-2.5 text-right text-ssm font-semibold tabular-nums text-muted-foreground">
                  {margin !== null ? `${margin.toFixed(1)}%` : <EmptyValue />}
                </td>
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr className="border-t border-border bg-surface-alt border-border ">
            <td className="px-4 py-2.5">
              <div className="flex items-center gap-2">
                <span className="text-ssm font-bold text-muted-foreground">Total</span>
                <span className="text-xs text-slate-400">{deals.length} deal{deals.length === 1 ? '' : 's'}</span>
              </div>
            </td>
            <td />
            <td className="px-3 py-2.5 text-right text-ssm font-bold tabular-nums text-muted-foreground">
              {formatPhp(totalCost)}
            </td>
            <td className="px-3 py-2.5 text-right text-ssm font-bold tabular-nums text-foreground">
              {formatPhp(totalBilling)}
            </td>
            <td className="px-3 py-2.5 text-right text-ssm font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
              {formatPhp(totalProfit)}
            </td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

function ResellerTableTabs({
  value,
  onChange,
}: {
  value: ResellerTableView
  onChange: (value: ResellerTableView) => void
}) {
  const tabs: { value: ResellerTableView; label: string }[] = [
    { value: 'pricing', label: 'Deal pricing' },
    { value: 'mrr', label: 'MRR' },
  ]

  return (
    <div className="flex items-center gap-1.5">
      {tabs.map(tab => (
        <button
          key={tab.value}
          type="button"
          onClick={() => onChange(tab.value)}
          className={cn(
            'rounded-md px-2.5 py-1 text-xxs font-medium transition-colors active:scale-[0.98]',
            value === tab.value
              ? 'bg-primary/10 text-primary'
              : 'bg-card text-muted-foreground hover:bg-surface-hover',
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}

function ResellerMonthlyRevenueSection({
  deals,
  onMonthSave,
}: {
  deals: ApiDeal[]
  onMonthSave: (dealId: string, monthKey: string, value: number) => void
}) {
  const columnTotals = MONTH_KEYS.map(monthKey =>
    deals.reduce((sum, deal) => sum + dealMonthValue(deal, monthKey), 0)
  )

  return (
    <div>
      <SectionHeader
        icon={<TrendingUp size={16} className="text-emerald-600 dark:text-emerald-400" />}
        title="Reseller Monthly Revenue"
        color="bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-200"
      />
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full min-w-[1120px] border-collapse text-left">
          <thead>
            <tr className="border-b border-border bg-surface-alt">
              <th className="sticky left-0 z-10 w-[320px] bg-surface-alt px-4 py-2.5 eyebrow-label bg-surface-alt">Deal</th>
              <th className="w-[110px] px-3 py-2.5 eyebrow-label">Product</th>
              <th className="w-[90px] px-3 py-2.5 eyebrow-label">Stage</th>
              <th className="w-[120px] px-3 py-2.5 text-right eyebrow-label">Billing</th>
              <MonthHeaders />
            </tr>
          </thead>
          <tbody className="divide-y divide-black/[.04] dark:divide-white/[.04]">
            {deals.length === 0 ? (
              <tr>
                <td colSpan={4 + MONTH_KEYS.length} className="px-4 py-10 text-center text-ssm text-slate-400">
                  No reseller deals found
                </td>
              </tr>
            ) : deals.map((deal, index) => {
              const products = getResellerProducts(deal)
              return (
                <tr key={deal.id} className={index % 2 === 0 ? '' : 'bg-surface-alt'}>
                  <td className="sticky left-0 z-10 bg-card px-4 py-2.5">
                    <Link
                      href={`/deals/${deal.id}?from=revenue`}
                      className="flex items-center gap-1 text-ssm font-medium text-slate-800 transition-colors hover:text-primary text-foreground dark:hover:text-primary"
                    >
                      <span className="max-w-[270px] truncate">{deal.title}</span>
                      <ChevronRight size={11} className="shrink-0 opacity-50" />
                    </Link>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-wrap gap-1">
                      {products.length > 0
                        ? products.map(product => <ResellerProductBadge key={product} product={product} />)
                        : <EmptyValue align="left" />}
                    </div>
                  </td>
                  <td className="px-3 py-2.5"><StagePill stage={deal.stage} /></td>
                  <td className="px-3 py-2.5 text-right text-ssm font-semibold tabular-nums text-muted-foreground">
                    {formatPhp(getResellerBillingPrice(deal))}
                  </td>
                  {MONTH_KEYS.map(monthKey => (
                    <EditableMonthCell key={monthKey} deal={deal} monthKey={monthKey} onSave={onMonthSave} />
                  ))}
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-emerald-200 bg-emerald-50/70 dark:border-emerald-800/50 dark:bg-emerald-950/20">
              <td colSpan={4} className="sticky left-0 z-10 bg-emerald-50/70 px-4 py-2.5 text-ssm font-semibold text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-300">
                Reseller Monthly Subtotal
              </td>
              {columnTotals.map((total, index) => (
                <td key={index} className="px-3 py-2.5 text-right text-ssm font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">
                  {total > 0 ? phpFmt(total) : ', '}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

// ─── Section A: Project-Based Revenue ─────────────────────────────────────────

function ProjectRevenueSection({
  deals,
  onMonthSave,
  onBillingClick,
  userById,
}: {
  deals: ApiDeal[]
  onMonthSave: (dealId: string, monthKey: string, value: number) => void
  onBillingClick: (deal: ApiDeal) => void
  userById: Map<string, ApiUser>
}) {
  const projectDeals = deals.filter(d => !d.servicesTags?.includes(STARTUP_TAG) && !d.servicesTags?.includes(EXISTING_TAG))
  if (projectDeals.length === 0) return null

  const columnTotals = MONTH_KEYS.map(mk =>
    projectDeals.reduce((sum, d) => sum + dealMonthValue(d, mk), 0)
  )

  return (
    <div>
      <SectionHeader
        icon={<Building2 size={16} className="text-teal-600 dark:text-teal-400" />}
        title="Section A: Project Based Revenue"
        color="bg-teal-50 dark:bg-teal-950/30 text-teal-800 dark:text-teal-200"
      />
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-border bg-surface-alt">
              <th className="px-4 py-2.5 eyebrow-label w-[260px] sticky left-0 bg-surface-alt bg-surface-alt z-10">Project / Deal</th>
              <th className="px-3 py-2.5 eyebrow-label w-[70px]">Owner</th>
              <th className="px-3 py-2.5 eyebrow-label w-[70px]">Stage</th>
              <th className="px-3 py-2.5 eyebrow-label text-right w-[100px]">Value</th>
              <MonthHeaders />
            </tr>
          </thead>
          <tbody className="divide-y divide-black/[.04] dark:divide-white/[.04]">
            {projectDeals.length === 0 ? (
              <tr>
                <td colSpan={4 + MONTH_KEYS.length} className="px-4 py-8 text-center text-ssm text-slate-400">
                  No project-based deals found
                </td>
              </tr>
            ) : (
              projectDeals.map((deal, i) => {
                const v = numVal(deal.value)
                return (
                  <tr key={deal.id} className={i % 2 === 0 ? '' : 'bg-surface-alt'}>
                    <td className="px-4 py-2.5 sticky left-0 bg-card z-10">
                      <Link
                        href={`/deals/${deal.id}?from=revenue`}
                        className="text-ssm font-medium text-foreground hover:text-primary dark:hover:text-primary transition-colors flex items-center gap-1 group"
                      >
                        <span className="truncate max-w-[220px]">{deal.title}</span>
                        <ChevronRight size={11} className="opacity-0 group-hover:opacity-60 transition-opacity shrink-0" />
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <OwnerCell user={deal.assignedTo ? userById.get(deal.assignedTo) : undefined} />
                    </td>
                    <td className="px-3 py-2.5"><StagePill stage={deal.stage} /></td>
                    <td className="px-3 py-2.5 text-right text-ssm tabular-nums font-medium text-muted-foreground">
                      {v > 0 ? (
                        <div>
                          <div>{phpFmt(v)}</div>
                          {deal.contractLength && deal.contractLength > 0 && (
                            <div className="text-atom text-slate-400">{deal.contractLength}mo</div>
                          )}
                        </div>
                      ) : (
                        <AddRevenueIconButton onClick={() => onBillingClick(deal)} />
                      )}
                    </td>
                    {MONTH_KEYS.map(mk => (
                      <EditableMonthCell key={mk} deal={deal} monthKey={mk} onSave={onMonthSave} />
                    ))}
                  </tr>
                )
              })
            )}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-teal-200 dark:border-teal-800/50 bg-teal-50/60 dark:bg-teal-950/20">
              <td colSpan={4} className="px-4 py-2.5 text-ssm font-semibold text-teal-700 dark:text-teal-300 sticky left-0 bg-teal-50/60 dark:bg-teal-950/20 z-10">
                Project Revenue Subtotal
              </td>
              {columnTotals.map((total, i) => (
                <td key={i} className="px-3 py-2.5 text-right text-ssm font-semibold tabular-nums text-teal-700 dark:text-teal-300">
                  {total > 0 ? phpFmt(total) : ', '}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

// ─── Section B: Startup-Based Revenue ─────────────────────────────────────────

function StartupRevenueSection({
  deals,
  onMonthSave,
  onBillingClick,
  userById,
}: {
  deals: ApiDeal[]
  onMonthSave: (dealId: string, monthKey: string, value: number) => void
  onBillingClick: (deal: ApiDeal) => void
  userById: Map<string, ApiUser>
}) {
  const startupDeals = deals.filter(d => d.servicesTags?.includes(STARTUP_TAG))
  if (startupDeals.length === 0) return null
  const agencyDeals = startupDeals.filter(d => dealStartupCategory(d) === 'agency')
  const hireaiDeals = startupDeals.filter(d => dealStartupCategory(d) === 'hireai')

  const combinedTotals = MONTH_KEYS.map(mk =>
    startupDeals.reduce((s, d) => s + dealMonthValue(d, mk), 0)
  )

  function DealRow({ deal, i }: { deal: ApiDeal; i: number }) {
    const mrr = numVal(deal.mrr)
    const otf = numVal(deal.oneTimeFee)

    return (
      <tr className={i % 2 === 0 ? '' : 'bg-surface-alt'}>
        <td className="px-4 py-2.5 sticky left-0 bg-card z-10">
          <Link
            href={`/deals/${deal.id}?from=revenue`}
            className="text-ssm font-medium text-foreground hover:text-primary dark:hover:text-primary transition-colors flex items-center gap-1 group"
          >
            <span className="truncate max-w-[220px]">{deal.title}</span>
            <ChevronRight size={11} className="opacity-0 group-hover:opacity-60 transition-opacity shrink-0" />
          </Link>
        </td>
        <td className="px-3 py-2.5 whitespace-nowrap">
          <OwnerCell user={deal.assignedTo ? userById.get(deal.assignedTo) : undefined} />
        </td>
        <td className="px-3 py-2.5"><StagePill stage={deal.stage} /></td>
        <td className="px-3 py-2.5 text-right text-ssm tabular-nums text-muted-foreground">
          {otf > 0 ? phpFmt(otf) : ', '}
        </td>
        <td className="px-3 py-2.5 text-right text-ssm tabular-nums font-medium text-muted-foreground">
          {mrr > 0 ? phpFmt(mrr) : (
            <AddRevenueIconButton onClick={() => onBillingClick(deal)} />
          )}
        </td>
        {MONTH_KEYS.map(mk => (
          <EditableMonthCell key={mk} deal={deal} monthKey={mk} onSave={onMonthSave} />
        ))}
      </tr>
    )
  }

  function SubgroupHeader({ label, color }: { label: string; color: string }) {
    return (
      <tr>
        <td colSpan={5 + MONTH_KEYS.length} className={`px-4 py-2 eyebrow-label font-bold ${color}`}>
          {label}
        </td>
      </tr>
    )
  }

  return (
    <div>
      <SectionHeader
        icon={<Rocket size={16} className="text-violet-600 dark:text-violet-400" />}
        title="Section B: Startup Based Revenue (MRR)"
        color="bg-violet-50 dark:bg-violet-950/30 text-violet-800 dark:text-violet-200"
      />
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-border bg-surface-alt">
              <th className="px-4 py-2.5 eyebrow-label w-[260px] sticky left-0 bg-surface-alt bg-surface-alt z-10">Client</th>
              <th className="px-3 py-2.5 eyebrow-label w-[70px]">Owner</th>
              <th className="px-3 py-2.5 eyebrow-label w-[70px]">Stage</th>
              <th className="px-3 py-2.5 eyebrow-label text-right w-[112px] whitespace-nowrap">One-Time</th>
              <th className="px-3 py-2.5 eyebrow-label text-right w-[90px] whitespace-nowrap">MRR</th>
              <MonthHeaders />
            </tr>
          </thead>
          <tbody className="divide-y divide-black/[.04] dark:divide-white/[.04]">
            <SubgroupHeader label="The Agency" color="bg-teal-50 dark:bg-teal-950/20 text-teal-700 dark:text-teal-400" />
            {agencyDeals.length === 0 ? (
              <tr><td colSpan={5 + MONTH_KEYS.length} className="px-8 py-3 text-ssm text-slate-400 italic">No Agency deals</td></tr>
            ) : agencyDeals.map((d, i) => <DealRow key={d.id} deal={d} i={i} />)}

            <SubgroupHeader label="HireAI" color="bg-violet-50 dark:bg-violet-950/20 text-violet-700 dark:text-violet-400" />
            {hireaiDeals.length === 0 ? (
              <tr><td colSpan={5 + MONTH_KEYS.length} className="px-8 py-3 text-ssm text-slate-400 italic">No HireAI deals</td></tr>
            ) : hireaiDeals.map((d, i) => <DealRow key={d.id} deal={d} i={i} />)}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-violet-200 dark:border-violet-800/50 bg-violet-50/60 dark:bg-violet-950/20">
              <td colSpan={5} className="px-4 py-2.5 text-ssm font-semibold text-violet-700 dark:text-violet-300 sticky left-0 bg-violet-50/60 dark:bg-violet-950/20 z-10">
                Startup Revenue Subtotal (MRR)
              </td>
              {combinedTotals.map((total, i) => (
                <td key={i} className="px-3 py-2.5 text-right text-ssm font-semibold tabular-nums text-violet-700 dark:text-violet-300">
                  {total > 0 ? phpFmt(total) : ', '}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

// ─── Section C: Existing Clients ─────────────────────────────────────────────

function ExistingClientsSection({
  deals,
  onMonthSave,
}: {
  deals: ApiDeal[]
  onMonthSave: (dealId: string, monthKey: string, value: number) => void
}) {
  const existingDeals = deals.filter(d => d.servicesTags?.includes(EXISTING_TAG))
  if (existingDeals.length === 0) return null
  const columnTotals = MONTH_KEYS.map(mk =>
    existingDeals.reduce((s, d) => s + dealMonthValue(d, mk), 0)
  )

  return (
    <div>
      <SectionHeader
        icon={<Archive size={16} className="text-amber-600 dark:text-amber-400" />}
        title="Section C: Existing Clients (Retainers)"
        color="bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-200"
      />
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-border bg-surface-alt">
              <th className="px-4 py-2.5 eyebrow-label w-[260px] sticky left-0 bg-surface-alt bg-surface-alt z-10">Client</th>
              <th className="px-3 py-2.5 eyebrow-label text-right w-[110px]">MRR</th>
              <MonthHeaders />
            </tr>
          </thead>
          <tbody className="divide-y divide-black/[.04] dark:divide-white/[.04]">
            {existingDeals.length === 0 ? (
              <tr><td colSpan={2 + MONTH_KEYS.length} className="px-4 py-8 text-center text-ssm text-slate-400">No existing clients</td></tr>
            ) : (
              existingDeals.map((deal, i) => {
                const mrr = numVal(deal.mrr)
                const displayName = deal.title.replace(' - Existing Client', '')
                return (
                  <tr key={deal.id} className={i % 2 === 0 ? '' : 'bg-surface-alt'}>
                    <td className="px-4 py-2.5 sticky left-0 bg-card z-10">
                      <Link
                        href={`/deals/${deal.id}?from=revenue`}
                        className="text-ssm font-medium text-foreground hover:text-primary dark:hover:text-primary transition-colors flex items-center gap-1 group"
                      >
                        <span className="truncate max-w-[220px]">{displayName}</span>
                        <ChevronRight size={11} className="opacity-0 group-hover:opacity-60 transition-opacity shrink-0" />
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 text-right text-ssm tabular-nums font-medium text-muted-foreground">
                      {mrr > 0 ? phpFmt(mrr) : ', '}
                    </td>
                    {MONTH_KEYS.map(mk => (
                      <EditableMonthCell key={mk} deal={deal} monthKey={mk} onSave={onMonthSave} />
                    ))}
                  </tr>
                )
              })
            )}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-amber-200 dark:border-amber-800/50 bg-amber-50/60 dark:bg-amber-950/20">
              <td className="px-4 py-2.5 text-ssm font-semibold text-amber-700 dark:text-amber-300 sticky left-0 bg-amber-50/60 dark:bg-amber-950/20 z-10">
                Existing Clients Subtotal
              </td>
              <td />
              {columnTotals.map((total, i) => (
                <td key={i} className="px-3 py-2.5 text-right text-ssm font-semibold tabular-nums text-amber-700 dark:text-amber-300">
                  {total > 0 ? phpFmt(total) : ', '}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

type RevenueGenerationProps = {
  /** Catalog parent category filter — undefined = All deals. */
  catalogProductType?: 'internal' | 'service' | 'reseller' | 'partnership'
  /** Drill into a specific catalog row within the active product_type. */
  catalogItemId?: string
}

type ResellerTableView = 'pricing' | 'mrr'

export function RevenueGeneration({ catalogProductType, catalogItemId }: RevenueGenerationProps = {}) {
  const { data: rawDeals = [], isLoading } = useGetDeals()
  const isFiltered = !!catalogProductType || !!catalogItemId
  const allDeals = useMemo(() => {
    let result = rawDeals.filter(deal => deal.catalogItemType !== 'partnership')
    if (catalogProductType) result = result.filter(d => d.catalogItemType === catalogProductType)
    if (catalogItemId) result = result.filter(d => d.catalogItemId === catalogItemId)
    return result
  }, [rawDeals, catalogProductType, catalogItemId])
  const { data: allUsers = [] } = useGetUsers()
  const qc = useQueryClient()
  const [resellerTableView, setResellerTableView] = useState<ResellerTableView>('pricing')
  const [billingDeal, setBillingDeal] = useState<ApiDeal | null>(null)

  const updateDeal = useUpdateDeal({
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.deals.all })
    },
  })
  const upsertBilling = useUpsertBilling()

  const userById = useMemo(() => {
    return new Map(allUsers.map(u => [u.id, u]))
  }, [allUsers])

  // Exclude parked + lost
  const activeDeals = useMemo(() =>
    allDeals.filter(d => !['closed_lost', 'parked'].includes(d.stage)),
    [allDeals]
  )

  // Per-month save handler: updates monthlyRevenue JSON on the deal
  const handleMonthSave = useCallback((dealId: string, monthKey: string, value: number) => {
    const deal = allDeals.find(d => d.id === dealId)
    if (!deal) return

    const currentMonthly = deal.monthlyRevenue ? { ...deal.monthlyRevenue } : {}

    // If value matches the deal's flat MRR/computed monthly, remove the override
    const mrr = numVal(deal.mrr)
    const flatMonthly = mrr > 0 ? mrr : (numVal(deal.value) > 0 ? Math.round(numVal(deal.value) / ((deal.contractLength && deal.contractLength > 0) ? deal.contractLength : 12)) : 0)

    if (value === flatMonthly && value > 0) {
      delete currentMonthly[monthKey]
    } else {
      currentMonthly[monthKey] = value
    }

    // If all overrides removed, set null
    const monthlyRevenue = Object.keys(currentMonthly).length > 0 ? currentMonthly : null

    // Optimistic update for snappy UX
    qc.setQueryData<ApiDeal[]>(queryKeys.deals.all, (old) =>
      old?.map(d => d.id === dealId ? { ...d, monthlyRevenue } : d)
    )

    updateDeal.mutate({ id: dealId, data: { monthlyRevenue } as any })
  }, [allDeals, qc, updateDeal])

  const handleBillingSave = useCallback((dealId: string, data: UpsertBillingInput) => {
    upsertBilling.mutate(
      { dealId, data },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: queryKeys.billing.byDeal(dealId) })
          qc.invalidateQueries({ queryKey: queryKeys.deals.all })
          setBillingDeal(null)
        },
      },
    )
  }, [qc, upsertBilling])

  // Totals (per-month aware)
  const projectSubtotal = useMemo(() => {
    const pDeals = activeDeals.filter(d => !d.servicesTags?.includes(STARTUP_TAG) && !d.servicesTags?.includes(EXISTING_TAG))
    // Use first month as representative for summary card
    return pDeals.reduce((s, d) => s + dealMonthValue(d, MONTH_KEYS[0]), 0)
  }, [activeDeals])

  const startupSubtotal = useMemo(() => {
    return activeDeals
      .filter(d => d.servicesTags?.includes(STARTUP_TAG))
      .reduce((s, d) => s + dealMonthValue(d, MONTH_KEYS[0]), 0)
  }, [activeDeals])

  const existingSubtotal = useMemo(() => {
    return activeDeals
      .filter(d => d.servicesTags?.includes(EXISTING_TAG))
      .reduce((s, d) => s + dealMonthValue(d, MONTH_KEYS[0]), 0)
  }, [activeDeals])

  const totalRevenue = projectSubtotal + startupSubtotal + existingSubtotal
  const gap = totalRevenue - TARGET_MONTHLY
  const pct = Math.min(100, Math.round((totalRevenue / TARGET_MONTHLY) * 100))

  // Grand totals per month across ALL sections
  const grandTotals = MONTH_KEYS.map(mk =>
    activeDeals.reduce((s, d) => s + dealMonthValue(d, mk), 0)
  )

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
      </div>
    )
  }

  if (catalogProductType === 'reseller') {
    const resellerDeals = allDeals.filter(isActiveResellerDeal)

    return (
      <div className="p-6 max-w-[1600px] mx-auto flex flex-col gap-3">
        <ResellerSummaryCards deals={allDeals} />
        <ResellerTableTabs value={resellerTableView} onChange={setResellerTableView} />
        {resellerTableView === 'pricing' ? (
          <ResellerPricingTable deals={resellerDeals} />
        ) : (
          <ResellerMonthlyRevenueSection deals={resellerDeals} onMonthSave={handleMonthSave} />
        )}
      </div>
    )
  }

  return (
    <div className="p-6 max-w-[1600px] mx-auto flex flex-col gap-6">
      {/* Summary cards + progress bar — only shown on the All tab.
          When the user drills into a specific catalog category/item, the
          target/gap framing is no longer meaningful (target = full-org). */}
      {!isFiltered && (<>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="rounded-md border border-border bg-card p-4">
          <div className="eyebrow-label mb-1">Target / Month</div>
          <div className="text-xl font-bold text-foreground tabular-nums">{'₱'}22,000,000</div>
        </div>
        <div className="rounded-md border border-border bg-card p-4">
          <div className="eyebrow-label text-teal-500 mb-1">Project Revenue / Mo</div>
          <div className="text-xl font-bold text-foreground tabular-nums">{phpFmt(projectSubtotal)}</div>
        </div>
        <div className="rounded-md border border-border bg-card p-4">
          <div className="eyebrow-label text-violet-500 mb-1">Startup MRR</div>
          <div className="text-xl font-bold text-foreground tabular-nums">{phpFmt(startupSubtotal)}</div>
        </div>
        <div className="rounded-md border border-border bg-card p-4">
          <div className="eyebrow-label text-amber-500 mb-1">Existing Clients</div>
          <div className="text-xl font-bold text-foreground tabular-nums">{phpFmt(existingSubtotal)}</div>
        </div>
        <div className={`rounded-md border p-4 ${gap < 0 ? 'border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-950/20' : 'border-emerald-200 dark:border-emerald-800/50 bg-emerald-50 dark:bg-emerald-950/20'}`}>
          <div className={`eyebrow-label mb-1 ${gap < 0 ? 'text-red-400' : 'text-emerald-500'}`}>
            {gap < 0 ? 'Gap to Target' : 'Surplus'}
          </div>
          <div className={`text-xl font-bold tabular-nums ${gap < 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
            {gap < 0 ? `-${phpFmt(Math.abs(gap))}` : `+${phpFmt(gap)}`}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="rounded-md border border-border bg-card p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-ssm font-semibold text-muted-foreground">Revenue vs. Target ({'₱'}22M)</span>
          <span className="text-ssm font-bold tabular-nums text-muted-foreground">{pct}%</span>
        </div>
        <div className="h-2.5 rounded-full bg-secondary overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${pct}%`,
              background: pct >= 100
                ? 'linear-gradient(90deg, #10b981, #34d399)'
                : pct >= 60
                ? 'linear-gradient(90deg, #f59e0b, #fbbf24)'
                : 'linear-gradient(90deg, #ef4444, #f87171)',
            }}
          />
        </div>
        <div className="flex items-center gap-4 mt-2">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm bg-teal-400" />
            <span className="text-atom text-slate-400">Project ({phpFmt(projectSubtotal)})</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm bg-violet-400" />
            <span className="text-atom text-slate-400">Startup ({phpFmt(startupSubtotal)})</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm bg-amber-400" />
            <span className="text-atom text-slate-400">Existing ({phpFmt(existingSubtotal)})</span>
          </div>
        </div>
      </div>
      </>)}

      {/* Section A */}
      <ProjectRevenueSection
        deals={activeDeals}
        userById={userById}
        onMonthSave={handleMonthSave}
        onBillingClick={setBillingDeal}
      />

      {/* Section B */}
      <StartupRevenueSection
        deals={activeDeals}
        userById={userById}
        onMonthSave={handleMonthSave}
        onBillingClick={setBillingDeal}
      />

      {/* Section C */}
      <ExistingClientsSection deals={activeDeals} onMonthSave={handleMonthSave} />

      {/* Grand total row */}
      <div className="overflow-x-auto rounded-md border-2 border-border-strong bg-surface-active ">
        <table className="w-full border-collapse">
          <tbody>
            <tr>
              <td className="px-4 py-3 text-sm font-bold text-white text-foreground w-[260px] sticky left-0 bg-slate-800 bg-secondary z-10">
                TOTAL REVENUE
              </td>
              {/* spacer cols to align with table above */}
              <td className="w-[70px]" />
              <td className="w-[70px]" />
              <td className="w-[100px]" />
              {grandTotals.map((total, i) => (
                <td key={i} className="px-3 py-3 text-right text-ssm font-bold tabular-nums text-white min-w-[90px]">
                  {total > 0 ? phpFmt(total) : ', '}
                </td>
              ))}
            </tr>
            <tr>
              <td className="px-4 py-2 text-ssm font-semibold w-[260px] sticky left-0 z-10" style={{ color: gap < 0 ? '#fca5a5' : '#6ee7b7', background: 'inherit' }}>
                Balance vs. Target
              </td>
              <td className="w-[70px]" />
              <td className="w-[70px]" />
              <td className="w-[100px]" />
              {grandTotals.map((total, i) => (
                <td key={i} className="px-3 py-2 text-right text-ssm font-semibold tabular-nums min-w-[90px]" style={{ color: total - TARGET_MONTHLY < 0 ? '#fca5a5' : '#6ee7b7' }}>
                  {total - TARGET_MONTHLY < 0
                    ? `-${phpFmt(Math.abs(total - TARGET_MONTHLY))}`
                    : `+${phpFmt(total - TARGET_MONTHLY)}`}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <p className="text-atom text-text-faint text-center">
        Click any month cell to enter a custom amount. Blue values = custom override; white = auto-calculated.
        Revenue uses monthly overrides first, then MRR, then value / contract length, then value / 12.
      </p>

      {billingDeal && (
        <RevenueBillingModal
          deal={billingDeal}
          onClose={() => setBillingDeal(null)}
          onSave={handleBillingSave}
          isSaving={upsertBilling.isPending}
        />
      )}
    </div>
  )
}
