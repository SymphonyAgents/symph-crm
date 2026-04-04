'use client'

import { useState, useCallback, useRef, useMemo } from 'react'
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
import { useCreateDeal, useUploadDocumentFile } from '@/lib/hooks/mutations'
import { useUser } from '@/lib/hooks/use-user'
import { queryKeys } from '@/lib/query-keys'
import { useEscapeKey } from '@/lib/hooks/use-escape-key'
import {
  STAGE_OPTIONS, OUTREACH_OPTIONS, PRICING_OPTIONS, SERVICE_TYPES, SYSTEM_TYPES,
} from '@/lib/constants'
import { cn } from '@/lib/utils'
import type { ApiCompanyDetail } from '@/lib/types'

type Props = {
  companies: ApiCompanyDetail[]
  onClose: () => void
  onCreated: () => void
}

// ─── Deal Name Input with system type autocomplete ──────────────────────────

function DealNameInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [focused, setFocused] = useState(false)

  const suggestions = useMemo(() => {
    if (!value || value.length < 1) return []
    const q = value.toUpperCase().trim()
    // Split input into words and match the last word against system types
    const words = q.split(/\s+/)
    const lastWord = words[words.length - 1]
    if (!lastWord || lastWord.length < 2) return []
    return SYSTEM_TYPES.filter(s =>
      s.acronym.startsWith(lastWord) || s.fullName.toUpperCase().includes(lastWord)
    ).slice(0, 6)
  }, [value])

  const showSuggestions = focused && suggestions.length > 0

  function applySuggestion(s: typeof SYSTEM_TYPES[number]) {
    // Replace the last word with "ACRONYM" if it matches, otherwise append
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
              {/* Parent label */}
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

const CREATE_DEAL_ACCEPT_LIST = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/html',
  'text/markdown',
  'text/plain',
  'text/csv',
  'image/jpeg',
  'image/png',
  'image/webp',
  'audio/mp4',
  'audio/x-m4a',
  'audio/mpeg',
]
const CREATE_DEAL_ACCEPT = CREATE_DEAL_ACCEPT_LIST.join(',')

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
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const uploadFiles = useUploadDocumentFile()

  const createDeal = useCreateDeal({
    onSuccess: (data: any) => {
      // If files are pending, upload them to the new deal
      if (pendingFiles.length > 0 && data?.id && userId) {
        uploadFiles.mutate(
          { dealId: data.id, authorId: userId, files: pendingFiles, dealStage: stage },
          {
            onSettled: () => {
              qc.invalidateQueries({ queryKey: queryKeys.deals.all })
              if (companyId) qc.invalidateQueries({ queryKey: queryKeys.companies.deals(companyId) })
              onCreated()
            },
          },
        )
      } else {
        qc.invalidateQueries({ queryKey: queryKeys.deals.all })
        if (companyId) qc.invalidateQueries({ queryKey: queryKeys.companies.deals(companyId) })
        onCreated()
      }
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return

    // Build tags from the selected service type
    const tags = serviceType ? [serviceType] : []

    createDeal.mutate({
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
  const isPending = createDeal.isPending || uploadFiles.isPending
  const error = createDeal.error

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-[2px] animate-in fade-in-0 duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-[#1e1e21] rounded-lg shadow-[0_8px_40px_rgba(0,0,0,0.18)] border border-black/[.06] dark:border-white/[.08] w-full max-w-[460px] mx-4 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 fade-in-0 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-black/[.06] dark:border-white/[.08] flex items-center justify-between sticky top-0 bg-white dark:bg-[#1e1e21] z-10">
          <div>
            <div className="text-sm font-semibold text-slate-900 dark:text-white">New Deal</div>
            <div className="text-xs text-slate-400 mt-0.5">Add a deal to your pipeline</div>
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

          {/* Brand / Company — use combobox since companies list can grow large */}
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
              <Select value={outreachCategory} onValueChange={setOutreachCategory}>
                <SelectTrigger className="h-9 text-ssm">
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  {OUTREACH_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value} className="text-ssm">{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Value + Pricing Model */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xxs font-medium text-slate-500 uppercase tracking-[0.05em]">Value (₱)</label>
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
                className="h-9 text-ssm"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xxs font-medium text-slate-500 uppercase tracking-[0.05em]">Pricing Model</label>
              <Select value={pricingModel} onValueChange={setPricingModel}>
                <SelectTrigger className="h-9 text-ssm">
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  {PRICING_OPTIONS.map(p => (
                    <SelectItem key={p.value} value={p.value} className="text-ssm">{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>


          {/* File attachments */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xxs font-medium text-slate-500 uppercase tracking-[0.05em]">
              Attachments <span className="text-slate-400">(optional)</span>
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept={CREATE_DEAL_ACCEPT}
              multiple
              onChange={e => {
                const files = e.target.files
                if (!files?.length) return
                setPendingFiles(prev => [...prev, ...Array.from(files).filter(f => CREATE_DEAL_ACCEPT_LIST.includes(f.type))])
                if (fileInputRef.current) fileInputRef.current.value = ''
              }}
              className="hidden"
              id="create-deal-files"
            />
            <label
              htmlFor="create-deal-files"
              className="flex items-center gap-2 py-2.5 px-3 border border-dashed border-slate-200 dark:border-white/[.1] rounded-lg cursor-pointer hover:border-primary/40 hover:bg-primary/[.02] transition-colors"
            >
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="text-slate-400 shrink-0">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {pendingFiles.length > 0 ? `${pendingFiles.length} file${pendingFiles.length !== 1 ? 's' : ''} attached` : 'Drop files or click to attach'}
              </span>
            </label>
            {pendingFiles.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-1">
                {pendingFiles.map((file, i) => (
                  <div key={i} className="relative group inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-100 dark:bg-white/[.06] border border-black/[.06] dark:border-white/[.08] max-w-[160px]">
                    <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="text-slate-400 shrink-0">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                    <span className="text-atom text-slate-600 dark:text-slate-300 truncate">{file.name}</span>
                    <button
                      type="button"
                      onClick={() => setPendingFiles(prev => prev.filter((_, j) => j !== i))}
                      className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-white dark:bg-[#2a2c30] border border-black/[.1] dark:border-white/[.1] flex items-center justify-center text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <svg width={6} height={6} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
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
              <>{isPending && <span className="inline-block w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />}Create Deal</>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
