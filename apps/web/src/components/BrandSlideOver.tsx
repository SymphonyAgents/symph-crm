'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { cn, getInitials, getBrandColor, formatDealValue, timeAgo, totalNumericValue, formatDealTitle, toPascalCase, formatPeso } from '@/lib/utils'
import { STAGE_COLORS, STAGE_LABELS, CLOSED_STAGE_IDS } from '@/lib/constants'
import { useGetDeals, useGetActivitiesByCompany, useGetUsers, useGetCompanies, useGetContactsByCompany } from '@/lib/hooks/queries'
import { useAssignDealBrand, useCreateContact } from '@/lib/hooks/mutations'
import type { ApiCompanyDetail, ApiDeal, Activity } from '@/lib/types'
import { queryKeys } from '@/lib/query-keys'
import { X, Plus, Copy, Check } from 'lucide-react'
import { Avatar } from './Avatar'
import { Input } from './ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { useEscapeKey } from '@/lib/hooks/use-escape-key'

// ─── Types ──────────────────────────────────────────────────────────────────

interface BrandSlideOverProps {
  brand: ApiCompanyDetail | null  // null = closed
  onClose: () => void
  onOpenDeal?: (dealId: string) => void
}

const UNASSIGNED_ID = '__unassigned__'

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={e => {
        e.stopPropagation()
        navigator.clipboard.writeText(value)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }}
      className={cn(
        'shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xxs font-medium transition-colors',
        copied
          ? 'border-green-200 dark:border-green-800 text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-500/10'
          : 'border-black/[.08] dark:border-white/[.1] text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/[.04]',
      )}
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function StagePill({ stage }: { stage: string }) {
  const stageColor = STAGE_COLORS[stage] || '#64748b'
  const label = STAGE_LABELS[stage] || stage
  return (
    <span
      className="inline-block px-2 py-px rounded-full text-xxs font-medium leading-[18px] whitespace-nowrap dark:brightness-150"
      style={{ background: `${stageColor}18`, color: stageColor }}
    >
      {label}
    </span>
  )
}

function StatCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex-1 min-w-0 bg-slate-50 dark:bg-white/[.03] rounded-lg px-3 py-2.5">
      <div className="text-atom font-medium text-slate-400 uppercase tracking-wide">{label}</div>
      <div
        className="text-sbase font-bold mt-0.5 tabular-nums truncate"
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
      className="text-xxs border border-black/[.08] dark:border-white/[.08] rounded-md px-2 py-0.5 bg-white dark:bg-[#2a2d31] text-slate-600 dark:text-slate-300 cursor-pointer hover:border-primary/40 transition-colors disabled:opacity-50 max-w-[130px]"
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
  const [personForm, setPersonForm] = useState({ name: '', phone: '', email: '', title: '', role: '' })
  const isOpen = !!brand
  const isUnassigned = brand?.id === UNASSIGNED_ID

  useEscapeKey(useCallback(onClose, [onClose]), isOpen)

  // Reset tab and form state when brand changes
  useEffect(() => {
    if (brand) {
      setTab('deals')
      setShowAddPerson(false)
      setPersonForm({ name: '', phone: '', email: '', title: '', role: '' })
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

  const userImageMap = useMemo(() => {
    const m = new Map<string, string>()
    for (const u of users) if (u.image) m.set(u.id, u.image)
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
      setPersonForm({ name: '', phone: '', email: '', title: '', role: '' })
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
  // People: merge DB contacts + activity-derived contacts (DB is primary)
  const people = useMemo(() => {
    const contactMap = new Map<string, { name: string; email: string | null; phone: string | null; role: string | null; title: string | null; lastActivity: string | null; source: 'db' | 'activity' }>()

    // DB contacts are the source of truth
    for (const c of dbContacts) {
      contactMap.set(c.id, {
        name: c.name,
        email: c.email,
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
          email: null,
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
                  className="w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold shrink-0"
                  style={{ background: `${brandColor}18`, color: brandColor }}
                >
                  {getInitials(brand.name)}
                </div>

                <div className="flex-1 min-w-0">
                  <h2 className="text-sbase font-semibold text-slate-900 dark:text-white truncate">
                    {toPascalCase(brand.name)}
                  </h2>
                  {!isUnassigned && (
                    <div className="flex items-center gap-1 text-xs text-slate-400 mt-0.5 flex-wrap">
                      {brand.industry && <span>{toPascalCase(brand.industry)}</span>}
                      {brand.industry && contactCount > 0 && <span>&#183;</span>}
                      {contactCount > 0 && <span>{contactCount} contact{contactCount !== 1 ? 's' : ''}</span>}
                      {(brand.industry || contactCount > 0) && brand.hqLocation && <span>&#183;</span>}
                      {brand.hqLocation && <span>{toPascalCase(brand.hqLocation)}</span>}
                      {(brand.industry || contactCount > 0 || brand.hqLocation) && brand.website && <span>&#183;</span>}
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
                    <p className="text-xs text-slate-400 mt-0.5">
                      Deals without a brand — assign one below
                    </p>
                  )}
                </div>

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
              <StatCard label="Open Value" value={openValue > 0 ? formatDealValue(String(openValue)) : formatPeso(0)} color={isUnassigned ? undefined : brandColor} />
            </div>

            {/* Tab switcher — hide People tab for unassigned */}
            {!isUnassigned && (
              <div className="shrink-0 px-5 flex gap-4 border-b border-black/[.06] dark:border-white/[.08]">
                {(['deals', 'people'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={cn(
                      'px-1 py-2.5 text-xs font-semibold border-b-2 transition-colors capitalize',
                      tab === t
                        ? 'border-primary text-primary'
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
                <div className="p-3 space-y-1.5">
                  {brandDeals.length === 0 ? (
                    <div className="py-8 text-center text-ssm text-slate-400">
                      No deals for this brand yet
                    </div>
                  ) : (
                    brandDeals.map(deal => (
                      <div
                        key={deal.id}
                        onClick={() => onOpenDeal?.(deal.id)}
                        className={cn(
                          'px-3.5 py-3 rounded-lg transition-colors border border-black/[.06] dark:border-white/[.08]',
                          onOpenDeal && 'cursor-pointer hover:border-black/[.12] dark:hover:border-white/[.15] hover:bg-slate-50 dark:hover:bg-white/[.02]',
                        )}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-ssm font-semibold text-slate-900 dark:text-white truncate">
                            {formatDealTitle(deal.title)}
                          </div>
                          <StagePill stage={deal.stage ?? ''} />
                        </div>
                        <div className="flex items-center gap-1.5 mt-1 text-xxs text-slate-400">
                          {deal.assignedTo && userMap.get(deal.assignedTo) && (
                            <>
                              <Avatar name={userMap.get(deal.assignedTo)!} src={userImageMap.get(deal.assignedTo!) ?? undefined} size={14} />
                              <span className="truncate">{userMap.get(deal.assignedTo)}</span>
                              <span>&#183;</span>
                            </>
                          )}
                          <span className="tabular-nums">{formatDealValue(deal.value)}</span>
                          {deal.updatedAt && (
                            <>
                              <span>&#183;</span>
                              <span>{new Date(deal.updatedAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}</span>
                            </>
                          )}
                        </div>
                        {isUnassigned && assignableCompanies.length > 0 && (
                          <div className="mt-1.5" onClick={e => e.stopPropagation()}>
                            <AssignBrandSelect
                              dealId={deal.id}
                              companies={assignableCompanies}
                              onAssigned={() => {}}
                            />
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}

              {tab === 'people' && !isUnassigned && (
                <div className="p-3 space-y-2.5">
                  {/* Add Person button / inline form */}
                  {!showAddPerson ? (
                    <button
                      onClick={() => setShowAddPerson(true)}
                      className="flex items-center gap-1.5 w-full px-3.5 py-2.5 text-xs font-medium text-primary hover:bg-primary/[.06] rounded-lg border border-dashed border-black/[.1] dark:border-white/[.1] transition-colors"
                    >
                      <Plus size={14} />
                      Add Person
                    </button>
                  ) : (
                    <div className="rounded-lg border border-black/[.06] dark:border-white/[.08] bg-white dark:bg-[#1e1e21] p-3.5 space-y-2.5">
                      <Input
                        autoFocus
                        type="text"
                        placeholder="Full name *"
                        value={personForm.name}
                        onChange={e => setPersonForm(f => ({ ...f, name: e.target.value }))}
                        className="text-ssm"
                      />
                      <Input
                        type="tel"
                        placeholder="Phone (optional)"
                        value={personForm.phone}
                        onChange={e => setPersonForm(f => ({ ...f, phone: e.target.value }))}
                        className="text-ssm"
                      />
                      <Input
                        type="email"
                        placeholder="Email (optional)"
                        value={personForm.email}
                        onChange={e => setPersonForm(f => ({ ...f, email: e.target.value }))}
                        className="text-ssm"
                      />
                      <Input
                        type="text"
                        placeholder="Notes / description (optional)"
                        value={personForm.title}
                        onChange={e => setPersonForm(f => ({ ...f, title: e.target.value }))}
                        className="text-ssm"
                      />
                      <Select
                        value={personForm.role || undefined}
                        onValueChange={v => setPersonForm(f => ({ ...f, role: v }))}
                      >
                        <SelectTrigger className="text-ssm">
                          <SelectValue placeholder="Role (optional)" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="poc" className="text-ssm">POC</SelectItem>
                          <SelectItem value="stakeholder" className="text-ssm">Stakeholder</SelectItem>
                          <SelectItem value="champion" className="text-ssm">Champion</SelectItem>
                          <SelectItem value="blocker" className="text-ssm">Blocker</SelectItem>
                          <SelectItem value="technical" className="text-ssm">Technical</SelectItem>
                          <SelectItem value="executive" className="text-ssm">Executive</SelectItem>
                        </SelectContent>
                      </Select>
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          onClick={() => {
                            if (!personForm.name.trim() || !brand?.id) return
                            createContact.mutate({
                              companyId: brand.id,
                              name: personForm.name.trim(),
                              phone: personForm.phone.trim() || null,
                              email: personForm.email.trim() || null,
                              title: [personForm.role, personForm.title.trim()].filter(Boolean).join(' — ') || null,
                            })
                          }}
                          disabled={!personForm.name.trim() || createContact.isPending}
                          className="flex items-center gap-1.5 h-8 px-3.5 text-xs font-semibold text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          style={{ background: 'linear-gradient(135deg, var(--primary), var(--color-primary-accent))' }}
                        >
                          <>{createContact.isPending && <span className="inline-block w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />}Add Person</>
                        </button>
                        <button
                          onClick={() => {
                            setShowAddPerson(false)
                            setPersonForm({ name: '', phone: '', email: '', title: '', role: '' })
                          }}
                          className="h-8 px-3.5 text-xs font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {people.length === 0 && !showAddPerson ? (
                    <div className="py-8 text-center text-ssm text-slate-400">
                      No contacts found for this brand
                    </div>
                  ) : (
                    people.map(person => {
                      const initials = getInitials(person.name)
                      const color = getBrandColor(person.name)
                      return (
                        <div
                          key={person.id}
                          className="rounded-lg border border-black/[.06] dark:border-white/[.08] bg-white dark:bg-[#1e1e21] p-4"
                        >
                          {/* Header: avatar + name + role + timestamp */}
                          <div className="flex items-center gap-3">
                            <div
                              className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                              style={{ background: color }}
                            >
                              {initials}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                                  {toPascalCase(person.name)}
                                </span>
                                {person.role && (
                                  <span className="text-atom font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-white/[.08] text-slate-500 dark:text-slate-400 whitespace-nowrap uppercase tracking-wide">
                                    {person.role}
                                  </span>
                                )}
                              </div>
                              <div className="text-xxs text-slate-400 mt-0.5">
                                {person.lastActivity
                                  ? (person.source === 'activity' ? 'Last met ' : 'Added ') + timeAgo(person.lastActivity)
                                  : 'Contact'}
                              </div>
                            </div>
                          </div>

                          {/* Contact info sections */}
                          {(person.email || person.phone) && (
                            <div className="mt-3 pt-3 border-t border-black/[.06] dark:border-white/[.06] space-y-3">
                              {person.email && (
                                <div>
                                  <div className="text-atom font-semibold text-slate-400 uppercase tracking-wide mb-1">Email</div>
                                  <div className="flex items-center justify-between">
                                    <span className="text-ssm text-slate-800 dark:text-white truncate">{person.email}</span>
                                    <CopyButton value={person.email} />
                                  </div>
                                </div>
                              )}
                              {person.phone && (
                                <div>
                                  <div className="text-atom font-semibold text-slate-400 uppercase tracking-wide mb-1">Phone</div>
                                  <div className="flex items-center justify-between">
                                    <span className="text-ssm text-slate-800 dark:text-white">{person.phone}</span>
                                    <CopyButton value={person.phone} />
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
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
