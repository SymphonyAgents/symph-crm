'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { Pencil, Trash2, ToggleLeft, ToggleRight, ImageIcon, Upload, X } from 'lucide-react'
import { useGetCatalogItems } from '@/lib/hooks/queries'
import {
  useCreateCatalogItem,
  useUpdateCatalogItem,
  useDeleteCatalogItem,
  useUploadCatalogItemIcon,
} from '@/lib/hooks/mutations'
import { queryKeys } from '@/lib/query-keys'
import { cn } from '@/lib/utils'
import { STANDARD_INDUSTRY_OPTIONS } from '@/lib/constants'
import { DataTable, SortableHeader, DataTableSkeleton } from '@/components/ui/data-table'
import { Combobox } from '@/components/ui/combobox'
import { TabFilter, type TabFilterItem } from '@/components/ui/tab-filter'
import { Input } from '@/components/ui/input'
import { StatusPill } from '@/components/ui/status-pill'
import { useEscapeKey } from '@/lib/hooks/use-escape-key'
import type { ApiCatalogItem, ProductType } from '@/lib/types'

type TabId = ProductType | 'all'

const TABS: { id: TabId; label: string; addCta: string; emptyText: string }[] = [
  { id: 'all',         label: 'All',         addCta: '+ New',             emptyText: 'No catalog items yet' },
  { id: 'internal',    label: 'Products',    addCta: '+ New Product',     emptyText: 'No products yet' },
  { id: 'service',     label: 'Services',    addCta: '+ New Service',     emptyText: 'No services yet' },
  { id: 'reseller',    label: 'Resellers',   addCta: '+ New Reseller',    emptyText: 'No resellers yet' },
]

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ─── Icon thumbnail (16×16, default placeholder if missing) ──────────────────

function IconThumb({ src, size = 16, className }: { src?: string | null; size?: number; className?: string }) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        className={cn('rounded-sm object-contain', className)}
        style={{ width: size, height: size }}
      />
    )
  }
  return (
    <div
      className={cn(
        'rounded-sm bg-secondary flex items-center justify-center text-slate-400',
        className,
      )}
      style={{ width: size, height: size }}
    >
      <ImageIcon size={Math.floor(size * 0.7)} strokeWidth={1.5} />
    </div>
  )
}

