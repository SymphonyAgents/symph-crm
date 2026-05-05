'use client'

import { useCallback, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { Plus, Pencil, Trash2, ToggleLeft, ToggleRight } from 'lucide-react'
import { useGetInternalProducts } from '@/lib/hooks/queries'
import { useCreateInternalProduct, useUpdateInternalProduct, useDeleteInternalProduct } from '@/lib/hooks/mutations'
import { queryKeys } from '@/lib/query-keys'
import { cn } from '@/lib/utils'
import { INDUSTRY_OPTIONS } from '@/lib/constants'
import { DataTable, SortableHeader } from '@/components/ui/data-table'
import { Combobox } from '@/components/ui/combobox'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useEscapeKey } from '@/lib/hooks/use-escape-key'
import type { ApiInternalProduct } from '@/lib/types'

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function ProductsPage() {
  const qc = useQueryClient()
  const { data: products = [], isLoading } = useGetInternalProducts()
  const [editing, setEditing] = useState<ApiInternalProduct | null>(null)
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState<ApiInternalProduct | null>(null)

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
      accessorKey: 'name',
      header: ({ column }) => <SortableHeader column={column}>Name</SortableHeader>,
      cell: ({ row }) => (
        <span className="text-ssm font-medium text-slate-900 dark:text-white">{row.original.name}</span>
      ),
    },
    {
      accessorKey: 'industry',
      header: ({ column }) => <SortableHeader column={column}>Industry</SortableHeader>,
      cell: ({ row }) => (
        <span className="text-ssm text-slate-600 dark:text-slate-300">{row.original.industry || '—'}</span>
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
              onClick={(e) => {
                e.stopPropagation()
                setEditing(p)
              }}
              className="h-7 w-7 rounded-md flex items-center justify-center text-slate-500 hover:text-primary hover:bg-slate-100 dark:hover:bg-white/[.06] transition-colors"
              title="Edit"
            >
              <Pencil size={13} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                setDeleting(p)
              }}
              className="h-7 w-7 rounded-md flex items-center justify-center text-slate-500 hover:text-[#dc2626] hover:bg-slate-100 dark:hover:bg-white/[.06] transition-colors"
              title="Delete"
            >
              <Trash2 size={13} />
            </button>
          </div>
        )
      },
    },
  ], [updateProduct])

  return (
    <div className="p-4 md:px-6 pb-6 max-w-[1200px]">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-base font-semibold text-slate-900 dark:text-white">Products</h1>
          <p className="text-xxs text-slate-500 dark:text-slate-400 mt-0.5">Internal products available for deal assignment</p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-ssm font-medium text-white transition-colors active:scale-[0.98]"
          style={{ background: 'linear-gradient(135deg, var(--primary), var(--color-primary-accent))' }}
        >
          <Plus size={14} />
          Add Product
        </button>
      </div>

      <div className="bg-white dark:bg-[#1e1e21] border border-black/[.06] dark:border-white/[.08] rounded-md shadow-[var(--shadow-card)]">
        {isLoading ? (
          <ProductsTableSkeleton />
        ) : (
          <DataTable
            columns={columns}
            data={products}
            emptyMessage="No products yet"
            emptyDescription="Click Add Product to create one"
          />
        )}
      </div>

      {(creating || editing) && (
        <ProductFormModal
          product={editing}
          onClose={() => {
            setCreating(false)
            setEditing(null)
          }}
        />
      )}

      {deleting && (
        <ConfirmDeleteModal
          product={deleting}
          isPending={deleteProduct.isPending}
          onCancel={() => setDeleting(null)}
          onConfirm={() => deleteProduct.mutate(deleting.id)}
        />
      )}
    </div>
  )
}

// ─── Skeleton loader — Supabase-style: a few horizontal bars, no table chrome ─

function ProductsTableSkeleton() {
  return (
    <div className="p-4 space-y-2.5">
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-9 w-[88%]" />
      <Skeleton className="h-9 w-[55%]" />
    </div>
  )
}

// ─── Product form modal — matches CreateDealModal style ──────────────────────

function ProductFormModal({
  product,
  onClose,
}: {
  product: ApiInternalProduct | null
  onClose: () => void
}) {
  useEscapeKey(useCallback(onClose, [onClose]))

  const qc = useQueryClient()
  const [name, setName] = useState(product?.name ?? '')
  const [industry, setIndustry] = useState(product?.industry ?? '')

  const create = useCreateInternalProduct({
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.internalProducts.all })
      onClose()
    },
  })
  const update = useUpdateInternalProduct({
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.internalProducts.all })
      onClose()
    },
  })
  const isPending = create.isPending || update.isPending
  const error = create.error || update.error
  const canSubmit = !!name.trim()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    if (product) {
      update.mutate({ id: product.id, data: { name: trimmed, industry: industry || null } })
    } else {
      create.mutate({ name: trimmed, industry: industry || null })
    }
  }

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
            <div className="text-sm font-semibold text-slate-900 dark:text-white">{product ? 'Edit Product' : 'New Product'}</div>
            <div className="text-xs text-slate-400 mt-0.5">{product ? 'Update name or industry' : 'Add an internal product to your catalog'}</div>
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
            <label className="text-xxs font-medium text-slate-500 uppercase tracking-[0.05em]">Name</label>
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Product name"
              className="h-9 text-ssm"
            />
          </div>
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
              {product ? 'Save Changes' : 'Create Product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Confirm delete modal — matches CreateDealModal style ────────────────────

function ConfirmDeleteModal({
  product,
  isPending,
  onCancel,
  onConfirm,
}: {
  product: ApiInternalProduct
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
          <div className="text-sm font-semibold text-slate-900 dark:text-white">Delete Product</div>
        </div>
        <div className="p-4 flex flex-col gap-4">
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Delete <span className="font-medium text-slate-900 dark:text-white">{product.name}</span>? This cannot be undone.
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
