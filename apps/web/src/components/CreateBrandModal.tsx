'use client'

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Input } from '@/components/ui/input'
import { useCreateCompany } from '@/lib/hooks/mutations'
import { queryKeys } from '@/lib/query-keys'

type Props = {
  onClose: () => void
  onCreated: () => void
}

export function CreateBrandModal({ onClose, onCreated }: Props) {
  const [name, setName] = useState('')
  const [industry, setIndustry] = useState('')
  const [website, setWebsite] = useState('')
  const [hqLocation, setHqLocation] = useState('')
  const [domain, setDomain] = useState('')

  const qc = useQueryClient()

  const { mutate, isPending, error } = useCreateCompany({
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.companies.all })
      onCreated()
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    mutate({
      name: name.trim(),
      industry: industry.trim() || null,
      website: website.trim() || null,
      hqLocation: hqLocation.trim() || null,
      domain: domain.trim() || null,
    })
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center"
      style={{ backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', backgroundColor: 'rgba(255,255,255,0.5)' }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.12)] border border-black/[.06] w-full max-w-[400px] mx-4"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-black/[.06] flex items-center justify-between">
          <div>
            <div className="text-[14px] font-semibold text-slate-900">New Brand</div>
            <div className="text-[11.5px] text-slate-400 mt-0.5">Add a client brand to group deals under</div>
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
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-medium text-slate-500 uppercase tracking-[0.05em]">
              Brand Name <span className="text-red-400">*</span>
            </label>
            <Input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Jollibee, BPI, SM Group"
              className="h-9 text-[13px]"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-medium text-slate-500 uppercase tracking-[0.05em]">Industry</label>
              <Input
                value={industry}
                onChange={e => setIndustry(e.target.value)}
                placeholder="e.g. F&B, Fintech"
                className="h-9 text-[13px]"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-medium text-slate-500 uppercase tracking-[0.05em]">Domain</label>
              <Input
                value={domain}
                onChange={e => setDomain(e.target.value)}
                placeholder="e.g. jollibee.com.ph"
                className="h-9 text-[13px]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-medium text-slate-500 uppercase tracking-[0.05em]">Website</label>
              <Input
                value={website}
                onChange={e => setWebsite(e.target.value)}
                placeholder="https://..."
                className="h-9 text-[13px]"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-medium text-slate-500 uppercase tracking-[0.05em]">HQ Location</label>
              <Input
                value={hqLocation}
                onChange={e => setHqLocation(e.target.value)}
                placeholder="e.g. Manila, PH"
                className="h-9 text-[13px]"
              />
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
              className="flex-1 h-9 rounded-lg border border-black/[.08] text-[13px] font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending || !name.trim()}
              className="flex-1 h-9 rounded-lg text-[13px] font-medium text-white transition-colors disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, var(--primary), var(--color-primary-accent))' }}
            >
              {isPending ? 'Creating…' : 'Create Brand'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
