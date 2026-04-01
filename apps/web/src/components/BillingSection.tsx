'use client'

import { useState, useEffect, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'
import { useGetBillingByDeal } from '@/lib/hooks/queries'
import { useUpsertBilling, useAddMilestone, useUpdateMilestone, useDeleteMilestone } from '@/lib/hooks/mutations'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import type { ApiBilling, ApiBillingMilestone } from '@/lib/types'

type BillingSectionProps = {
  dealId: string
}

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

export function BillingSection({ dealId }: BillingSectionProps) {
  const queryClient = useQueryClient()
  const { data: billing, isLoading } = useGetBillingByDeal(dealId)

  const [billingType, setBillingType] = useState<'annual' | 'monthly' | 'milestone'>('monthly')
  const [contractStart, setContractStart] = useState('')
  const [contractEnd, setContractEnd] = useState('')
  const [amount, setAmount] = useState('')
  const [dirty, setDirty] = useState(false)

  // Milestone form
  const [newMilestoneName, setNewMilestoneName] = useState('')
  const [newMilestoneAmount, setNewMilestoneAmount] = useState('')

  // Sync local state from API data
  useEffect(() => {
    if (billing && !dirty) {
      setBillingType(billing.billingType)
      setContractStart(billing.contractStart ?? '')
      setContractEnd(billing.contractEnd ?? '')
      setAmount(billing.amount ?? '')
    }
  }, [billing, dirty])

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.billing.byDeal(dealId) })
  }, [queryClient, dealId])

  const upsertBilling = useUpsertBilling({ onSuccess: () => { setDirty(false); invalidate() } })
  const addMilestone = useAddMilestone({ onSuccess: () => { setNewMilestoneName(''); setNewMilestoneAmount(''); invalidate() } })
  const updateMilestone = useUpdateMilestone({ onSuccess: invalidate })
  const deleteMilestone = useDeleteMilestone({ onSuccess: invalidate })

  const handleSave = useCallback(() => {
    upsertBilling.mutate({
      dealId,
      data: {
        billingType,
        contractStart: contractStart || null,
        contractEnd: contractEnd || null,
        amount: amount || null,
      },
    })
  }, [dealId, billingType, contractStart, contractEnd, amount, upsertBilling])

  const handleAddMilestone = useCallback(() => {
    if (!newMilestoneName.trim() || !newMilestoneAmount.trim()) return
    addMilestone.mutate({
      dealId,
      data: {
        name: newMilestoneName.trim(),
        amount: newMilestoneAmount.trim(),
        sortOrder: (billing?.milestones?.length ?? 0),
      },
    })
  }, [dealId, newMilestoneName, newMilestoneAmount, billing, addMilestone])

  const handleTogglePaid = useCallback((m: ApiBillingMilestone) => {
    updateMilestone.mutate({
      dealId,
      milestoneId: m.id,
      data: { isPaid: !m.isPaid },
    })
  }, [dealId, updateMilestone])

  const handleDeleteMilestone = useCallback((milestoneId: string) => {
    deleteMilestone.mutate({ dealId, milestoneId })
  }, [dealId, deleteMilestone])

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-[#1e1e21] rounded-xl border border-black/[.06] dark:border-white/[.08] shadow-[0_1px_4px_rgba(0,0,0,0.04)] p-4">
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-3">Billing</p>
        <div className="flex items-center justify-center py-4">
          <div className="w-4 h-4 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
        </div>
      </div>
    )
  }

  const monthlyDerived = billing?.monthlyDerived

  return (
    <div className="bg-white dark:bg-[#1e1e21] rounded-xl border border-black/[.06] dark:border-white/[.08] shadow-[0_1px_4px_rgba(0,0,0,0.04)] p-4">
      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-3">Billing</p>

      {/* Billing type selector */}
      <div className="mb-3">
        <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block mb-1">Type</label>
        <Select
          value={billingType}
          onValueChange={(v: string) => {
            setBillingType(v as 'annual' | 'monthly' | 'milestone')
            setDirty(true)
          }}
        >
          <SelectTrigger className="h-8 text-[12px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="annual" className="text-[12px]">Annual</SelectItem>
            <SelectItem value="monthly" className="text-[12px]">Monthly</SelectItem>
            <SelectItem value="milestone" className="text-[12px]">Milestone</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Contract dates */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div>
          <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block mb-1">Start</label>
          <input
            type="date"
            value={contractStart}
            onChange={e => { setContractStart(e.target.value); setDirty(true) }}
            className="w-full h-8 rounded-md border border-black/[.08] dark:border-white/[.1] bg-transparent px-2 text-[12px] text-slate-800 dark:text-white outline-none focus:ring-1 focus:ring-primary/30"
          />
        </div>
        <div>
          <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block mb-1">End</label>
          <input
            type="date"
            value={contractEnd}
            onChange={e => { setContractEnd(e.target.value); setDirty(true) }}
            className="w-full h-8 rounded-md border border-black/[.08] dark:border-white/[.1] bg-transparent px-2 text-[12px] text-slate-800 dark:text-white outline-none focus:ring-1 focus:ring-primary/30"
          />
        </div>
      </div>

      {/* Amount input — Annual or Monthly */}
      {billingType !== 'milestone' && (
        <div className="mb-3">
          <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block mb-1">
            {billingType === 'annual' ? 'Annual Total' : 'Monthly Amount'}
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            value={amount}
            onChange={e => { setAmount(e.target.value); setDirty(true) }}
            className="w-full h-8 rounded-md border border-black/[.08] dark:border-white/[.1] bg-transparent px-2 text-[12px] text-slate-800 dark:text-white tabular-nums outline-none focus:ring-1 focus:ring-primary/30"
          />
          {billingType === 'annual' && amount && (
            <p className="text-[10px] text-slate-400 mt-1 tabular-nums">
              Monthly Rate: {formatPeso(parseFloat(amount) / 12)}/mo
            </p>
          )}
          {billingType === 'monthly' && monthlyDerived && (
            <p className="text-[10px] text-slate-400 mt-1 tabular-nums">
              {formatPeso(monthlyDerived)}/mo
            </p>
          )}
        </div>
      )}

      {/* Milestone section */}
      {billingType === 'milestone' && (
        <div className="mb-3">
          <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block mb-2">Milestones</label>

          {/* Existing milestones */}
          {billing?.milestones && billing.milestones.length > 0 && (
            <div className="flex flex-col gap-1.5 mb-2">
              {billing.milestones.map(m => (
                <div
                  key={m.id}
                  className={cn(
                    'flex items-center gap-2 px-2 py-1.5 rounded-lg border transition-colors',
                    m.isPaid
                      ? 'border-[rgba(22,163,74,0.2)] bg-[rgba(22,163,74,0.04)]'
                      : 'border-black/[.06] dark:border-white/[.08]'
                  )}
                >
                  <button
                    onClick={() => handleTogglePaid(m)}
                    className={cn(
                      'w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors',
                      m.isPaid
                        ? 'bg-[#16a34a] border-[#16a34a]'
                        : 'border-slate-300 dark:border-slate-600 hover:border-primary'
                    )}
                  >
                    {m.isPaid && (
                      <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3} strokeLinecap="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      'text-[11px] font-medium truncate',
                      m.isPaid ? 'text-slate-400 line-through' : 'text-slate-800 dark:text-white'
                    )}>
                      {m.name}
                    </p>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] tabular-nums text-slate-500">{formatPeso(m.amount)}</span>
                      {m.percentage && (
                        <span className="text-[9px] font-semibold px-1 py-0.5 rounded bg-primary/10 text-primary tabular-nums">
                          {parseFloat(m.percentage).toFixed(0)}%
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteMilestone(m.id)}
                    className="text-slate-300 hover:text-red-500 transition-colors shrink-0"
                  >
                    <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add milestone form */}
          <div className="flex gap-1.5">
            <input
              type="text"
              placeholder="Milestone name"
              value={newMilestoneName}
              onChange={e => setNewMilestoneName(e.target.value)}
              className="flex-1 h-7 rounded-md border border-black/[.08] dark:border-white/[.1] bg-transparent px-2 text-[11px] text-slate-800 dark:text-white placeholder:text-slate-400 outline-none focus:ring-1 focus:ring-primary/30"
            />
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="Amount"
              value={newMilestoneAmount}
              onChange={e => setNewMilestoneAmount(e.target.value)}
              className="w-[80px] h-7 rounded-md border border-black/[.08] dark:border-white/[.1] bg-transparent px-2 text-[11px] text-slate-800 dark:text-white tabular-nums placeholder:text-slate-400 outline-none focus:ring-1 focus:ring-primary/30"
            />
            <button
              onClick={handleAddMilestone}
              disabled={!newMilestoneName.trim() || !newMilestoneAmount.trim() || addMilestone.isPending}
              className="h-7 px-2 rounded-md bg-primary text-white text-[10px] font-semibold disabled:opacity-40 transition-opacity active:scale-[0.98]"
            >
              Add
            </button>
          </div>

          {/* Total */}
          {billing?.amount && (
            <div className="mt-2 pt-2 border-t border-black/[.04] dark:border-white/[.05]">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-400">Total</span>
                <span className="text-[11px] font-bold text-slate-800 dark:text-white tabular-nums">{formatPeso(billing.amount)}</span>
              </div>
              {billing.monthlyDerived && (
                <div className="flex items-center justify-between mt-0.5">
                  <span className="text-[10px] text-slate-400">Monthly equiv.</span>
                  <span className="text-[10px] text-slate-500 tabular-nums">{formatPeso(billing.monthlyDerived)}/mo</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Save button */}
      <button
        onClick={handleSave}
        disabled={upsertBilling.isPending}
        className="w-full h-8 rounded-lg bg-primary hover:bg-primary/90 text-white text-[12px] font-semibold transition-colors duration-150 active:scale-[0.98] disabled:opacity-60"
      >
        {upsertBilling.isPending ? 'Saving...' : 'Save Billing'}
      </button>
    </div>
  )
}
