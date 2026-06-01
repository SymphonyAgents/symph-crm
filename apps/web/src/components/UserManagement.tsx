'use client'

import { useCallback, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Check, ShieldCheck, UserRoundCog, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUser } from '@/lib/auth-context'
import { useGetExternalUsers } from '@/lib/hooks/queries'
import { useApproveExternalUser, useRejectExternalUser, useRemoveExternalUser, useUpdateExternalUserRole } from '@/lib/hooks/mutations'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DataTableSkeleton } from '@/components/ui/data-table'
import { TabFilter, type TabFilterItem } from '@/components/ui/tab-filter'
import type { ApiUser } from '@/lib/types'

type UserTab = 'pending' | 'active'
type ConfirmTarget = { type: 'approve' | 'reject' | 'remove'; user: ApiUser }

function getDisplayName(user: ApiUser) {
  return user.name || user.nickname || user.email
}

function StatusBadge({ status }: { status: ApiUser['status'] }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xxs font-semibold uppercase tracking-wide',
        status === 'pending' && 'bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/20',
        status === 'active' && 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/20',
        status === 'rejected' && 'bg-red-50 text-red-700 ring-1 ring-red-200 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-500/20',
      )}
    >
      {status ?? 'active'}
    </span>
  )
}

function EmptyState({ tab }: { tab: UserTab }) {
  return (
    <div className="flex min-h-[220px] flex-col items-center justify-center rounded-md border border-dashed border-black/[.08] bg-slate-50/70 px-4 text-center dark:border-white/[.08] dark:bg-white/[.03]">
      <UserRoundCog size={22} className="text-slate-400" />
      <p className="mt-3 text-sm font-semibold text-slate-900 dark:text-white">
        {tab === 'pending' ? 'No pending external users' : 'No approved external users'}
      </p>
      <p className="mt-1 max-w-sm text-xs text-slate-500 dark:text-slate-400">
        {tab === 'pending'
          ? 'Non-Symph signups will appear here before they can access client-facing pages.'
          : 'Approved partner and external users will appear here.'}
      </p>
    </div>
  )
}

function UserActions({
  user,
  onApprove,
  onReject,
  onRemove,
}: {
  user: ApiUser
  onApprove: () => void
  onReject: () => void
  onRemove: () => void
}) {
  const updateRole = useUpdateExternalUserRole()
  const isPending = user.status === 'pending'

  return (
    <div className="flex items-center justify-end gap-2">
      {isPending ? (
        <>
          <button
            type="button"
            onClick={onApprove}
            aria-label={`Approve ${user.email}`}
            title="Approve"
            className="flex size-7 items-center justify-center rounded-md border border-emerald-200 bg-emerald-50 text-emerald-700 transition-colors hover:bg-emerald-100 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300 dark:hover:bg-emerald-500/15"
          >
            <Check size={14} strokeWidth={2} />
          </button>
          <button
            type="button"
            onClick={onReject}
            aria-label={`Reject ${user.email}`}
            title="Reject"
            className="flex size-7 items-center justify-center rounded-md border border-red-200 bg-red-50 text-red-700 transition-colors hover:bg-red-100 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300 dark:hover:bg-red-500/15"
          >
            <X size={14} strokeWidth={2} />
          </button>
        </>
      ) : (
        <>
          <Select
            value={(user.role === 'BUILD' || user.role === 'PARTNER') ? user.role : 'PARTNER'}
            onValueChange={role => updateRole.mutate({ id: user.id, role: role as 'BUILD' | 'PARTNER' })}
            disabled={updateRole.isPending}
          >
            <SelectTrigger size="sm" className="w-[132px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="PARTNER">Partner</SelectItem>
              <SelectItem value="BUILD">Build</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={onRemove}>
            Remove
          </Button>
        </>
      )}
    </div>
  )
}

