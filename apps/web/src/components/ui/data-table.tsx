'use client'

import {
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { useState } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './table'
import { Skeleton } from './skeleton'
import { cn } from '@/lib/utils'
import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react'

// ── DataTable skeleton ──────────────────────────────────────────────────────
//
// Use this anywhere a DataTable would render but data is still loading.
// Three horizontal bars at descending widths — Supabase-style. Single render,
// no staircase, no layout shift with the real table because it's rendered in
// the parent surface, not inside the table itself.

export function DataTableSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('p-4 space-y-2.5', className)}>
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-9 w-[88%]" />
      <Skeleton className="h-9 w-[55%]" />
    </div>
  )
}

// ── Sort header helper ──────────────────────────────────────────────────────

export function SortableHeader({
  column,
  children,
}: {
  column: { getIsSorted: () => false | 'asc' | 'desc'; toggleSorting: (desc?: boolean) => void }
  children: React.ReactNode
}) {
  const sorted = column.getIsSorted()
  return (
    <button
      type="button"
      className="-ml-1 flex items-center gap-1 rounded-control px-1 py-0.5 transition-colors hover:text-foreground"
      onClick={() => column.toggleSorting(sorted === 'asc')}
    >
      {children}
      {sorted === 'asc' ? (
        <ArrowUp size={12} />
      ) : sorted === 'desc' ? (
        <ArrowDown size={12} />
      ) : (
        <ArrowUpDown size={12} className="opacity-40" />
      )}
    </button>
  )
}

// ── DataTable ───────────────────────────────────────────────────────────────

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  /** Global filter value (searches all columns) */
  globalFilter?: string
  /** Placeholder shown when table is empty */
  emptyMessage?: string
  emptyDescription?: string
  /** Called when a row is clicked */
  onRowClick?: (row: TData) => void
  /** Optional callback to add extra class names to a row */
  rowClassName?: (row: TData) => string | undefined
}

export function DataTable<TData, TValue>({
  columns,
  data,
  globalFilter,
  emptyMessage = 'No results found',
  emptyDescription,
  onRowClick,
  rowClassName,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnFilters, globalFilter },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  return (
    <Table>
      <TableHeader>
        {table.getHeaderGroups().map(headerGroup => (
          <TableRow key={headerGroup.id} className="hover:bg-transparent">
            {headerGroup.headers.map(header => (
              <TableHead key={header.id} style={{ width: header.getSize() !== 150 ? header.getSize() : undefined }}>
                {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
              </TableHead>
            ))}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {table.getRowModel().rows.length === 0 ? (
          <TableRow>
            <TableCell colSpan={columns.length} className="h-32 text-center">
              <div className="text-ssm text-muted-foreground">{emptyMessage}</div>
              {emptyDescription && (
                <div className="mt-1 text-xxs text-text-faint">{emptyDescription}</div>
              )}
            </TableCell>
          </TableRow>
        ) : (
          table.getRowModel().rows.map(row => (
            <TableRow
              key={row.id}
              className={cn(
                'hover:bg-surface-hover transition-colors',
                onRowClick && 'cursor-pointer',
                rowClassName?.(row.original),
              )}
              onClick={onRowClick ? () => onRowClick(row.original) : undefined}
            >
              {row.getVisibleCells().map(cell => (
                <TableCell key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  )
}
