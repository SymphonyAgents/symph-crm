'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, RotateCcw, Trash2 } from 'lucide-react'
import { useGetTrashedDeals, useGetCompanies, useGetUsers } from '@/lib/hooks/queries'
import { useRestoreDeal, usePermanentlyDeleteDeal } from '@/lib/hooks/mutations'
import { queryKeys } from '@/lib/query-keys'
import { formatDealName } from '@/lib/format-deal-name'
import { formatDealMoney } from '@/lib/currency'
import { Button } from '@/components/ui/button'
import { DataTableSkeleton } from '@/components/ui/data-table'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { ApiDeal } from '@/lib/types'

type TrashAction = 'restore' | 'delete'
type TrashActionTarget = {
  action: TrashAction
  deal: ApiDeal
}

function formatDate(value: string | null | undefined) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
}

function daysRemaining(value: string | null | undefined) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  const diff = date.getTime() - Date.now()
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24))
  if (days <= 0) return 'Eligible now'
  return `${days} day${days === 1 ? '' : 's'} left`
}

function TrashActionDialog({
  target,
  loading,
  onCancel,
  onConfirm,
}: {
  target: TrashActionTarget
  loading: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  const isDelete = target.action === 'delete'
  const title = isDelete ? 'Delete forever?' : 'Restore deal?'
  const actionLabel = isDelete ? 'Delete forever' : 'Restore'

  return (
    <Dialog open onOpenChange={open => { if (!open) onCancel() }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <div>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>
              {isDelete ? 'This action cannot be undone.' : 'This deal will return to active CRM views.'}
            </DialogDescription>
          </div>
        </DialogHeader>
        <div className="p-4">
          <p className="text-ssm leading-relaxed text-slate-600 dark:text-slate-400">
            {isDelete ? 'Permanently delete' : 'Restore'}{' '}
            <span className="font-semibold text-slate-900 dark:text-white">{formatDealName(target.deal.title)}</span>
            {isDelete ? ' and remove its trashed record from CRM.' : '.'}
          </p>
          <div className="mt-4 flex gap-2.5">
            <button
              type="button"
              onClick={onCancel}
              className="h-9 flex-1 rounded-lg border border-black/[.08] text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 dark:border-white/[.1] dark:text-slate-300 dark:hover:bg-white/[.04]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={loading}
              className={isDelete
                ? 'flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-red-600 text-xs font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-60'
                : 'flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 text-xs font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-60'}
            >
              {loading && <span className="inline-block size-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />}
              {actionLabel}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function DealInfo({ deal, companyName }: { deal: ApiDeal; companyName: string }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-ssm font-semibold text-slate-900 dark:text-white">{formatDealName(deal.title)}</p>
      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
        {companyName} {deal.stage ? `· ${deal.stage}` : ''}
      </p>
    </div>
  )
}

export function DealTrash() {
  const queryClient = useQueryClient()
  const { data: deals = [], isLoading } = useGetTrashedDeals()
  const { data: companies = [] } = useGetCompanies()
  const { data: users = [] } = useGetUsers()
  const [actionTarget, setActionTarget] = useState<TrashActionTarget | null>(null)

  const companyMap = useMemo(() => new Map(companies.map(company => [company.id, company.name])), [companies])
  const userMap = useMemo(() => new Map(users.map(user => [user.id, user.name || user.email])), [users])

  const restoreDeal = useRestoreDeal({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.deals.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.deals.trash })
      setActionTarget(null)
    },
  })

  const permanentlyDeleteDeal = usePermanentlyDeleteDeal({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.deals.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.deals.trash })
      setActionTarget(null)
    },
  })

  function confirmAction() {
    if (!actionTarget) return
    if (actionTarget.action === 'restore') restoreDeal.mutate(actionTarget.deal.id)
    else permanentlyDeleteDeal.mutate(actionTarget.deal.id)
  }

  const actionLoading = restoreDeal.isPending || permanentlyDeleteDeal.isPending

  return (
    <>
      {actionTarget && (
        <TrashActionDialog
          target={actionTarget}
          loading={actionLoading}
          onCancel={() => setActionTarget(null)}
          onConfirm={confirmAction}
        />
      )}
      <div className="p-4 md:px-6 pb-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/settings" className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition-colors hover:text-primary">
            <ArrowLeft size={14} /> Settings
          </Link>
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/[.08] dark:text-amber-300 sm:max-w-xs">
            Permanent delete only applies to trashed deals.
          </div>
        </div>

        <div className="rounded-md border border-black/[.06] bg-white shadow-[var(--shadow-card)] dark:border-white/[.08] dark:bg-[#1e1e21]">
          {isLoading ? (
            <DataTableSkeleton className="p-3" />
          ) : deals.length === 0 ? (
            <div className="flex min-h-[220px] flex-col items-center justify-center rounded-md border border-dashed border-black/[.08] bg-slate-50/70 px-4 text-center dark:border-white/[.08] dark:bg-white/[.03]">
              <Trash2 size={22} className="text-slate-400" />
              <p className="mt-3 text-sm font-semibold text-slate-900 dark:text-white">Trash is empty</p>
              <p className="mt-1 max-w-sm text-xs text-slate-500 dark:text-slate-400">
                Deleted deals will appear here until Sales restores or permanently deletes them.
              </p>
            </div>
          ) : (
            <>
              <div className="block divide-y divide-black/[.06] p-2 dark:divide-white/[.08] md:hidden">
                {deals.map(deal => {
                  const companyName = companyMap.get(deal.companyId) ?? deal.brandName ?? 'No brand'
                  return (
                    <div key={deal.id} className="py-3 first:pt-1 last:pb-1">
                      <DealInfo deal={deal} companyName={companyName} />
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <p className="text-xxs font-semibold uppercase tracking-wide text-slate-400">Value</p>
                          <p className="mt-0.5 text-slate-700 dark:text-slate-300">{formatDealMoney(deal)}</p>
                        </div>
                        <div>
                          <p className="text-xxs font-semibold uppercase tracking-wide text-slate-400">Remaining</p>
                          <p className="mt-0.5 text-slate-700 dark:text-slate-300">{daysRemaining(deal.deleteAfter)}</p>
                        </div>
                        <div>
                          <p className="text-xxs font-semibold uppercase tracking-wide text-slate-400">Trashed</p>
                          <p className="mt-0.5 text-slate-700 dark:text-slate-300">{formatDate(deal.deletedAt)}</p>
                        </div>
                        <div>
                          <p className="text-xxs font-semibold uppercase tracking-wide text-slate-400">Delete after</p>
                          <p className="mt-0.5 text-slate-700 dark:text-slate-300">{formatDate(deal.deleteAfter)}</p>
                        </div>
                      </div>
                      {deal.deletedBy && (
                        <p className="mt-2 text-xs text-slate-400">Trashed by {userMap.get(deal.deletedBy) ?? deal.deletedBy}</p>
                      )}
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={actionLoading}
                          onClick={() => setActionTarget({ action: 'restore', deal })}
                        >
                          <RotateCcw size={13} /> Restore
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          disabled={actionLoading}
                          onClick={() => setActionTarget({ action: 'delete', deal })}
                        >
                          <Trash2 size={13} /> Delete
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[900px] text-left">
                  <thead>
                    <tr className="border-b border-black/[.06] text-xxs font-semibold uppercase tracking-wider text-slate-400 dark:border-white/[.08]">
                      <th className="px-4 py-2.5">Deal</th>
                      <th className="px-4 py-2.5">Value</th>
                      <th className="px-4 py-2.5">Trashed</th>
                      <th className="px-4 py-2.5">Delete after</th>
                      <th className="px-4 py-2.5">Remaining</th>
                      <th className="px-4 py-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deals.map(deal => {
                      const companyName = companyMap.get(deal.companyId) ?? deal.brandName ?? 'No brand'
                      return (
                        <tr key={deal.id} className="border-b border-black/[.04] text-xs text-slate-600 last:border-b-0 dark:border-white/[.05] dark:text-slate-300">
                          <td className="px-4 py-3">
                            <DealInfo deal={deal} companyName={companyName} />
                          </td>
                          <td className="px-4 py-3 tabular-nums">{formatDealMoney(deal)}</td>
                          <td className="px-4 py-3">
                            <div>{formatDate(deal.deletedAt)}</div>
                            {deal.deletedBy && <div className="mt-0.5 text-xxs text-slate-400">by {userMap.get(deal.deletedBy) ?? deal.deletedBy}</div>}
                          </td>
                          <td className="px-4 py-3">{formatDate(deal.deleteAfter)}</td>
                          <td className="px-4 py-3">{daysRemaining(deal.deleteAfter)}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={actionLoading}
                                onClick={() => setActionTarget({ action: 'restore', deal })}
                              >
                                <RotateCcw size={13} /> Restore
                              </Button>
                              <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                disabled={actionLoading}
                                onClick={() => setActionTarget({ action: 'delete', deal })}
                              >
                                <Trash2 size={13} /> Delete forever
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}
