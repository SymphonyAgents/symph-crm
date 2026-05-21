'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, RotateCcw, Trash2 } from 'lucide-react'
import { useGetTrashedDeals, useGetCompanies, useGetUsers } from '@/lib/hooks/queries'
import { useRestoreDeal, usePermanentlyDeleteDeal } from '@/lib/hooks/mutations'
import { queryKeys } from '@/lib/query-keys'
import { formatDealName } from '@/lib/format-deal-name'
import { formatPeso } from '@/lib/utils'

function formatDate(value: string | null | undefined) {
  if (!value) return 'Not set'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Not set'
  return date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
}

function daysRemaining(value: string | null | undefined) {
  if (!value) return 'Unknown'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unknown'
  const diff = date.getTime() - Date.now()
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24))
  if (days <= 0) return 'Eligible now'
  return `${days} day${days === 1 ? '' : 's'} left`
}

export function DealTrash() {
  const queryClient = useQueryClient()
  const { data: deals = [], isLoading } = useGetTrashedDeals()
  const { data: companies = [] } = useGetCompanies()
  const { data: users = [] } = useGetUsers()

  const companyMap = useMemo(() => new Map(companies.map(company => [company.id, company.name])), [companies])
  const userMap = useMemo(() => new Map(users.map(user => [user.id, user.name || user.email])), [users])

  const restoreDeal = useRestoreDeal({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.deals.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.deals.trash })
    },
  })

  const permanentlyDeleteDeal = usePermanentlyDeleteDeal({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.deals.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.deals.trash })
    },
  })

  function handlePermanentDelete(id: string, title: string) {
    const typed = window.prompt(`Type DELETE to permanently delete ${formatDealName(title)}.`)
    if (typed !== 'DELETE') return
    permanentlyDeleteDeal.mutate(id)
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/settings" className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-primary transition-colors mb-3">
            <ArrowLeft size={14} /> Settings
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Deal Trash</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Deals moved to trash are hidden from CRM views and can be restored for 30 days.
          </p>
        </div>
        <div className="hidden sm:block rounded-xl border border-amber-200 dark:border-amber-500/20 bg-amber-50 dark:bg-amber-500/[.08] px-4 py-3 text-xs text-amber-800 dark:text-amber-300 max-w-xs">
          Permanent delete is only available for deals already in trash.
        </div>
      </div>

      <div className="rounded-2xl border border-black/[.06] dark:border-white/[.08] bg-white dark:bg-[#1e1e21] overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-slate-400">Loading trash...</div>
        ) : deals.length === 0 ? (
          <div className="p-10 text-center">
            <div className="mx-auto w-12 h-12 rounded-2xl bg-slate-100 dark:bg-white/[.06] flex items-center justify-center mb-3">
              <Trash2 size={20} className="text-slate-400" />
            </div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Trash is empty</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Deleted deals will appear here until they are restored or permanently deleted.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[860px]">
              <thead className="bg-slate-50 dark:bg-white/[.03] border-b border-black/[.06] dark:border-white/[.08]">
                <tr className="text-atom font-semibold uppercase tracking-[0.06em] text-slate-400">
                  <th className="px-4 py-3">Deal</th>
                  <th className="px-4 py-3">Brand</th>
                  <th className="px-4 py-3">Value</th>
                  <th className="px-4 py-3">Trashed</th>
                  <th className="px-4 py-3">Delete after</th>
                  <th className="px-4 py-3">Remaining</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[.04] dark:divide-white/[.06]">
                {deals.map(deal => (
                  <tr key={deal.id} className="text-sm text-slate-700 dark:text-slate-300">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900 dark:text-white">{formatDealName(deal.title)}</div>
                      <div className="text-xs text-slate-400 mt-0.5">Stage: {deal.stage}</div>
                    </td>
                    <td className="px-4 py-3">{companyMap.get(deal.companyId) ?? deal.brandName ?? 'No brand'}</td>
                    <td className="px-4 py-3 tabular-nums">{formatPeso(parseFloat(deal.value || '0') || 0)}</td>
                    <td className="px-4 py-3">
                      <div>{formatDate(deal.deletedAt)}</div>
                      {deal.deletedBy && <div className="text-xs text-slate-400 mt-0.5">by {userMap.get(deal.deletedBy) ?? deal.deletedBy}</div>}
                    </td>
                    <td className="px-4 py-3">{formatDate(deal.deleteAfter)}</td>
                    <td className="px-4 py-3">{daysRemaining(deal.deleteAfter)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => restoreDeal.mutate(deal.id)}
                          disabled={restoreDeal.isPending || permanentlyDeleteDeal.isPending}
                          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold border border-black/[.08] dark:border-white/[.1] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[.04] disabled:opacity-50"
                        >
                          <RotateCcw size={13} /> Restore
                        </button>
                        <button
                          onClick={() => handlePermanentDelete(deal.id, deal.title)}
                          disabled={restoreDeal.isPending || permanentlyDeleteDeal.isPending}
                          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                        >
                          <Trash2 size={13} /> Delete forever
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
