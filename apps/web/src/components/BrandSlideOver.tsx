'use client'

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { cn, getInitials, getBrandColor, formatDealValue, timeAgo, totalNumericValue, formatDealTitle } from '@/lib/utils'
import { STAGE_COLORS, STAGE_LABELS, CLOSED_STAGE_IDS } from '@/lib/constants'
import { useGetDeals, useGetActivitiesByCompany, useGetUsers, useGetCompanies, useGetContactsByCompany } from '@/lib/hooks/queries'
import { useAssignDealBrand, useCreateContact, useDeleteBrand } from '@/lib/hooks/mutations'
import type { ApiCompanyDetail, ApiDeal, Activity } from '@/lib/types'
import { queryKeys } from '@/lib/query-keys'
import { X, Plus, Trash2 } from 'lucide-react'
import { Avatar } from './Avatar'
import { useEscapeKey } from '@/lib/hooks/use-escape-key'

// ─── Types ──────────────────────────────────────────────────────────────────

interface BrandSlideOverProps {
  brand: ApiCompanyDetail | null  // null = closed
  onClose: () => void
  onOpenDeal?: (dealId: string) => void
}

const UNASSIGNED_ID = '__unassigned__'

// ─── Helpers ────────────────────────────────────────────────────────────────

function StagePill({ stage }: { stage: string }) {
  const stageColor = STAGE_COLORS[stage] || '#64748b'
  const label = STAGE_LABELS[stage] || stage
  return (
    <span
      className="inline-block px-2 py-px rounded-full text-[11px] font-medium leading-[18px] whitespace-nowrap dark:brightness-150"
      style={{ background: `${stageColor}18`, color: stageColor }}
    >
      {label}
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

// ─── AssignBrandSelect — inline dropdown for unassigned deals ───────────────

function AssignBrandSelect({
  dealId,
  companies,
  onAssigned,
}: {
  dealId: string
  companies: ApiCompanyDetail[]
  onAssigned: () => void
}) {
  const qc = useQueryClient()
  const assign = useAssignDealBrand({
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deals'] })
      qc.invalidateQueries({ queryKey: ['companies'] })
      onAssigned()
    },
  })

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const companyId = e.target.value || null
    if (companyId) assign.mutate({ id: dealId, companyId })
  }

  return (
    <select
      defaultValue=""
      onChange={handleChange}
      disabled={assign.isPending}
      onClick={e => e.stopPropagation()}
      className="text-[11px] border border-black/[.08] dark:border-white/[.08] rounded-md px-2 py-0.5 bg-white dark:bg-[#2a2d31] text-slate-600 dark:text-slate-300 cursor-pointer hover:border-primary/40 transition-colors disabled:opacity-50 max-w-[130px]"
    >
      <option value="" disabled>Assign brand…</option>
      {companies.map(c => (
        <option key={c.id} value={c.id}>{c.name}</option>
      ))}
    </select>
  )
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function BrandSlideOver({ brand, onClose, onOpenDeal }: BrandSlideOverProps) {
  const [tab, setTab] = useState<'deals' | 'people'>('deals')
  const [showAddPerson, setShowAddPerson] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [personForm, setPersonForm] = useState({ name: '', phone: '', title: '', role: '' })
  const isDeleting = useRef(false)
  const isOpen = !!brand && !isDeleting.current
  const isUnassigned = brand?.id === UNASSIGNED_ID

  useEscapeKey(useCallback(onClose, [onClose]), isOpen)

  // Reset tab and form state when brand changes
  useEffect(() => {
    if (brand) {
      isDeleting.current = false
      setTab('deals')
      setShowAddPerson(false)
      setShowDeleteConfirm(false)
      setPersonForm({ name: '', phone: '', title: '', role: '' })
    }
  }, [brand?.id])

  // Fetch deals
  const { data: allDeals = [] } = useGetDeals()

  // For "No Brand" group, filter deals with no companyId; otherwise filter by brand.id
  const brandDeals = useMemo(() => {
    if (!brand) return []
    if (isUnassigned) return allDeals.filter(d => !d.companyId)
    return allDeals.filter(d => d.companyId === brand.id)
  }, [allDeals, brand?.id, isUnassigned])

  // Companies list — needed for the assign dropdown on unassigned deals
  const { data: companies = [] } = useGetCompanies()
  const assignableCompanies = useMemo(
    () => companies.filter(c => c.id !== UNASSIGNED_ID),
    [companies],
  )

  // Fetch users for assigned person display
  const { data: users = [] } = useGetUsers()
  const userMap = useMemo(() => {
    const m = new Map<string, string>()
    for (const u of users) if (u.name) m.set(u.id, u.name)
    return m
  }, [users])

  // Contacts from DB (real source of truth)
  const { data: dbContacts = [] } = useGetContactsByCompany(brand?.id !== UNASSIGNED_ID ? brand?.id : undefined)

  // Mutations
  const qc = useQueryClient()
  const createContact = useCreateContact({
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.contacts.byCompany(brand?.id ?? '') })
      setShowAddPerson(false)
      setPersonForm({ name: '', phone: '', title: '', role: '' })
    },
  })
  const deleteBrand = useDeleteBrand({
    onMutate: async () => {
      // Optimistic: dismiss confirmation dialog, close slide-over, remove brand from cache
      isDeleting.current = true
      setShowDeleteConfirm(false)

      // Cancel any outgoing refetches so they don't overwrite our optimistic update
      await qc.cancelQueries({ queryKey: queryKeys.companies.all })

      // Snapshot previous companies for rollback
      const previousCompanies = qc.getQueryData(queryKeys.companies.all)

      // Optimistically remove the brand from the companies cache
      qc.setQueryData(queryKeys.companies.all, (old: ApiCompanyDetail[] | undefined) =>
        old ? old.filter(c => c.id !== brand?.id) : [],
      )

      // Close the slide-over immediately
      onClose()

      return { previousCompanies }
    },
    onError: (_err, _vars, onMutateResult: { previousCompanies?: unknown } | undefined) => {
      // Rollback the optimistic removal on error
      if (onMutateResult?.previousCompanies) {
        qc.setQueryData(queryKeys.companies.all, onMutateResult.previousCompanies)
      }
      isDeleting.current = false
    },
    onSuccess: () => {
      // Sync full state from server
      qc.invalidateQueries({ queryKey: queryKeys.companies.all })
      qc.invalidateQueries({ queryKey: queryKeys.deals.all })
    },
    onSettled: () => {
      isDeleting.current = false
    },
  })

  // Fetch activities (skip for unassigned pseudo-brand)
  const { data: activities = [] } = useGetActivitiesByCompany(brand?.id ?? '', {
    enabled: !!brand?.id && !isUnassigned,
  })

  // Stats
  const totalDeals = brandDeals.length
  const openValue = useMemo(
    () => totalNumericValue(brandDeals.filter(d => !CLOSED_STAGE_IDS.has(d.stage ?? ''))),
    [brandDeals],
  )
  const winRate = useMemo(() => {
    const closed = brandDeals.filter(d => CLOSED_STAGE_IDS.has(d.stage ?? ''))
    if (closed.length === 0) return null
    const won = closed.filter(d => d.stage === 'closed_won').length
    return Math.round((won / closed.length) * 100)
  }, [brandDeals])

  // People: merge DB contacts + activity-derived contacts (DB is primary)
  const people = useMemo(() => {
    const contactMap = new Map<string, { name: string; phone: string | null; role: string | null; title: string | null; lastActivity: string | null; source: 'db' | 'activity' }>()

    // DB contacts are the source of truth
    for (const c of dbContacts) {
      contactMap.set(c.id, {
        name: c.name,
        phone: c.phone,
        role: c.title, // title field serves as role
        title: c.title,
        lastActivity: c.updatedAt,
        source: 'db',
      })
    }

    // Supplement with activity-derived contacts not already in DB
    for (const act of activities) {
      const meta = act.metadata as Record<string, unknown>
      const contactId = meta?.contactId as string | undefined
      const contactName = meta?.contactName as string | undefined
      const contactRole = meta?.contactRole as string | undefined
      if (contactId && contactName && !contactMap.has(contactId)) {
        contactMap.set(contactId, {
          name: contactName,
          phone: null,
          role: contactRole ?? null,
          title: contactRole ?? null,
          lastActivity: act.createdAt,
          source: 'activity',
        })
      }
    }

    return Array.from(contactMap.entries()).map(([id, info]) => ({ id, ...info }))
  }, [dbContacts, activities])

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
                  {!isUnassigned && (
                    <div className="flex items-center gap-1 text-[11.5px] text-slate-400 mt-0.5 flex-wrap">
                      {brand.industry && <span>{brand.industry}</span>}
                      {brand.industry && contactCount > 0 && <span>&#183;</span>}
                      {contactCount > 0 && <span>{contactCount} contact{contactCount !== 1 ? 's' : ''}</span>}
                      {(brand.industry || contactCount > 0) && brand.website && <span>&#183;</span>}
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
                  )}
                  {isUnassigned && (
                    <p className="text-[11.5px] text-slate-400 mt-0.5">
                      Deals without a brand — assign one below
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {!isUnassigned && (
                    <button
                      onClick={() => setShowDeleteConfirm(true)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                      title="Delete brand"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                  <button
                    onClick={onClose}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[.08] transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            </div>

            {/* Stat cards */}
            <div className="shrink-0 px-5 py-3 flex gap-2.5">
              <StatCard label="Total Deals" value={String(totalDeals)} />
              <StatCard label="Open Value" value={openValue > 0 ? formatDealValue(String(openValue)) : '--'} color={isUnassigned ? undefined : brandColor} />
              {!isUnassigned && <StatCard label="Win Rate" value={winRate !== null ? `${winRate}%` : '--'} />}
            </div>

            {/* Tab switcher — hide People tab for unassigned */}
            {!isUnassigned && (
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
            )}

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto">
              {/* Deals list */}
              {(tab === 'deals' || isUnassigned) && (
                <div className="p-3 space-y-2">
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
                          'flex items-start gap-3 px-3 py-2.5 rounded-lg transition-colors border border-black/[.08] dark:border-white/[.08] bg-transparent',
                          onOpenDeal ? 'cursor-pointer hover:border-black/[.15] dark:hover:border-white/[.15] hover:bg-slate-50 dark:hover:bg-white/[.03]' : 'hover:border-black/[.15] dark:hover:border-white/[.15] hover:bg-slate-50 dark:hover:bg-white/[.03]',
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-[13px] font-medium text-slate-900 dark:text-white truncate">
                            {formatDealTitle(deal.title)}
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
                          {/* Assign brand dropdown — only shown in the "No Brand" slide-over */}
                          {isUnassigned && assignableCompanies.length > 0 && (
                            <div className="mt-1.5" onClick={e => e.stopPropagation()}>
                              <AssignBrandSelect
                                dealId={deal.id}
                                companies={assignableCompanies}
                                onAssigned={() => {/* deal disappears from list on next query refresh */}}
                              />
                            </div>
                          )}
                        </div>
                        <div className="shrink-0 pt-0.5">
                          <StagePill stage={deal.stage ?? ''} />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {tab === 'people' && !isUnassigned && (
                <div className="p-3 space-y-1">
                  {/* Add Person button / inline form */}
                  {!showAddPerson ? (
                    <button
                      onClick={() => setShowAddPerson(true)}
                      className="flex items-center gap-1.5 px-3 py-2 text-[12px] font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-colors w-full"
                    >
                      <Plus size={14} />
                      Add Person
                    </button>
                  ) : (
                    <div className="bg-slate-50 dark:bg-white/[.03] rounded-lg p-3 space-y-2 mb-2">
                      <input
                        autoFocus
                        type="text"
                        placeholder="Full name *"
                        value={personForm.name}
                        onChange={e => setPersonForm(f => ({ ...f, name: e.target.value }))}
                        className="w-full text-[13px] px-2.5 py-1.5 rounded-md border border-black/[.08] dark:border-white/[.1] bg-white dark:bg-[#2a2d31] text-slate-900 dark:text-white placeholder:text-slate-400"
                      />
                      <input
                        type="tel"
                        placeholder="Phone (optional)"
                        value={personForm.phone}
                        onChange={e => setPersonForm(f => ({ ...f, phone: e.target.value }))}
                        className="w-full text-[13px] px-2.5 py-1.5 rounded-md border border-black/[.08] dark:border-white/[.1] bg-white dark:bg-[#2a2d31] text-slate-900 dark:text-white placeholder:text-slate-400"
                      />
                      <input
                        type="text"
                        placeholder="Notes / description (optional)"
                        value={personForm.title}
                        onChange={e => setPersonForm(f => ({ ...f, title: e.target.value }))}
                        className="w-full text-[13px] px-2.5 py-1.5 rounded-md border border-black/[.08] dark:border-white/[.1] bg-white dark:bg-[#2a2d31] text-slate-900 dark:text-white placeholder:text-slate-400"
                      />
                      <select
                        value={personForm.role}
                        onChange={e => setPersonForm(f => ({ ...f, role: e.target.value }))}
                        className="w-full text-[13px] px-2.5 py-1.5 rounded-md border border-black/[.08] dark:border-white/[.1] bg-white dark:bg-[#2a2d31] text-slate-900 dark:text-white"
                      >
                        <option value="">Role (optional)</option>
                        <option value="poc">POC</option>
                        <option value="stakeholder">Stakeholder</option>
                        <option value="champion">Champion</option>
                        <option value="blocker">Blocker</option>
                        <option value="technical">Technical</option>
                        <option value="executive">Executive</option>
                      </select>
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          onClick={() => {
                            if (!personForm.name.trim() || !brand?.id) return
                            createContact.mutate({
                              companyId: brand.id,
                              name: personForm.name.trim(),
                              phone: personForm.phone.trim() || null,
                              title: [personForm.role, personForm.title.trim()].filter(Boolean).join(' — ') || null,
                            })
                          }}
                          disabled={!personForm.name.trim() || createContact.isPending}
                          className="px-3 py-1.5 text-[12px] font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {createContact.isPending ? 'Adding...' : 'Add'}
                        </button>
                        <button
                          onClick={() => {
                            setShowAddPerson(false)
                            setPersonForm({ name: '', phone: '', title: '', role: '' })
                          }}
                          className="px-3 py-1.5 text-[12px] font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {people.length === 0 && !showAddPerson ? (
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
                            {person.phone && (
                              <div className="text-[11px] text-slate-400 mt-0.5">{person.phone}</div>
                            )}
                            {person.lastActivity && (
                              <div className="text-[11px] text-slate-400 mt-0.5">
                                {person.source === 'activity' ? 'Last met: ' : 'Added: '}{timeAgo(person.lastActivity)}
                              </div>
                            )}
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

        {/* Delete confirmation dialog */}
        {showDeleteConfirm && brand && !isUnassigned && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/30 dark:bg-black/50 rounded-l-xl">
            <div className="bg-white dark:bg-[#1e1e21] rounded-xl shadow-xl p-4 mx-6 max-w-[320px] w-full border border-black/[.06] dark:border-white/[.08]">
              <h3 className="text-[14px] font-semibold text-slate-900 dark:text-white">Delete brand?</h3>
              <p className="text-[12.5px] text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                This will permanently delete <strong>{brand.name}</strong>.
                {brandDeals.length > 0 && (
                  <> Its {brandDeals.length} deal{brandDeals.length !== 1 ? 's' : ''} will become &ldquo;No Brand&rdquo; deals.</>
                )}
              </p>
              <div className="flex items-center gap-2 mt-4 justify-end">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-3 py-1.5 text-[12px] font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[.06] rounded-md transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => deleteBrand.mutate(brand.id)}
                  disabled={deleteBrand.isPending}
                  className="px-3 py-1.5 text-[12px] font-medium bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 transition-colors"
                >
                  {deleteBrand.isPending ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
