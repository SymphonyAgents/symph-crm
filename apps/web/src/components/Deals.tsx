'use client'

import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useGetCompanies, useGetDeals, useGetUsers } from '@/lib/hooks/queries'
import { Input } from '@/components/ui/input'
import { cn, getInitials, getBrandColor, formatDealValue, formatServiceType, totalNumericValue, formatDealTitle, toPascalCase } from '@/lib/utils'
import { STAGE_DISPLAY, STAGE_COLORS, STAGE_LABELS, CLOSED_STAGE_IDS } from '@/lib/constants'
import type { ApiCompanyDetail, ApiDeal } from '@/lib/types'
import type { ColumnDef } from '@tanstack/react-table'
import { DataTable, SortableHeader } from './ui/data-table'
import { Avatar } from './Avatar'
import { EmptyState } from './EmptyState'
import { CreateBrandModal } from './CreateBrandModal'
import { CreateDealModal } from './CreateDealModal'
import { DealsGraph } from './DealsGraph'
import { BrandSlideOver } from './BrandSlideOver'
import { Paperclip, Pencil, Trash2, X } from 'lucide-react'
import { useUpdateCompany, useDeleteCompany } from '@/lib/hooks/mutations'
import { Combobox } from '@/components/ui/combobox'
import { INDUSTRY_OPTIONS } from '@/lib/constants'
import { queryKeys } from '@/lib/query-keys'
import { useUser } from '@/lib/hooks/use-user'
import { useEscapeKey } from '@/lib/hooks/use-escape-key'
import { useRouter, useSearchParams } from 'next/navigation'

type ViewMode = 'table' | 'graph'

// ── DataTable brand row type ──────────────────────────────────────────────────

type BrandTableRow = {
  company: ApiCompanyDetail
  color: string
  dealCount: number
  stageSummary: Array<{ id: string; label: string; bg: string; color: string }>
  documentCount: number
  totalValue: number
  createdByName: string | null
  createdByImage: string | null
  lastActivityAt: string | null
}

type BrandGroup = {
  company: ApiCompanyDetail
  color: string
  deals: ApiDeal[]
  totalValue: number
  activeCount: number
}

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

