'use client'

import { useMemo, useState } from 'react'
import { useGetDeals, useGetUsers } from '@/lib/hooks/queries'
import { formatCurrency } from '@/lib/utils'
import { TrendingUp, Building2, Rocket, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import type { ApiDeal } from '@/lib/types'

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTHS = ['May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const MONTH_KEYS = ['05', '06', '07', '08', '09', '10', '11', '12']
const TARGET_MONTHLY = 25_000_000

// Startup product tag
const STARTUP_TAG = 'internal_products'

// The Agency vs HireAI, determined by internalProductName
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

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ icon, title, color }: { icon: React.ReactNode; title: string; color: string }) {
  return (
    <div className={`flex items-center gap-2.5 px-4 py-3 rounded-xl ${color} mb-3`}>
      <div className="shrink-0">{icon}</div>
      <span className="text-sm font-semibold">{title}</span>
    </div>
  )
}

function MonthCell({ value }: { value: number }) {
  return (
    <td className="px-3 py-2 text-right text-ssm tabular-nums">
      {value > 0 ? (
        <span className="text-slate-800 dark:text-slate-200">{phpFmt(value)}</span>
      ) : (
        <span className="text-slate-300 dark:text-slate-600">, </span>
      )}
    </td>
  )
}

// ─── Section A: Project-Based Revenue ─────────────────────────────────────────

