'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Building2, CheckCircle2, ChevronDown, CircleDashed, ExternalLink, Filter, Gauge, Loader2, Mail, MapPin, Pencil, Phone, Plus, Search, Send, Trash2, Users, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Combobox } from '@/components/ui/combobox'
import { CopyButton } from '@/components/ui/copy-button'
import { DataTableSkeleton } from '@/components/ui/data-table'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { StatusPill } from '@/components/ui/status-pill'
import { SubTabFilter, type SubTabFilterItem } from '@/components/ui/sub-tab-filter'
import { Textarea } from '@/components/ui/textarea'
import { LeadStatus, LEGACY_LEAD_STATUS_MAP } from '@symph-crm/shared'
import { LEAD_SEGMENT_OPTIONS, LeadSegmentOption, STANDARD_INDUSTRY_OPTIONS } from '@/lib/constants'
import { formatNameWithAcronyms } from '@/lib/format-deal-name'
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value'
import { useGetCatalogItems, useGetCompanies } from '@/lib/hooks/queries'
import { useConvertLead, useCreateLead, useDeleteLead, useInfiniteLeadsList, useUpdateLead } from '@/lib/hooks/useLeadsQuery'
import { cn } from '@/lib/utils'
import type { ApiLead, ConvertLeadInput, CreateLeadInput } from '@/lib/types'

const LEAD_STATUS_OPTIONS: Array<{ value: LeadStatus | 'all'; label: string }> = [
  { value: 'all', label: 'All leads' },
  { value: LeadStatus.ToContact, label: 'To Contact' },
  { value: LeadStatus.Contacted, label: 'Contacted' },
  { value: LeadStatus.FollowedUp, label: 'Followed Up' },
  { value: LeadStatus.Lost, label: 'Lost' },
  { value: LeadStatus.Converted, label: 'Converted' },
]

const LEAD_STATUS_META: Record<LeadStatus, { label: string; className: string }> = {
  [LeadStatus.ToContact]: { label: 'To Contact', className: 'bg-sky-500/12 text-sky-700 dark:text-sky-300' },
  [LeadStatus.Contacted]: { label: 'Contacted', className: 'bg-blue-500/12 text-blue-700 dark:text-blue-300' },
  [LeadStatus.FollowedUp]: { label: 'Followed Up', className: 'bg-violet-500/12 text-violet-700 dark:text-violet-300' },
  [LeadStatus.Lost]: { label: 'Lost', className: 'bg-slate-500/12 text-slate-700 dark:text-slate-300' },
  [LeadStatus.Converted]: { label: 'Converted', className: 'bg-green-500/12 text-green-700 dark:text-green-300' },
}

const LEADS_PAGE_SIZE = 20

const INITIAL_FORM: CreateLeadInput = {
  sourceName: 'manual',
  status: LeadStatus.ToContact,
  followUpCount: 0,
  score: 0,
  personName: '',
  personTitle: '',
  companyName: '',
  industry: '',
  companySize: '',
  location: '',
  email: '',
  emailStatus: '',
  linkedinUrl: '',
  phone: '',
  segment: '',
  notes: '',
}

function leadIdentity(lead: ApiLead) {
  return lead.personName || lead.email || 'Unnamed lead'
}

function formatLeadLabel(value: string | null | undefined) {
  if (!value) return ''
  return value
    .split(/([/&])/)
    .map(part => {
      if (part === '/') return '/'
      if (part === '&') return ' & '
      return formatNameWithAcronyms(part, { pascalCaseFallback: true })
    })
    .join('')
    .replace(/\s+/g, ' ')
}

function isLeadSegment(value: string): value is LeadSegmentOption {
  return Object.values(LeadSegmentOption).includes(value as LeadSegmentOption)
}

function cleanLeadInput(input: CreateLeadInput): CreateLeadInput {
  return Object.fromEntries(
    Object.entries(input).map(([key, value]) => [key, typeof value === 'string' ? value.trim() || null : value]),
  ) as CreateLeadInput
}

function normalizeLeadStatus(status: LeadStatus | string | null | undefined): LeadStatus {
  if (!status) return LeadStatus.ToContact
  if (status in LEAD_STATUS_META) return status as LeadStatus
  return LEGACY_LEAD_STATUS_MAP[status] ?? LeadStatus.ToContact
}

function StatusBadge({ status, loading = false }: { status: LeadStatus | string; loading?: boolean }) {
  const normalizedStatus = normalizeLeadStatus(status)
  const meta = LEAD_STATUS_META[normalizedStatus]
  return (
    <StatusPill className={cn('rounded-full', meta.className)}>
      {loading && <Loader2 size={11} className="mr-1 animate-spin" />}
      {meta.label}
    </StatusPill>
  )
}

