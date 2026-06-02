'use client'

import { useCallback, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Check, Pencil, Plus, ShieldCheck, Trash2, UserRoundCog, UsersRound, X } from 'lucide-react'
import { CrmUserRole, CrmUserStatus } from '@symph-crm/shared'
import { cn } from '@/lib/utils'
import { useUser } from '@/lib/auth-context'
import { useGetExternalUsers, useGetPartnerDealGroups } from '@/lib/hooks/queries'
import { useApproveExternalUser, useArchivePartnerDealGroup, useCreatePartnerDealGroup, useRejectExternalUser, useRemoveExternalUser, useUpdatePartnerDealGroup } from '@/lib/hooks/mutations'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DataTableSkeleton } from '@/components/ui/data-table'
import { TabFilter, type TabFilterItem } from '@/components/ui/tab-filter'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { StatusPill } from '@/components/ui/status-pill'
import type { ApiPartnerDealGroup, ApiUser } from '@/lib/types'

type UserTab = 'pending' | 'active' | 'groups'
type ConfirmTarget = { type: 'approve' | 'reject' | 'remove'; user: ApiUser }

function getDisplayName(user: ApiUser) {
  return user.name || user.nickname || user.email
}

function formatStatusLabel(status: CrmUserStatus) {
  return status.slice(0, 1).toUpperCase() + status.slice(1)
}

