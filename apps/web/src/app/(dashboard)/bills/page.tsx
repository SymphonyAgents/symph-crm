'use client'

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useGetDeals, useGetBillingByDeal, useGetCompanies } from '@/lib/hooks/queries'
import { cn, formatDealTitle } from '@/lib/utils'
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

/** Individual row that fetches its own billing data */
function BillRow({ deal, companyMap, onClick }: { deal: ApiDeal; companyMap: Map<string, string>; onClick: () => void }) {
  const { data: billing, isLoading } = useGetBillingByDeal(deal.id)

  if (isLoading) {
    return (
      <tr className="border-b border-black/[.04] dark:border-white/[.05]">
        <td colSpan={7} className="px-4 py-3">
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
      <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-400">
        {deal.companyId ? (companyMap.get(deal.companyId) ?? deal.companyId.slice(0, 8)) : '--'}
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
    </tr>
  )
}

export default function BillsPage() {
  const router = useRouter()
  const { data: deals = [], isLoading } = useGetDeals()
  const { data: companies = [] } = useGetCompanies()

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
          <div className="flex items-center justify-center py-12">
            <div className="w-5 h-5 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
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
            <table className="w-full min-w-[700px]">
              <thead>
                <tr className="border-b border-black/[.06] dark:border-white/[.08]">
                  <th className="px-4 py-2.5 text-left text-xxs font-semibold text-slate-400 uppercase tracking-wider">Deal</th>
                  <th className="px-4 py-2.5 text-left text-xxs font-semibold text-slate-400 uppercase tracking-wider">Company</th>
                  <th className="px-4 py-2.5 text-left text-xxs font-semibold text-slate-400 uppercase tracking-wider">Type</th>
                  <th className="px-4 py-2.5 text-right text-xxs font-semibold text-slate-400 uppercase tracking-wider">Value</th>
                  <th className="px-4 py-2.5 text-right text-xxs font-semibold text-slate-400 uppercase tracking-wider">Monthly</th>
                  <th className="px-4 py-2.5 text-left text-xxs font-semibold text-slate-400 uppercase tracking-wider">Period</th>
                  <th className="px-4 py-2.5 text-left text-xxs font-semibold text-slate-400 uppercase tracking-wider">Milestones</th>
                </tr>
              </thead>
              <tbody>
                {wonDeals.map(deal => (
                  <BillRow
                    key={deal.id}
                    deal={deal}
                    companyMap={companyMap}
                    onClick={() => router.push(`/deals/${deal.id}`)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
