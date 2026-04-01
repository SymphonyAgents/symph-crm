'use client'

import { useState, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
// Product/Tier inputs removed per Vins — not needed in create flow
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Combobox } from '@/components/ui/combobox'
import { useCreateDeal } from '@/lib/hooks/mutations'
import { useUser } from '@/lib/hooks/use-user'
import { queryKeys } from '@/lib/query-keys'
import { useEscapeKey } from '@/lib/hooks/use-escape-key'
import {
  STAGE_OPTIONS, OUTREACH_OPTIONS, PRICING_OPTIONS, SERVICE_TYPES,
} from '@/lib/constants'
import type { ApiCompanyDetail } from '@/lib/types'

type Props = {
  companies: ApiCompanyDetail[]
  onClose: () => void
  onCreated: () => void
}

/** Flatten SERVICE_TYPES for display in grouped select */
function ServiceSelect({ value, onValueChange }: { value: string; onValueChange: (v: string) => void }) {
  return (
    <Select value={value || '__none__'} onValueChange={v => onValueChange(v === '__none__' ? '' : v)}>
      <SelectTrigger className="h-9 text-[13px]">
        <SelectValue placeholder="Select service" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__none__" className="text-[13px] text-slate-400">No service</SelectItem>
        {SERVICE_TYPES.map(svc => (
          svc.children ? (
            <div key={svc.value}>
              {/* Parent label */}
              <div className="px-2 pt-2 pb-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                {svc.label}
              </div>
              {svc.children.map(child => (
                <SelectItem key={child.value} value={child.value} className="text-[13px] pl-5">
                  {child.label}
                </SelectItem>
              ))}
            </div>
          ) : (
            <SelectItem key={svc.value} value={svc.value} className="text-[13px]">
              {svc.label}
            </SelectItem>
          )
        ))}
      </SelectContent>
    </Select>
  )
}

export function CreateDealModal({ companies, onClose, onCreated }: Props) {
  useEscapeKey(useCallback(onClose, [onClose]))

  const [title, setTitle] = useState('')
  const [companyId, setCompanyId] = useState('')
  const [stage, setStage] = useState('lead')
  const [value, setValue] = useState('')
  const [outreachCategory, setOutreachCategory] = useState('')
  const [pricingModel, setPricingModel] = useState('')
  const [serviceType, setServiceType] = useState('')
  const qc = useQueryClient()
  const { userId } = useUser()

  const { mutate, isPending, error } = useCreateDeal({
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.deals.all })
      if (companyId) qc.invalidateQueries({ queryKey: queryKeys.companies.deals(companyId) })
      onCreated()
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return

    // Build tags from the selected service type
    const tags = serviceType ? [serviceType] : []

    mutate({
      title: title.trim(),
      companyId: companyId || null,
      productId: null,
      tierId: null,
      stage,
      value: value.replace(/,/g, '').trim() || null,
      outreachCategory: outreachCategory || null,
      pricingModel: pricingModel || null,
      servicesTags: tags,
      createdBy: userId,
      assignedTo: userId,
    })
  }

  // Product + tier are now optional — only title is required
  const canSubmit = !!title.trim()

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-[#1e1e21] rounded-lg shadow-[0_8px_40px_rgba(0,0,0,0.18)] border border-black/[.06] dark:border-white/[.08] w-full max-w-[460px] mx-4 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-black/[.06] dark:border-white/[.08] flex items-center justify-between sticky top-0 bg-white dark:bg-[#1e1e21] z-10">
          <div>
            <div className="text-[14px] font-semibold text-slate-900 dark:text-white">New Deal</div>
            <div className="text-[11.5px] text-slate-400 mt-0.5">Add a deal to your pipeline</div>
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
        <form onSubmit={handleSubmit} className="px-6 py-5 flex flex-col gap-4">
          {/* Title */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-medium text-slate-500 uppercase tracking-[0.05em]">
              Deal Name <span className="text-red-400">*</span>
            </label>
            <Input
              autoFocus
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Jollibee HRIS Implementation"
              className="h-9 text-[13px]"
              required
            />
          </div>

          {/* Brand / Company — use combobox since companies list can grow large */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-medium text-slate-500 uppercase tracking-[0.05em]">
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
            <label className="text-[11px] font-medium text-slate-500 uppercase tracking-[0.05em]">Service</label>
            <ServiceSelect value={serviceType} onValueChange={setServiceType} />
          </div>

          {/* Stage + Outreach */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-medium text-slate-500 uppercase tracking-[0.05em]">Stage</label>
              <Combobox
                options={STAGE_OPTIONS}
                value={stage}
                onValueChange={setStage}
                placeholder="Select stage..."
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-medium text-slate-500 uppercase tracking-[0.05em]">Outreach</label>
              <Select value={outreachCategory} onValueChange={setOutreachCategory}>
                <SelectTrigger className="h-9 text-[13px]">
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  {OUTREACH_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value} className="text-[13px]">{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Value + Pricing Model */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-medium text-slate-500 uppercase tracking-[0.05em]">Value (₱)</label>
              <Input
                value={value}
                onChange={e => {
                  const raw = e.target.value.replace(/[^0-9.]/g, '')
                  // Format with commas for display, strip on submit
                  const parts = raw.split('.')
                  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',')
                  setValue(parts.join('.'))
                }}
                placeholder="e.g. 250,000"
                className="h-9 text-[13px]"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-medium text-slate-500 uppercase tracking-[0.05em]">Pricing Model</label>
              <Select value={pricingModel} onValueChange={setPricingModel}>
                <SelectTrigger className="h-9 text-[13px]">
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  {PRICING_OPTIONS.map(p => (
                    <SelectItem key={p.value} value={p.value} className="text-[13px]">{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>


          {error && (
            <p className="text-[12px] text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {error.message}
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-9 rounded-lg border border-black/[.08] dark:border-white/[.08] text-[13px] font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/[.04] dark:bg-white/[.03] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending || !canSubmit}
              className="flex-1 h-9 rounded-lg text-[13px] font-medium text-white transition-colors disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, var(--primary), var(--color-primary-accent))' }}
            >
              {isPending ? 'Creating…' : 'Create Deal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