function StatusBadge({ status }: { status: ApiUser['status'] }) {
  const nextStatus = status ?? CrmUserStatus.Active
  const tone = nextStatus === CrmUserStatus.Pending ? 'amber' : nextStatus === CrmUserStatus.Rejected ? 'red' : 'emerald'
  return <StatusPill tone={tone}>{formatStatusLabel(nextStatus)}</StatusPill>
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

function PartnerGroupsCell({ groups }: { groups: ApiPartnerDealGroup[] }) {
  if (groups.length === 0) {
    return <span className="text-xs text-slate-400">-</span>
  }

  return (
    <div className="flex max-w-xs flex-wrap gap-1.5">
      {groups.slice(0, 2).map(group => (
        <StatusPill key={group.id} tone="neutral">{group.name}</StatusPill>
      ))}
      {groups.length > 2 && (
        <StatusPill tone="neutral">+{groups.length - 2} more</StatusPill>
      )}
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
  const isPending = user.status === CrmUserStatus.Pending

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
  partnerDealGroups,
  loading,
  onCancel,
  onConfirm,
}: {
  target: ConfirmTarget
  partnerDealGroups: ApiPartnerDealGroup[]
  loading: boolean
  onCancel: () => void
  onConfirm: (partnerDealGroupIds?: string[]) => void
}) {
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([])
  const isApprove = target.type === 'approve'
  const isReject = target.type === 'reject'
  const actionLabel = isApprove ? 'Approve' : isReject ? 'Reject' : 'Remove'

  function toggleGroup(groupId: string) {
    setSelectedGroupIds(current => current.includes(groupId)
      ? current.filter(id => id !== groupId)
      : [...current, groupId])
  }

  return (
    <Dialog open onOpenChange={open => { if (!open) onCancel() }}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-[calc(100vw-2rem)] overflow-hidden sm:max-w-sm">
        <DialogHeader className="px-4">
          <div>
            <DialogTitle>{actionLabel} user?</DialogTitle>
            <DialogDescription>
              {isApprove ? 'Approve partner access.' : isReject ? 'Reject this signup request.' : 'Remove this partner account.'}
            </DialogDescription>
          </div>
        </DialogHeader>
        <div className="max-h-[calc(100dvh-8rem)] overflow-y-auto p-4">
          <p className="text-ssm leading-relaxed text-slate-600 dark:text-slate-400">
            {actionLabel} <span className="font-semibold text-slate-900 dark:text-white">{target.user.email}</span>. {isApprove ? 'They will be able to access the partner portal after approval.' : isReject ? 'They will not be able to access the CRM.' : 'They will lose CRM access.'}
          </p>

          {isApprove && (
            <div className="mt-4">
              <label className="mb-1.5 block text-xxs font-medium uppercase tracking-[0.05em] text-slate-500">
                Assign partner deal group <span className="font-normal normal-case text-slate-400">optional</span>
              </label>
              <Command className="rounded-md border border-black/[.06] dark:border-white/[.08]">
                <CommandInput placeholder="Search partner deal groups..." className="text-ssm" />
                <CommandList className="h-[min(220px,32dvh)] max-h-[220px] overflow-y-auto">
                  <CommandEmpty>No partner deal groups found.</CommandEmpty>
                  <CommandGroup>
                    {partnerDealGroups.filter(group => group.isActive).map(group => {
                      const checked = selectedGroupIds.includes(group.id)
                      return (
                        <CommandItem
                          key={group.id}
                          value={`${group.name} ${group.slug}`}
                          onSelect={() => toggleGroup(group.id)}
                          className="text-ssm"
                        >
                          <span className={cn(
                            'flex size-4 items-center justify-center rounded border border-slate-300 dark:border-white/[.16]',
                            checked && 'border-primary bg-primary text-white',
                          )}>
                            {checked && <Check size={12} />}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-medium text-slate-900 dark:text-white">{group.name}</div>
                            <div className="truncate text-xxs text-slate-400">
                              {group.members.length} member{group.members.length === 1 ? '' : 's'}
                            </div>
                          </div>
                        </CommandItem>
                      )
                    })}
                  </CommandGroup>
                </CommandList>
              </Command>
              {selectedGroupIds.length === 0 && (
                <p className="mt-2 pt-2 text-xxs leading-relaxed text-amber-600 dark:text-amber-300">
                  This partner can log in but will not see deals until assigned to a partner deal group.
                </p>
              )}
            </div>
          )}

          <div className="mt-4 flex gap-2.5">
            <button
              onClick={onCancel}
              className="h-9 flex-1 rounded-lg border border-black/[.08] text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 dark:border-white/[.1] dark:text-slate-300 dark:hover:bg-white/[.04]"
            >
              Cancel
            </button>
            <button
              onClick={() => onConfirm(isApprove ? selectedGroupIds : undefined)}
              disabled={loading}
              className={cn(
                'flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg text-xs font-semibold text-white transition-colors disabled:opacity-60',
                isApprove ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700',
              )}
            >
              {loading && <span className="inline-block size-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />}
              {actionLabel}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

type PartnerDealGroupDialogMode = 'create' | 'edit'

type PartnerDealGroupDialogState = {
  mode: PartnerDealGroupDialogMode
  group?: ApiPartnerDealGroup
}

function makeSlug(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

function PartnerDealGroupDialog({ state, onClose }: { state: PartnerDealGroupDialogState; onClose: () => void }) {
  const [name, setName] = useState(state.group?.name ?? '')
  const [slug, setSlug] = useState(state.group?.slug ?? '')
  const [description, setDescription] = useState(state.group?.description ?? '')
  const createGroup = useCreatePartnerDealGroup({ onSuccess: onClose })
  const updateGroup = useUpdatePartnerDealGroup({ onSuccess: onClose })
  const isEdit = state.mode === 'edit'
  const isPending = createGroup.isPending || updateGroup.isPending
  const normalizedName = name.trim()
  const normalizedSlug = slug.trim() || makeSlug(name)

  function submit() {
    if (!normalizedName) return
    const input = { name: normalizedName, slug: normalizedSlug, description: description.trim() || null }
    if (isEdit && state.group) updateGroup.mutate({ id: state.group.id, input })
    else createGroup.mutate(input)
  }

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose() }}>
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
        <DialogHeader className="px-4">
          <div>
            <DialogTitle>{isEdit ? 'Edit partner deal group' : 'Create partner deal group'}</DialogTitle>
            <DialogDescription>Partner deal groups are containers for partner-visible deals.</DialogDescription>
          </div>
        </DialogHeader>
        <div className="space-y-3 p-4">
          <div className="space-y-1.5">
            <label className="text-xxs font-medium uppercase tracking-[0.05em] text-slate-500">Name</label>
            <Input value={name} onChange={event => setName(event.target.value)} placeholder="CPS" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xxs font-medium uppercase tracking-[0.05em] text-slate-500">Slug</label>
            <Input value={slug} onChange={event => setSlug(event.target.value)} placeholder={makeSlug(name) || 'cps'} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xxs font-medium uppercase tracking-[0.05em] text-slate-500">Description</label>
            <Textarea value={description} onChange={event => setDescription(event.target.value)} placeholder="Optional notes for Sales" />
          </div>
          <div className="flex gap-2.5 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="h-9 flex-1 rounded-lg border border-black/[.08] text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 dark:border-white/[.1] dark:text-slate-300 dark:hover:bg-white/[.04]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={!normalizedName || isPending}
              className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary text-xs font-semibold text-white transition-colors hover:bg-primary/90 disabled:opacity-60"
            >
              {isPending && <span className="inline-block size-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />}
              {isEdit ? 'Save changes' : 'Create group'}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function ArchivePartnerDealGroupDialog({ group, loading, onCancel, onConfirm }: { group: ApiPartnerDealGroup; loading: boolean; onCancel: () => void; onConfirm: () => void }) {
  return (
    <Dialog open onOpenChange={open => { if (!open) onCancel() }}>
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-sm">
        <DialogHeader className="px-4">
          <div>
            <DialogTitle>Archive partner deal group?</DialogTitle>
            <DialogDescription>This hides the group from new assignment flows.</DialogDescription>
          </div>
        </DialogHeader>
        <div className="p-4">
          <p className="text-ssm leading-relaxed text-slate-600 dark:text-slate-400">
            Archive <span className="font-semibold text-slate-900 dark:text-white">{group.name}</span>. Existing records stay in the database.
          </p>
          <div className="mt-4 flex gap-2.5">
            <button
              type="button"
              onClick={onCancel}
              className="h-9 flex-1 rounded-lg border border-black/[.08] text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 dark:border-white/[.1] dark:text-slate-300 dark:hover:bg-white/[.04]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={loading}
              className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-red-600 text-xs font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-60"
            >
              {loading && <span className="inline-block size-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />}
              Archive
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function PartnerDealGroupsPanel() {
  const { data: groups = [], isLoading } = useGetPartnerDealGroups()
  const [dialogState, setDialogState] = useState<PartnerDealGroupDialogState | null>(null)
  const [archiveTarget, setArchiveTarget] = useState<ApiPartnerDealGroup | null>(null)
  const archiveGroup = useArchivePartnerDealGroup({ onSuccess: () => setArchiveTarget(null) })

  return (
    <>
      {dialogState && <PartnerDealGroupDialog state={dialogState} onClose={() => setDialogState(null)} />}
      {archiveTarget && (
        <ArchivePartnerDealGroupDialog
          group={archiveTarget}
          loading={archiveGroup.isPending}
          onCancel={() => setArchiveTarget(null)}
          onConfirm={() => archiveGroup.mutate(archiveTarget.id)}
        />
      )}
      <div className="rounded-md border border-black/[.06] bg-white shadow-[var(--shadow-card)] dark:border-white/[.08] dark:bg-[#1e1e21]">
        <div className="flex flex-col gap-3 border-b border-black/[.06] px-4 py-3 dark:border-white/[.08] sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">Partner deal groups</p>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Containers like CPS, CAN, and ISV - Americas Google. Deals will be linked after the new flow is ready.
            </p>
          </div>
          <Button size="sm" onClick={() => setDialogState({ mode: 'create' })}>
            <Plus size={13} /> Create group
          </Button>
        </div>
        <div className="p-2">
          {isLoading ? (
            <DataTableSkeleton className="p-1.5 space-y-2" />
          ) : groups.length === 0 ? (
            <div className="flex min-h-[220px] flex-col items-center justify-center rounded-md border border-dashed border-black/[.08] bg-slate-50/70 px-4 text-center dark:border-white/[.08] dark:bg-white/[.03]">
              <UsersRound size={22} className="text-slate-400" />
              <p className="mt-3 text-sm font-semibold text-slate-900 dark:text-white">No partner deal groups</p>
              <p className="mt-1 max-w-sm text-xs text-slate-500 dark:text-slate-400">Create the containers before linking deals or partner users.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Group</TableHead>
                  <TableHead>Members</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groups.map(group => (
                  <TableRow key={group.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex size-8 items-center justify-center rounded-md bg-slate-100 text-slate-500 dark:bg-white/[.06] dark:text-slate-300">
                          <UsersRound size={15} />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-ssm font-semibold text-slate-900 dark:text-white">{group.name}</p>
                          <p className="truncate text-xs text-slate-500 dark:text-slate-400">{group.slug}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {group.members.length === 0 ? (
                        <span className="text-xs text-slate-400">No members</span>
                      ) : (
                        <div className="flex max-w-md flex-wrap gap-1.5">
                          {group.members.slice(0, 3).map(member => (
                            <StatusPill key={member.id} tone="neutral">{member.name ?? member.email}</StatusPill>
                          ))}
                          {group.members.length > 3 && (
                            <StatusPill tone="neutral">+{group.members.length - 3} more</StatusPill>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusPill tone={group.isActive ? 'emerald' : 'neutral'}>
                        {group.isActive ? 'Active' : 'Archived'}
                      </StatusPill>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => setDialogState({ mode: 'edit', group })}
                          className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-primary dark:hover:bg-white/[.06]"
                          title="Edit"
                        >
                          <Pencil size={13} />
                        </button>
                        {group.isActive && (
                          <button
                            type="button"
                            onClick={() => setArchiveTarget(group)}
                            className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-red-600 dark:hover:bg-white/[.06] dark:hover:text-red-400"
                            title="Archive"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </>
  )
}

export function UserManagement() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { isSales, isLoading: userLoading } = useUser()
  const rawTab = searchParams.get('tab')
  const tab: UserTab = rawTab === 'approved' ? 'active' : rawTab === 'groups' ? 'groups' : 'pending'
  const [confirmTarget, setConfirmTarget] = useState<ConfirmTarget | null>(null)
  const approve = useApproveExternalUser({ onSuccess: () => setConfirmTarget(null) })
  const reject = useRejectExternalUser({ onSuccess: () => setConfirmTarget(null) })
  const remove = useRemoveExternalUser({ onSuccess: () => setConfirmTarget(null) })
  const { data: users = [], isLoading } = useGetExternalUsers({ enabled: isSales })
  const { data: partnerDealGroups = [] } = useGetPartnerDealGroups({ enabled: isSales })

  const { pendingUsers, activeUsers } = useMemo(() => {
    return {
      pendingUsers: users.filter(user => user.status === CrmUserStatus.Pending),
      activeUsers: users.filter(user => user.status !== CrmUserStatus.Pending),
    }
  }, [users])

  const visibleUsers = tab === 'pending' ? pendingUsers : activeUsers
  const groupsByPartnerId = useMemo(() => {
    const map = new Map<string, ApiPartnerDealGroup[]>()
    for (const group of partnerDealGroups) {
      for (const member of group.members) {
        const groupsForPartner = map.get(member.id) ?? []
        groupsForPartner.push(group)
        map.set(member.id, groupsForPartner)
      }
    }
    return map
  }, [partnerDealGroups])

  const tabItems = useMemo<TabFilterItem<UserTab>[]>(() => [
    { id: 'pending', label: 'Pending', count: pendingUsers.length },
    { id: 'active', label: 'Approved', count: activeUsers.length },
    { id: 'groups', label: 'Groups' },
  ], [activeUsers.length, pendingUsers.length])

  const setTab = useCallback(
    (next: UserTab) => {
      const params = new URLSearchParams(searchParams.toString())
      params.set('tab', next === 'active' ? 'approved' : next)
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
          partnerDealGroups={partnerDealGroups}
          loading={confirmTarget.type === 'approve' ? approve.isPending : confirmTarget.type === 'reject' ? reject.isPending : remove.isPending}
          onCancel={() => setConfirmTarget(null)}
          onConfirm={(partnerDealGroupIds) => {
            if (confirmTarget.type === 'approve') approve.mutate({ id: confirmTarget.user.id, partnerDealGroupIds })
            else if (confirmTarget.type === 'reject') reject.mutate(confirmTarget.user.id)
            else remove.mutate(confirmTarget.user.id)
          }}
        />
      )}
      <div className="flex flex-col gap-3 p-4 md:px-6 pb-6">
        <TabFilter items={tabItems} value={tab} onChange={setTab} className="self-start" />

        {tab === 'groups' ? (
          <PartnerDealGroupsPanel />
        ) : (
          <div className="rounded-md border border-black/[.06] bg-white shadow-[var(--shadow-card)] dark:border-white/[.08] dark:bg-[#1e1e21]">
            <div className="overflow-x-auto p-2">
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
                    <TableHead>Partner deal groups</TableHead>
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
                      <TableCell className="text-xs font-medium text-slate-600 dark:text-slate-300">{user.role ?? CrmUserRole.Partner}</TableCell>
                      <TableCell><StatusBadge status={user.status} /></TableCell>
                      <TableCell>
                        {user.role === CrmUserRole.Partner ? (
                          <PartnerGroupsCell groups={groupsByPartnerId.get(user.id) ?? []} />
                        ) : (
                          <span className="text-xs text-slate-400">-</span>
                        )}
                      </TableCell>
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
        )}
      </div>
    </>
  )
}
