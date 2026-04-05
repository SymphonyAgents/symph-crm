'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, Clock, Trophy, AtSign } from 'lucide-react'
import { cn, timeAgo } from '@/lib/utils'
import { useGetNotifications } from '@/lib/hooks/queries'
import { useMarkAllNotificationsRead, useMarkNotificationRead } from '@/lib/hooks/mutations'
import type { ApiNotification } from '@/lib/types'
import { useEscapeKey } from '@/lib/hooks/use-escape-key'

function NotificationIcon({ type }: { type: string }) {
  if (type === 'dormant_deal') return <Clock size={14} className="text-amber-500" />
  if (type === 'deal_won') return <Trophy size={14} className="text-green-500" />
  return <AtSign size={14} className="text-blue-500" />
}

function NotificationItem({
  notification,
  onRead,
}: {
  notification: ApiNotification
  onRead: () => void
}) {
  return (
    <button
      onClick={onRead}
      className={cn(
        'w-full text-left flex items-start gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-white/[.03] transition-colors',
        !notification.isRead && 'bg-blue-50/40 dark:bg-blue-500/[.05]',
      )}
    >
      {/* Type icon */}
      <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-white/[.06] flex items-center justify-center shrink-0 mt-0.5">
        <NotificationIcon type={notification.type} />
      </div>

      <div className="flex-1 min-w-0">
        {/* Deal + Brand */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {notification.dealTitle && (
            <span className="text-ssm font-semibold text-slate-900 dark:text-white truncate">
              {notification.dealTitle}
            </span>
          )}
          {notification.brandName && (
            <span className="text-xxs text-slate-400">&middot; {notification.brandName}</span>
          )}
        </div>
        {/* Trigger text */}
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          {notification.triggerText}
        </p>
        {/* Timestamp */}
        <p className="text-xxs text-slate-400 mt-1">{timeAgo(notification.createdAt)}</p>
      </div>

      {/* Unread dot */}
      {!notification.isRead && (
        <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0 mt-2" />
      )}
    </button>
  )
}

export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  const { data: notifications = [] } = useGetNotifications()
  const { mutate: markAllRead } = useMarkAllNotificationsRead()
  const { mutate: markOneRead } = useMarkNotificationRead()

  const unreadCount = notifications.filter(n => !n.isRead).length
  const dormant = notifications.filter(n => n.type === 'dormant_deal' && !n.isRead)
  const earlier = notifications.filter(n => n.type !== 'dormant_deal' || n.isRead)

  useEscapeKey(useCallback(() => setOpen(false), []), open)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  function handleNotificationClick(n: ApiNotification) {
    markOneRead(n.id)
    setOpen(false)
    if (n.dealId) router.push(`/deals/${n.dealId}?from=dashboard`)
  }

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell button */}
      <button
        onClick={() => setOpen(v => !v)}
        className={cn(
          'relative w-8 h-8 flex items-center justify-center rounded-lg transition-colors',
          open
            ? 'bg-slate-200 dark:bg-white/[.12] text-slate-900 dark:text-white'
            : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-white/[.06] hover:text-slate-700 dark:hover:text-white',
        )}
      >
        <Bell size={15} strokeWidth={1.5} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 text-white text-atom font-bold flex items-center justify-center leading-none">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-[340px] bg-white dark:bg-[#1e1e21] border border-black/[.06] dark:border-white/[.08] rounded-xl shadow-md dark:shadow-2xl z-50 overflow-hidden">
          {/* Panel header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-black/[.06] dark:border-white/[.08]">
            <span className="text-ssm font-semibold text-slate-900 dark:text-white">Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllRead()}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-[420px] overflow-y-auto">
            {/* Flagged section — dormant deals */}
            {dormant.length > 0 && (
              <>
                <div className="px-4 py-2 bg-slate-50 dark:bg-white/[.02]">
                  <span className="text-atom font-semibold text-slate-400 uppercase tracking-wider">
                    Needs Attention
                  </span>
                </div>
                {dormant.map(n => (
                  <NotificationItem
                    key={n.id}
                    notification={n}
                    onRead={() => handleNotificationClick(n)}
                  />
                ))}
              </>
            )}

            {/* Earlier section */}
            {earlier.length > 0 && (
              <>
                <div className="px-4 py-2 bg-slate-50 dark:bg-white/[.02]">
                  <span className="text-atom font-semibold text-slate-400 uppercase tracking-wider">
                    Earlier
                  </span>
                </div>
                {earlier.map(n => (
                  <NotificationItem
                    key={n.id}
                    notification={n}
                    onRead={() => handleNotificationClick(n)}
                  />
                ))}
              </>
            )}

            {notifications.length === 0 && (
              <div className="py-10 text-center">
                <Bell size={20} className="mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                <p className="text-ssm text-slate-400">No notifications yet</p>
              </div>
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="border-t border-black/[.06] dark:border-white/[.08] px-4 py-2.5 text-center">
              <button
                onClick={() => setOpen(false)}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium"
              >
                View all notifications
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
