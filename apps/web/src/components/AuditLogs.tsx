'use client'

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Avatar } from './Avatar'
import { Search, ChevronLeft, ChevronRight } from 'lucide-react'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from './ui/select'

// ── Types ────────────────────────────────────────────────────────────────────

type AuditLogEntry = {
  id: number
  createdAt: string
  action: 'create' | 'update' | 'delete' | 'status_change'
  auditType: string
  entityType: string
  entityId: string | null
  source: string | null
  performedBy: string | null
  details: Record<string, unknown> | null
  performerName: string | null
  performerImage: string | null
}

type AuditLogsResponse = {
  rows: AuditLogEntry[]
  total: number
}

type UserOption = {
  id: string
  name: string | null
  email: string
  image: string | null
  firstName: string | null
  lastName: string | null
  nickname: string | null
}

// ── Display config ───────────────────────────────────────────────────────────

const ACTION_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  create:        { label: 'Created',  color: '#16a34a', bg: 'rgba(22,163,74,0.08)',  icon: '+' },
  update:        { label: 'Updated',  color: '#2563eb', bg: 'rgba(37,99,235,0.08)',  icon: '✎' },
  delete:        { label: 'Deleted',  color: '#dc2626', bg: 'rgba(220,38,38,0.08)',  icon: '×' },
  status_change: { label: 'Status',   color: '#d97706', bg: 'rgba(217,119,6,0.08)',  icon: '→' },
}

const ENTITY_LABEL: Record<string, string> = {
  deal: 'Deal',
  company: 'Company',
  contact: 'Contact',
  activity: 'Activity',
  document: 'Document',
  proposal: 'Proposal',
  user: 'User',
}

const PAGE_SIZE = 50

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatRelativeTime(iso: string): string {
  const date = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60_000)
  const diffHours = Math.floor(diffMs / 3_600_000)
  const diffDays = Math.floor(diffMs / 86_400_000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined })
}

function formatFullDate(iso: string): string {
  return new Date(iso).toLocaleString('en-PH', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  })
}

function describeDetails(entry: AuditLogEntry): string {
  const details = entry.details
  if (!details) return ''

  // Status change: "lead → discovery"
  if (entry.action === 'status_change' && details.from && details.to) {
    return `${details.from} → ${details.to}`
  }

  // Update: list changed fields
  if (entry.action === 'update' && details.fields) {
    const fields = details.fields as string[]
    return fields.join(', ')
  }

  // Create: show title/name if present
  if (details.title) return String(details.title)
  if (details.name) return String(details.name)

  return ''
}

function userDisplayName(u: UserOption): string {
  if (u.nickname) return u.nickname
  if (u.firstName && u.lastName) return `${u.firstName} ${u.lastName}`
  return u.name || u.email
}

// ── Data fetching ────────────────────────────────────────────────────────────

async function fetchAuditLogs(params: {
  entityType?: string
  action?: string
  performedBy?: string
  limit: number
  offset: number
}): Promise<AuditLogsResponse> {
  const sp = new URLSearchParams()
  if (params.entityType) sp.set('entityType', params.entityType)
  if (params.action) sp.set('action', params.action)
  if (params.performedBy) sp.set('performedBy', params.performedBy)
  sp.set('limit', String(params.limit))
  sp.set('offset', String(params.offset))

  const res = await fetch(`/api/audit-logs?${sp}`)
  if (!res.ok) throw new Error('Failed to fetch audit logs')
  return res.json()
}

async function fetchUsers(): Promise<UserOption[]> {
  const res = await fetch('/api/users')
  if (!res.ok) throw new Error('Failed to fetch users')
  return res.json()
}

// ── Component ────────────────────────────────────────────────────────────────

