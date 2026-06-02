'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Combobox } from '@/components/ui/combobox'
import { UserOption } from '@/components/UserOption'
import { useUpdateDeal, useAssignDealBrand, useCreateCompany } from '@/lib/hooks/mutations'
import { useGetCompanies, useGetUsers, useGetCatalogItems } from '@/lib/hooks/queries'
import { queryKeys } from '@/lib/query-keys'
import { useEscapeKey } from '@/lib/hooks/use-escape-key'
import {
  STAGE_OPTIONS, OUTREACH_OPTIONS, SYSTEM_TYPES,
} from '@/lib/constants'
import { cn } from '@/lib/utils'
import type { ApiDealDetail, ApiCatalogItem } from '@/lib/types'

type Props = {
  deal: ApiDealDetail
  onClose: () => void
}

// ─── Deal Name Input with system type autocomplete ──────────────────────────

function DealNameInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [focused, setFocused] = useState(false)

  const suggestions = useMemo(() => {
    if (!value || value.length < 1) return []
    const q = value.toUpperCase().trim()
    const words = q.split(/\s+/)
    const lastWord = words[words.length - 1]
    if (!lastWord || lastWord.length < 2) return []
    return SYSTEM_TYPES.filter(s =>
      s.acronym.startsWith(lastWord) || s.fullName.toUpperCase().includes(lastWord)
    ).slice(0, 6)
  }, [value])

  const showSuggestions = focused && suggestions.length > 0

  function applySuggestion(s: typeof SYSTEM_TYPES[number]) {
    const words = value.trim().split(/\s+/)
    const lastWord = words[words.length - 1]?.toUpperCase() ?? ''
    if (s.acronym.startsWith(lastWord)) {
      words[words.length - 1] = s.fullName
    } else {
      words.push(s.fullName)
    }
    onChange(words.join(' '))
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xxs font-medium text-slate-500 uppercase tracking-[0.05em]">
        Deal Name <span className="text-red-400">*</span>
      </label>
      <div className="relative">
        <Input
          autoFocus
          value={value}
          onChange={e => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          placeholder="e.g. Jollibee HRIS Implementation"
          className="h-11 sm:h-9 text-ssm"
          required
        />
        {showSuggestions && (
          <div className="absolute left-0 right-0 top-full mt-1 z-50 rounded-lg border border-black/[.08] dark:border-white/[.1] bg-white dark:bg-[#1e1e21] shadow-lg py-1 max-h-[200px] overflow-y-auto">
            {suggestions.map((s, i) => (
              <button
                key={`${s.acronym}-${s.category}-${i}`}
                type="button"
                onMouseDown={e => { e.preventDefault(); applySuggestion(s) }}
                className="w-full text-left px-3 py-1.5 text-xs hover:bg-slate-50 dark:hover:bg-white/[.06] transition-colors flex items-center gap-2"
              >
                <span className="font-semibold text-slate-900 dark:text-white">{s.acronym}</span>
                <span className="text-slate-400 truncate">{s.fullName}</span>
                <span className="ml-auto text-atom text-slate-300 dark:text-slate-600 shrink-0">{s.category}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/** DB-driven catalog grouped by product type. Value = row's slug. */
function ServiceSelect({ value, onValueChange }: { value: string; onValueChange: (v: string) => void }) {
  const { data: catalog = [] } = useGetCatalogItems(true)
  const groups = useMemo(() => {
    const sortByName = (a: ApiCatalogItem, b: ApiCatalogItem) => a.name.localeCompare(b.name)
    return {
      services: catalog.filter(c => c.productType === 'service').sort(sortByName),
      products: catalog.filter(c => c.productType === 'internal').sort(sortByName),
      resellers: catalog.filter(c => c.productType === 'reseller').sort(sortByName),
    }
  }, [catalog])
  return (
    <Select value={value || '__none__'} onValueChange={v => onValueChange(v === '__none__' ? '' : v)}>
      <SelectTrigger className="h-11 sm:h-9 text-ssm">
        <SelectValue placeholder="Select service" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__none__" className="text-ssm text-slate-400">No service</SelectItem>
        {groups.services.length > 0 && <>
          <div className="px-2 pt-2 pb-1 text-atom font-semibold text-slate-400 uppercase tracking-wider">Services</div>
          {groups.services.map(s => (
            <SelectItem key={s.id} value={s.slug ?? s.id} className="text-ssm">
              <CatalogRowLabel item={s} />
            </SelectItem>
          ))}
        </>}
        {groups.products.length > 0 && <>
          <div className="px-2 pt-2 pb-1 text-atom font-semibold text-slate-400 uppercase tracking-wider">Internal Products</div>
          {groups.products.map(p => (
            <SelectItem key={p.id} value={p.slug ?? p.id} className="text-ssm">
              <CatalogRowLabel item={p} />
            </SelectItem>
          ))}
        </>}
        {groups.resellers.length > 0 && <>
          <div className="px-2 pt-2 pb-1 text-atom font-semibold text-slate-400 uppercase tracking-wider">Resellers</div>
          {groups.resellers.map(r => (
            <SelectItem key={r.id} value={r.slug ?? r.id} className="text-ssm">
              <CatalogRowLabel item={r} />
            </SelectItem>
          ))}
        </>}
      </SelectContent>
    </Select>
  )
}

function CatalogRowLabel({ item }: { item: ApiCatalogItem }) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      {item.iconUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.iconUrl} alt="" width={16} height={16} className="rounded-sm object-contain shrink-0" style={{ width: 16, height: 16 }} />
      ) : (
        <span className="w-4 h-4 rounded-sm bg-slate-200 dark:bg-white/[.08] shrink-0" />
      )}
      <span className="truncate">{item.name}</span>
    </div>
  )
}

/** Format a number string with commas for display */
function formatValueDisplay(raw: string): string {
  const clean = raw.replace(/[^0-9.]/g, '')
  const parts = clean.split('.')
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return parts.join('.')
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const isUuid = (s: string) => UUID_RE.test(s)

export function EditDealModal({ deal, onClose }: Props) {
  useEscapeKey(useCallback(onClose, [onClose]))

  const { data: companies = [] } = useGetCompanies()
  const { data: allUsers = [] } = useGetUsers()
  const { data: catalogItems = [] } = useGetCatalogItems(true)
  const salesUsers = useMemo(() => allUsers.filter(u => u.role === 'SALES'), [allUsers])
  const qc = useQueryClient()

  // ── Form state, pre-populated from deal ──────────────────────────────────
  const [title, setTitle] = useState(deal.title)
  const [companyId, setCompanyId] = useState(deal.companyId ?? '')
  const [stage, setStage] = useState(deal.stage)
  const [value, setValue] = useState(deal.value ? formatValueDisplay(deal.value) : '')
  const [oneTimeFee, setOneTimeFee] = useState(deal.oneTimeFee ? formatValueDisplay(deal.oneTimeFee) : '')
  const [mrr, setMrr] = useState(deal.mrr ? formatValueDisplay(deal.mrr) : '')
  const [contractLength, setContractLength] = useState(deal.contractLength ? String(deal.contractLength) : '')
  // Reseller-specific fields
  const isReseller = deal.dealType === 'reseller'
  const [costPrice, setCostPrice] = useState(deal.costPrice ? String(deal.costPrice) : '')
  const [marginPercent, setMarginPercent] = useState(deal.marginPercent ? String(deal.marginPercent) : '')
  const [outreachCategory, setOutreachCategory] = useState(deal.outreachCategory ?? '')
  const [serviceType, setServiceType] = useState(
    (deal.servicesTags && deal.servicesTags.length > 0) ? deal.servicesTags[0] : ''
  )
  const [closeDate, setCloseDate] = useState(deal.closeDate ? deal.closeDate.slice(0, 10) : '')
  const [probability, setProbability] = useState(
    deal.probability != null ? String(deal.probability) : ''
  )
  const [subAccountManagerId, setSubAccountManagerId] = useState(deal.subAccountManagerId ?? '')
  const [builders, setBuilders] = useState<string[]>(deal.builders ?? [])
  const [catalogItemId, setCatalogItemId] = useState(deal.catalogItemId ?? '')

  const updateDeal = useUpdateDeal({
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.deals.all })
      qc.invalidateQueries({ queryKey: queryKeys.deals.detail(deal.id) })
      qc.invalidateQueries({ queryKey: queryKeys.pipeline.summary })
      onClose()
    },
  })

  const createCompany = useCreateCompany()

  const assignBrand = useAssignDealBrand({
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.deals.all })
      qc.invalidateQueries({ queryKey: queryKeys.deals.detail(deal.id) })
      qc.invalidateQueries({ queryKey: queryKeys.pipeline.summary })
      onClose()
    },
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return

    // Build the changed-fields-only payload
    const changes: Record<string, unknown> = {}

    if (title.trim() !== deal.title) changes.title = title.trim()
    if (stage !== deal.stage) changes.stage = stage

    const cleanValue = value.replace(/,/g, '').trim() || null
    if (cleanValue !== deal.value) changes.value = cleanValue

    const cleanOneTimeFee = oneTimeFee.replace(/,/g, '').trim() || null
    if (cleanOneTimeFee !== (deal.oneTimeFee ?? null)) changes.oneTimeFee = cleanOneTimeFee

    const cleanMrr = mrr.replace(/,/g, '').trim() || null
    if (cleanMrr !== (deal.mrr ?? null)) changes.mrr = cleanMrr

    // Reseller revenue fields
    const cleanCostPrice = costPrice.replace(/,/g, '').trim() || null
    if (cleanCostPrice !== (deal.costPrice ?? null)) changes.costPrice = cleanCostPrice
    const cleanMarginPercent = marginPercent.trim() || null
    if (cleanMarginPercent !== (deal.marginPercent ?? null)) changes.marginPercent = cleanMarginPercent

    const cleanContractLength = contractLength ? parseInt(contractLength, 10) || null : null
    if (cleanContractLength !== (deal.contractLength ?? null)) changes.contractLength = cleanContractLength

    if ((outreachCategory || null) !== (deal.outreachCategory || null)) {
      changes.outreachCategory = outreachCategory || null
    }

    const newTags = serviceType ? [serviceType] : []
    const oldTags = deal.servicesTags ?? []
    if (JSON.stringify(newTags) !== JSON.stringify(oldTags)) {
      changes.servicesTags = newTags
    }

    const newCloseDate = closeDate || null
    const oldCloseDate = deal.closeDate ? deal.closeDate.slice(0, 10) : null
    if (newCloseDate !== oldCloseDate) changes.closeDate = newCloseDate

    const newProb = probability ? Number(probability) : null
    if (newProb !== deal.probability) changes.probability = newProb

    const newSubAm = subAccountManagerId || null
    if (newSubAm !== (deal.subAccountManagerId ?? null)) changes.subAccountManagerId = newSubAm

    const oldBuilders = deal.builders ?? []
    if (JSON.stringify(builders) !== JSON.stringify(oldBuilders)) {
      changes.builders = builders
    }

    const newCatalogItemId = serviceType === 'internal_products' ? (catalogItemId || null) : null
    if (newCatalogItemId !== (deal.catalogItemId ?? null)) {
      changes.catalogItemId = newCatalogItemId
    }

    // companyId is handled separately via useAssignDealBrand.
    // If user typed a free-text name (not a UUID), create the company first.
    const rawCompanyId = companyId || null
    const oldCompanyId = deal.companyId || null

    let resolvedCompanyId = rawCompanyId
    if (rawCompanyId && !isUuid(rawCompanyId)) {
      try {
        const created = await createCompany.mutateAsync({ name: rawCompanyId })
        resolvedCompanyId = created.id
        qc.invalidateQueries({ queryKey: queryKeys.companies.all })
      } catch {
        // createCompany error is already toasted by withToast — stop submit
        return
      }
    }

    if (resolvedCompanyId !== oldCompanyId) {
      assignBrand.mutate({ id: deal.id, companyId: resolvedCompanyId })
    }

    // Only call updateDeal if there are non-brand changes
    if (Object.keys(changes).length > 0) {
      updateDeal.mutate({ id: deal.id, data: changes })
    } else if (resolvedCompanyId === oldCompanyId) {
      // Nothing changed at all — just close
      onClose()
    }
    // else: brand-only change — assignBrand is in-flight; its onSuccess handles onClose
  }

  const canSubmit = !!title.trim()
  const isPending = updateDeal.isPending || assignBrand.isPending || createCompany.isPending
  const error = updateDeal.error || assignBrand.error

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/45 animate-in fade-in-0 duration-150 ease-out"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-[#1e1e21] rounded-lg shadow-lg border border-slate-200 dark:border-white/[.08] w-full max-w-[460px] mx-4 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 fade-in-0 duration-150 ease-out"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-black/[.06] dark:border-white/[.08] flex items-center justify-between sticky top-0 bg-white dark:bg-[#1e1e21] z-10">
          <div>
            <div className="text-sm font-semibold text-slate-900 dark:text-white">Edit Deal</div>
            <div className="text-xs text-slate-400 mt-0.5">Update deal details</div>
          </div>
          <button
            onClick={onClose}
            className="w-11 h-11 sm:w-7 sm:h-7 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[.06] dark:bg-white/[.06] transition-colors"
          >
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-4">
          {/* Title with system type suggestions */}
          <DealNameInput value={title} onChange={setTitle} />

          {/* Brand / Company */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xxs font-medium text-slate-500 uppercase tracking-[0.05em]">
              Brand <span className="text-slate-400">(optional)</span>
            </label>
            <Combobox
              options={[
                { value: '', label: 'No brand' },
                ...companies.map(c => ({ value: c.id, label: c.name })),
              ]}
              value={companyId}
              onValueChange={setCompanyId}
              placeholder="Search or type new brand..."
              allowCustom
            />
          </div>

          {/* Service Type */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xxs font-medium text-slate-500 uppercase tracking-[0.05em]">Service</label>
            <ServiceSelect value={serviceType} onValueChange={setServiceType} />
          </div>

          {/* Internal Product — only when service is "internal_products" */}
          {serviceType === 'internal_products' && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xxs font-medium text-slate-500 uppercase tracking-[0.05em]">Internal Product</label>
              <Select
                value={catalogItemId || '__none__'}
                onValueChange={v => setCatalogItemId(v === '__none__' ? '' : v)}
              >
                <SelectTrigger className="h-11 sm:h-9 text-ssm">
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent className="max-h-[280px]">
                  <SelectItem value="__none__" className="text-ssm text-slate-400">—</SelectItem>
                  {catalogItems.map(p => (
                    <SelectItem key={p.id} value={p.id} className="text-ssm">{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Stage + Outreach */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xxs font-medium text-slate-500 uppercase tracking-[0.05em]">Stage</label>
              <Combobox
                options={STAGE_OPTIONS}
                value={stage}
                onValueChange={setStage}
                placeholder="Select stage..."
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xxs font-medium text-slate-500 uppercase tracking-[0.05em]">Outreach</label>
              <Select value={outreachCategory || '__none__'} onValueChange={v => setOutreachCategory(v === '__none__' ? '' : v)}>
                <SelectTrigger className="h-11 sm:h-9 text-ssm">
                  <SelectValue placeholder="---" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__" className="text-ssm text-slate-400">---</SelectItem>
                  {OUTREACH_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value} className="text-ssm">{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Revenue fields, all deal types */}
          <div className="flex flex-col gap-3 rounded-xl border border-slate-200 dark:border-white/[.08] p-3 bg-slate-50/50 dark:bg-white/[.02]">
            <div className="text-xxs font-semibold text-slate-400 uppercase tracking-wider">Revenue</div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xxs font-medium text-slate-500 uppercase tracking-[0.05em]">One-Time Fee (PHP)</label>
                <Input
                  value={oneTimeFee}
                  onChange={e => setOneTimeFee(formatValueDisplay(e.target.value))}
                  placeholder="e.g. 1,214,000"
                  className="h-11 sm:h-9 text-ssm border border-slate-200 dark:border-white/[.1] bg-white dark:bg-[#2a2d31] text-slate-900 dark:text-white"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xxs font-medium text-slate-500 uppercase tracking-[0.05em]">
                  MRR (PHP) <span className="text-slate-400 normal-case font-normal">monthly</span>
                </label>
                <Input
                  value={mrr}
                  onChange={e => setMrr(formatValueDisplay(e.target.value))}
                  placeholder="e.g. 50,000"
                  className="h-11 sm:h-9 text-ssm border border-slate-200 dark:border-white/[.1] bg-white dark:bg-[#2a2d31] text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xxs font-medium text-slate-500 uppercase tracking-[0.05em]">
                  Contract Length <span className="text-slate-400 normal-case font-normal">months</span>
                </label>
                <Input
                  type="number"
                  min={1}
                  max={120}
                  value={contractLength}
                  onChange={e => setContractLength(e.target.value)}
                  placeholder="e.g. 12"
                  className="h-11 sm:h-9 text-ssm border border-slate-200 dark:border-white/[.1] bg-white dark:bg-[#2a2d31] text-slate-900 dark:text-white"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xxs font-medium text-slate-500 uppercase tracking-[0.05em]">
                  Total Value <span className="text-slate-400 normal-case font-normal">computed</span>
                </label>
                <div className="h-11 sm:h-9 flex items-center px-3 rounded-lg border border-slate-200 dark:border-white/[.06] bg-slate-100 dark:bg-white/[.04] text-ssm tabular-nums text-slate-600 dark:text-slate-400">
                  {(() => {
                    const otf = parseFloat(oneTimeFee.replace(/,/g, '')) || 0
                    const mrrVal = parseFloat(mrr.replace(/,/g, '')) || 0
                    const len = parseInt(contractLength, 10) || 1
                    const computed = otf + mrrVal * len
                    if (computed === 0) return <span className="text-slate-400">auto</span>
                    return `₱${computed.toLocaleString('en-PH')}`
                  })()}
                </div>
              </div>
            </div>
          </div>

          {/* Reseller revenue fields — only shown for reseller deals */}
          {isReseller && (
            <div className="flex flex-col gap-3 rounded-xl border border-blue-200 dark:border-blue-800/40 p-3 bg-blue-50/40 dark:bg-blue-950/20">
              <div className="text-xxs font-semibold text-blue-500 uppercase tracking-wider">Reseller Pricing</div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xxs font-medium text-slate-500 uppercase tracking-[0.05em]">Cost Price (PHP)</label>
                  <Input
                    value={costPrice}
                    onChange={e => setCostPrice(e.target.value)}
                    placeholder="e.g. 500,000"
                    className="h-11 sm:h-9 text-ssm border border-slate-200 dark:border-white/[.1] bg-white dark:bg-[#2a2d31] text-slate-900 dark:text-white"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xxs font-medium text-slate-500 uppercase tracking-[0.05em]">
                    Gross Margin <span className="text-slate-400 normal-case font-normal">%</span>
                  </label>
                  <Input
                    type="number"
                    min={0}
                    max={99}
                    step={0.1}
                    value={marginPercent}
                    onChange={e => setMarginPercent(e.target.value)}
                    placeholder="e.g. 15"
                    className="h-11 sm:h-9 text-ssm border border-slate-200 dark:border-white/[.1] bg-white dark:bg-[#2a2d31] text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Computed billing price preview */}
              {(() => {
                const cost = parseFloat(costPrice.replace(/,/g, '')) || 0
                const margin = parseFloat(marginPercent) || 0
                if (cost <= 0) return null
                const billing = margin > 0 && margin < 100 ? cost / (1 - margin / 100) : cost
                const profit = billing - cost
                return (
                  <div className="flex items-center justify-between text-xs pt-1 border-t border-blue-200 dark:border-blue-800/30">
                    <div>
                      <span className="text-slate-500">Billing price</span>
                      <span className="ml-2 font-bold text-slate-900 dark:text-white">
                        ₱{billing.toLocaleString('en-PH', { maximumFractionDigits: 0 })}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500">Gross profit</span>
                      <span className="ml-2 font-semibold text-emerald-600 dark:text-emerald-400">
                        ₱{profit.toLocaleString('en-PH', { maximumFractionDigits: 0 })}
                      </span>
                    </div>
                  </div>
                )
              })()}
            </div>
          )}

          {/* Probability */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xxs font-medium text-slate-500 uppercase tracking-[0.05em]">Probability (%)</label>
              <Input
                type="number"
                min={0}
                max={100}
                value={probability}
                onChange={e => setProbability(e.target.value)}
                placeholder="e.g. 75"
                className="h-11 sm:h-9 text-ssm border border-slate-200 dark:border-white/[.1] bg-white dark:bg-[#2a2d31] text-slate-900 dark:text-white"
              />
            </div>
          </div>

          {/* Close Date */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xxs font-medium text-slate-500 uppercase tracking-[0.05em]">
              Expected Close Date <span className="text-slate-400">(optional)</span>
            </label>
            <Input
              type="date"
              value={closeDate}
              onChange={e => setCloseDate(e.target.value)}
              className="h-11 sm:h-9 text-ssm border border-slate-200 dark:border-white/[.1] bg-white dark:bg-[#2a2d31] text-slate-900 dark:text-white"
            />
          </div>

          {/* Sub Account Manager */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xxs font-medium text-slate-500 uppercase tracking-[0.05em]">
              Sub Account Manager <span className="text-slate-400">(optional)</span>
            </label>
            <Select value={subAccountManagerId || '__none__'} onValueChange={v => setSubAccountManagerId(v === '__none__' ? '' : v)}>
              <SelectTrigger className="h-11 sm:h-9 text-ssm">
                <SelectValue placeholder="Unassigned" />
              </SelectTrigger>
              <SelectContent className="max-h-[280px]">
                <SelectItem value="__none__" className="text-ssm text-slate-400">Unassigned</SelectItem>
                {salesUsers.map(u => (
                  <SelectItem key={u.id} value={u.id} className="text-ssm">
                    <UserOption user={u} />
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Builders */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xxs font-medium text-slate-500 uppercase tracking-[0.05em]">
              Builders <span className="text-slate-400">(optional)</span>
            </label>
            <div className="flex flex-wrap gap-1.5 mb-1.5">
              {builders.length === 0 ? (
                <span className="text-xxs text-slate-400 px-1">No builders assigned</span>
              ) : (
                builders.map(uid => {
                  const u = allUsers.find(x => x.id === uid)
                  return (
                    <span key={uid} className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded text-xxs font-medium bg-slate-100 dark:bg-white/[.06] text-slate-700 dark:text-slate-200">
                      {u?.name || u?.email || uid}
                      <button
                        type="button"
                        onClick={() => setBuilders(builders.filter(b => b !== uid))}
                        className="ml-0.5 rounded hover:bg-slate-200 dark:hover:bg-white/[.08] p-0.5"
                      >
                        <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                      </button>
                    </span>
                  )
                })
              )}
            </div>
            <Select value="" onValueChange={(uid) => { if (uid && !builders.includes(uid)) setBuilders([...builders, uid]) }}>
              <SelectTrigger className="h-11 sm:h-9 text-ssm">
                <SelectValue placeholder="Add builder..." />
              </SelectTrigger>
              <SelectContent className="max-h-[280px]">
                {allUsers.filter(u => !builders.includes(u.id)).map(u => (
                  <SelectItem key={u.id} value={u.id} className="text-ssm">
                    <UserOption user={u} />
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {error && (
            <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {error.message}
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-11 sm:h-9 rounded-lg border border-black/[.08] dark:border-white/[.08] text-ssm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/[.04] dark:bg-white/[.03] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending || !canSubmit}
              className="flex-1 h-11 sm:h-9 flex items-center justify-center gap-1.5 rounded-lg text-ssm font-medium text-white transition-colors disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, var(--primary), var(--color-primary-accent))' }}
            >
              <>{isPending && <span className="inline-block w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />}Save Changes</>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
