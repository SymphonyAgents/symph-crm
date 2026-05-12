'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { Pencil, Trash2, ToggleLeft, ToggleRight, ImageIcon, Upload, X } from 'lucide-react'
import { useGetInternalProducts } from '@/lib/hooks/queries'
import {
  useCreateInternalProduct,
  useUpdateInternalProduct,
  useDeleteInternalProduct,
  useUploadInternalProductIcon,
} from '@/lib/hooks/mutations'
import { queryKeys } from '@/lib/query-keys'
import { cn } from '@/lib/utils'
import { INDUSTRY_OPTIONS } from '@/lib/constants'
import { DataTable, SortableHeader, DataTableSkeleton } from '@/components/ui/data-table'
import { Combobox } from '@/components/ui/combobox'
import { Input } from '@/components/ui/input'
import { useEscapeKey } from '@/lib/hooks/use-escape-key'
import type { ApiInternalProduct, ProductType } from '@/lib/types'

const TABS: { id: ProductType; label: string; addCta: string; emptyText: string }[] = [
  { id: 'internal', label: 'Products', addCta: '+ New Product', emptyText: 'No products yet' },
  { id: 'service', label: 'Services', addCta: '+ New Service', emptyText: 'No services yet' },
  { id: 'reseller', label: 'Resellers', addCta: '+ New Reseller', emptyText: 'No resellers yet' },
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
        'rounded-sm bg-slate-100 dark:bg-white/[.06] flex items-center justify-center text-slate-400',
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
  const [tab, setTab] = useState<ProductType>('internal')
  const { data: items = [], isLoading } = useGetInternalProducts({ type: tab })
  const [editing, setEditing] = useState<ApiInternalProduct | null>(null)
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState<ApiInternalProduct | null>(null)

  const tabMeta = TABS.find(t => t.id === tab)!

  const updateProduct = useUpdateInternalProduct({
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.internalProducts.all }),
  })
  const deleteProduct = useDeleteInternalProduct({
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.internalProducts.all })
      setDeleting(null)
    },
  })

  const columns = useMemo<ColumnDef<ApiInternalProduct>[]>(() => [
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
        <span className="text-ssm font-medium text-slate-900 dark:text-white">{row.original.name}</span>
      ),
    },
    ...(tab === 'internal' ? [{
      accessorKey: 'industry',
      header: ({ column }: any) => <SortableHeader column={column}>Industry</SortableHeader>,
      cell: ({ row }: any) => (
        <span className="text-ssm text-slate-600 dark:text-slate-300">{row.original.industry || '—'}</span>
      ),
    } as ColumnDef<ApiInternalProduct>] : []),
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
        return (
          <span className={cn(
            'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xxs font-medium',
            active
              ? 'bg-[rgba(22,163,74,0.08)] text-[#16a34a]'
              : 'bg-slate-100 dark:bg-white/[.06] text-slate-500 dark:text-slate-400',
          )}>
            <span className={cn('w-1.5 h-1.5 rounded-full', active ? 'bg-[#16a34a]' : 'bg-slate-400')} />
            {active ? 'Active' : 'Inactive'}
          </span>
        )
      },
    },
    {
      accessorKey: 'createdAt',
      header: ({ column }) => <SortableHeader column={column}>Created</SortableHeader>,
      cell: ({ row }) => (
        <span className="text-ssm text-slate-500 dark:text-slate-400 tabular-nums">{formatDate(row.original.createdAt)}</span>
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
              className="h-7 w-7 rounded-md flex items-center justify-center text-slate-500 hover:text-primary hover:bg-slate-100 dark:hover:bg-white/[.06] transition-colors"
              title={p.isActive ? 'Deactivate' : 'Activate'}
            >
              {p.isActive ? <ToggleRight size={15} /> : <ToggleLeft size={15} />}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setEditing(p) }}
              className="h-7 w-7 rounded-md flex items-center justify-center text-slate-500 hover:text-primary hover:bg-slate-100 dark:hover:bg-white/[.06] transition-colors"
              title="Edit"
            >
              <Pencil size={13} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setDeleting(p) }}
              className="h-7 w-7 rounded-md flex items-center justify-center text-slate-500 hover:text-[#dc2626] hover:bg-slate-100 dark:hover:bg-white/[.06] transition-colors"
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
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-base font-semibold text-slate-900 dark:text-white">Catalog</h1>
          <p className="text-xxs text-slate-500 dark:text-slate-400 mt-0.5">
            Manage internal products, service offerings, and reseller partners
          </p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="rounded-lg px-3 py-[5px] text-xs font-medium text-white transition-colors flex items-center gap-1.5"
          style={{ background: 'linear-gradient(135deg, var(--primary), var(--color-primary-accent))' }}
        >
          {tabMeta.addCta}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-4 border-b border-black/[.06] dark:border-white/[.08]">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'px-3 py-2 text-ssm font-medium border-b-2 -mb-px transition-colors',
              tab === t.id
                ? 'border-primary text-primary'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="bg-white dark:bg-[#1e1e21] border border-black/[.06] dark:border-white/[.08] rounded-md shadow-[var(--shadow-card)]">
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
          defaultType={tab}
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
  item: ApiInternalProduct | null
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

  const create = useCreateInternalProduct({})
  const update = useUpdateInternalProduct({})
  const uploadIcon = useUploadInternalProductIcon({})
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
    qc.invalidateQueries({ queryKey: queryKeys.internalProducts.all })
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-[2px] animate-in fade-in-0 duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-[#1e1e21] rounded-lg shadow-[0_8px_40px_rgba(0,0,0,0.18)] border border-black/[.06] dark:border-white/[.08] w-full max-w-[460px] mx-4 animate-in zoom-in-95 fade-in-0 duration-200"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-black/[.06] dark:border-white/[.08] flex items-center justify-between bg-white dark:bg-[#1e1e21] rounded-t-lg">
          <div>
            <div className="text-sm font-semibold text-slate-900 dark:text-white">
              {item ? `Edit ${typeLabel}` : `New ${typeLabel}`}
            </div>
            <div className="text-xs text-slate-400 mt-0.5">
              {item ? 'Update details' : `Add a new ${typeLabel.toLowerCase()} to the catalog`}
            </div>
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

        <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-4">
          {/* Icon */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xxs font-medium text-slate-500 uppercase tracking-[0.05em]">
              Icon <span className="text-slate-400">(optional, up to 512KB)</span>
            </label>
            <div className="flex items-center gap-3">
              <div className="relative">
                <IconThumb src={iconPreview} size={40} />
                {iconPreview && (
                  <button
                    type="button"
                    onClick={handleRemoveIcon}
                    title="Remove icon"
                    className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-slate-200 dark:bg-white/[.12] flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-red-100 dark:hover:bg-red-500/20 hover:text-red-500 transition-colors"
                  >
                    <X size={9} strokeWidth={2.5} />
                  </button>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif"
                onChange={handleFilePick}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md text-ssm font-medium border border-black/[.08] dark:border-white/[.08] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[.04] transition-colors"
              >
                <Upload size={13} />
                {iconPreview ? 'Replace icon' : 'Upload icon'}
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xxs font-medium text-slate-500 uppercase tracking-[0.05em]">Name</label>
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
              <label className="text-xxs font-medium text-slate-500 uppercase tracking-[0.05em]">
                Industry <span className="text-slate-400">(optional)</span>
              </label>
              <Combobox
                options={INDUSTRY_OPTIONS.map(i => ({ value: i, label: i }))}
                value={industry}
                onValueChange={setIndustry}
                placeholder="Search industry..."
              />
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-xxs font-medium text-slate-500 uppercase tracking-[0.05em]">
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
  item: ApiInternalProduct
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
        className="bg-white dark:bg-[#1e1e21] rounded-lg shadow-[0_8px_40px_rgba(0,0,0,0.18)] border border-black/[.06] dark:border-white/[.08] w-full max-w-[400px] mx-4 animate-in zoom-in-95 fade-in-0 duration-200"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-black/[.06] dark:border-white/[.08]">
          <div className="text-sm font-semibold text-slate-900 dark:text-white">Delete catalog item</div>
        </div>
        <div className="p-4 flex flex-col gap-4">
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Delete <span className="font-medium text-slate-900 dark:text-white">{item.name}</span>? This cannot be undone.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 h-9 rounded-lg border border-black/[.08] dark:border-white/[.08] text-ssm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/[.04] dark:bg-white/[.03] transition-colors"
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
