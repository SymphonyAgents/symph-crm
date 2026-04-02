'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { cn, getInitials, getBrandColor, formatDealValue, timeAgo, totalNumericValue } from '@/lib/utils'
import { STAGE_DISPLAY, STAGE_COLORS, CLOSED_STAGE_IDS } from '@/lib/constants'
import { useGetDeals, useGetActivitiesByCompany, useGetUsers } from '@/lib/hooks/queries'
import type { ApiCompanyDetail, ApiDeal, Activity } from '@/lib/types'
import { X } from 'lucide-react'
import { Avatar } from './Avatar'
import { useEscapeKey } from '@/lib/hooks/use-escape-key'

// ─── Types ──────────────────────────────────────────────────────────────────

interface BrandSlideOverProps {
  brand: ApiCompanyDetail | null  // null = closed
  onClose: () => void
  onOpenDeal?: (dealId: string) => void
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function StagePill({ stage }: { stage: string }) {
  const cfg = STAGE_DISPLAY[stage] || { label: stage, bg: '#f1f5f9', color: '#475569' }
  return (
    <span
      className="inline-block px-2 py-px rounded-full text-[11px] font-medium leading-[18px] whitespace-nowrap"
      style={{ background: cfg.bg, color: cfg.color }}
    >
      {cfg.label}
    </span>
  )
}

function StatCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex-1 min-w-0 bg-slate-50 dark:bg-white/[.03] rounded-lg px-3 py-2.5">
      <div className="text-[10px] font-medium text-slate-400 uppercase tracking-wide">{label}</div>
      <div
        className="text-[15px] font-bold mt-0.5 tabular-nums truncate"
        style={color ? { color } : undefined}
      >
        {value}
      </div>
    </div>
  )
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function BrandSlideOver({ brand, onClose, onOpenDeal }: BrandSlideOverProps) {
  const [tab, setTab] = useState<'deals' | 'people'>('deals')
  const isOpen = !!brand

  useEscapeKey(useCallback(onClose, [onClose]), isOpen)

  // Reset tab when brand changes
  useEffect(() => {
    if (brand) setTab('deals')
  }, [brand?.id])

  // Fetch deals
  const { data: allDeals = [] } = useGetDeals()
  const brandDeals = useMemo(() => {
    if (!brand) return []
    return allDeals.filter(d => d.companyId === brand.id)
  }, [allDeals, brand?.id])

  // Fetch users for assigned person display
  const { data: users = [] } = useGetUsers()
  const userMap = useMemo(() => {
    const m = new Map<string, string>()
    for (const u of users) if (u.name) m.set(u.id, u.name)
    return m
  }, [users])

  // Fetch activities (always when brand is open, not just on people tab)
  const { data: activities = [] } = useGetActivitiesByCompany(brand?.id ?? '', {
    enabled: !!brand?.id,
  })

  // Stats
  const totalDeals = brandDeals.length
  const openValue = useMemo(
    () => totalNumericValue(brandDeals.filter(d => !CLOSED_STAGE_IDS.has(d.stage))),
    [brandDeals],
  )
  const winRate = useMemo(() => {
    const closed = brandDeals.filter(d => CLOSED_STAGE_IDS.has(d.stage))
    if (closed.length === 0) return null
    const won = closed.filter(d => d.stage === 'closed_won').length
    return Math.round((won / closed.length) * 100)
  }, [brandDeals])

  // People: extract unique contacts from activities
  const people = useMemo(() => {
    if (!activities.length) return []
    const contactMap = new Map<string, { name: string; role: string | null; lastActivity: string }>()
    for (const act of activities) {
      const meta = act.metadata as Record<string, unknown>
      const contactId = meta?.contactId as string | undefined
      const contactName = meta?.contactName as string | undefined
      const contactRole = meta?.contactRole as string | undefined
      if (contactId && contactName) {
        const existing = contactMap.get(contactId)
        if (!existing || act.createdAt > existing.lastActivity) {
          contactMap.set(contactId, {
            name: contactName,
            role: contactRole ?? existing?.role ?? null,
            lastActivity: act.createdAt,
          })
        }
      }
    }
    return Array.from(contactMap.entries()).map(([id, info]) => ({ id, ...info }))
  }, [activities])

  const contactCount = people.length
  const brandColor = brand ? getBrandColor(brand.name) : '#94a3b8'

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          'fixed inset-0 z-30 bg-black/20 dark:bg-black/40 transition-opacity duration-200',
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none',
        )}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={cn(
          'fixed right-0 top-0 h-full w-full sm:w-[380px] md:w-[420px] z-40',
          'bg-white dark:bg-[#1e1e21] border-l border-black/[.06] dark:border-white/[.08]',
          'shadow-2xl flex flex-col',
          'transition-transform duration-200 ease-out',
          isOpen ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        {brand && (
          <>
            {/* Header */}
            <div className="shrink-0 px-5 pt-5 pb-4 border-b border-black/[.06] dark:border-white/[.08]">
              <div className="flex items-start gap-3">
                {/* Avatar */}
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center text-[14px] font-bold shrink-0"
                  style={{ background: `${brandColor}18`, color: brandColor }}
                >
                  {getInitials(brand.name)}
                </div>

                <div className="flex-1 min-w-0">
                  <h2 className="text-[15px] font-semibold text-slate-900 dark:text-white truncate">
                    {brand.name}
                  </h2>
                  <div className="flex items-center gap-1 text-[11.5px] text-slate-400 mt-0.5 flex-wrap">
                    {brand.industry && (
                      <span>{brand.industry}</span>
                    )}
                    {brand.industry && contactCount > 0 && (
                      <span>&#183;</span>
                    )}
                    {contactCount > 0 && (
                      <span>{contactCount} contact{contactCount !== 1 ? 's' : ''}</span>
                    )}
                    {(brand.industry || contactCount > 0) && brand.website && (
                      <span>&#183;</span>
                    )}
                    {brand.website && (
                      <a
                        href={brand.website.startsWith('http') ? brand.website : `https://${brand.website}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-500 hover:underline truncate"
                        onClick={e => e.stopPropagation()}
                      >
                        {brand.domain || brand.website}
                      </a>
                    )}
                  </div>
                </div>

                {/* Close */}
                <button
                  onClick={onClose}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[.08] transition-colors shrink-0"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* Stat cards */}
            <div className="shrink-0 px-5 py-3 flex gap-2.5">
              <StatCard label="Total Deals" value={String(totalDeals)} />
              <StatCard label="Open Value" value={openValue > 0 ? formatDealValue(String(openValue)) : '--'} color={brandColor} />
              <StatCard label="Win Rate" value={winRate !== null ? `${winRate}%` : '--'} />
            </div>

            {/* Tab switcher */}
            <div className="shrink-0 px-5 flex gap-1 border-b border-black/[.06] dark:border-white/[.08]">
              {(['deals', 'people'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={cn(
                    'px-3 py-2.5 text-[12.5px] font-medium border-b-2 transition-colors capitalize',
                    tab === t
                      ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                      : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300',
                  )}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto">
              {tab === 'deals' && (
                <div className="p-3 space-y-1">
                  {brandDeals.length === 0 ? (
                    <div className="py-8 text-center text-[13px] text-slate-400">
                      No deals for this brand yet
                    </div>
                  ) : (
                    brandDeals.map(deal => (
                      <div
                        key={deal.id}
                        onClick={() => onOpenDeal?.(deal.id)}
                        className={cn(
                          "flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg transition-colors",
                          onOpenDeal ? "cursor-pointer hover:bg-slate-50 dark:hover:bg-white/[.04]" : "hover:bg-slate-50 dark:hover:bg-white/[.03]"
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-[13px] font-medium text-slate-900 dark:text-white truncate">
                            {deal.title}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            {formatDealValue(deal.value)}
                            {deal.updatedAt && (
                              <> &#183; {new Date(deal.updatedAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}</>
                            )}
                          </div>
                          {deal.assignedTo && userMap.get(deal.assignedTo) && (
                            <div className="flex items-center gap-1 mt-0.5">
                              <Avatar name={userMap.get(deal.assignedTo)!} size={14} />
                              <span className="text-[10px] text-slate-400 truncate">{userMap.get(deal.assignedTo)}</span>
                            </div>
                          )}
                        </div>
                        <StagePill stage={deal.stage} />
                      </div>
                    ))
                  )}
                </div>
              )}

              {tab === 'people' && (
                <div className="p-3 space-y-1">
                  {people.length === 0 ? (
                    <div className="py-8 text-center text-[13px] text-slate-400">
                      No contacts found for this brand
                    </div>
                  ) : (
                    people.map(person => {
                      const initials = getInitials(person.name)
                      const color = getBrandColor(person.name)
                      return (
                        <div
                          key={person.id}
                          className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-50 dark:hover:bg-white/[.03] transition-colors"
                        >
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0"
                            style={{ background: color }}
                          >
                            {initials}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-[13px] font-medium text-slate-900 dark:text-white truncate">
                                {person.name}
                              </span>
                              {person.role && (
                                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-lg bg-slate-100 dark:bg-white/[.06] text-slate-500 dark:text-slate-400 whitespace-nowrap">
                                  {person.role}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 mt-0.5">
                              Last met: {timeAgo(person.lastActivity)}
                            </div>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </>
  )
}