export default function CatalogPage() {
  const qc = useQueryClient()
  const [tab, setTab] = useState<TabId>('all')
  const { data: items = [], isLoading } = useGetCatalogItems(tab === 'all' ? {} : { type: tab })
  const { data: allItems = [] } = useGetCatalogItems({})
  const [editing, setEditing] = useState<ApiCatalogItem | null>(null)
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState<ApiCatalogItem | null>(null)

  const tabMeta = TABS.find(t => t.id === tab)!
  const tabCounts = useMemo(() => {
    return allItems.reduce<Record<TabId, number>>((acc, item) => {
      if (item.productType === 'partnership') return acc
      acc.all += 1
      acc[item.productType] += 1
      return acc
    }, { all: 0, internal: 0, service: 0, reseller: 0, partnership: 0 })
  }, [allItems])
  const tabItems = useMemo<TabFilterItem<TabId>[]>(() => TABS.map(t => ({ id: t.id, label: t.label, count: tabCounts[t.id] })), [tabCounts])
  const activeCount = useMemo(() => allItems.filter(item => item.isActive && item.productType !== 'partnership').length, [allItems])

  const updateProduct = useUpdateCatalogItem({
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.catalogItems.all }),
  })
  const deleteProduct = useDeleteCatalogItem({
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.catalogItems.all })
      setDeleting(null)
    },
  })

  const columns = useMemo<ColumnDef<ApiCatalogItem>[]>(() => [
    {
      id: 'icon',
      header: '',
      size: 48,
      cell: ({ row }) => <IconThumb src={row.original.iconUrl} size={20} />,
    },
    {
      accessorKey: 'name',
      header: ({ column }) => <SortableHeader column={column}>Name</SortableHeader>,
      cell: ({ row }) => (
        <span className="text-ssm font-medium text-foreground">{row.original.name}</span>
      ),
    },
    ...(tab === 'internal' ? [{
      accessorKey: 'industry',
      header: ({ column }: any) => <SortableHeader column={column}>Industry</SortableHeader>,
      cell: ({ row }: any) => (
        <span className="text-ssm text-muted-foreground">{row.original.industry || '—'}</span>
      ),
    } as ColumnDef<ApiCatalogItem>] : []),
    {
      accessorKey: 'landingPageLink',
      header: 'Landing page',
      cell: ({ row }) => row.original.landingPageLink ? (
        <a
          href={row.original.landingPageLink}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="text-ssm text-primary hover:underline truncate inline-block max-w-[220px]"
        >
          {row.original.landingPageLink.replace(/^https?:\/\//, '')}
        </a>
      ) : (
        <span className="text-ssm text-slate-400">—</span>
      ),
    },
    {
      accessorKey: 'isActive',
      header: 'Status',
      cell: ({ row }) => {
        const active = row.original.isActive
        return <StatusPill tone={active ? 'emerald' : 'neutral'}>{active ? 'Active' : 'Inactive'}</StatusPill>
      },
    },
    {
      accessorKey: 'createdAt',
      header: ({ column }) => <SortableHeader column={column}>Created</SortableHeader>,
      cell: ({ row }) => (
        <span className="text-ssm text-muted-foreground tabular-nums">{formatDate(row.original.createdAt)}</span>
      ),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const p = row.original
        return (
          <div className="flex items-center gap-1 justify-end">
            <button
              onClick={(e) => {
                e.stopPropagation()
                updateProduct.mutate({ id: p.id, data: { isActive: !p.isActive } })
              }}
              className="h-7 w-7 rounded-md flex items-center justify-center text-slate-500 hover:text-primary hover:bg-surface-hover transition-colors"
              title={p.isActive ? 'Deactivate' : 'Activate'}
            >
              {p.isActive ? <ToggleRight size={15} /> : <ToggleLeft size={15} />}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setEditing(p) }}
              className="h-7 w-7 rounded-md flex items-center justify-center text-slate-500 hover:text-primary hover:bg-surface-hover transition-colors"
              title="Edit"
            >
              <Pencil size={13} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setDeleting(p) }}
              className="h-7 w-7 rounded-md flex items-center justify-center text-slate-500 hover:text-[#dc2626] hover:bg-surface-hover transition-colors"
              title="Delete"
            >
              <Trash2 size={13} />
            </button>
          </div>
        )
      },
    },
  ], [updateProduct, tab])

  return (
    <div className="p-4 md:px-6 pb-6 w-full">
      <div className="mb-4 flex flex-col gap-1">
        <div className="text-ssm font-semibold text-foreground">Catalog</div>
        <div className="text-xxs text-slate-400 tabular-nums">
          {allItems.length} item{allItems.length !== 1 ? 's' : ''} · {activeCount} active · Products, services, and resellers used across deals
        </div>
      </div>

      <div className="mb-4 flex items-center justify-between gap-3">
        <TabFilter items={tabItems} value={tab} onChange={setTab} />
        {tab !== 'all' && (
          <button
            onClick={() => setCreating(true)}
            className="rounded-lg px-3 py-[5px] text-xs font-medium text-white transition-colors flex items-center gap-1.5"
            style={{ background: 'linear-gradient(135deg, var(--primary), var(--color-primary-accent))' }}
          >
            {tabMeta.addCta}
          </button>
        )}
      </div>

      <div className="bg-card border border-border rounded-md shadow-[var(--shadow-card)]">
        {isLoading ? (
          <DataTableSkeleton />
        ) : (
          <DataTable
            columns={columns}
            data={items}
            emptyMessage={tabMeta.emptyText}
            emptyDescription="Click + to create one"
          />
        )}
      </div>

      {(creating || editing) && (
        <CatalogItemFormModal
          item={editing}
          defaultType={tab === 'all' ? 'internal' : tab}
          onClose={() => { setCreating(false); setEditing(null) }}
        />
      )}

      {deleting && (
        <ConfirmDeleteModal
          item={deleting}
          isPending={deleteProduct.isPending}
          onCancel={() => setDeleting(null)}
          onConfirm={() => deleteProduct.mutate(deleting.id)}
        />
      )}
    </div>
  )
}

// ─── Form modal ───────────────────────────────────────────────────────────────