function ProjectRevenueSection({ deals, userMap }: { deals: ApiDeal[]; userMap: Map<string, string> }) {
  // Monthly revenue = deal value / 12 (standard project revenue recognition)
  // If deal has no value, show blank (user needs to fill in CRM)
  const projectDeals = deals.filter(d => !d.servicesTags?.includes(STARTUP_TAG))

  const columnTotals = MONTHS.map(() => {
    return projectDeals.reduce((sum, d) => {
      const v = numVal(d.value)
      return sum + (v > 0 ? Math.round(v / 12) : 0)
    }, 0)
  })

  return (
    <div>
      <SectionHeader
        icon={<Building2 size={16} className="text-teal-600 dark:text-teal-400" />}
        title="Section A, Project Based Revenue"
        color="bg-teal-50 dark:bg-teal-950/30 text-teal-800 dark:text-teal-200"
      />
      <div className="overflow-x-auto rounded-xl border border-black/[.06] dark:border-white/[.08]">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-black/[.06] dark:border-white/[.08] bg-slate-50 dark:bg-white/[.02]">
              <th className="px-4 py-2.5 text-xxs font-semibold text-slate-500 uppercase tracking-wider w-[280px]">Project / Deal</th>
              <th className="px-3 py-2.5 text-xxs font-semibold text-slate-500 uppercase tracking-wider w-[90px]">Owner</th>
              <th className="px-3 py-2.5 text-xxs font-semibold text-slate-500 uppercase tracking-wider w-[80px]">Stage</th>
              <th className="px-3 py-2.5 text-xxs font-semibold text-slate-500 uppercase tracking-wider text-right w-[110px]">Deal Value</th>
              {MONTHS.map(m => (
                <th key={m} className="px-3 py-2.5 text-xxs font-semibold text-slate-500 uppercase tracking-wider text-right">{m}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-black/[.04] dark:divide-white/[.04]">
            {projectDeals.length === 0 ? (
              <tr>
                <td colSpan={4 + MONTHS.length} className="px-4 py-8 text-center text-ssm text-slate-400">
                  No project-based deals found
                </td>
              </tr>
            ) : (
              projectDeals.map((deal, i) => {
                const v = numVal(deal.value)
                const monthly = v > 0 ? Math.round(v / 12) : 0
                const am = userMap.get(deal.assignedTo ?? '') ?? 'Unassigned'
                return (
                  <tr key={deal.id} className={i % 2 === 0 ? '' : 'bg-slate-50/50 dark:bg-white/[.01]'}>
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/deals/${deal.id}?from=revenue`}
                        className="text-ssm font-medium text-slate-800 dark:text-slate-200 hover:text-primary dark:hover:text-primary transition-colors flex items-center gap-1 group"
                      >
                        {deal.title}
                        <ChevronRight size={11} className="opacity-0 group-hover:opacity-60 transition-opacity" />
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 text-ssm text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {am.split(' ')[0]}
                    </td>
                    <td className="px-3 py-2.5">{stageBadge(deal.stage)}</td>
                    <td className="px-3 py-2.5 text-right text-ssm tabular-nums font-medium text-slate-700 dark:text-slate-300">
                      {v > 0 ? phpFmt(v) : (
                        <Link href={`/deals/${deal.id}?tab=billing&from=revenue`} className="text-amber-500 hover:text-amber-600 text-atom">
                          + Add value
                        </Link>
                      )}
                    </td>
                    {MONTHS.map(m => (
                      <MonthCell key={m} value={monthly} />
                    ))}
                  </tr>
                )
              })
            )}
          </tbody>
          {/* Subtotal row */}
          <tfoot>
            <tr className="border-t-2 border-teal-200 dark:border-teal-800/50 bg-teal-50/60 dark:bg-teal-950/20">
              <td colSpan={4} className="px-4 py-2.5 text-ssm font-semibold text-teal-700 dark:text-teal-300">
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

function StartupRevenueSection({ deals, userMap }: { deals: ApiDeal[]; userMap: Map<string, string> }) {
  const startupDeals = deals.filter(d => d.servicesTags?.includes(STARTUP_TAG))
  const agencyDeals = startupDeals.filter(d => dealStartupCategory(d) === 'agency')
  const hireaiDeals = startupDeals.filter(d => dealStartupCategory(d) === 'hireai')

  function totalMrr(list: ApiDeal[]) {
    return list.reduce((s, d) => s + numVal(d.mrr), 0)
  }

  const agencyMonthlyTotals = MONTHS.map(() => totalMrr(agencyDeals))
  const hireaiMonthlyTotals = MONTHS.map(() => totalMrr(hireaiDeals))
  const combinedTotals = MONTHS.map((_, i) => agencyMonthlyTotals[i] + hireaiMonthlyTotals[i])

  function DealRow({ deal, i }: { deal: ApiDeal; i: number }) {
    const mrr = numVal(deal.mrr)
    const otf = numVal(deal.oneTimeFee)
    const am = userMap.get(deal.assignedTo ?? '') ?? 'Unassigned'
    const isHireAI = dealStartupCategory(deal) === 'hireai'

    return (
      <tr className={i % 2 === 0 ? '' : 'bg-slate-50/50 dark:bg-white/[.01]'}>
        <td className="px-4 py-2.5">
          <Link
            href={`/deals/${deal.id}?from=revenue`}
            className="text-ssm font-medium text-slate-800 dark:text-slate-200 hover:text-primary dark:hover:text-primary transition-colors flex items-center gap-1 group"
          >
            {deal.title}
            <ChevronRight size={11} className="opacity-0 group-hover:opacity-60 transition-opacity" />
          </Link>
        </td>
        <td className="px-3 py-2.5 text-ssm text-slate-500 dark:text-slate-400 whitespace-nowrap">
          {am.split(' ')[0]}
        </td>
        <td className="px-3 py-2.5">{stageBadge(deal.stage)}</td>
        {isHireAI && (
          <td className="px-3 py-2.5 text-right text-ssm tabular-nums text-slate-500 dark:text-slate-400">
            {otf > 0 ? phpFmt(otf) : (
              <Link href={`/deals/${deal.id}?from=revenue`} className="text-amber-500 hover:text-amber-600 text-atom">
                + Add
              </Link>
            )}
          </td>
        )}
        {!isHireAI && <td className="px-3 py-2.5" />}
        <td className="px-3 py-2.5 text-right text-ssm tabular-nums font-medium text-slate-700 dark:text-slate-300">
          {mrr > 0 ? phpFmt(mrr) : (
            <Link href={`/deals/${deal.id}?from=revenue`} className="text-amber-500 hover:text-amber-600 text-atom">
              + Add MRR
            </Link>
          )}
        </td>
        {MONTHS.map(m => (
          <MonthCell key={m} value={mrr} />
        ))}
      </tr>
    )
  }

  function SubgroupHeader({ label, color }: { label: string; color: string }) {
    return (
      <tr>
        <td colSpan={5 + MONTHS.length} className={`px-4 py-2 text-xs font-bold uppercase tracking-wider ${color}`}>
          {label}
        </td>
      </tr>
    )
  }

  return (
    <div>
      <SectionHeader
        icon={<Rocket size={16} className="text-violet-600 dark:text-violet-400" />}
        title="Section B, Startup Based Revenue (MRR)"
        color="bg-violet-50 dark:bg-violet-950/30 text-violet-800 dark:text-violet-200"
      />
      <div className="overflow-x-auto rounded-xl border border-black/[.06] dark:border-white/[.08]">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-black/[.06] dark:border-white/[.08] bg-slate-50 dark:bg-white/[.02]">
              <th className="px-4 py-2.5 text-xxs font-semibold text-slate-500 uppercase tracking-wider w-[280px]">Client</th>
              <th className="px-3 py-2.5 text-xxs font-semibold text-slate-500 uppercase tracking-wider w-[90px]">Owner</th>
              <th className="px-3 py-2.5 text-xxs font-semibold text-slate-500 uppercase tracking-wider w-[80px]">Stage</th>
              <th className="px-3 py-2.5 text-xxs font-semibold text-slate-500 uppercase tracking-wider text-right w-[110px]">One-Time Fee</th>
              <th className="px-3 py-2.5 text-xxs font-semibold text-slate-500 uppercase tracking-wider text-right w-[110px]">MRR</th>
              {MONTHS.map(m => (
                <th key={m} className="px-3 py-2.5 text-xxs font-semibold text-slate-500 uppercase tracking-wider text-right">{m}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-black/[.04] dark:divide-white/[.04]">
            {/* The Agency */}
            <SubgroupHeader label="The Agency" color="bg-teal-50 dark:bg-teal-950/20 text-teal-700 dark:text-teal-400" />
            {agencyDeals.length === 0 ? (
              <tr>
                <td colSpan={5 + MONTHS.length} className="px-8 py-3 text-ssm text-slate-400 italic">No Agency deals</td>
              </tr>
            ) : agencyDeals.map((d, i) => <DealRow key={d.id} deal={d} i={i} />)}

            {/* HireAI */}
            <SubgroupHeader label="HireAI" color="bg-violet-50 dark:bg-violet-950/20 text-violet-700 dark:text-violet-400" />
            {hireaiDeals.length === 0 ? (
              <tr>
                <td colSpan={5 + MONTHS.length} className="px-8 py-3 text-ssm text-slate-400 italic">No HireAI deals</td>
              </tr>
            ) : hireaiDeals.map((d, i) => <DealRow key={d.id} deal={d} i={i} />)}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-violet-200 dark:border-violet-800/50 bg-violet-50/60 dark:bg-violet-950/20">
              <td colSpan={5} className="px-4 py-2.5 text-ssm font-semibold text-violet-700 dark:text-violet-300">
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

// ─── Main Component ───────────────────────────────────────────────────────────

export function RevenueGeneration() {
  const { data: allDeals = [], isLoading } = useGetDeals()
  const { data: allUsers = [] } = useGetUsers()

  const userMap = useMemo(() => {
    return new Map(allUsers.map(u => [u.id, u.name]))
  }, [allUsers])

  // Exclude clearly irrelevant deals (parked, lost)
  const activeDeals = useMemo(() =>
    allDeals.filter(d => !['closed_lost', 'parked'].includes(d.stage)),
    [allDeals]
  )

  // Totals for summary bar
  const projectSubtotal = useMemo(() => {
    return activeDeals
      .filter(d => !d.servicesTags?.includes(STARTUP_TAG))
      .reduce((s, d) => s + (numVal(d.value) > 0 ? Math.round(numVal(d.value) / 12) : 0), 0)
  }, [activeDeals])

  const startupSubtotal = useMemo(() => {
    return activeDeals
      .filter(d => d.servicesTags?.includes(STARTUP_TAG))
      .reduce((s, d) => s + numVal(d.mrr), 0)
  }, [activeDeals])

  const totalRevenue = projectSubtotal + startupSubtotal
  const gap = totalRevenue - TARGET_MONTHLY
  const pct = Math.min(100, Math.round((totalRevenue / TARGET_MONTHLY) * 100))

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
            Monthly forecast across project and startup revenue streams
          </p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl border border-black/[.06] dark:border-white/[.08] bg-white dark:bg-white/[.03] p-4">
          <div className="text-xxs font-semibold text-slate-400 uppercase tracking-wider mb-1">Target / Month</div>
          <div className="text-xl font-bold text-slate-800 dark:text-white tabular-nums">₱25,000,000</div>
        </div>
        <div className="rounded-xl border border-black/[.06] dark:border-white/[.08] bg-white dark:bg-white/[.03] p-4">
          <div className="text-xxs font-semibold text-teal-500 uppercase tracking-wider mb-1">Project Revenue / Mo</div>
          <div className="text-xl font-bold text-slate-800 dark:text-white tabular-nums">{phpFmt(projectSubtotal)}</div>
        </div>
        <div className="rounded-xl border border-black/[.06] dark:border-white/[.08] bg-white dark:bg-white/[.03] p-4">
          <div className="text-xxs font-semibold text-violet-500 uppercase tracking-wider mb-1">Startup MRR</div>
          <div className="text-xl font-bold text-slate-800 dark:text-white tabular-nums">{phpFmt(startupSubtotal)}</div>
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
          <span className="text-ssm font-semibold text-slate-700 dark:text-slate-300">Revenue vs. Target</span>
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
            <span className="text-atom text-slate-400">Startup MRR ({phpFmt(startupSubtotal)})</span>
          </div>
        </div>
      </div>

      {/* Section A */}
      <ProjectRevenueSection deals={activeDeals} userMap={userMap} />

      {/* Section B */}
      <StartupRevenueSection deals={activeDeals} userMap={userMap} />

      {/* Note */}
      <p className="text-atom text-slate-400 dark:text-slate-500 text-center">
        Project monthly revenue = deal value / 12. Startup revenue = MRR entered on each deal.
        Click any deal to edit its values. Parked and lost deals are excluded.
      </p>
    </div>
  )
}
