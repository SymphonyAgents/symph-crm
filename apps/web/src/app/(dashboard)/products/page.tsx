'use client'

import { useMemo, useState } from 'react'
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
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
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:opacity-90 transition-opacity active:scale-[0.98]"
        >
          <Plus size={14} />
          Add Product
        </button>
      </div>

      <div className="bg-white dark:bg-[#1e1e21] border border-black/[.06] dark:border-white/[.08] rounded-md shadow-[var(--shadow-card)]">
        {isLoading ? (
          <div className="p-12 text-center text-xxs text-slate-400">Loading...</div>
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
        <ProductFormDialog
          product={editing}
          onClose={() => {
            setCreating(false)
            setEditing(null)
          }}
        />
      )}

      {deleting && (
        <ConfirmDeleteDialog
          product={deleting}
          isPending={deleteProduct.isPending}
          onCancel={() => setDeleting(null)}
          onConfirm={() => deleteProduct.mutate(deleting.id)}
        />
      )}
    </div>
  )
}

function ProductFormDialog({
  product,
  onClose,
}: {
  product: ApiInternalProduct | null
  onClose: () => void
}) {
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
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="text-sm">{product ? 'Edit Product' : 'Add Product'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 pt-1">
          <div>
            <label className="block text-atom font-semibold uppercase tracking-[0.06em] text-slate-400 mb-1.5">Name</label>
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Product name"
              className="text-ssm"
            />
          </div>
          <div>
            <label className="block text-atom font-semibold uppercase tracking-[0.06em] text-slate-400 mb-1.5">Industry</label>
            <Combobox
              options={INDUSTRY_OPTIONS.map(i => ({ value: i, label: i }))}
              value={industry}
              onValueChange={setIndustry}
              placeholder="Search industry..."
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium border border-black/[.08] dark:border-white/[.08] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[.04] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || isPending}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:opacity-90 transition-opacity active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPending && <span className="inline-block w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              {product ? 'Save changes' : 'Create product'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ConfirmDeleteDialog({
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
  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="text-sm">Delete product</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-slate-600 dark:text-slate-400">
          Delete <span className="font-medium text-slate-900 dark:text-white">{product.name}</span>? This cannot be undone.
        </p>
        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onCancel}
            className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium border border-black/[.08] dark:border-white/[.08] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[.04] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#dc2626] text-white hover:bg-[#b91c1c] transition-colors active:scale-[0.98] disabled:opacity-50"
          >
            {isPending && <span className="inline-block w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            Delete
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