function CatalogItemFormModal({
  item,
  defaultType,
  onClose,
}: {
  item: ApiCatalogItem | null
  defaultType: ProductType
  onClose: () => void
}) {
  useEscapeKey(useCallback(onClose, [onClose]))
  const qc = useQueryClient()

  const [name, setName] = useState(item?.name ?? '')
  const [productType] = useState<ProductType>(item?.productType ?? defaultType)
  const [industry, setIndustry] = useState(item?.industry ?? '')
  const [landingPageLink, setLandingPageLink] = useState(item?.landingPageLink ?? '')
  const [iconFile, setIconFile] = useState<File | null>(null)
  const [iconPreview, setIconPreview] = useState<string | null>(item?.iconUrl ?? null)
  const [removeIcon, setRemoveIcon] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const create = useCreateCatalogItem({})
  const update = useUpdateCatalogItem({})
  const uploadIcon = useUploadCatalogItemIcon({})
  const isPending = create.isPending || update.isPending || uploadIcon.isPending
  const error = create.error || update.error || uploadIcon.error
  const canSubmit = !!name.trim()

  const typeLabel = TABS.find(t => t.id === productType)?.label.replace(/s$/, '') ?? 'Item'

  function handleFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setIconFile(f)
    setIconPreview(URL.createObjectURL(f))
    setRemoveIcon(false)
  }

  function handleRemoveIcon() {
    setIconFile(null)
    setIconPreview(null)
    setRemoveIcon(true)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return

    const payload = {
      productType,
      name: trimmed,
      industry: productType === 'internal' ? (industry || null) : null,
      landingPageLink: landingPageLink.trim() || null,
    }

    let savedId = item?.id
    if (item) {
      const updatePayload = removeIcon ? { ...payload, iconUrl: null } : payload
      await update.mutateAsync({ id: item.id, data: updatePayload })
    } else {
      const created = await create.mutateAsync(payload)
      savedId = created.id
    }

    if (savedId && iconFile) {
      await uploadIcon.mutateAsync({ id: savedId, file: iconFile })
    }
    qc.invalidateQueries({ queryKey: queryKeys.catalogItems.all })
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-[2px] animate-in fade-in-0 duration-200"
      onClick={onClose}
    >
      <div
        className="bg-card rounded-lg shadow-[0_8px_40px_rgba(0,0,0,0.18)] border border-border w-full max-w-[460px] mx-4 animate-in zoom-in-95 fade-in-0 duration-200"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-card rounded-t-lg">
          <div>
            <div className="text-sm font-semibold text-foreground">
              {item ? `Edit ${typeLabel}` : `New ${typeLabel}`}
            </div>
            <div className="text-xs text-slate-400 mt-0.5">
              {item ? 'Update details' : `Add a new ${typeLabel.toLowerCase()} to the catalog`}
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:bg-surface-hover transition-colors"
          >
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-4">
          {/* Icon */}
          <div className="flex flex-col gap-1.5">
            <label className="eyebrow-label">
              Icon <span className="text-slate-400">(optional, up to 512KB)</span>
            </label>
            <div className="flex items-center gap-3">
              <IconThumb src={iconPreview} size={40} />
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif"
                onChange={handleFilePick}
                className="hidden"
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md text-ssm font-medium border border-border text-muted-foreground hover:bg-surface-hover transition-colors"
                >
                  <Upload size={13} />
                  {iconPreview ? 'Replace icon' : 'Upload icon'}
                </button>
                {iconPreview && (
                  <button
                    type="button"
                    onClick={handleRemoveIcon}
                    className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md text-ssm font-medium border border-border text-[#dc2626] hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                  >
                    <X size={13} />
                    Remove icon
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="eyebrow-label">Name</label>
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={`${typeLabel} name`}
              className="h-9 text-ssm"
            />
          </div>

          {productType === 'internal' && (
            <div className="flex flex-col gap-1.5">
              <label className="eyebrow-label">
                Industry <span className="text-slate-400">(optional)</span>
              </label>
              <Combobox
                options={STANDARD_INDUSTRY_OPTIONS}
                value={industry}
                onValueChange={setIndustry}
                placeholder="Search industry..."
              />
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="eyebrow-label">
              Landing page <span className="text-slate-400">(optional)</span>
            </label>
            <Input
              value={landingPageLink}
              onChange={(e) => setLandingPageLink(e.target.value)}
              placeholder="https://..."
              className="h-9 text-ssm"
            />
          </div>

          {error && (
            <p className="text-xs text-red-500 bg-red-50 dark:bg-red-500/[.08] border border-red-100 dark:border-red-500/20 rounded-lg px-3 py-2">
              {error.message}
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-9 rounded-lg border border-border text-ssm font-medium text-muted-foreground hover:bg-surface-hover transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending || !canSubmit}
              className="flex-1 h-9 flex items-center justify-center gap-1.5 rounded-lg text-ssm font-medium text-white transition-colors disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, var(--primary), var(--color-primary-accent))' }}
            >
              {isPending && <span className="inline-block w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              {item ? 'Save Changes' : `Create ${typeLabel}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ConfirmDeleteModal({
  item,
  isPending,
  onCancel,
  onConfirm,
}: {
  item: ApiCatalogItem
  isPending: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  useEscapeKey(useCallback(onCancel, [onCancel]))
  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-[2px] animate-in fade-in-0 duration-200"
      onClick={onCancel}
    >
      <div
        className="bg-card rounded-lg shadow-[0_8px_40px_rgba(0,0,0,0.18)] border border-border w-full max-w-[400px] mx-4 animate-in zoom-in-95 fade-in-0 duration-200"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-border">
          <div className="text-sm font-semibold text-foreground">Delete catalog item</div>
        </div>
        <div className="p-4 flex flex-col gap-4">
          <p className="text-xs text-muted-foreground">
            Delete <span className="font-medium text-foreground">{item.name}</span>? This cannot be undone.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 h-9 rounded-lg border border-border text-ssm font-medium text-muted-foreground hover:bg-surface-hover transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={isPending}
              className="flex-1 h-9 flex items-center justify-center gap-1.5 rounded-lg text-ssm font-medium text-white bg-[#dc2626] hover:bg-[#b91c1c] transition-colors active:scale-[0.98] disabled:opacity-50"
            >
              {isPending && <span className="inline-block w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
