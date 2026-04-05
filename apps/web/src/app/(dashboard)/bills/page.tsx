'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { useGetDeals, useGetBillingByDeal, useGetCompanies } from '@/lib/hooks/queries'
import { useDeleteBilling } from '@/lib/hooks/mutations'
import { queryKeys } from '@/lib/query-keys'
import { cn, formatDealTitle, getInitials, getBrandColor, toPascalCase } from '@/lib/utils'
import { Pencil, Trash2 } from 'lucide-react'
import type { ApiDeal, ApiBilling } from '@/lib/types'

const BILLING_TYPE_LABELS: Record<string, string> = {
  annual: 'Annual',
  monthly: 'Monthly',
  milestone: 'Milestone',
}

function formatPeso(value: string | number | null | undefined): string {
  if (value == null || value === '') return '--'
  const n = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(n)) return '--'
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(n)
}

function formatDate(d: string | null): string {
  if (!d) return '--'
  return new Date(d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
}

// Individual row that fetches its own billing data
function BillRow({
  deal,
  companyMap,
  onClick,
  onEdit,
  onDelete,
}: {
  deal: ApiDeal
  companyMap: Map<string, string>
  onClick: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const { data: billing, isLoading } = useGetBillingByDeal(deal.id)

  if (isLoading) {
    return (
      <tr className="border-b border-black/[.04] dark:border-white/[.05]">
        <td colSpan={8} className="px-4 py-3">
          <div className="h-4 w-32 bg-slate-100 dark:bg-white/[.06] rounded animate-pulse" />
        </td>
      </tr>
    )
  }

  // Skip deals with no billing set up
  if (!billing) return null

  const paidCount = billing.milestones?.filter(m => m.isPaid).length ?? 0
  const totalMilestones = billing.milestones?.length ?? 0

  return (
    <tr
      onClick={onClick}
      className="border-b border-black/[.04] dark:border-white/[.05] hover:bg-slate-50 dark:hover:bg-white/[.02] cursor-pointer transition-colors"
    >
      <td className="px-4 py-3 text-xs font-medium text-slate-800 dark:text-white">
        {formatDealTitle(deal.title)}
      </td>
      <td className="px-4 py-3">
        {deal.companyId && companyMap.get(deal.companyId) ? (() => {
          const name = companyMap.get(deal.companyId)!
          const color = getBrandColor(name)
          return (
            <div className="flex items-center gap-2">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center text-atom font-bold shrink-0"
                style={{ background: `${color}18`, color }}
              >
                {getInitials(name)}
              </div>
              <span className="text-xs text-slate-700 dark:text-slate-300 truncate">{toPascalCase(name)}</span>
            </div>
          )
        })() : (
          <span className="text-xs text-slate-400">--</span>
        )}
      </td>
      <td className="px-4 py-3">
        <span className="text-atom font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
          {BILLING_TYPE_LABELS[billing.billingType] ?? billing.billingType}
        </span>
      </td>
      <td className="px-4 py-3 text-xs font-medium text-slate-800 dark:text-white tabular-nums text-right">
        {formatPeso(billing.amount)}
      </td>
      <td className="px-4 py-3 text-xs text-slate-500 tabular-nums text-right">
        {billing.monthlyDerived ? `${formatPeso(billing.monthlyDerived)}/mo` : '--'}
      </td>
      <td className="px-4 py-3 text-xs text-slate-500">
        {billing.contractStart || billing.contractEnd
          ? `${formatDate(billing.contractStart)} - ${formatDate(billing.contractEnd)}`
          : '--'}
      </td>
      <td className="px-4 py-3 text-xs text-slate-500">
        {billing.billingType === 'milestone' && totalMilestones > 0
          ? (
            <span className="tabular-nums">
              <span className="text-[#16a34a] font-medium">{paidCount}</span>
              <span className="text-slate-400">/{totalMilestones} paid</span>
            </span>
          )
          : '--'}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1 justify-end">
          <button
            onClick={e => { e.stopPropagation(); onEdit() }}
            className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[.06] transition-colors"
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={e => { e.stopPropagation(); onDelete() }}
            className="p-1.5 rounded-md text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </td>
    </tr>
  )
}

export default function BillsPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { data: deals = [], isLoading } = useGetDeals()
  const { data: companies = [] } = useGetCompanies()
  const [deleteTarget, setDeleteTarget] = useState<{ dealId: string; dealTitle: string } | null>(null)

  const deleteBilling = useDeleteBilling({
    onSuccess: () => {
      if (deleteTarget) {
        queryClient.invalidateQueries({ queryKey: queryKeys.billing.byDeal(deleteTarget.dealId) })
      }
      setDeleteTarget(null)
    },
    onError: () => {
      setDeleteTarget(null)
    },
  })

  const companyMap = useMemo(() => {
    const m = new Map<string, string>()
    for (const c of companies) m.set(c.id, c.name)
    return m
  }, [companies])

  const wonDeals = useMemo(
    () => deals.filter(d => d.stage === 'closed_won'),
    [deals],
  )

  return (
    <div className="p-4 md:px-6 pb-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4 shrink-0">
        <div>
          <div className="text-ssm font-semibold text-slate-900 dark:text-white">Bills</div>
          <div className="text-xxs text-slate-400 mt-0.5">
            {isLoading ? 'Loading\u2026' : `${wonDeals.length} won deal${wonDeals.length !== 1 ? 's' : ''}`}
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-[#1e1e21] rounded-xl border border-black/[.06] dark:border-white/[.08] shadow-[0_1px_4px_rgba(0,0,0,0.04)] overflow-hidden">
        {isLoading ? (
          <div className="overflow-hidden">
            {/* Header skeleton */}
            <div className="border-b border-black/[.06] dark:border-white/[.08] px-4 py-2.5 flex gap-8">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-3 w-16 bg-slate-100 dark:bg-white/[.06] rounded animate-pulse" />
              ))}
            </div>
            {/* Row skeletons */}
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-black/[.04] dark:border-white/[.05]">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-white/[.06] animate-pulse" />
                  <div className="h-3.5 w-24 bg-slate-100 dark:bg-white/[.06] rounded animate-pulse" />
                </div>
                <div className="h-3.5 w-20 bg-slate-100 dark:bg-white/[.06] rounded animate-pulse" />
                <div className="h-5 w-16 rounded-full bg-slate-100 dark:bg-white/[.06] animate-pulse" />
                <div className="h-3.5 w-16 bg-slate-100 dark:bg-white/[.06] rounded animate-pulse ml-auto" />
                <div className="h-3.5 w-16 bg-slate-100 dark:bg-white/[.06] rounded animate-pulse" />
                <div className="h-3.5 w-28 bg-slate-100 dark:bg-white/[.06] rounded animate-pulse" />
                <div className="h-3.5 w-16 bg-slate-100 dark:bg-white/[.06] rounded animate-pulse" />
                <div className="h-3.5 w-10 bg-slate-100 dark:bg-white/[.06] rounded animate-pulse" />
              </div>
            ))}
          </div>
        ) : wonDeals.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.2} className="text-slate-300 dark:text-slate-600 mb-3">
              <rect x="2" y="6" width="20" height="14" rx="2" />
              <path d="M2 10h20" />
              <path d="M6 14h4" />
            </svg>
            <p className="text-ssm font-medium text-slate-400">No won deals yet</p>
            <p className="text-xxs text-slate-300 dark:text-slate-600 mt-0.5">
              Won deals with billing will appear here
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px]">
              <thead>
                <tr className="border-b border-black/[.06] dark:border-white/[.08]">
                  <th className="px-4 py-2.5 text-left text-xxs font-semibold text-slate-400 uppercase tracking-wider">Deal</th>
                  <th className="px-4 py-2.5 text-left text-xxs font-semibold text-slate-400 uppercase tracking-wider">Company</th>
                  <th className="px-4 py-2.5 text-left text-xxs font-semibold text-slate-400 uppercase tracking-wider">Type</th>
                  <th className="px-4 py-2.5 text-right text-xxs font-semibold text-slate-400 uppercase tracking-wider">Value</th>
                  <th className="px-4 py-2.5 text-right text-xxs font-semibold text-slate-400 uppercase tracking-wider">Monthly</th>
                  <th className="px-4 py-2.5 text-left text-xxs font-semibold text-slate-400 uppercase tracking-wider">Period</th>
                  <th className="px-4 py-2.5 text-left text-xxs font-semibold text-slate-400 uppercase tracking-wider">Milestones</th>
                  <th className="px-4 py-2.5 text-right text-xxs font-semibold text-slate-400 uppercase tracking-wider w-20" />
                </tr>
              </thead>
              <tbody>
                {wonDeals.map(deal => (
                  <BillRow
                    key={deal.id}
                    deal={deal}
                    companyMap={companyMap}
                    onClick={() => router.push(`/deals/${deal.id}?from=bills`)}
                    onEdit={() => router.push(`/deals/${deal.id}?from=bills&tab=billing`)}
                    onDelete={() => setDeleteTarget({ dealId: deal.id, dealTitle: deal.title })}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete billing confirmation modal */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm px-4 flex items-center justify-center"
          onClick={() => setDeleteTarget(null)}
        >
          <div
            className="max-w-sm w-full rounded-xl border border-black/[.06] dark:border-white/[.08] bg-white dark:bg-[#1e1e21] shadow-2xl p-4 animate-in zoom-in-95 fade-in-0 duration-300"
            onClick={e => e.stopPropagation()}
          >
            <p className="text-sm font-semibold text-slate-900 dark:text-white">Delete billing record?</p>
            <p className="text-ssm text-slate-600 dark:text-slate-400 leading-relaxed mt-1">
              Remove billing for <span className="font-semibold text-slate-900 dark:text-white">{formatDealTitle(deleteTarget.dealTitle)}</span>. This will delete the billing setup and all milestones.
            </p>
            <div className="flex gap-2.5 mt-4">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 h-8 rounded-lg text-xs font-semibold border border-black/[.08] dark:border-white/[.1] text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[.04] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteBilling.mutate(deleteTarget.dealId)}
                disabled={deleteBilling.isPending}
                className="flex-1 h-8 flex items-center justify-center gap-1.5 rounded-lg text-xs font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-60 transition-colors"
              >
                <>{deleteBilling.isPending && <span className="inline-block w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />}Delete</>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