// --- Brand detail modal ---
function BrandDetailModal({
  group,
  onClose,
  onOpenDeal,
}: {
  group: BrandGroup
  onClose: () => void
  onOpenDeal: (id: string) => void
}) {
  useEscapeKey(useCallback(onClose, [onClose]))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in-0 duration-200" onClick={onClose}>
      <div
        className="bg-white dark:bg-[#1a1d21] rounded-xl shadow-2xl border border-black/[.08] dark:border-white/[.08] w-[90vw] max-w-[640px] max-h-[80vh] flex flex-col animate-in fade-in-0 zoom-in-95 duration-150"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal header */}
        <div className="flex items-center gap-3 p-4 border-b border-black/[.06] dark:border-white/[.08] shrink-0">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center text-sm font-semibold"
            style={{ background: `${group.color}15`, color: group.color }}
          >
            {getInitials(group.company.name)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sbase font-semibold text-slate-900 dark:text-white truncate">
              {group.company.name}
            </div>
            <div className="flex items-center gap-2 text-xxs text-slate-400 mt-0.5">
              {group.company.industry && <span>{group.company.industry}</span>}
              {group.company.domain && <span>{group.company.domain}</span>}
              {group.company.website && (
                <a
                  href={group.company.website.startsWith('http') ? group.company.website : `https://${group.company.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                  onClick={e => e.stopPropagation()}
                >
                  {group.company.website}
                </a>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[.08] transition-colors"
          >
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Stats bar */}
        <div className="flex items-center gap-4 px-4 py-2.5 border-b border-black/[.04] dark:border-white/[.06] bg-slate-50/50 dark:bg-white/[.02] shrink-0">
          <div className="text-xs">
            <span className="text-slate-400">Deals:</span>{' '}
            <span className="font-semibold text-slate-700 dark:text-slate-300">{group.deals.length}</span>
          </div>
          <div className="text-xs">
            <span className="text-slate-400">Active:</span>{' '}
            <span className="font-semibold text-slate-700 dark:text-slate-300">{group.activeCount}</span>
          </div>
          <div className="text-xs">
            <span className="text-slate-400">Value:</span>{' '}
            <span className="font-semibold tabular-nums" style={{ color: group.color }}>
              {group.totalValue > 0 ? formatDealValue(String(group.totalValue)) : 'P0.00'}
            </span>
          </div>
        </div>

        {/* Deals list */}
        <div className="flex-1 overflow-y-auto">
          {group.deals.length === 0 ? (
            <div className="py-10 text-center text-ssm text-slate-400">
              No deals for this brand yet
            </div>
          ) : (
            group.deals.map(deal => {
              const stageCfg = STAGE_DISPLAY[deal.stage] || { label: deal.stage, bg: '#f1f5f9', color: '#475569' }
              const tags = deal.servicesTags?.filter(Boolean) ?? []
              return (
                <div
                  key={deal.id}
                  onClick={() => { onClose(); onOpenDeal(deal.id) }}
                  className="flex items-center gap-3 px-4 py-3 border-b border-black/[.04] dark:border-white/[.06] cursor-pointer hover:bg-slate-50 dark:hover:bg-white/[.03] transition-colors"
                >
                  <div
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ background: STAGE_COLORS[deal.stage] || '#94a3b8' }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-ssm font-medium text-slate-900 dark:text-white truncate">
                      {formatDealTitle(deal.title)}
                    </div>
                    {tags.length > 0 && (
                      <div className="flex gap-1 mt-0.5 flex-wrap">
                        {tags.slice(0, 3).map(s => (
                          <span key={s} className="text-atom font-medium px-1.5 py-0.5 rounded-lg bg-slate-100 dark:bg-white/[.06] text-slate-500 whitespace-nowrap">
                            {formatServiceType(s)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <StagePill stage={deal.stage} />
                  <div className="text-ssm font-medium text-slate-700 dark:text-slate-300 tabular-nums whitespace-nowrap">
                    {formatDealValue(deal.value)}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}

// ── BrandsDataTable ───────────────────────────────────────────────────────────

function LastActivityCell({ iso }: { iso: string | null }) {
  if (!iso) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-600 shrink-0" />
        <span className="text-xs text-slate-400">No activity</span>
      </div>
    )
  }
  const diffDays = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  let dotColor: string
  if (diffDays < 7) dotColor = 'bg-green-500'
  else if (diffDays <= 30) dotColor = 'bg-amber-500'
  else dotColor = 'bg-red-500'

  return (
    <div className="flex items-center gap-1.5">
      <span className={cn('w-2 h-2 rounded-full shrink-0', dotColor)} />
      <span className="text-xs text-slate-600 dark:text-slate-400 tabular-nums">
        {diffDays === 0 ? 'Today' : diffDays === 1 ? '1 day ago' : `${diffDays} days ago`}
      </span>
    </div>
  )
}

function BrandsDataTable({
  rows,
  onRowClick,
  search,
  selectedBrandId,
  onEditBrand,
  onDeleteBrand,
}: {
  rows: BrandTableRow[]
  onRowClick: (row: BrandTableRow) => void
  search: string
  selectedBrandId?: string | null
  onEditBrand?: (brand: ApiCompanyDetail) => void
  onDeleteBrand?: (brand: ApiCompanyDetail) => void
}) {
  const columns: ColumnDef<BrandTableRow>[] = [
    // 1. Brand
    {
      id: 'brand',
      accessorFn: r => r.company.name,
      header: ({ column }) => <SortableHeader column={column}>Brand</SortableHeader>,
      cell: ({ row }) => {
        const r = row.original
        return (
          <div className="flex items-center gap-2.5 py-0.5">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
              style={{ background: `${r.color}18`, color: r.color }}
            >
              {getInitials(r.company.name)}
            </div>
            <div className="min-w-0">
              <div className="text-ssm font-semibold text-slate-900 dark:text-white truncate">
                {toPascalCase(r.company.name)}
              </div>
              {(r.company.industry || r.company.domain) && (
                <div className="text-xxs text-slate-400 truncate">
                  {r.company.industry || r.company.domain}
                </div>
              )}
            </div>
          </div>
        )
      },
      size: 240,
    },
    // 2. Pipeline Value (after Brand)
    {
      id: 'totalValue',
      accessorKey: 'totalValue',
      header: ({ column }) => <SortableHeader column={column}>Value</SortableHeader>,
      cell: ({ getValue }) => {
        const v = getValue<number>()
        return (
          <span className="text-ssm font-semibold tabular-nums text-slate-700 dark:text-slate-300">
            {v > 0 ? formatDealValue(String(v)) : 'P0.00'}
          </span>
        )
      },
      size: 140,
    },
    // 3. # Deals
    {
      id: 'dealCount',
      accessorKey: 'dealCount',
      header: ({ column }) => <SortableHeader column={column}>Deals</SortableHeader>,
      cell: ({ getValue }) => (
        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 tabular-nums">
          {getValue<number>()}
        </span>
      ),
      size: 80,
    },
    // 3b. Current Stage
    {
      id: 'currentStage',
      header: ({ column }) => <SortableHeader column={column}>Stage</SortableHeader>,
      cell: ({ row }) => {
        const stages = row.original.stageSummary
        if (!stages.length) return <span className="text-xs text-slate-300 dark:text-slate-600">&mdash;</span>
        return (
          <div className="flex flex-wrap gap-1">
            {stages.slice(0, 2).map(s => (
              <span
                key={s.id}
                className="inline-block px-2 py-px rounded-full text-xxs font-medium leading-[18px] whitespace-nowrap dark:brightness-150"
                style={{ background: s.bg, color: s.color }}
              >
                {s.label}
              </span>
            ))}
            {stages.length > 2 && (
              <span className="text-xxs text-slate-400">+{stages.length - 2}</span>
            )}
          </div>
        )
      },
      size: 180,
    },
    // 4. # Resources
    {
      id: 'documentCount',
      accessorKey: 'documentCount',
      header: ({ column }) => (
        <SortableHeader column={column}>
          <Paperclip size={12} className="shrink-0" />
          Resources
        </SortableHeader>
      ),
      cell: ({ getValue }) => {
        const n = getValue<number>()
        return (
          <div className="flex items-center gap-1">
            {n > 0 ? (
              <span className="text-xs font-semibold text-primary tabular-nums">{n}</span>
            ) : (
              <span className="text-xs text-slate-300 dark:text-slate-600">—</span>
            )}
          </div>
        )
      },
      size: 100,
    },
    // 5. Last Activity
    {
      id: 'lastActivity',
      accessorFn: r => r.lastActivityAt ?? '',
      header: ({ column }) => <SortableHeader column={column}>Last Activity</SortableHeader>,
      cell: ({ row }) => <LastActivityCell iso={row.original.lastActivityAt} />,
      size: 140,
    },
    // 6. Created By (last)
    {
      id: 'createdBy',
      accessorFn: r => r.createdByName ?? '—',
      header: ({ column }) => <SortableHeader column={column}>Created By</SortableHeader>,
      cell: ({ row }) => {
        const name = row.original.createdByName ?? '—'
        const image = row.original.createdByImage
        return (
          <div className="flex items-center gap-1.5">
            {name !== '—' && <Avatar name={name} src={image ?? undefined} size={20} />}
            <span className="text-xs text-slate-700 dark:text-slate-300">{name}</span>
          </div>
        )
      },
      size: 160,
    },
    // 7. Actions
    {
      id: 'actions',
      header: () => null,
      cell: ({ row }) => {
        const r = row.original
        if (r.company.id === '__unassigned__') return null
        return (
          <div className="flex items-center justify-end gap-1">
            <button
              onClick={e => { e.stopPropagation(); onEditBrand?.(r.company) }}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[.06] transition-colors"
              title="Edit brand"
            >
              <Pencil size={13} />
            </button>
            <button
              onClick={e => { e.stopPropagation(); onDeleteBrand?.(r.company) }}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
              title="Delete brand"
            >
              <Trash2 size={13} />
            </button>
          </div>
        )
      },
      enableSorting: false,
      size: 80,
    },
  ]

  return (
    <DataTable
      columns={columns}
      data={rows}
      globalFilter={search}
      onRowClick={onRowClick}
      rowClassName={(row) =>
        selectedBrandId && row.company.id === selectedBrandId
          ? 'bg-blue-50 dark:bg-blue-950/20'
          : undefined
      }
      emptyMessage="No brands found"
      emptyDescription="Try adjusting your search"
    />
  )
}

// Re-export types for components that import from Deals.tsx (legacy)
export type { ApiCompanyDetail as ApiCompany } from '@/lib/types'
export type { ApiDeal } from '@/lib/types'

// --- Main component ---

type DealsProps = {
  initialView?: ViewMode
  onOpenDeal: (id: string) => void
}

export function Deals({ initialView = 'table', onOpenDeal }: DealsProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [search, setSearch] = useState('')
  const [showCreateBrand, setShowCreateBrand] = useState(false)
  const [showCreateDeal, setShowCreateDeal] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>(initialView)
  const [selectedBrand, setSelectedBrand] = useState<ApiCompanyDetail | null>(null)
  const [editingBrand, setEditingBrand] = useState<ApiCompanyDetail | null>(null)
  const [deletingBrand, setDeletingBrand] = useState<ApiCompanyDetail | null>(null)
  const [editForm, setEditForm] = useState({ name: '', industry: '', domain: '', website: '', hqLocation: '' })
  const { isSales } = useUser()

  // Ctrl+F / Cmd+F focuses search bar (matches Pipeline behavior)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const qc = useQueryClient()

  const { data: companies = [], isLoading: loadingCompanies } = useGetCompanies()
  const { data: deals = [], isLoading: loadingDeals } = useGetDeals()
  const { data: users = [] } = useGetUsers()

  // Edit/delete mutations
  const updateCompany = useUpdateCompany({
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.companies.all })
      setEditingBrand(null)
    },
  })
  const deleteCompany = useDeleteCompany({
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.companies.all })
      qc.invalidateQueries({ queryKey: queryKeys.deals.all })
      setDeletingBrand(null)
    },
  })

  // Populate edit form when editingBrand changes
  useEffect(() => {
    if (editingBrand) {
      setEditForm({
        name: editingBrand.name ?? '',
        industry: editingBrand.industry ?? '',
        domain: editingBrand.domain ?? '',
        website: editingBrand.website ?? '',
        hqLocation: editingBrand.hqLocation ?? '',
      })
    }
  }, [editingBrand?.id])

  const isLoading = loadingCompanies || loadingDeals

  // Map userId → display name for Created By column
  const userNameMap = useMemo(() => {
    const m = new Map<string, string>()
    for (const u of users) if (u.name) m.set(u.id, u.name)
    return m
  }, [users])

  // Map userId → profile image URL
  const userImageMap = useMemo(() => {
    const m = new Map<string, string>()
    for (const u of users) if (u.image) m.set(u.id, u.image)
    return m
  }, [users])

  const companyMap = useMemo(() => {
    const m = new Map<string, ApiCompanyDetail>()
    for (const c of companies) m.set(c.id, c)
    return m
  }, [companies])

  const groups: BrandGroup[] = useMemo(() => {
    const dealsByCompany = new Map<string, ApiDeal[]>()
    for (const d of deals) {
      const key = d.companyId || '__unassigned__'
      const arr = dealsByCompany.get(key) || []
      arr.push(d)
      dealsByCompany.set(key, arr)
    }

    const result: BrandGroup[] = []

    // Add all companies (even those with no deals)
    for (const company of companies) {
      const cDeals = dealsByCompany.get(company.id) || []
      result.push({
        company,
        color: getBrandColor(company.name),
        deals: cDeals,
        totalValue: totalNumericValue(cDeals),
        activeCount: cDeals.filter(d => !CLOSED_STAGE_IDS.has(d.stage)).length,
      })
    }

    // Add "No Brand" group for deals without a company
    const unassignedDeals = dealsByCompany.get('__unassigned__')
    if (unassignedDeals && unassignedDeals.length > 0) {
      result.push({
        company: {
          id: '__unassigned__',
          name: 'No Brand',
          domain: null,
          industry: null,
          website: null,
          hqLocation: null,
          logoUrl: null,
          createdAt: '',
        },
        color: getBrandColor('No Brand'),
        deals: unassignedDeals,
        totalValue: totalNumericValue(unassignedDeals),
        activeCount: unassignedDeals.filter(d => !CLOSED_STAGE_IDS.has(d.stage)).length,
      })
    }

    return result.sort((a, b) => b.totalValue - a.totalValue)
  }, [deals, companyMap])

  // ── DataTable brand rows ─────────────────────────────────────────────────
  const brandTableRows = useMemo<BrandTableRow[]>(() => {
    return groups.map(g => {
      // Most recent lastActivityAt across all deals for this brand
      const activityDates = g.deals
        .map(d => d.lastActivityAt)
        .filter((v): v is string => !!v)
      const lastActivityAt = activityDates.length > 0
        ? activityDates.reduce((a, b) => a > b ? a : b)
        : null

      const seenStages = new Set<string>()
      const stageSummary: Array<{ id: string; label: string; bg: string; color: string }> = []
      for (const d of g.deals.filter(dd => !CLOSED_STAGE_IDS.has(dd.stage))) {
        if (!seenStages.has(d.stage)) {
          seenStages.add(d.stage)
          const stageColor = STAGE_COLORS[d.stage] || '#64748b'
          const label = STAGE_LABELS[d.stage] || d.stage
          stageSummary.push({ id: d.stage, label, bg: `${stageColor}18`, color: stageColor })
        }
      }

      return {
        company: g.company,
        color: g.color,
        dealCount: g.deals.length,
        stageSummary,
        documentCount: g.deals.reduce((sum, d) => sum + (d.documentCount ?? 0), 0),
        totalValue: g.totalValue,
        createdByName: g.company.createdBy ? (userNameMap.get(g.company.createdBy) ?? null) : null,
        createdByImage: g.company.createdBy ? (userImageMap.get(g.company.createdBy) ?? null) : null,
        lastActivityAt,
      }
    })
  }, [groups, userNameMap, userImageMap])

  const filteredTableRows = useMemo<BrandTableRow[]>(() => {
    if (!search.trim()) return brandTableRows
    const q = search.toLowerCase()
    return brandTableRows.filter(r =>
      r.company.name.toLowerCase().includes(q) ||
      (r.createdByName ?? '').toLowerCase().includes(q)
    )
  }, [brandTableRows, search])

  const totalDeals = deals.length
  const activePipeline = totalNumericValue(deals.filter(d => !CLOSED_STAGE_IDS.has(d.stage)))

  return (
    <>
      <BrandSlideOver
        brand={selectedBrand}
        onClose={() => setSelectedBrand(null)}
        onOpenDeal={(dealId) => {
          setSelectedBrand(null)
          onOpenDeal(dealId)
        }}
      />
      {showCreateBrand && (
        <CreateBrandModal
          onClose={() => setShowCreateBrand(false)}
          onCreated={() => {
            qc.invalidateQueries({ queryKey: ['companies'] })
            setShowCreateBrand(false)
          }}
        />
      )}
      {showCreateDeal && (
        <CreateDealModal
          companies={companies}
          onClose={() => setShowCreateDeal(false)}
          onCreated={() => {
            qc.invalidateQueries({ queryKey: ['deals'] })
            setShowCreateDeal(false)
          }}
        />
      )}

      {/* Edit Brand Modal */}
      {editingBrand && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-[2px] animate-in fade-in-0 duration-200"
          onClick={() => setEditingBrand(null)}
        >
          <div
            className="bg-white dark:bg-[#1e1e21] rounded-lg shadow-[0_8px_40px_rgba(0,0,0,0.18)] border border-black/[.06] dark:border-white/[.08] w-full max-w-[400px] mx-4 animate-in zoom-in-95 fade-in-0 duration-200"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-black/[.06] dark:border-white/[.08] flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-slate-900 dark:text-white">Edit Brand</div>
                <div className="text-xs text-slate-400 mt-0.5">Update brand details</div>
              </div>
              <button
                onClick={() => setEditingBrand(null)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[.06] transition-colors"
              >
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form
              onSubmit={e => {
                e.preventDefault()
                if (!editForm.name.trim()) return
                updateCompany.mutate({
                  id: editingBrand.id,
                  data: {
                    name: editForm.name.trim(),
                    industry: editForm.industry.trim() || null,
                    website: editForm.website.trim() || null,
                    hqLocation: editForm.hqLocation.trim() || null,
                    domain: editForm.domain.trim() || null,
                  },
                })
              }}
              className="p-4 flex flex-col gap-4"
            >
              <div className="flex flex-col gap-1.5">
                <label className="text-xxs font-medium text-slate-500 uppercase tracking-[0.05em]">
                  Brand Name <span className="text-red-400">*</span>
                </label>
                <Input
                  autoFocus
                  value={editForm.name}
                  onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
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
                    value={editForm.industry}
                    onValueChange={v => setEditForm(f => ({ ...f, industry: v }))}
                    placeholder="Search industry..."
                    allowCustom
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xxs font-medium text-slate-500 uppercase tracking-[0.05em]">Domain</label>
                  <Input
                    value={editForm.domain}
                    onChange={e => setEditForm(f => ({ ...f, domain: e.target.value }))}
                    placeholder="e.g. jollibee.com.ph"
                    className="h-9 text-ssm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xxs font-medium text-slate-500 uppercase tracking-[0.05em]">Website</label>
                  <Input
                    value={editForm.website}
                    onChange={e => setEditForm(f => ({ ...f, website: e.target.value }))}
                    placeholder="https://..."
                    className="h-9 text-ssm"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xxs font-medium text-slate-500 uppercase tracking-[0.05em]">HQ Location</label>
                  <Input
                    value={editForm.hqLocation}
                    onChange={e => setEditForm(f => ({ ...f, hqLocation: e.target.value }))}
                    placeholder="e.g. Manila, PH"
                    className="h-9 text-ssm"
                  />
                </div>
              </div>

              {updateCompany.error && (
                <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                  {updateCompany.error.message}
                </p>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setEditingBrand(null)}
                  className="flex-1 h-9 rounded-lg border border-black/[.08] dark:border-white/[.08] text-ssm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/[.04] dark:bg-white/[.03] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateCompany.isPending || !editForm.name.trim()}
                  className="flex-1 h-9 flex items-center justify-center gap-1.5 rounded-lg text-ssm font-medium text-white transition-colors disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, var(--primary), var(--color-primary-accent))' }}
                >
                  <>{updateCompany.isPending && <span className="inline-block w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />}Save Changes</>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Brand Confirmation Modal */}
      {deletingBrand && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm px-4 flex items-center justify-center animate-in fade-in-0 duration-200"
          onClick={() => setDeletingBrand(null)}
        >
          <div
            className="max-w-sm w-full rounded-xl border border-black/[.06] dark:border-white/[.08] bg-white dark:bg-[#1e1e21] shadow-2xl p-4 animate-in zoom-in-95 fade-in-0 duration-300"
            onClick={e => e.stopPropagation()}
          >
            <p className="text-sm font-semibold text-slate-900 dark:text-white">Delete brand?</p>
            <p className="text-ssm text-slate-600 dark:text-slate-400 leading-relaxed mt-1">
              This will permanently delete <strong>{deletingBrand.name}</strong>. Associated deals will become unassigned.
            </p>
            <div className="flex gap-2.5 mt-4">
              <button
                onClick={() => setDeletingBrand(null)}
                className="flex-1 h-8 rounded-lg text-xs font-semibold border border-black/[.08] dark:border-white/[.1] text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[.04] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteCompany.mutate(deletingBrand.id)}
                disabled={deleteCompany.isPending}
                className="flex-1 h-8 flex items-center justify-center gap-1.5 rounded-lg text-xs font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-60 transition-colors"
              >
                <>{deleteCompany.isPending && <span className="inline-block w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />}Delete</>
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="p-4 md:p-6 h-full flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4 shrink-0">
          <div>
            <div className="text-ssm font-semibold text-slate-900 dark:text-white">Brands</div>
            <div className="text-xxs text-slate-400 mt-0.5">
              {isLoading
                ? 'Loading…'
                : `${groups.length} brand${groups.length !== 1 ? 's' : ''} · ${totalDeals} deal${totalDeals !== 1 ? 's' : ''} · ${activePipeline > 0 ? formatDealValue(String(activePipeline)) + ' pipeline' : 'No pipeline value'}`
              }
            </div>
          </div>

          <div className="sm:ml-auto flex flex-wrap gap-2 items-center">
            {/* View toggle */}
            <div className="flex items-center bg-slate-100 dark:bg-white/[.06] rounded-lg p-0.5 gap-0.5">
              <button
                onClick={() => {
                  setViewMode('table')
                  const params = new URLSearchParams(searchParams.toString())
                  params.set('view', 'table')
                  router.replace(`/deals?${params.toString()}`, { scroll: false })
                }}
                className={`h-[26px] px-2.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${viewMode === 'table' ? 'bg-white dark:bg-[#1e1e21] text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-300'}`}
              >
                <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="3" y1="15" x2="21" y2="15" /><line x1="9" y1="9" x2="9" y2="21" />
                </svg>
                Table
              </button>
              <button
                onClick={() => {
                  setViewMode('graph')
                  const params = new URLSearchParams(searchParams.toString())
                  params.set('view', 'graph')
                  router.replace(`/deals?${params.toString()}`, { scroll: false })
                }}
                className={`h-[26px] px-2.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${viewMode === 'graph' ? 'bg-white dark:bg-[#1e1e21] text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-300'}`}
              >
                <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
                  <circle cx="5" cy="12" r="2" /><circle cx="19" cy="5" r="2" /><circle cx="19" cy="19" r="2" /><circle cx="12" cy="12" r="2" />
                  <line x1="7" y1="12" x2="10" y2="12" /><line x1="13.4" y1="10.6" x2="17" y2="6.9" /><line x1="13.4" y1="13.4" x2="17" y2="17.1" />
                </svg>
                Graph
              </button>
            </div>

            {/* Search */}
            <div className="relative flex-1 sm:flex-none sm:w-[200px] min-w-[140px]">
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" stroke="currentColor" strokeWidth={1.2} strokeLinecap="round">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <Input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search brands…"
                className="border border-black/[.06] dark:border-white/[.08] bg-slate-50 dark:bg-white/[.03] rounded-lg text-ssm text-slate-900 dark:text-white w-full placeholder:text-slate-400 focus:ring-0 focus-visible:ring-0 focus-visible:outline-none pl-8 pr-7 py-[5px] h-auto shadow-none"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* New Brand / New Deal */}
            {isSales && (
              <>
                <button
                  onClick={() => setShowCreateBrand(true)}
                  className="h-[30px] px-3 rounded-lg border border-black/[.08] dark:border-white/[.08] text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/[.04] dark:bg-white/[.03] transition-colors flex items-center gap-1.5"
                >
                  <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                  New Brand
                </button>

                {/* New Deal */}
                <button
                  onClick={() => setShowCreateDeal(true)}
                  className="h-[30px] px-3 rounded-lg text-xs font-medium text-white transition-colors flex items-center gap-1.5"
                  style={{ background: 'linear-gradient(135deg, var(--primary), var(--color-primary-accent))' }}
                >
                  <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                  New Deal
                </button>
              </>
            )}
          </div>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="w-6 h-6 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
              <p className="text-xs text-slate-400">Loading deals…</p>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && companies.length === 0 && (
          <div className="flex-1 flex items-center justify-center">
            <EmptyState
              title="No deals yet"
              description="Create a brand and add your first deal to start tracking your pipeline"
            />
          </div>
        )}

        {/* Table view */}
        {!isLoading && companies.length > 0 && viewMode === 'table' && (
          <div className="flex-1 overflow-y-auto bg-white dark:bg-[#1e1e21] border border-black/[.06] dark:border-white/[.08] rounded-lg shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
            <BrandsDataTable
              rows={filteredTableRows}
              onRowClick={(row) => setSelectedBrand(row.company)}
              search={search}
              selectedBrandId={selectedBrand?.id}
              onEditBrand={setEditingBrand}
              onDeleteBrand={setDeletingBrand}
            />
          </div>
        )}

        {/* Graph view */}
        {!isLoading && (companies.length > 0 || deals.length > 0) && viewMode === 'graph' && (
          <div className="-mx-4 md:mx-0 flex-1 rounded-lg overflow-hidden border border-black/[.06] dark:border-white/[.08]">
            <DealsGraph
              companies={companies}
              deals={deals}
              onOpenDeal={onOpenDeal}
              onOpenBrand={(companyId) => {
                const company = companyMap.get(companyId)
                if (company) setSelectedBrand(company)
              }}
              searchQuery={search}
            />
          </div>
        )}

      </div>
    </>
  )
}
