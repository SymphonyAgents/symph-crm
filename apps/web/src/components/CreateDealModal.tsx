'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useCreateDeal } from '@/lib/hooks/mutations'
import { queryKeys } from '@/lib/query-keys'
import type { ApiCompany } from './Deals'

type ApiProduct = { id: string; name: string; slug: string }
type ApiTier = { id: string; name: string; slug: string }

const STAGE_OPTIONS = [
  { value: 'lead',          label: 'Lead' },
  { value: 'discovery',     label: 'Discovery' },
  { value: 'assessment',    label: 'Assessment' },
  { value: 'qualified',     label: 'Qualified' },
  { value: 'demo',          label: 'Demo' },
  { value: 'proposal',      label: 'Proposal' },
  { value: 'proposal_demo', label: 'Demo + Proposal' },
  { value: 'negotiation',   label: 'Negotiation' },
  { value: 'followup',      label: 'Follow-up' },
  { value: 'closed_won',    label: 'Won' },
  { value: 'closed_lost',   label: 'Lost' },
]

const OUTREACH_OPTIONS = [
  { value: 'inbound',  label: 'Inbound' },
  { value: 'outbound', label: 'Outbound' },
]

const PRICING_OPTIONS = [
  { value: 'fixed',   label: 'Fixed' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'annual',  label: 'Annual' },
]

type Props = {
  companies: ApiCompany[]
  onClose: () => void
  onCreated: () => void
}

export function CreateDealModal({ companies, onClose, onCreated }: Props) {
  const [title, setTitle] = useState('')
  const [companyId, setCompanyId] = useState('')
  const [stage, setStage] = useState('lead')
  const [value, setValue] = useState('')
  const [outreachCategory, setOutreachCategory] = useState('')
  const [pricingModel, setPricingModel] = useState('')
  const [servicesTags, setServicesTags] = useState('')
  const [productId, setProductId] = useState('')
  const [tierId, setTierId] = useState('')

  const qc = useQueryClient()

  const { data: products = [] } = useQuery<ApiProduct[]>({
    queryKey: queryKeys.products.all,
    queryFn: async () => {
      const res = await fetch('/api/products')
      if (!res.ok) throw new Error('Failed to fetch products')
      return res.json()
    },
    staleTime: Infinity, // products/tiers are reference data — never stale
  })

  const { data: tiers = [] } = useQuery<ApiTier[]>({
    queryKey: queryKeys.tiers.all,
    queryFn: async () => {
      const res = await fetch('/api/tiers')
      if (!res.ok) throw new Error('Failed to fetch tiers')
      return res.json()
    },
    staleTime: Infinity,
  })

  // Auto-select first product/tier when there's only one (standard for now)
  const effectiveProductId = productId || (products.length === 1 ? products[0].id : '')
  const effectiveTierId = tierId || (tiers.length === 1 ? tiers[0].id : '')

  const { mutate, isPending, error } = useCreateDeal({
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.deals.all })
      // Also invalidate company-specific deals if we ever have that query
      if (companyId) qc.invalidateQueries({ queryKey: queryKeys.companies.deals(companyId) })
      onCreated()
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !companyId || !effectiveProductId || !effectiveTierId) return

    const tags = servicesTags.split(',').map(s => s.trim()).filter(Boolean)

    mutate({
      title: title.trim(),
      companyId,
      productId: effectiveProductId,
      tierId: effectiveTierId,
      stage,
      value: value.trim() || null,
      outreachCategory: outreachCategory || null,
      pricingModel: pricingModel || null,
      servicesTags: tags,
    })
  }

  const canSubmit = title.trim() && companyId && effectiveProductId && effectiveTierId

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', backgroundColor: 'rgba(255,255,255,0.5)' }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.12)] border border-black/[.06] w-full max-w-[460px] mx-4 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-black/[.06] flex items-center justify-between sticky top-0 bg-white z-10">
          <div>
            <div className="text-[14px] font-semibold text-slate-900">New Deal</div>
            <div className="text-[11.5px] text-slate-400 mt-0.5">Add a deal to your pipeline</div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 transition-colors"
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

          {/* Brand / Company */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-medium text-slate-500 uppercase tracking-[0.05em]">
              Brand <span className="text-red-400">*</span>
            </label>
            {companies.length === 0 ? (
              <div className="h-9 flex items-center px-3 rounded-lg border border-black/[.08] text-[12px] text-slate-400">
                No brands yet — create a brand first
              </div>
            ) : (
              <Select value={companyId} onValueChange={setCompanyId}>
                <SelectTrigger className="h-9 text-[13px]">
                  <SelectValue placeholder="Select brand…" />
                </SelectTrigger>
                <SelectContent>
                  {companies.map(c => (
                    <SelectItem key={c.id} value={c.id} className="text-[13px]">
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Stage + Outreach */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-medium text-slate-500 uppercase tracking-[0.05em]">Stage</label>
              <Select value={stage} onValueChange={setStage}>
                <SelectTrigger className="h-9 text-[13px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STAGE_OPTIONS.map(s => (
                    <SelectItem key={s.value} value={s.value} className="text-[13px]">{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                onChange={e => setValue(e.target.value.replace(/[^0-9.]/g, ''))}
                placeholder="e.g. 250000"
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

          {/* Services Tags */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-medium text-slate-500 uppercase tracking-[0.05em]">
              Services <span className="text-slate-300 normal-case font-normal">(comma-separated)</span>
            </label>
            <Input
              value={servicesTags}
              onChange={e => setServicesTags(e.target.value)}
              placeholder="e.g. AI Agents, Web Dev, Design"
              className="h-9 text-[13px]"
            />
          </div>

          {/* Product + Tier (only shown when more than one option) */}
          {(products.length > 1 || tiers.length > 1) && (
            <div className="grid grid-cols-2 gap-3">
              {products.length > 1 && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-medium text-slate-500 uppercase tracking-[0.05em]">Product <span className="text-red-400">*</span></label>
                  <Select value={productId} onValueChange={setProductId}>
                    <SelectTrigger className="h-9 text-[13px]">
                      <SelectValue placeholder="Select…" />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map(p => (
                        <SelectItem key={p.id} value={p.id} className="text-[13px]">{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {tiers.length > 1 && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-medium text-slate-500 uppercase tracking-[0.05em]">Tier <span className="text-red-400">*</span></label>
                  <Select value={tierId} onValueChange={setTierId}>
                    <SelectTrigger className="h-9 text-[13px]">
                      <SelectValue placeholder="Select…" />
                    </SelectTrigger>
                    <SelectContent>
                      {tiers.map(t => (
                        <SelectItem key={t.id} value={t.id} className="text-[13px]">{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}

          {error && (
            <p className="text-[12px] text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {error.message}
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-9 rounded-lg border border-black/[.08] text-[13px] font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending || !canSubmit}
              className="flex-1 h-9 rounded-lg text-[13px] font-medium text-white transition-colors disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #6c63ff, #a78bfa)' }}
            >
              {isPending ? 'Creating…' : 'Create Deal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
