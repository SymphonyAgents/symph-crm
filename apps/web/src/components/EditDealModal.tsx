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
import { useUpdateDeal, useAssignDealBrand } from '@/lib/hooks/mutations'
import { useGetCompanies } from '@/lib/hooks/queries'
import { queryKeys } from '@/lib/query-keys'
import { useEscapeKey } from '@/lib/hooks/use-escape-key'
import {
  STAGE_OPTIONS, OUTREACH_OPTIONS, SERVICE_TYPES, SYSTEM_TYPES,
} from '@/lib/constants'
import { cn } from '@/lib/utils'
import type { ApiDealDetail } from '@/lib/types'

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
          className="h-9 text-ssm"
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

/** Flatten SERVICE_TYPES for display in grouped select */
function ServiceSelect({ value, onValueChange }: { value: string; onValueChange: (v: string) => void }) {
  return (
    <Select value={value || '__none__'} onValueChange={v => onValueChange(v === '__none__' ? '' : v)}>
      <SelectTrigger className="h-9 text-ssm">
        <SelectValue placeholder="Select service" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__none__" className="text-ssm text-slate-400">No service</SelectItem>
        {SERVICE_TYPES.map(svc => (
          svc.children ? (
            <div key={svc.value}>
              <div className="px-2 pt-2 pb-1 text-atom font-semibold text-slate-400 uppercase tracking-wider">
                {svc.label}
              </div>
              {svc.children.map(child => (
                <SelectItem key={child.value} value={child.value} className="text-ssm pl-5">
                  {child.label}
                </SelectItem>
              ))}
            </div>
          ) : (
            <SelectItem key={svc.value} value={svc.value} className="text-ssm">
              {svc.label}
            </SelectItem>
          )
        ))}
      </SelectContent>
    </Select>
  )
}

/** Format a number string with commas for display */
function formatValueDisplay(raw: string): string {
  const clean = raw.replace(/[^0-9.]/g, '')
  const parts = clean.split('.')
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return parts.join('.')
}

export function EditDealModal({ deal, onClose }: Props) {
  useEscapeKey(useCallback(onClose, [onClose]))

  const { data: companies = [] } = useGetCompanies()
  const qc = useQueryClient()

  // ── Form state, pre-populated from deal ──────────────────────────────────
  const [title, setTitle] = useState(deal.title)
  const [companyId, setCompanyId] = useState(deal.companyId ?? '')
  const [stage, setStage] = useState(deal.stage)
  const [value, setValue] = useState(deal.value ? formatValueDisplay(deal.value) : '')
  const [outreachCategory, setOutreachCategory] = useState(deal.outreachCategory ?? '')
  const [serviceType, setServiceType] = useState(
    (deal.servicesTags && deal.servicesTags.length > 0) ? deal.servicesTags[0] : ''
  )
  const [closeDate, setCloseDate] = useState(deal.closeDate ? deal.closeDate.slice(0, 10) : '')
  const [probability, setProbability] = useState(
    deal.probability != null ? String(deal.probability) : ''
  )

  const updateDeal = useUpdateDeal({
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.deals.all })
      qc.invalidateQueries({ queryKey: queryKeys.deals.detail(deal.id) })
      qc.invalidateQueries({ queryKey: queryKeys.pipeline.summary })
      onClose()
    },
  })

  const assignBrand = useAssignDealBrand({
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.deals.all })
      qc.invalidateQueries({ queryKey: queryKeys.deals.detail(deal.id) })
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return

    // Build the changed-fields-only payload
    const changes: Record<string, unknown> = {}

    if (title.trim() !== deal.title) changes.title = title.trim()
    if (stage !== deal.stage) changes.stage = stage

    const cleanValue = value.replace(/,/g, '').trim() || null
    if (cleanValue !== deal.value) changes.value = cleanValue

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

    // companyId is handled separately via useAssignDealBrand
    const newCompanyId = companyId || null
    const oldCompanyId = deal.companyId || null
    if (newCompanyId !== oldCompanyId) {
      assignBrand.mutate({ id: deal.id, companyId: newCompanyId })
    }

    // Only call updateDeal if there are non-brand changes
    if (Object.keys(changes).length > 0) {
      updateDeal.mutate({ id: deal.id, data: changes })
    } else if (newCompanyId === oldCompanyId) {
      // Nothing changed at all — just close
      onClose()
    } else {
      // Only brand changed — close after brand mutation fires
      onClose()
    }
  }

  const canSubmit = !!title.trim()
  const isPending = updateDeal.isPending || assignBrand.isPending
  const error = updateDeal.error || assignBrand.error

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-[2px] animate-in fade-in-0 duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-[#1e1e21] rounded-lg shadow-[0_8px_40px_rgba(0,0,0,0.18)] border border-slate-200 dark:border-white/[.08] w-full max-w-[460px] mx-4 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 fade-in-0 duration-200"
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
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[.06] dark:bg-white/[.06] transition-colors"
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
              placeholder="Search brands..."
            />
          </div>

          {/* Service Type */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xxs font-medium text-slate-500 uppercase tracking-[0.05em]">Service</label>
            <ServiceSelect value={serviceType} onValueChange={setServiceType} />
          </div>

          {/* Stage + Outreach */}
          <div className="grid grid-cols-2 gap-3">
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
                <SelectTrigger className="h-9 text-ssm">
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

          {/* Value + Probability */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xxs font-medium text-slate-500 uppercase tracking-[0.05em]">Value (PHP)</label>
              <Input
                value={value}
                onChange={e => setValue(formatValueDisplay(e.target.value))}
                placeholder="e.g. 250,000"
                className="h-9 text-ssm border border-slate-200 dark:border-white/[.1] bg-white dark:bg-[#2a2d31] text-slate-900 dark:text-white"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xxs font-medium text-slate-500 uppercase tracking-[0.05em]">Probability (%)</label>
              <Input
                type="number"
                min={0}
                max={100}
                value={probability}
                onChange={e => setProbability(e.target.value)}
                placeholder="e.g. 75"
                className="h-9 text-ssm border border-slate-200 dark:border-white/[.1] bg-white dark:bg-[#2a2d31] text-slate-900 dark:text-white"
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
              className="h-9 text-ssm border border-slate-200 dark:border-white/[.1] bg-white dark:bg-[#2a2d31] text-slate-900 dark:text-white"
            />
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
              className="flex-1 h-9 rounded-lg border border-black/[.08] dark:border-white/[.08] text-ssm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/[.04] dark:bg-white/[.03] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending || !canSubmit}
              className="flex-1 h-9 flex items-center justify-center gap-1.5 rounded-lg text-ssm font-medium text-white transition-colors disabled:opacity-50"
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
