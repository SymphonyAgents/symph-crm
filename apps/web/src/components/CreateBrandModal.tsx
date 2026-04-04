'use client'

import { useState, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Input } from '@/components/ui/input'
import { Combobox } from '@/components/ui/combobox'
import { useCreateCompany } from '@/lib/hooks/mutations'
import { queryKeys } from '@/lib/query-keys'
import { useEscapeKey } from '@/lib/hooks/use-escape-key'
import { INDUSTRY_OPTIONS } from '@/lib/constants'

type Props = {
  onClose: () => void
  onCreated: () => void
}

export function CreateBrandModal({ onClose, onCreated }: Props) {
  useEscapeKey(useCallback(onClose, [onClose]))

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
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-[2px] animate-in fade-in-0 duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-[#1e1e21] rounded-lg shadow-[0_8px_40px_rgba(0,0,0,0.18)] border border-black/[.06] dark:border-white/[.08] w-full max-w-[400px] mx-4 animate-in zoom-in-95 fade-in-0 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-black/[.06] dark:border-white/[.08] flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-slate-900 dark:text-white">New Brand</div>
            <div className="text-xs text-slate-400 mt-0.5">Add a client brand to group deals under</div>
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
          <div className="flex flex-col gap-1.5">
            <label className="text-xxs font-medium text-slate-500 uppercase tracking-[0.05em]">
              Brand Name <span className="text-red-400">*</span>
            </label>
            <Input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Jollibee, BPI, SM Group"
              className="h-9 text-ssm"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xxs font-medium text-slate-500 uppercase tracking-[0.05em]">Industry</label>
              <Combobox
                options={INDUSTRY_OPTIONS.map(i => ({ value: i, label: i }))}
                value={industry}
                onValueChange={setIndustry}
                placeholder="Search industry..."
                allowCustom
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xxs font-medium text-slate-500 uppercase tracking-[0.05em]">Domain</label>
              <Input
                value={domain}
                onChange={e => setDomain(e.target.value)}
                placeholder="e.g. jollibee.com.ph"
                className="h-9 text-ssm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xxs font-medium text-slate-500 uppercase tracking-[0.05em]">Website</label>
              <Input
                value={website}
                onChange={e => setWebsite(e.target.value)}
                placeholder="https://..."
                className="h-9 text-ssm"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xxs font-medium text-slate-500 uppercase tracking-[0.05em]">HQ Location</label>
              <Input
                value={hqLocation}
                onChange={e => setHqLocation(e.target.value)}
                placeholder="e.g. Manila, PH"
                className="h-9 text-ssm"
              />
            </div>
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
              disabled={isPending || !name.trim()}
              className="flex-1 h-9 flex items-center justify-center gap-1.5 rounded-lg text-ssm font-medium text-white transition-colors disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, var(--primary), var(--color-primary-accent))' }}
            >
              <>{isPending && <span className="inline-block w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />}Create Brand</>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