function formatLeadDateTime(value: string | null | undefined) {
  if (!value) return ''
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value))
}

function hasLeadValue(value: string | number | null | undefined) {
  return value !== null && value !== undefined && String(value).trim() !== ''
}

function leadInitials(lead: ApiLead) {
  const source = lead.personName || lead.companyName || lead.email || 'Lead'
  return source
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part.charAt(0).toUpperCase())
    .join('')
}

function LeadDetailRow({
  icon: Icon,
  label,
  value,
  copyValue,
  href,
  external = false,
}: {
  icon: typeof Mail
  label: string
  value: string | number | null | undefined
  copyValue?: string
  href?: string
  external?: boolean
}) {
  if (!hasLeadValue(value)) return null

  const content = href ? (
    <a
      href={href}
      target={external ? '_blank' : undefined}
      rel={external ? 'noreferrer' : undefined}
      className="inline-flex items-center gap-1 text-primary underline-offset-2 hover:underline"
    >
      {value}
      {external && <ExternalLink size={13} />}
    </a>
  ) : value

  return (
    <div className="grid grid-cols-[20px_104px_1fr_auto] items-center gap-2 py-2 text-xs">
      <Icon size={15} strokeWidth={1.7} className="text-text-faint" />
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className="min-w-0 break-words text-right font-medium text-foreground">{content}</span>
      {copyValue && <CopyButton value={copyValue} />}
    </div>
  )
}