function UserConfirmModal({
  target,
  loading,
  onCancel,
  onConfirm,
}: {
  target: ConfirmTarget
  loading: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  const isApprove = target.type === 'approve'
  const isReject = target.type === 'reject'
  const actionLabel = isApprove ? 'Approve' : isReject ? 'Reject' : 'Remove'
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-xl border border-black/[.06] bg-white p-4 shadow-lg animate-in zoom-in-95 fade-in-0 duration-150 dark:border-white/[.08] dark:bg-[#1e1e21]"
        onClick={event => event.stopPropagation()}
      >
        <p className="text-sm font-semibold text-slate-900 dark:text-white">
          {actionLabel} user?
        </p>
        <p className="mt-1 text-ssm leading-relaxed text-slate-600 dark:text-slate-400">
          {actionLabel} <span className="font-semibold text-slate-900 dark:text-white">{target.user.email}</span>. {isApprove ? 'They will be able to access the partner portal after approval.' : isReject ? 'They will not be able to access the CRM.' : 'They will lose CRM access.'}
        </p>
        <div className="mt-4 flex gap-2.5">
          <button
            onClick={onCancel}
            className="h-8 flex-1 rounded-lg border border-black/[.08] text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 dark:border-white/[.1] dark:text-slate-300 dark:hover:bg-white/[.04]"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={cn(
              'flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg text-xs font-semibold text-white transition-colors disabled:opacity-60',
              isApprove ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700',
            )}
          >
            {loading && <span className="inline-block size-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />}
            {actionLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export function UserManagement() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { isSales, isLoading: userLoading } = useUser()
  const tab: UserTab = searchParams.get('tab') === 'approved' ? 'active' : 'pending'
  const [confirmTarget, setConfirmTarget] = useState<ConfirmTarget | null>(null)
  const approve = useApproveExternalUser({ onSuccess: () => setConfirmTarget(null) })
  const reject = useRejectExternalUser({ onSuccess: () => setConfirmTarget(null) })
  const remove = useRemoveExternalUser({ onSuccess: () => setConfirmTarget(null) })
  const { data: users = [], isLoading } = useGetExternalUsers({ enabled: isSales })

  const { pendingUsers, activeUsers } = useMemo(() => {
    return {
      pendingUsers: users.filter(user => user.status === 'pending'),
      activeUsers: users.filter(user => user.status !== 'pending'),
    }
  }, [users])

  const visibleUsers = tab === 'pending' ? pendingUsers : activeUsers

  const tabItems = useMemo<TabFilterItem<UserTab>[]>(() => [
    { id: 'pending', label: 'Pending', count: pendingUsers.length },
    { id: 'active', label: 'Approved', count: activeUsers.length },
  ], [activeUsers.length, pendingUsers.length])

  const setTab = useCallback(
    (next: UserTab) => {
      const params = new URLSearchParams(searchParams.toString())
      params.set('tab', next === 'active' ? 'approved' : 'pending')
      router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    },
    [pathname, router, searchParams],
  )

  if (!userLoading && !isSales) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="max-w-sm rounded-md border border-black/[.06] bg-white p-6 text-center shadow-[var(--shadow-card)] dark:border-white/[.08] dark:bg-[#1e1e21]">
          <ShieldCheck size={24} className="mx-auto text-slate-400" />
          <p className="mt-3 text-sm font-semibold text-slate-900 dark:text-white">Sales access required</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Only Sales users can review and approve external CRM accounts.
          </p>
        </div>
      </div>
    )
  }

  return (
    <>
      {confirmTarget && (
        <UserConfirmModal
          target={confirmTarget}
          loading={confirmTarget.type === 'approve' ? approve.isPending : confirmTarget.type === 'reject' ? reject.isPending : remove.isPending}
          onCancel={() => setConfirmTarget(null)}
          onConfirm={() => {
            if (confirmTarget.type === 'approve') approve.mutate(confirmTarget.user.id)
            else if (confirmTarget.type === 'reject') reject.mutate(confirmTarget.user.id)
            else remove.mutate(confirmTarget.user.id)
          }}
        />
      )}
      <div className="flex flex-col gap-3 p-4 md:px-6 pb-6">
        <TabFilter items={tabItems} value={tab} onChange={setTab} className="self-start" />

        <div className="rounded-md border border-black/[.06] bg-white shadow-[var(--shadow-card)] dark:border-white/[.08] dark:bg-[#1e1e21]">
          <div className="p-2">
            {isLoading ? (
              <DataTableSkeleton className="p-1.5 space-y-2" />
            ) : visibleUsers.length === 0 ? (
              <EmptyState tab={tab} />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleUsers.map(user => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {user.image ? (
                            <img src={user.image} alt="" className="size-8 rounded-full" />
                          ) : (
                            <div className="flex size-8 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-500 dark:bg-white/[.06] dark:text-slate-300">
                              {getDisplayName(user).slice(0, 1).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <p className="text-ssm font-semibold text-slate-900 dark:text-white">{getDisplayName(user)}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">{user.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs font-medium text-slate-600 dark:text-slate-300">{user.role ?? 'PARTNER'}</TableCell>
                      <TableCell><StatusBadge status={user.status} /></TableCell>
                      <TableCell>
                        <UserActions
                          user={user}
                          onApprove={() => setConfirmTarget({ type: 'approve', user })}
                          onReject={() => setConfirmTarget({ type: 'reject', user })}
                          onRemove={() => setConfirmTarget({ type: 'remove', user })}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