export function AuditLogs() {
  const [search, setSearch] = useState('')
  const [entityFilter, setEntityFilter] = useState<string>('all')
  const [actionFilter, setActionFilter] = useState<string>('all')
  const [userFilter, setUserFilter] = useState<string>('all')
  const [page, setPage] = useState(0)

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', entityFilter, actionFilter, userFilter, page],
    queryFn: () => fetchAuditLogs({
      entityType: entityFilter !== 'all' ? entityFilter : undefined,
      action: actionFilter !== 'all' ? actionFilter : undefined,
      performedBy: userFilter !== 'all' ? userFilter : undefined,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    }),
  })

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: fetchUsers,
    staleTime: 5 * 60 * 1000,
  })

  const rows = data?.rows ?? []
  const total = data?.total ?? 0
  const totalPages = Math.ceil(total / PAGE_SIZE)

  // Client-side search filter (on top of server filters)
  const filtered = useMemo(() => {
    if (!search.trim()) return rows
    const q = search.toLowerCase()
    return rows.filter(r =>
      (r.performerName || '').toLowerCase().includes(q) ||
      r.entityType.toLowerCase().includes(q) ||
      r.action.toLowerCase().includes(q) ||
      (r.entityId || '').toLowerCase().includes(q) ||
      describeDetails(r).toLowerCase().includes(q)
    )
  }, [rows, search])

  const resetPage = () => setPage(0)

  return (
    <div className="p-4 md:p-6 h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4 shrink-0">
        <div>
          <div className="text-[13px] font-semibold text-slate-900 dark:text-white">Audit Log</div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            {isLoading ? 'Loading…' : `${total} event${total !== 1 ? 's' : ''}`}
          </div>
        </div>

        <div className="sm:ml-auto flex flex-wrap gap-2 items-center">
          {/* Search */}
          <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-white/[.03] border border-black/[.06] dark:border-white/[.08] rounded-lg px-2.5 py-[5px] flex-1 sm:flex-none sm:w-[200px] min-w-[140px]">
            <Search size={13} className="text-slate-400 shrink-0" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search logs…"
              className="flex-1 bg-transparent outline-none text-[12px] text-slate-900 dark:text-white placeholder:text-slate-400 min-w-0"
            />
          </div>

          {/* Entity type filter */}
          <Select
            value={entityFilter}
            onValueChange={v => { setEntityFilter(v); resetPage() }}
          >
            <SelectTrigger size="sm" className="w-[130px] text-[12px]">
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
            <SelectTrigger size="sm" className="w-[120px] text-[12px]">
              <SelectValue placeholder="All actions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All actions</SelectItem>
              {Object.entries(ACTION_CONFIG).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* User filter */}
          <Select
            value={userFilter}
            onValueChange={v => { setUserFilter(v); resetPage() }}
          >
            <SelectTrigger size="sm" className="w-[140px] text-[12px]">
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

      {/* Table */}
      <div className="flex-1 overflow-y-auto bg-white dark:bg-[#1e1e21] border border-black/[.06] dark:border-white/[.08] rounded-lg shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center py-16">
            <div className="text-center">
              <div className="text-[13px] text-slate-400">No audit events found</div>
              <div className="text-[11px] text-slate-300 dark:text-white/20 mt-1">
                {search || entityFilter !== 'all' || actionFilter !== 'all' || userFilter !== 'all'
                  ? 'Try adjusting your filters'
                  : 'Events will appear here as actions are performed'}
              </div>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-black/[.04] dark:divide-white/[.06]">
            {filtered.map(entry => {
              const cfg = ACTION_CONFIG[entry.action] ?? ACTION_CONFIG.update
              const entityLabel = ENTITY_LABEL[entry.entityType] ?? entry.entityType
              const details = describeDetails(entry)

              return (
                <div
                  key={entry.id}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50/50 dark:hover:bg-white/[.02] transition-colors"
                >
                  {/* Action icon */}
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-[12px] font-bold shrink-0"
                    style={{ background: cfg.bg, color: cfg.color }}
                  >
                    {cfg.icon}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 text-[12.5px]">
                      <span className="font-semibold text-slate-900 dark:text-white truncate">
                        {entry.performerName || 'System'}
                      </span>
                      <span
                        className="font-medium px-1.5 py-px rounded-full text-[10px]"
                        style={{ background: cfg.bg, color: cfg.color }}
                      >
                        {cfg.label}
                      </span>
                      <span className="text-slate-500">
                        {entityLabel}
                      </span>
                    </div>
                    {details && (
                      <div className="text-[11px] text-slate-400 mt-0.5 truncate">
                        {details}
                      </div>
                    )}
                  </div>

                  {/* Performer avatar */}
                  <Avatar
                    name={entry.performerName || 'System'}
                    size={24}
                  />

                  {/* Timestamp */}
                  <div className="text-[11px] text-slate-400 tabular-nums shrink-0 min-w-[60px] text-right" title={formatFullDate(entry.createdAt)}>
                    {formatRelativeTime(entry.createdAt)}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-3 shrink-0">
          <span className="text-[11px] text-slate-400">
            Page {page + 1} of {totalPages}
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
    </div>
  )
}