function LeadDetailDialog({ lead, open, onOpenChange }: { lead: ApiLead | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  const contactRows = Boolean(lead && (hasLeadValue(lead.email) || hasLeadValue(lead.phone) || hasLeadValue(lead.linkedinUrl)))
  const companyRows = Boolean(lead && (hasLeadValue(lead.industry) || hasLeadValue(lead.companySize) || hasLeadValue(lead.location)))
  const sourceMeta = lead ? [lead.sourceName, lead.sourceFileName, lead.sourceRowNumber ? `row ${lead.sourceRowNumber}` : null].filter(hasLeadValue).join(' · ') : ''
  const updatedAt = lead ? formatLeadDateTime(lead.updatedAt) : ''

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[520px] overflow-hidden">
        {lead && (
          <div className="p-4">
            <div className="flex items-start gap-3.5">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                {leadInitials(lead)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <DialogTitle className="truncate text-sbase font-semibold tracking-[-0.02em] text-foreground">
                      {leadIdentity(lead)}
                    </DialogTitle>
                    {(lead.personTitle || lead.companyName) && (
                      <DialogDescription className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        {lead.personTitle && <span>{lead.personTitle}</span>}
                        {lead.personTitle && lead.companyName && <span>·</span>}
                        {lead.companyName && (
                          <span className="inline-flex items-center gap-1">
                            {lead.companyName}
                            <CopyButton value={lead.companyName} className="size-5" />
                          </span>
                        )}
                      </DialogDescription>
                    )}
                  </div>
                  <StatusBadge status={lead.status} />
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {lead.segment && (
                    <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-muted-foreground">
                      {lead.segment}
                    </span>
                  )}
                  {hasLeadValue(lead.score) && (
                    <span className="inline-flex items-center gap-1.5 rounded-full px-1.5 py-1 text-xs font-medium text-muted-foreground">
                      <Gauge size={14} />
                      Score {lead.score}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {(contactRows || companyRows) && <div className="my-4 h-px bg-border" />}

            {contactRows && (
              <div className="divide-y divide-border">
                <LeadDetailRow icon={Mail} label="Email" value={lead.email} href={lead.email ? `mailto:${lead.email}` : undefined} copyValue={lead.email ?? undefined} />
                <LeadDetailRow icon={Phone} label="Phone" value={lead.phone} href={lead.phone ? `tel:${lead.phone}` : undefined} copyValue={lead.phone ?? undefined} />
                <LeadDetailRow icon={ExternalLink} label="LinkedIn" value={lead.linkedinUrl ? 'View profile' : null} href={lead.linkedinUrl ?? undefined} external copyValue={lead.linkedinUrl ?? undefined} />
              </div>
            )}

            {contactRows && companyRows && <div className="my-2 h-px bg-border" />}

            {companyRows && (
              <div className="divide-y divide-border">
                <LeadDetailRow icon={Building2} label="Industry" value={formatLeadLabel(lead.industry)} />
                <LeadDetailRow icon={Users} label="Company size" value={lead.companySize ? `${lead.companySize} employees` : null} />
                <LeadDetailRow icon={MapPin} label="Location" value={lead.location} />
              </div>
            )}

            {lead.notes && (
              <>
                <div className="my-3 h-px bg-border" />
                <div className="rounded-md border border-border bg-secondary/40 p-2.5">
                  <p className="eyebrow-label mb-1">Notes</p>
                  <p className="whitespace-pre-wrap text-xs leading-5 text-muted-foreground">{lead.notes}</p>
                </div>
              </>
            )}

            {(sourceMeta || updatedAt) && (
              <>
                <div className="my-3 h-px bg-border" />
                <div className="flex flex-col gap-1 text-xs font-medium text-text-faint">
                  {sourceMeta && (
                    <div className="flex items-center gap-1.5">
                      <span>{sourceMeta}</span>
                      <CopyButton value={sourceMeta} className="size-5" />
                    </div>
                  )}
                  {updatedAt && <span>Updated {updatedAt}</span>}
                </div>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function leadToForm(lead: ApiLead): CreateLeadInput {
  return {
    sourceName: lead.sourceName ?? 'manual',
    sourceFileName: lead.sourceFileName,
    sourceRowNumber: lead.sourceRowNumber,
    segment: lead.segment ?? '',
    personName: lead.personName ?? '',
    personTitle: lead.personTitle ?? '',
    companyName: lead.companyName ?? '',
    industry: lead.industry ?? '',
    companySize: lead.companySize ?? '',
    location: lead.location ?? '',
    email: lead.email ?? '',
    emailStatus: lead.emailStatus ?? '',
    linkedinUrl: lead.linkedinUrl ?? '',
    phone: lead.phone ?? '',
    status: lead.status,
    score: lead.score ?? 0,
    notes: lead.notes ?? '',
    rawPayload: lead.rawPayload,
    matchedCompanyId: lead.matchedCompanyId,
    matchedContactId: lead.matchedContactId,
  }
}

function CreateLeadDialog({
  open,
  onOpenChange,
  lead,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  lead?: ApiLead | null
}) {
  const isEdit = Boolean(lead)
  const [form, setForm] = useState<CreateLeadInput>(INITIAL_FORM)
  const createLead = useCreateLead({
    onSuccess: () => {
      setForm(INITIAL_FORM)
      onOpenChange(false)
    },
  })
  const updateLead = useUpdateLead({
    onSuccess: () => {
      onOpenChange(false)
    },
  })
  const isPending = createLead.isPending || updateLead.isPending

  useEffect(() => {
    if (!open) return
    setForm(lead ? leadToForm(lead) : INITIAL_FORM)
  }, [lead, open])

  function updateField<K extends keyof CreateLeadInput>(key: K, value: CreateLeadInput[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const input = cleanLeadInput(form)
    if (lead) {
      updateLead.mutate({ id: lead.id, data: input })
      return
    }
    createLead.mutate(input)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-[520px] overflow-hidden rounded-lg" onEscapeKeyDown={() => onOpenChange(false)}>
        <DialogHeader className="sticky top-0 z-10 bg-card">
          <div>
            <DialogTitle>{isEdit ? 'Edit lead' : 'New lead'}</DialogTitle>
            <DialogDescription>{isEdit ? 'Update lead details before outreach or conversion.' : 'Capture a pre-pipeline prospect before it becomes a deal.'}</DialogDescription>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
            aria-label="Close new lead dialog"
          >
            <X size={14} />
          </button>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="max-h-[calc(88vh-57px)] overflow-y-auto px-4 py-3">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="eyebrow-label">
                Person name <span className="text-red-400">*</span>
              </label>
              <Input
                autoFocus
                className="h-9 text-ssm"
                value={form.personName ?? ''}
                onChange={e => updateField('personName', e.target.value)}
                placeholder="e.g. Joanna Ocampo"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label className="eyebrow-label">Title</label>
                <Input
                  className="h-9 text-ssm"
                  value={form.personTitle ?? ''}
                  onChange={e => updateField('personTitle', e.target.value)}
                  placeholder="Founder & CEO"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="eyebrow-label">Company</label>
                <Input
                  className="h-9 text-ssm"
                  value={form.companyName ?? ''}
                  onChange={e => updateField('companyName', e.target.value)}
                  placeholder="Company name"
                />
              </div>
            </div>

            <div className="border-t border-border pt-3">
              <p className="eyebrow-label mb-2">Classify</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <label className="sr-only">Industry</label>
                  <Combobox
                    options={STANDARD_INDUSTRY_OPTIONS}
                    value={form.industry ?? ''}
                    onValueChange={value => updateField('industry', value)}
                    placeholder="Search industry..."
                    className="h-9 text-ssm"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="sr-only">Segment</label>
                  <Select
                    value={typeof form.segment === 'string' && isLeadSegment(form.segment) ? form.segment : undefined}
                    onValueChange={value => updateField('segment', value)}
                  >
                    <SelectTrigger className="h-9 text-ssm">
                      <SelectValue placeholder="Segment" />
                    </SelectTrigger>
                    <SelectContent>
                      {LEAD_SEGMENT_OPTIONS.map(option => (
                        <SelectItem key={option.value} value={option.value} className="text-ssm">{option.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="border-t border-border pt-3">
              <p className="eyebrow-label mb-2">Contact</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Input className="h-9 text-ssm" value={form.email ?? ''} onChange={e => updateField('email', e.target.value)} placeholder="Email" />
                <Input className="h-9 text-ssm" value={form.phone ?? ''} onChange={e => updateField('phone', e.target.value)} placeholder="Phone" />
                <Input className="h-9 text-ssm" value={form.linkedinUrl ?? ''} onChange={e => updateField('linkedinUrl', e.target.value)} placeholder="LinkedIn URL" />
                <Input className="h-9 text-ssm" value={form.location ?? ''} onChange={e => updateField('location', e.target.value)} placeholder="Location" />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="eyebrow-label">
                Notes <span className="text-slate-400">(optional)</span>
              </label>
              <Textarea
                className="min-h-[72px] text-ssm"
                value={form.notes ?? ''}
                onChange={e => updateField('notes', e.target.value)}
                placeholder="Anything worth remembering about this lead"
              />
            </div>

            <div className="grid grid-cols-1 gap-2 border-t border-border pt-3 sm:grid-cols-[0.72fr_1.28fr]">
              <Button type="button" variant="outline" className="h-9" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" className="h-9" disabled={isPending}>
                {isPending && <Loader2 size={13} className="animate-spin" />}
                {isEdit ? 'Save changes' : 'Create lead'}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

type LeadConfirmAction = 'delete' | 'convert'

type LeadConfirmTarget = {
  action: LeadConfirmAction
  lead: ApiLead
}

function LeadActionConfirmDialog({
  target,
  isPending,
  onCancel,
  onConfirm,
}: {
  target: LeadConfirmTarget | null
  isPending: boolean
  onCancel: () => void
  onConfirm: (data?: ConvertLeadInput) => void
}) {
  const lead = target?.lead
  const isDelete = target?.action === 'delete'
  const [brandId, setBrandId] = useState('')
  const [brandInput, setBrandInput] = useState('')
  const [catalogItemId, setCatalogItemId] = useState('')
  const { data: companies = [] } = useGetCompanies({ enabled: target?.action === 'convert' })
  const { data: catalog = [] } = useGetCatalogItems(true, { enabled: target?.action === 'convert' })

  const serviceOptions = useMemo(() => catalog
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(item => ({
      value: item.id,
      label: item.industry ? `${item.name} · ${item.industry}` : item.name,
    })), [catalog])
  const selectedService = useMemo(() => catalog.find(item => item.id === catalogItemId), [catalog, catalogItemId])
  const canConvert = Boolean(catalogItemId.trim())

  useEffect(() => {
    if (!lead || target?.action !== 'convert') return
    const defaultBrand = lead.companyName?.trim() || ''
    const matched = defaultBrand ? companies.find(company => company.name.toLowerCase() === defaultBrand.toLowerCase()) : undefined
    setBrandId(matched?.id ?? '')
    setBrandInput(matched?.name ?? defaultBrand)
    setCatalogItemId('')
  }, [companies, lead, target?.action])

  if (!target || !lead) return null

  const leadName = leadIdentity(lead)
  const accentClass = isDelete ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-primary text-primary-foreground hover:bg-primary/90'

  function submitConversion() {
    if (!lead || !catalogItemId.trim()) return
    onConfirm({
      companyId: brandId || undefined,
      companyName: brandId ? undefined : brandInput.trim() || lead.companyName || undefined,
      dealTitle: lead.companyName || lead.personName || undefined,
      catalogItemId: catalogItemId || undefined,
      serviceTag: selectedService?.slug || selectedService?.name || undefined,
    })
  }

  if (isDelete) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm" onClick={onCancel}>
        <div
          className="w-full max-w-sm animate-in rounded-md border border-border bg-card p-4 shadow-lg zoom-in-95 fade-in-0 duration-150"
          onClick={event => event.stopPropagation()}
        >
          <div className="mb-4 flex items-center gap-2">
            <StatusBadge status={lead.status} />
            <ChevronDown size={14} className="-rotate-90 text-text-faint" />
            <StatusBadge status={LeadStatus.Lost} />
          </div>
          <p className="text-sm font-semibold text-foreground">Delete lead?</p>
          <p className="mt-1 text-ssm leading-relaxed text-muted-foreground">
            Delete <span className="font-semibold text-foreground">{leadName}</span> from the pre-pipeline lead list.
          </p>
          <div className="mt-4 flex gap-2.5">
            <button type="button" onClick={onCancel} disabled={isPending} className="h-8 flex-1 rounded-control border border-border text-xs font-semibold text-muted-foreground transition-colors hover:bg-surface-hover disabled:opacity-60">Cancel</button>
            <button type="button" onClick={() => onConfirm()} disabled={isPending} className={cn('flex h-8 flex-1 items-center justify-center gap-1.5 rounded-control text-xs font-semibold transition-colors disabled:opacity-60', accentClass)}>
              {isPending && <Loader2 size={13} className="animate-spin" />}
              Delete
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm" onClick={onCancel}>
      <div
        className="w-full max-w-[520px] animate-in rounded-lg border border-border bg-card shadow-lg zoom-in-95 fade-in-0 duration-150"
        onClick={event => event.stopPropagation()}
      >
        <div className="border-b border-border px-4 py-3">
          <div className="mb-3 flex items-center gap-2">
            <StatusBadge status={lead.status} />
            <ChevronDown size={14} className="-rotate-90 text-text-faint" />
            <StatusBadge status={LeadStatus.Converted} />
          </div>
          <p className="text-sm font-semibold text-foreground">Move to sales pipeline?</p>
          <p className="mt-1 text-ssm text-muted-foreground">
            Convert <span className="font-semibold text-foreground">{leadName}</span> into a sales pipeline deal.
          </p>
        </div>

        <div className="max-h-[68vh] overflow-y-auto px-4 py-3">
          <div>
            <div className="flex items-start justify-between gap-3 pb-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">{leadName}</p>
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {[lead.personTitle, lead.companyName].filter(Boolean).join(' · ') || 'No title or company'}
                </p>
              </div>
              <StatusBadge status={lead.status} />
            </div>
            <div className="border-y border-border">
              {lead.email && <LeadConvertListRow icon={Mail} label="Email" value={lead.email} />}
              {lead.phone && <LeadConvertListRow icon={Phone} label="Phone" value={lead.phone} />}
              {lead.linkedinUrl && <LeadConvertListRow icon={ExternalLink} label="LinkedIn" value="View profile" href={lead.linkedinUrl} />}
              {lead.industry && <LeadConvertListRow icon={Building2} label="Industry" value={formatLeadLabel(lead.industry)} />}
              {lead.segment && <LeadConvertListRow icon={Users} label="Segment" value={formatLeadLabel(lead.segment)} />}
              {lead.location && <LeadConvertListRow icon={MapPin} label="Location" value={lead.location} />}
            </div>
            {lead.notes && (
              <div className="border-b border-border py-2.5">
                <p className="text-xxs font-medium uppercase tracking-[0.12em] text-text-faint">Notes</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{lead.notes}</p>
              </div>
            )}
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label className="eyebrow-label">Brand</label>
              <Combobox
                options={[...companies]
                  .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))
                  .map(company => ({ value: company.id, label: company.name }))}
                value={brandId || brandInput}
                onValueChange={(value) => {
                  const company = companies.find(item => item.id === value)
                  if (company) {
                    setBrandId(company.id)
                    setBrandInput(company.name)
                    return
                  }
                  setBrandId('')
                  setBrandInput(value)
                }}
                placeholder="Search or type brand..."
                allowCustom
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="eyebrow-label">
                Service <span className="text-red-400">*</span>
              </label>
              <Combobox
                options={serviceOptions}
                value={catalogItemId}
                onValueChange={setCatalogItemId}
                placeholder="Search service..."
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 border-t border-border px-4 py-3 sm:grid-cols-[0.72fr_1.28fr]">
          <Button type="button" variant="outline" className="h-9" onClick={onCancel} disabled={isPending}>Cancel</Button>
          <Button type="button" className="h-9" onClick={submitConversion} disabled={isPending || !canConvert}>
            {isPending && <Loader2 size={13} className="animate-spin" />}
            Convert
          </Button>
        </div>
      </div>
    </div>
  )
}

function LeadConvertListRow({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: typeof Mail
  label: string
  value: string
  href?: string
}) {
  const valueNode = href ? (
    <a href={href} target="_blank" rel="noreferrer" className="text-primary underline-offset-2 hover:underline">
      {value}
    </a>
  ) : value

  return (
    <div className="flex items-center gap-3 border-b border-border py-2.5 last:border-b-0">
      <Icon size={15} className="shrink-0 text-muted-foreground" />
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className="ml-auto max-w-[58%] truncate text-right text-xs text-foreground">{valueNode}</span>
    </div>
  )
}

function LeadRow({
  lead,
  rowNumber,
  onRequestDelete,
  onRequestConvert,
  onRequestEdit,
  onOpenDetails,
}: {
  lead: ApiLead
  rowNumber: number
  onRequestDelete: (lead: ApiLead) => void
  onRequestConvert: (lead: ApiLead) => void
  onRequestEdit: (lead: ApiLead) => void
  onOpenDetails: (lead: ApiLead) => void
}) {
  const [pendingStatus, setPendingStatus] = useState<LeadStatus | null>(null)
  const [pendingFollowUpCount, setPendingFollowUpCount] = useState<number | null>(null)
  const updateLead = useUpdateLead({
    onSuccess: () => {
      setPendingStatus(null)
      setPendingFollowUpCount(null)
    },
    onError: () => {
      setPendingStatus(null)
      setPendingFollowUpCount(null)
    },
  })
  const currentStatus = pendingStatus ?? normalizeLeadStatus(lead.status)
  const currentFollowUpCount = pendingFollowUpCount ?? lead.followUpCount
  const canConvert = currentStatus !== LeadStatus.Converted && currentStatus !== LeadStatus.Lost

  return (
    <tr className="cursor-pointer border-b border-border transition-colors hover:bg-surface-hover" onClick={() => onOpenDetails(lead)}>
      <td className="px-4 py-3 align-top text-xxs tabular-nums text-text-faint">
        {rowNumber}
      </td>
      <td className="px-4 py-3 align-top">
        <div className="truncate text-ssm font-medium text-foreground">{leadIdentity(lead)}</div>
      </td>
      <td className="hidden px-4 py-3 align-top lg:table-cell">
        <div className="text-xs text-foreground">{lead.companyName || 'No company'}</div>
      </td>
      <td className="hidden px-4 py-3 align-top md:table-cell">
        <div className="text-xs text-foreground">{lead.email || lead.phone || 'No contact'}</div>
      </td>
      <td className="px-4 py-3 align-top" onClick={event => event.stopPropagation()}>
        <div className="flex items-center gap-2">
          <Select
            value={currentStatus}
            disabled={updateLead.isPending}
            onValueChange={(value) => {
              const nextStatus = value as LeadStatus
              if (nextStatus === currentStatus) return
              const nextFollowUpCount = nextStatus === LeadStatus.FollowedUp ? Math.max(lead.followUpCount || 1, 1) : 0
              setPendingStatus(nextStatus)
              setPendingFollowUpCount(nextFollowUpCount)
              updateLead.mutate({
                id: lead.id,
                data: {
                  status: nextStatus,
                  followUpCount: nextFollowUpCount,
                },
              })
            }}
          >
            <SelectTrigger size="sm" className="w-[132px] border-transparent bg-transparent px-0 hover:bg-transparent focus-visible:border-transparent focus-visible:ring-0 disabled:opacity-100">
              <StatusBadge status={currentStatus} loading={updateLead.isPending} />
            </SelectTrigger>
            <SelectContent className="w-[180px]">
              {LEAD_STATUS_OPTIONS.filter(option => option.value !== 'all').map(option => {
                const optionStatus = option.value as LeadStatus
                return (
                  <SelectItem
                    key={option.value}
                    value={option.value}
                    className="cursor-pointer px-2 py-2 focus:bg-surface-hover data-[highlighted]:bg-surface-hover"
                  >
                    <StatusBadge status={optionStatus} />
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>
          {currentStatus === LeadStatus.FollowedUp && (
            <Select
              value={String(currentFollowUpCount || 1)}
              disabled={updateLead.isPending}
              onValueChange={(value) => {
                const nextFollowUpCount = Number(value)
                setPendingFollowUpCount(nextFollowUpCount)
                updateLead.mutate({ id: lead.id, data: { status: LeadStatus.FollowedUp, followUpCount: nextFollowUpCount } })
              }}
            >
              <SelectTrigger size="sm" className="h-7 w-[58px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5].map(count => (
                  <SelectItem key={count} value={String(count)}>{count} {count === 1 ? 'time' : 'times'}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </td>
      <td className="hidden w-[190px] px-4 py-3 align-top xl:table-cell">
        <span className="inline-flex max-w-none whitespace-nowrap rounded-full border border-border bg-secondary px-2 py-0.5 text-xxs font-medium text-muted-foreground">
          {lead.segment || 'No segment'}
        </span>
      </td>
      <td className="px-4 py-3 align-top" onClick={event => event.stopPropagation()}>
        <div className="flex items-center justify-end gap-1.5">
          {lead.linkedinUrl && (
            <Button variant="ghost" size="icon" asChild className="size-7 text-muted-foreground">
              <a href={lead.linkedinUrl} target="_blank" rel="noreferrer" aria-label="Open LinkedIn" onClick={event => event.stopPropagation()}><ExternalLink size={14} /></a>
            </Button>
          )}
          <Button variant="ghost" size="icon" className="size-7 text-muted-foreground" onClick={() => onRequestEdit(lead)} aria-label="Edit lead">
            <Pencil size={14} />
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!canConvert}
            onClick={() => onRequestConvert(lead)}
          >
            Convert
          </Button>
          <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-danger" onClick={() => onRequestDelete(lead)} aria-label="Delete lead">
            <Trash2 size={14} />
          </Button>
        </div>
      </td>
    </tr>
  )
}

export function Leads() {
  const router = useRouter()
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, 300)
  const [status, setStatus] = useState<LeadStatus | 'all'>('all')
  const [segment, setSegment] = useState<LeadSegmentOption | 'all'>('all')
  const [createOpen, setCreateOpen] = useState(false)
  const [editingLead, setEditingLead] = useState<ApiLead | null>(null)
  const [selectedLead, setSelectedLead] = useState<ApiLead | null>(null)
  const [leadDetailOpen, setLeadDetailOpen] = useState(false)
  const [confirmTarget, setConfirmTarget] = useState<LeadConfirmTarget | null>(null)
  const params = useMemo(() => ({ search: debouncedSearch.trim() || undefined, status, segment: segment === 'all' ? undefined : segment }), [debouncedSearch, segment, status])
  const {
    data,
    isLoading,
    isError,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useInfiniteLeadsList(params, LEADS_PAGE_SIZE)
  const leads = useMemo(() => data?.pages.flatMap(page => page.items) ?? [], [data])
  const totalLeadCount = data?.pages[0]?.count ?? 0
  const stats = data?.pages[0]?.stats ?? { active: 0, followedUp: 0, converted: 0 }
  const segmentCounts = data?.pages[0]?.segmentCounts ?? {}
  const segmentTabs = useMemo<SubTabFilterItem<LeadSegmentOption | 'all'>[]>(() => [
    { id: 'all', label: 'All', count: Object.values(segmentCounts).reduce((sum, count) => sum + count, 0) },
    ...LEAD_SEGMENT_OPTIONS.map(option => ({ id: option.value, label: option.label, count: segmentCounts[option.value] ?? 0 })),
  ], [segmentCounts])
  const convertLead = useConvertLead({
    onSuccess: (result) => {
      setConfirmTarget(null)
      if (result.deal?.id) router.push(`/deals/${result.deal.id}?from=leads`)
    },
    onError: () => setConfirmTarget(null),
  })
  const deleteLead = useDeleteLead({
    onSuccess: () => setConfirmTarget(null),
    onError: () => setConfirmTarget(null),
  })
  const confirmPending = convertLead.isPending || deleteLead.isPending

  function confirmLeadAction(data?: ConvertLeadInput) {
    if (!confirmTarget) return
    if (confirmTarget.action === 'convert') {
      convertLead.mutate({ id: confirmTarget.lead.id, data: data ?? {} })
      return
    }
    deleteLead.mutate(confirmTarget.lead.id)
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null
      const isEditableTarget = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable
      if (createOpen || leadDetailOpen || confirmTarget) return
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'f') {
        event.preventDefault()
        searchInputRef.current?.focus()
        searchInputRef.current?.select()
        return
      }
      if (event.key === 'Escape' && search) {
        event.preventDefault()
        setSearch('')
        if (!isEditableTarget) searchInputRef.current?.focus()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [confirmTarget, createOpen, leadDetailOpen, search])

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="shrink-0 border-b border-border bg-bg px-4 py-3 md:px-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-ssm font-semibold text-foreground">Leads</p>
              <span className="rounded-full border border-border bg-secondary px-2 py-0.5 text-atom font-medium text-muted-foreground">Pre-pipeline</span>
            </div>
            <p className="mt-1 text-xxs text-muted-foreground">
              Track raw prospects before they become pipeline deals.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 lg:min-w-[360px]">
            <div className="rounded-md border border-border bg-card px-3 py-2">
              <p className="text-atom uppercase tracking-[0.14em] text-text-faint">Active</p>
              <p className="mt-1 text-sm font-semibold text-foreground tabular-nums">{stats.active}</p>
            </div>
            <div className="rounded-md border border-border bg-card px-3 py-2">
              <p className="text-atom uppercase tracking-[0.14em] text-text-faint">Followed Up</p>
              <p className="mt-1 text-sm font-semibold text-foreground tabular-nums">{stats.followedUp}</p>
            </div>
            <div className="rounded-md border border-border bg-card px-3 py-2">
              <p className="text-atom uppercase tracking-[0.14em] text-text-faint">Converted</p>
              <p className="mt-1 text-sm font-semibold text-foreground tabular-nums">{stats.converted}</p>
            </div>
          </div>
        </div>
        <div className="mt-3 flex flex-col gap-2 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              className="pl-8"
              value={search}
              onChange={event => setSearch(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Escape') {
                  event.preventDefault()
                  setSearch('')
                }
              }}
              placeholder="Search name, company, contact, industry, segment"
            />
          </div>
          <div className="min-w-0 overflow-x-auto">
            <SubTabFilter items={segmentTabs} value={segment} onChange={setSegment} />
          </div>
          <Select value={status} onValueChange={(value) => setStatus(value as LeadStatus | 'all')}>
            <SelectTrigger className="md:w-[180px]">
              <Filter size={14} className="text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LEAD_STATUS_OPTIONS.map(option => (
                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => {
            setEditingLead(null)
            setCreateOpen(true)
          }}>
            <Plus size={14} />
            New lead
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-bg p-3 md:p-4">
        <div className="overflow-hidden rounded-md border border-border bg-card">
          <table className="w-full min-w-[1040px]">
            <thead className="border-b border-border bg-secondary">
              <tr className="text-left font-mono text-atom font-medium capitalize tracking-[0.06em] text-text-faint">
                <th className="w-12 px-4 py-2.5 font-medium">#</th>
                <th className="px-4 py-2.5 font-medium">Lead</th>
                <th className="hidden px-4 py-2.5 font-medium lg:table-cell">Company</th>
                <th className="hidden px-4 py-2.5 font-medium md:table-cell">Contact</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="hidden w-[190px] px-4 py-2.5 font-medium xl:table-cell">Segment</th>
                <th className="px-4 py-2.5 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={7}>
                    <DataTableSkeleton />
                  </td>
                </tr>
              )}
              {!isLoading && isError && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-xs text-danger">Could not load leads.</td>
                </tr>
              )}
              {!isLoading && !isError && leads.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-14 text-center">
                    <div className="mx-auto flex max-w-sm flex-col items-center gap-2">
                      <CircleDashed size={22} className="text-text-faint" />
                      <p className="text-sm font-semibold text-foreground">No leads found</p>
                      <p className="text-xs text-muted-foreground">Create a lead or adjust the filter to see the pre-pipeline queue.</p>
                      <Button size="sm" onClick={() => {
                        setEditingLead(null)
                        setCreateOpen(true)
                      }}><Plus size={13} /> Add lead</Button>
                    </div>
                  </td>
                </tr>
              )}
              {!isLoading && !isError && leads.map((lead, index) => (
                <LeadRow
                  key={lead.id}
                  lead={lead}
                  rowNumber={index + 1}
                  onRequestDelete={(targetLead) => setConfirmTarget({ action: 'delete', lead: targetLead })}
                  onRequestConvert={(targetLead) => setConfirmTarget({ action: 'convert', lead: targetLead })}
                  onRequestEdit={(targetLead) => {
                    setEditingLead(targetLead)
                    setCreateOpen(true)
                  }}
                  onOpenDetails={(leadToOpen) => {
                    setSelectedLead(leadToOpen)
                    setLeadDetailOpen(true)
                  }}
                />
              ))}
            </tbody>
          </table>
        </div>
        {!isLoading && leads.length > 0 && (
          <div className="mt-3 flex flex-col items-center gap-3">
            <div className="flex items-center gap-1.5 text-xxs text-muted-foreground">
              <CheckCircle2 size={13} className="text-primary" />
              <span>{leads.length} of {totalLeadCount} lead{totalLeadCount !== 1 ? 's' : ''} loaded from CRM.</span>
              <Send size={13} className="ml-2 text-text-faint" />
              <span>Convert moves a lead into the deals pipeline.</span>
            </div>
            {hasNextPage && (
              <Button
                type="button"
                variant="outline"
                className="h-9 rounded-md px-4 text-xs font-semibold shadow-sm"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
              >
                {isFetchingNextPage ? <Loader2 size={14} className="animate-spin" /> : <ChevronDown size={14} />}
                Load more
              </Button>
            )}
          </div>
        )}
      </div>
      <CreateLeadDialog
        open={createOpen}
        lead={editingLead}
        onOpenChange={(open) => {
          setCreateOpen(open)
          if (!open) window.setTimeout(() => setEditingLead(null), 120)
        }}
      />
      <LeadDetailDialog
        lead={selectedLead}
        open={leadDetailOpen}
        onOpenChange={(open) => {
          setLeadDetailOpen(open)
          if (!open) window.setTimeout(() => setSelectedLead(null), 120)
        }}
      />
      <LeadActionConfirmDialog
        target={confirmTarget}
        isPending={confirmPending}
        onCancel={() => {
          if (!confirmPending) setConfirmTarget(null)
        }}
        onConfirm={confirmLeadAction}
      />
    </div>
  )
}
