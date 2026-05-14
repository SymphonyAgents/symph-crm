'use client'

import { useState, useMemo } from 'react'
import { useGetAuditLogs, useGetUsers } from '@/lib/hooks/queries'
import { type ColumnDef } from '@tanstack/react-table'
import { DataTable, SortableHeader, DataTableSkeleton } from './ui/data-table'
import { Avatar } from './Avatar'
import { Search, ChevronLeft, ChevronRight, X, Sparkles } from 'lucide-react'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from './ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from './ui/dialog'
import { formatFullDate, describeAuditDetails, userDisplayName } from '@/lib/utils'
import { AUDIT_ACTION_CONFIG, ENTITY_LABEL, AUDIT_PAGE_SIZE } from '@/lib/constants'
import { CHANGELOG_OPEN_EVENT } from '@/lib/changelog-config'
import type { AuditLogEntry, AuditLogsResponse, ApiUser } from '@/lib/types'

// ── Column definitions ──────────────────────────────────────────────────────

const columns: ColumnDef<AuditLogEntry>[] = [
  {
    accessorKey: 'createdAt',
    header: ({ column }) => <SortableHeader column={column}>When</SortableHeader>,
    size: 160,
    cell: ({ row }) => (
      <span
        className="text-xs text-slate-600 dark:text-slate-400 tabular-nums"
        title={formatFullDate(row.original.createdAt)}
      >
        {formatFullDate(row.original.createdAt)}
      </span>
    ),
  },
  {
    accessorKey: 'action',
    header: ({ column }) => <SortableHeader column={column}>Event</SortableHeader>,
    size: 180,
    cell: ({ row }) => {
      const entry = row.original
      const cfg = AUDIT_ACTION_CONFIG[entry.action] ?? AUDIT_ACTION_CONFIG.update
      const details = describeAuditDetails(entry)
      return (
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-1.5">
            <span
              className="inline-flex items-center gap-1 font-medium px-1.5 py-px rounded-full text-xxs"
              style={{ background: cfg.bg, color: cfg.color }}
            >
              <span className="text-xxs leading-none">{cfg.icon}</span>
              {cfg.label}
            </span>
          </div>
          {details && (
            <span className="text-xxs text-slate-400 truncate max-w-[200px]">{details}</span>
          )}
        </div>
      )
    },
    filterFn: (row, _columnId, filterValue) => {
      if (!filterValue || filterValue === 'all') return true
      return row.original.action === filterValue
    },
  },
  {
    accessorKey: 'entityType',
    header: ({ column }) => <SortableHeader column={column}>On</SortableHeader>,
    size: 120,
    cell: ({ row }) => {
      const entry = row.original
      const entityLabel = ENTITY_LABEL[entry.entityType] ?? entry.entityType
      return (
        <div className="flex flex-col">
          <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{entityLabel}</span>
          {entry.entityName && (
            <span className="text-xxs text-slate-500 dark:text-slate-400 truncate max-w-[140px]">{entry.entityName}</span>
          )}
          {!entry.entityName && entry.entityId && (
            <span className="text-xxs text-slate-400 font-mono">#{entry.entityId.slice(0, 8)}</span>
          )}
        </div>
      )
    },
    filterFn: (row, _columnId, filterValue) => {
      if (!filterValue || filterValue === 'all') return true
      return row.original.entityType === filterValue
    },
  },
  {
    accessorKey: 'performerName',
    header: ({ column }) => <SortableHeader column={column}>By</SortableHeader>,
    size: 180,
    cell: ({ row }) => {
      const entry = row.original
      return (
        <div className="flex items-center gap-2">
          <Avatar name={entry.performerName || 'System'} src={entry.performerImage ?? undefined} size={24} />
          <span className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">
            {entry.performerName || 'System'}
          </span>
        </div>
      )
    },
  },
  {
    accessorKey: 'source',
    header: 'Via',
    size: 80,
    cell: ({ row }) => {
      const source = row.original.source
      if (!source) return <span className="text-xxs text-slate-300 dark:text-white/20">—</span>
      return (
        <span className="inline-block px-1.5 py-px rounded text-xxs font-medium bg-slate-100 dark:bg-white/[.06] text-slate-500 dark:text-slate-400 uppercase tracking-wide">
          {source}
        </span>
      )
    },
  },
]

export function AuditLogs() {
  return (
    <div className="p-4 md:p-6 h-full flex flex-col overflow-hidden">
      <AuditTab />
    </div>
  )
}

// ── Audit tab (existing implementation) ──────────────────────────────────────

