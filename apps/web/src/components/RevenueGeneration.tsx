'use client'

import { useMemo, useState, useCallback, useRef, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useGetDeals, useGetUsers } from '@/lib/hooks/queries'
import { useUpdateDeal } from '@/lib/hooks/mutations'
import { queryKeys } from '@/lib/query-keys'
import { formatCurrency } from '@/lib/utils'
import { TrendingUp, Building2, Rocket, Archive, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import type { ApiDeal } from '@/lib/types'

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTH_KEYS = ['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11', '2026-12']
const MONTH_LABELS = ['May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const TARGET_MONTHLY = 22_000_000

const STARTUP_TAG = 'internal_products'
const EXISTING_TAG = 'existing_client'

function dealStartupCategory(deal: ApiDeal): 'hireai' | 'agency' | null {
  if (!deal.servicesTags?.includes(STARTUP_TAG)) return null
  const name = (deal.internalProductName ?? '').toLowerCase()
  if (name.includes('hireai') || name.includes('hire ai')) return 'hireai'
  return 'agency'
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function numVal(v: string | null | undefined): number {
  if (!v) return 0
  const n = parseFloat(v.replace(/,/g, ''))
  return isNaN(n) ? 0 : n
}

function phpFmt(n: number): string {
  if (n === 0) return ', '
  return '₱' + formatCurrency(n)
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

function stageBadge(stage: string) {
  const map: Record<string, { label: string; color: string }> = {
    lead: { label: 'Lead', color: 'bg-slate-100 text-slate-500 dark:bg-white/[.06] dark:text-slate-400' },
    discovery: { label: 'Discovery', color: 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400' },
    assessment: { label: 'Assessment', color: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400' },
    proposal_demo: { label: 'Proposal', color: 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400' },
    followup: { label: 'Follow-up', color: 'bg-orange-50 text-orange-600 dark:bg-orange-950/40 dark:text-orange-400' },
    closed_won: { label: 'Won', color: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400' },
    closed_lost: { label: 'Lost', color: 'bg-red-50 text-red-500 dark:bg-red-950/40 dark:text-red-400' },
    parked: { label: 'Parked', color: 'bg-slate-100 text-slate-400 dark:bg-white/[.04] dark:text-slate-500' },
  }
  const meta = map[stage] ?? { label: stage, color: 'bg-slate-100 text-slate-500 dark:bg-white/[.06] dark:text-slate-400' }
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-atom font-semibold ${meta.color}`}>
      {meta.label}
    </span>
  )
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
          className="w-full h-7 px-2 text-right text-ssm tabular-nums rounded border border-primary/30 bg-white dark:bg-[#2a2d31] text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary/40"
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
        <span className={hasOverride ? 'text-primary font-medium' : 'text-slate-800 dark:text-slate-200'}>
          {phpFmt(currentValue)}
        </span>
      ) : (
        <span className="text-slate-300 dark:text-slate-600">, </span>
      )}
    </td>
  )
}

// ─── Shared Section Components ────────────────────────────────────────────────

function SectionHeader({ icon, title, color }: { icon: React.ReactNode; title: string; color: string }) {
  return (
    <div className={`flex items-center gap-2.5 px-4 py-3 rounded-xl ${color} mb-3`}>
      <div className="shrink-0">{icon}</div>
      <span className="text-sm font-semibold">{title}</span>
    </div>
  )
}

function MonthHeaders() {
  return (
    <>
      {MONTH_LABELS.map(m => (
        <th key={m} className="px-3 py-2.5 text-xxs font-semibold text-slate-500 uppercase tracking-wider text-right min-w-[90px]">{m}</th>
      ))}
    </>
  )
}

// ─── Section A: Project-Based Revenue ─────────────────────────────────────────

function ProjectRevenueSection({
  deals,
  userMap,
  onMonthSave,
}: {
  deals: ApiDeal[]
  userMap: Map<string, string>
  onMonthSave: (dealId: string, monthKey: string, value: number) => void
}) {
  const projectDeals = deals.filter(d => !d.servicesTags?.includes(STARTUP_TAG) && !d.servicesTags?.includes(EXISTING_TAG))

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
      <div className="overflow-x-auto rounded-xl border border-black/[.06] dark:border-white/[.08]">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-black/[.06] dark:border-white/[.08] bg-slate-50 dark:bg-white/[.02]">
              <th className="px-4 py-2.5 text-xxs font-semibold text-slate-500 uppercase tracking-wider w-[260px] sticky left-0 bg-slate-50 dark:bg-[#1a1a1d] z-10">Project / Deal</th>
              <th className="px-3 py-2.5 text-xxs font-semibold text-slate-500 uppercase tracking-wider w-[70px]">Owner</th>
              <th className="px-3 py-2.5 text-xxs font-semibold text-slate-500 uppercase tracking-wider w-[70px]">Stage</th>
              <th className="px-3 py-2.5 text-xxs font-semibold text-slate-500 uppercase tracking-wider text-right w-[100px]">Value</th>
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
                const am = userMap.get(deal.assignedTo ?? '') ?? 'Unassigned'
                return (
                  <tr key={deal.id} className={i % 2 === 0 ? '' : 'bg-slate-50/50 dark:bg-white/[.01]'}>
                    <td className="px-4 py-2.5 sticky left-0 bg-white dark:bg-[#1e1e21] z-10">
                      <Link
                        href={`/deals/${deal.id}?from=revenue`}
                        className="text-ssm font-medium text-slate-800 dark:text-slate-200 hover:text-primary dark:hover:text-primary transition-colors flex items-center gap-1 group"
                      >
                        <span className="truncate max-w-[220px]">{deal.title}</span>
                        <ChevronRight size={11} className="opacity-0 group-hover:opacity-60 transition-opacity shrink-0" />
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 text-ssm text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {am.split(' ')[0]}
                    </td>
                    <td className="px-3 py-2.5">{stageBadge(deal.stage)}</td>
                    <td className="px-3 py-2.5 text-right text-ssm tabular-nums font-medium text-slate-700 dark:text-slate-300">
                      {v > 0 ? (
                        <div>
                          <div>{phpFmt(v)}</div>
                          {deal.contractLength && deal.contractLength > 0 && (
                            <div className="text-atom text-slate-400">{deal.contractLength}mo</div>
                          )}
                        </div>
                      ) : (
                        <Link href={`/deals/${deal.id}?from=revenue`} className="text-amber-500 hover:text-amber-600 text-atom">
                          + Add
                        </Link>
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
  userMap,
  onMonthSave,
}: {
  deals: ApiDeal[]
  userMap: Map<string, string>
  onMonthSave: (dealId: string, monthKey: string, value: number) => void
}) {
  const startupDeals = deals.filter(d => d.servicesTags?.includes(STARTUP_TAG))
  const agencyDeals = startupDeals.filter(d => dealStartupCategory(d) === 'agency')
  const hireaiDeals = startupDeals.filter(d => dealStartupCategory(d) === 'hireai')

  const combinedTotals = MONTH_KEYS.map(mk =>
    startupDeals.reduce((s, d) => s + dealMonthValue(d, mk), 0)
  )

  function DealRow({ deal, i }: { deal: ApiDeal; i: number }) {
    const mrr = numVal(deal.mrr)
    const otf = numVal(deal.oneTimeFee)
    const am = userMap.get(deal.assignedTo ?? '') ?? 'Unassigned'

    return (
      <tr className={i % 2 === 0 ? '' : 'bg-slate-50/50 dark:bg-white/[.01]'}>
        <td className="px-4 py-2.5 sticky left-0 bg-white dark:bg-[#1e1e21] z-10">
          <Link
            href={`/deals/${deal.id}?from=revenue`}
            className="text-ssm font-medium text-slate-800 dark:text-slate-200 hover:text-primary dark:hover:text-primary transition-colors flex items-center gap-1 group"
          >
            <span className="truncate max-w-[220px]">{deal.title}</span>
            <ChevronRight size={11} className="opacity-0 group-hover:opacity-60 transition-opacity shrink-0" />
          </Link>
        </td>
        <td className="px-3 py-2.5 text-ssm text-slate-500 dark:text-slate-400 whitespace-nowrap">
          {am.split(' ')[0]}
        </td>
        <td className="px-3 py-2.5">{stageBadge(deal.stage)}</td>
        <td className="px-3 py-2.5 text-right text-ssm tabular-nums text-slate-500 dark:text-slate-400">
          {otf > 0 ? phpFmt(otf) : ', '}
        </td>
        <td className="px-3 py-2.5 text-right text-ssm tabular-nums font-medium text-slate-700 dark:text-slate-300">
          {mrr > 0 ? phpFmt(mrr) : (
            <Link href={`/deals/${deal.id}?from=revenue`} className="text-amber-500 hover:text-amber-600 text-atom">
              + Add
            </Link>
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
        <td colSpan={5 + MONTH_KEYS.length} className={`px-4 py-2 text-xs font-bold uppercase tracking-wider ${color}`}>
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
      <div className="overflow-x-auto rounded-xl border border-black/[.06] dark:border-white/[.08]">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-black/[.06] dark:border-white/[.08] bg-slate-50 dark:bg-white/[.02]">
              <th className="px-4 py-2.5 text-xxs font-semibold text-slate-500 uppercase tracking-wider w-[260px] sticky left-0 bg-slate-50 dark:bg-[#1a1a1d] z-10">Client</th>
              <th className="px-3 py-2.5 text-xxs font-semibold text-slate-500 uppercase tracking-wider w-[70px]">Owner</th>
              <th className="px-3 py-2.5 text-xxs font-semibold text-slate-500 uppercase tracking-wider w-[70px]">Stage</th>
              <th className="px-3 py-2.5 text-xxs font-semibold text-slate-500 uppercase tracking-wider text-right w-[100px]">One-Time</th>
              <th className="px-3 py-2.5 text-xxs font-semibold text-slate-500 uppercase tracking-wider text-right w-[90px]">MRR</th>
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
      <div className="overflow-x-auto rounded-xl border border-black/[.06] dark:border-white/[.08]">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-black/[.06] dark:border-white/[.08] bg-slate-50 dark:bg-white/[.02]">
              <th className="px-4 py-2.5 text-xxs font-semibold text-slate-500 uppercase tracking-wider w-[260px] sticky left-0 bg-slate-50 dark:bg-[#1a1a1d] z-10">Client</th>
              <th className="px-3 py-2.5 text-xxs font-semibold text-slate-500 uppercase tracking-wider text-right w-[110px]">MRR</th>
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
                  <tr key={deal.id} className={i % 2 === 0 ? '' : 'bg-slate-50/50 dark:bg-white/[.01]'}>
                    <td className="px-4 py-2.5 sticky left-0 bg-white dark:bg-[#1e1e21] z-10">
                      <Link
                        href={`/deals/${deal.id}?from=revenue`}
                        className="text-ssm font-medium text-slate-800 dark:text-slate-200 hover:text-primary dark:hover:text-primary transition-colors flex items-center gap-1 group"
                      >
                        <span className="truncate max-w-[220px]">{displayName}</span>
                        <ChevronRight size={11} className="opacity-0 group-hover:opacity-60 transition-opacity shrink-0" />
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 text-right text-ssm tabular-nums font-medium text-slate-700 dark:text-slate-300">
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

export function RevenueGeneration() {
  const { data: allDeals = [], isLoading } = useGetDeals({ dealType: 'agency' })
  const { data: allUsers = [] } = useGetUsers()
  const qc = useQueryClient()

  const updateDeal = useUpdateDeal({
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.deals.all })
    },
  })

  const userMap = useMemo(() => {
    return new Map(allUsers.map(u => [u.id, u.name]))
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

  return (
    <div className="p-6 max-w-[1600px] mx-auto flex flex-col gap-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <TrendingUp size={20} className="text-primary" />
            Revenue Generation
          </h1>
          <p className="text-ssm text-slate-500 dark:text-slate-400 mt-0.5">
            Monthly forecast across project and startup revenue streams. Click any month cell to edit.
          </p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="rounded-xl border border-black/[.06] dark:border-white/[.08] bg-white dark:bg-white/[.03] p-4">
          <div className="text-xxs font-semibold text-slate-400 uppercase tracking-wider mb-1">Target / Month</div>
          <div className="text-xl font-bold text-slate-800 dark:text-white tabular-nums">{'₱'}22,000,000</div>
        </div>
        <div className="rounded-xl border border-black/[.06] dark:border-white/[.08] bg-white dark:bg-white/[.03] p-4">
          <div className="text-xxs font-semibold text-teal-500 uppercase tracking-wider mb-1">Project Revenue / Mo</div>
          <div className="text-xl font-bold text-slate-800 dark:text-white tabular-nums">{phpFmt(projectSubtotal)}</div>
        </div>
        <div className="rounded-xl border border-black/[.06] dark:border-white/[.08] bg-white dark:bg-white/[.03] p-4">
          <div className="text-xxs font-semibold text-violet-500 uppercase tracking-wider mb-1">Startup MRR</div>
          <div className="text-xl font-bold text-slate-800 dark:text-white tabular-nums">{phpFmt(startupSubtotal)}</div>
        </div>
        <div className="rounded-xl border border-black/[.06] dark:border-white/[.08] bg-white dark:bg-white/[.03] p-4">
          <div className="text-xxs font-semibold text-amber-500 uppercase tracking-wider mb-1">Existing Clients</div>
          <div className="text-xl font-bold text-slate-800 dark:text-white tabular-nums">{phpFmt(existingSubtotal)}</div>
        </div>
        <div className={`rounded-xl border p-4 ${gap < 0 ? 'border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-950/20' : 'border-emerald-200 dark:border-emerald-800/50 bg-emerald-50 dark:bg-emerald-950/20'}`}>
          <div className={`text-xxs font-semibold uppercase tracking-wider mb-1 ${gap < 0 ? 'text-red-400' : 'text-emerald-500'}`}>
            {gap < 0 ? 'Gap to Target' : 'Surplus'}
          </div>
          <div className={`text-xl font-bold tabular-nums ${gap < 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
            {gap < 0 ? `-${phpFmt(Math.abs(gap))}` : `+${phpFmt(gap)}`}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="rounded-xl border border-black/[.06] dark:border-white/[.08] bg-white dark:bg-white/[.03] p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-ssm font-semibold text-slate-700 dark:text-slate-300">Revenue vs. Target ({'₱'}22M)</span>
          <span className="text-ssm font-bold tabular-nums text-slate-700 dark:text-slate-300">{pct}%</span>
        </div>
        <div className="h-2.5 rounded-full bg-slate-100 dark:bg-white/[.06] overflow-hidden">
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

      {/* Section A */}
      <ProjectRevenueSection deals={activeDeals} userMap={userMap} onMonthSave={handleMonthSave} />

      {/* Section B */}
      <StartupRevenueSection deals={activeDeals} userMap={userMap} onMonthSave={handleMonthSave} />

      {/* Section C */}
      <ExistingClientsSection deals={activeDeals} onMonthSave={handleMonthSave} />

      {/* Grand total row */}
      <div className="overflow-x-auto rounded-xl border-2 border-slate-800 dark:border-white/[.2] bg-slate-800 dark:bg-white/[.06]">
        <table className="w-full border-collapse">
          <tbody>
            <tr>
              <td className="px-4 py-3 text-sm font-bold text-white dark:text-white w-[260px] sticky left-0 bg-slate-800 dark:bg-[#2a2d31] z-10">
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

      <p className="text-atom text-slate-400 dark:text-slate-500 text-center">
        Click any month cell to enter a custom amount. Blue values = custom override; white = auto-calculated.
        Revenue uses monthly overrides first, then MRR, then value / contract length, then value / 12.
      </p>
    </div>
  )
}