function AuditTab() {
  const [search, setSearch] = useState('')
  const [entityFilter, setEntityFilter] = useState<string>('all')
  const [actionFilter, setActionFilter] = useState<string>('all')
  const [userFilter, setUserFilter] = useState<string>('all')
  const [page, setPage] = useState(0)
  const [selectedEntry, setSelectedEntry] = useState<AuditLogEntry | null>(null)

  const auditParams = {
    entityType: entityFilter !== 'all' ? entityFilter : undefined,
    action: actionFilter !== 'all' ? actionFilter : undefined,
    performedBy: userFilter !== 'all' ? userFilter : undefined,
    limit: AUDIT_PAGE_SIZE,
    offset: page * AUDIT_PAGE_SIZE,
  }
  const { data, isLoading } = useGetAuditLogs(auditParams)
  const { data: users = [] } = useGetUsers({ staleTime: 5 * 60 * 1000 })

  const rows = data?.rows ?? []
  const total = data?.total ?? 0
  const totalPages = Math.ceil(total / AUDIT_PAGE_SIZE)

  // Client-side search filter (on top of server filters)
  const filtered = useMemo(() => {
    if (!search.trim()) return rows
    const q = search.toLowerCase()
    return rows.filter(r =>
      (r.performerName || '').toLowerCase().includes(q) ||
      r.entityType.toLowerCase().includes(q) ||
      r.action.toLowerCase().includes(q) ||
      (r.entityId || '').toLowerCase().includes(q) ||
      describeAuditDetails(r).toLowerCase().includes(q)
    )
  }, [rows, search])

  const resetPage = () => setPage(0)

  function openChangeLog() {
    window.dispatchEvent(new Event(CHANGELOG_OPEN_EVENT))
  }

  return (
    <>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4 shrink-0">
        <div>
          <div className="text-ssm font-semibold text-slate-900 dark:text-white">Audit Log</div>
          <div className="text-xxs text-slate-400 mt-0.5">
            {isLoading ? 'Loading...' : `${total} event${total !== 1 ? 's' : ''}`}
          </div>
        </div>

        <div className="sm:ml-auto flex flex-wrap gap-2 items-center">
          <button
            type="button"
            onClick={openChangeLog}
            className="h-8 px-3 rounded-lg inline-flex items-center gap-1.5 text-xs font-semibold bg-[rgba(108,99,255,0.10)] text-primary hover:bg-[rgba(108,99,255,0.16)] dark:bg-[rgba(108,99,255,0.16)] dark:hover:bg-[rgba(108,99,255,0.22)] transition-colors"
          >
            <Sparkles size={13} />
            View change logs
          </button>

          {/* Search */}
          <div className="relative flex-1 sm:flex-none sm:w-[200px] min-w-[140px]">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search logs..."
              className="w-full bg-slate-50 dark:bg-white/[.03] border border-black/[.06] dark:border-white/[.08] rounded-lg pl-8 pr-7 py-[5px] text-xs text-slate-900 dark:text-white placeholder:text-slate-400 outline-none"
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

          {/* Entity type filter */}
          <Select
            value={entityFilter}
            onValueChange={v => { setEntityFilter(v); resetPage() }}
          >
            <SelectTrigger size="sm" className="w-[130px] text-xs">
              <SelectValue placeholder="All entities" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All entities</SelectItem>
              {Object.entries(ENTITY_LABEL).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Action filter */}
          <Select
            value={actionFilter}
            onValueChange={v => { setActionFilter(v); resetPage() }}
          >
            <SelectTrigger size="sm" className="w-[120px] text-xs">
              <SelectValue placeholder="All actions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All actions</SelectItem>
              {Object.entries(AUDIT_ACTION_CONFIG).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* User filter */}
          <Select
            value={userFilter}
            onValueChange={v => { setUserFilter(v); resetPage() }}
          >
            <SelectTrigger size="sm" className="w-[140px] text-xs">
              <SelectValue placeholder="All users" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All users</SelectItem>
              {users.map(u => (
                <SelectItem key={u.id} value={u.id}>{userDisplayName(u)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* DataTable */}
      <div className="flex-1 overflow-y-auto bg-white dark:bg-[#1e1e21] border border-black/[.06] dark:border-white/[.08] rounded-lg shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
        {isLoading ? (
          <DataTableSkeleton />
        ) : (
          <DataTable
            columns={columns}
            data={filtered}
            globalFilter={search}
            onRowClick={(entry) => setSelectedEntry(entry)}
            emptyMessage="No audit events found"
            emptyDescription={
              search || entityFilter !== 'all' || actionFilter !== 'all' || userFilter !== 'all'
                ? 'Try adjusting your filters'
                : 'Events will appear here as actions are performed'
            }
          />
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-3 shrink-0">
          <span className="text-xxs text-slate-400">
            Page {page + 1} of {totalPages} ({total} total)
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="h-7 w-7 rounded-lg border border-black/[.08] dark:border-white/[.08] flex items-center justify-center text-slate-500 hover:bg-slate-50 dark:hover:bg-white/[.04] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="h-7 w-7 rounded-lg border border-black/[.08] dark:border-white/[.08] flex items-center justify-center text-slate-500 hover:bg-slate-50 dark:hover:bg-white/[.04] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* ── Audit Detail Modal ──────────────────────────────────────────── */}
      <Dialog open={!!selectedEntry} onOpenChange={(open) => { if (!open) setSelectedEntry(null) }}>
        <DialogContent className="max-w-lg">
          {selectedEntry && (() => {
            const cfg = AUDIT_ACTION_CONFIG[selectedEntry.action] ?? AUDIT_ACTION_CONFIG.update
            const entityLabel = ENTITY_LABEL[selectedEntry.entityType] ?? selectedEntry.entityType
            return (
              <>
                <DialogHeader>
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-flex items-center gap-1 font-medium px-2 py-0.5 rounded-full text-xs"
                      style={{ background: cfg.bg, color: cfg.color }}
                    >
                      <span className="text-xs leading-none">{cfg.icon}</span>
                      {cfg.label}
                    </span>
                    <DialogTitle className="text-sm">
                      {selectedEntry.auditType?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                    </DialogTitle>
                  </div>
                  <DialogDescription className="sr-only">Audit event details</DialogDescription>
                </DialogHeader>

                <div className="px-6 py-4 space-y-3 text-xs">
                  {/* When */}
                  <div className="flex items-start gap-3">
                    <span className="w-12 shrink-0 font-medium text-slate-400 uppercase tracking-wide text-xxs pt-0.5">When</span>
                    <span className="text-slate-700 dark:text-slate-300 tabular-nums">{formatFullDate(selectedEntry.createdAt)}</span>
                  </div>

                  {/* On */}
                  <div className="flex items-start gap-3">
                    <span className="w-12 shrink-0 font-medium text-slate-400 uppercase tracking-wide text-xxs pt-0.5">On</span>
                    <div className="flex flex-col">
                      <span className="font-medium text-slate-700 dark:text-slate-300">
                        {entityLabel}
                        {selectedEntry.entityName && <> &mdash; &ldquo;{selectedEntry.entityName}&rdquo;</>}
                      </span>
                      {selectedEntry.entityId && (
                        <span className="text-xxs text-slate-400 font-mono">#{selectedEntry.entityId.slice(0, 8)}</span>
                      )}
                    </div>
                  </div>

                  {/* By */}
                  <div className="flex items-start gap-3">
                    <span className="w-12 shrink-0 font-medium text-slate-400 uppercase tracking-wide text-xxs pt-0.5">By</span>
                    <div className="flex items-center gap-2">
                      <Avatar name={selectedEntry.performerName || 'System'} src={selectedEntry.performerImage ?? undefined} size={20} />
                      <span className="font-medium text-slate-700 dark:text-slate-300">{selectedEntry.performerName || 'System'}</span>
                    </div>
                  </div>

                  {/* Via */}
                  {selectedEntry.source && (
                    <div className="flex items-start gap-3">
                      <span className="w-12 shrink-0 font-medium text-slate-400 uppercase tracking-wide text-xxs pt-0.5">Via</span>
                      <span className="inline-block px-1.5 py-px rounded text-xxs font-medium bg-slate-100 dark:bg-white/[.06] text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                        {selectedEntry.source}
                      </span>
                    </div>
                  )}

                  {/* Details */}
                  {selectedEntry.details && Object.keys(selectedEntry.details).length > 0 && (
                    <div className="pt-2 border-t border-black/[.06] dark:border-white/[.08]">
                      <span className="block font-medium text-slate-400 uppercase tracking-wide text-xxs mb-2">Details</span>
                      <div className="space-y-1.5 bg-slate-50 dark:bg-white/[.03] rounded-md p-3">
                        {Object.entries(selectedEntry.details).map(([key, value]) => (
                          <div key={key} className="flex items-start gap-2">
                            <span className="text-xxs font-mono text-slate-400 shrink-0 min-w-[80px]">{key}</span>
                            <span className="text-xxs text-slate-700 dark:text-slate-300 break-all">
                              {typeof value === 'object' ? JSON.stringify(value) : String(value ?? '—')}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )
          })()}
        </DialogContent>
      </Dialog>
    </>
  )
}
