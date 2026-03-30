'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'
import { queryKeys } from '@/lib/query-keys'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { EmptyState } from './EmptyState'
import { useUser } from '@/lib/hooks/use-user'
import { useEscapeKey } from '@/lib/hooks/use-escape-key'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

const EVENT_TYPE_COLORS: Record<string, string> = {
  demo:           'bg-violet-500',
  discovery_call: 'bg-blue-500',
  followup:       'bg-amber-500',
  general:        'bg-slate-400',
}

type ApiCalendarEvent = {
  id: string
  googleEventId: string
  userId: string
  title: string
  description: string | null
  startAt: string
  endAt: string
  location: string | null
  attendeeEmails: string[]
  dealId: string | null
  eventType: 'demo' | 'discovery_call' | 'followup' | 'general'
}

type CalendarStatus = {
  connected: boolean
  googleEmail?: string
  lastSyncedAt?: string
}

type CreateEventForm = {
  title: string
  startAt: string
  endAt: string
  description: string
  location: string
  eventType: 'demo' | 'discovery_call' | 'followup' | 'general'
}

const BLANK_FORM: CreateEventForm = {
  title: '',
  startAt: '',
  endAt: '',
  description: '',
  location: '',
  eventType: 'general',
}

function toDateKey(iso: string) {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit', hour12: true })
}

function monthRange(year: number, month: number) {
  const from = new Date(year, month, 1).toISOString()
  const to = new Date(year, month + 1, 0, 23, 59, 59).toISOString()
  return { from, to }
}

function CreateEventModal({
  defaultDate,
  onClose,
  onCreated,
  userId,
}: {
  defaultDate?: string
  onClose: () => void
  onCreated: () => void
  userId: string | null
}) {
  useEscapeKey(useCallback(onClose, [onClose]))

  const [form, setForm] = useState<CreateEventForm>({
    ...BLANK_FORM,
    startAt: defaultDate ? `${defaultDate}T09:00` : '',
    endAt: defaultDate ? `${defaultDate}T10:00` : '',
  })
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: async (data: CreateEventForm) => {
      const res = await fetch(`${API}/calendar/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': userId ?? '' },
        body: JSON.stringify({
          ...data,
          startAt: new Date(data.startAt).toISOString(),
          endAt: new Date(data.endAt).toISOString(),
        }),
      })
      if (!res.ok) throw new Error(await res.text())
      return res.json()
    },
    onSuccess: () => { onCreated(); onClose() },
    onError: (err: Error) => setError(err.message),
  })

  const set = (k: keyof CreateEventForm, v: string) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white dark:bg-[#1e1e21] rounded-lg shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-[15px] font-semibold text-slate-900 dark:text-white">New Event</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:text-slate-400 text-lg leading-none">x</button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-[12px] font-medium text-slate-600 dark:text-slate-400 mb-1">Title *</label>
            <Input
              className="h-9 text-[13px]"
              value={form.title}
              onChange={e => set('title', e.target.value)}
              placeholder="e.g. Discovery call with Jollibee"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] font-medium text-slate-600 dark:text-slate-400 mb-1">Start *</label>
              <Input
                type="datetime-local"
                className="h-9 text-[13px]"
                value={form.startAt}
                onChange={e => set('startAt', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-slate-600 dark:text-slate-400 mb-1">End *</label>
              <Input
                type="datetime-local"
                className="h-9 text-[13px]"
                value={form.endAt}
                onChange={e => set('endAt', e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-[12px] font-medium text-slate-600 dark:text-slate-400 mb-1">Type</label>
            <Select
              value={form.eventType}
              onValueChange={v => set('eventType', v as CreateEventForm['eventType'])}
            >
              <SelectTrigger className="w-full text-[13px] h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="general">General</SelectItem>
                <SelectItem value="demo">Demo</SelectItem>
                <SelectItem value="discovery_call">Discovery Call</SelectItem>
                <SelectItem value="followup">Follow-up</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-[12px] font-medium text-slate-600 dark:text-slate-400 mb-1">Location</label>
            <Input
              className="h-9 text-[13px]"
              value={form.location}
              onChange={e => set('location', e.target.value)}
              placeholder="Google Meet, Zoom, office address..."
            />
          </div>

          <div>
            <label className="block text-[12px] font-medium text-slate-600 dark:text-slate-400 mb-1">Description</label>
            <Textarea
              className="text-[13px] min-h-[80px]"
              rows={3}
              value={form.description}
              onChange={e => set('description', e.target.value)}
              placeholder="Agenda, notes..."
            />
          </div>

          {error && <p className="text-[12px] text-red-500">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={onClose}
              className="px-4 py-2 text-[13px] rounded-lg border border-black/[.06] dark:border-white/[.08] text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/[.04]"
            >
              Cancel
            </button>
            <button
              onClick={() => mutation.mutate(form)}
              disabled={!form.title || !form.startAt || !form.endAt || mutation.isPending}
              className="px-4 py-2 text-[13px] rounded-lg bg-slate-900 text-white font-medium disabled:opacity-40 hover:bg-slate-700"
            >
              {mutation.isPending ? 'Creating...' : 'Create Event'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

type CalendarProps = {
  onOpenDeal?: (id: string) => void
}

export function Calendar({ onOpenDeal }: CalendarProps = {}) {
  const { userId } = useUser()
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth())
  const [year, setYear] = useState(now.getFullYear())
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [clickedDate, setClickedDate] = useState<string | undefined>()
  const [oauthBanner, setOauthBanner] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const searchParams = useSearchParams()
  const qc = useQueryClient()

  // Read OAuth redirect params once on mount, then clean the URL
  useEffect(() => {
    const connected = searchParams.get('connected')
    const oauthError = searchParams.get('oauth_error')
    if (connected === 'true') {
      setOauthBanner({ type: 'success', message: 'Google connected successfully!' })
      qc.invalidateQueries({ queryKey: queryKeys.calendar.status })
    } else if (oauthError) {
      setOauthBanner({ type: 'error', message: oauthError })
    }
    // Clean up the URL so it doesn't persist on refresh
    if (connected || oauthError) {
      const url = new URL(window.location.href)
      url.searchParams.delete('connected')
      url.searchParams.delete('oauth_error')
      window.history.replaceState({}, '', url.toString())
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const { from, to } = monthRange(year, month)

  const { data: status } = useQuery<CalendarStatus>({
    queryKey: queryKeys.calendar.status,
    queryFn: () =>
      fetch(`${API}/auth/google-calendar/status`, { headers: { 'x-user-id': userId ?? '' } }).then(r => r.json()),
    enabled: !!userId,
  })

  const { data: events = [] } = useQuery<ApiCalendarEvent[]>({
    queryKey: queryKeys.calendar.events({ from, to }),
    queryFn: () =>
      fetch(`${API}/calendar/events?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, {
        headers: { 'x-user-id': userId ?? '' },
      }).then(r => r.json()),
    enabled: !!status?.connected,
  })

  const eventsByDate = useMemo(() => {
    const map: Record<string, ApiCalendarEvent[]> = {}
    for (const ev of events) {
      const key = toDateKey(ev.startAt)
      if (!map[key]) map[key] = []
      map[key].push(ev)
    }
    return map
  }, [events])

  const upcoming = useMemo(() => {
    const todayStr = toDateKey(now.toISOString())
    return [...events]
      .filter(e => toDateKey(e.startAt) >= todayStr)
      .sort((a, b) => a.startAt.localeCompare(b.startAt))
      .slice(0, 10)
  }, [events])

  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const prevMonthDays = new Date(year, month, 0).getDate()
  const today = now.getDate()
  const isCurrentMonth = month === now.getMonth() && year === now.getFullYear()

  const cells: { day: number; current: boolean; dateKey: string }[] = []
  for (let i = 0; i < firstDay; i++) {
    const d = prevMonthDays - firstDay + i + 1
    const pm = month === 0 ? 11 : month - 1
    const py = month === 0 ? year - 1 : year
    cells.push({ day: d, current: false, dateKey: `${py}-${String(pm + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}` })
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, current: true, dateKey: `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}` })
  }
  const remaining = 42 - cells.length
  for (let i = 1; i <= remaining; i++) {
    const nm = month === 11 ? 0 : month + 1
    const ny = month === 11 ? year + 1 : year
    cells.push({ day: i, current: false, dateKey: `${ny}-${String(nm + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}` })
  }

  const handlePrev = () => { if (month === 0) { setMonth(11); setYear(y => y - 1) } else setMonth(m => m - 1) }
  const handleNext = () => { if (month === 11) { setMonth(0); setYear(y => y + 1) } else setMonth(m => m + 1) }

  return (
    <div className="p-4 md:p-6 flex flex-col gap-4">
      {/* OAuth result banner */}
      {oauthBanner && (
        <div className={cn(
          'flex items-center justify-between rounded-lg px-4 py-3 border text-[13px]',
          oauthBanner.type === 'success'
            ? 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800/40 text-green-800 dark:text-green-300'
            : 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800/40 text-red-800 dark:text-red-300',
        )}>
          <span className="font-medium">
            {oauthBanner.type === 'success' ? '✓ ' : '⚠ '}
            {oauthBanner.message}
          </span>
          <button
            onClick={() => setOauthBanner(null)}
            className="ml-4 shrink-0 text-[11px] opacity-60 hover:opacity-100 transition-opacity"
          >
            Dismiss
          </button>
        </div>
      )}

      {status && !status.connected && (
        <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/40 rounded-lg px-4 py-3">
          <div>
            <p className="text-[13px] font-semibold text-blue-900 dark:text-blue-300">Connect Google Calendar</p>
            <p className="text-[12px] text-blue-700 dark:text-blue-400 mt-0.5">Sync your events and schedule demos directly from the CRM.</p>
          </div>
          <a
            href={`${API}/auth/google-calendar/connect${userId ? `?userId=${encodeURIComponent(userId)}` : ''}`}
            className="ml-4 shrink-0 px-4 py-2 bg-blue-600 text-white text-[13px] font-medium rounded-lg hover:bg-blue-700"
          >
            Connect
          </a>
        </div>
      )}

      {status?.connected && (
        <div className="flex items-center gap-2 text-[12px] text-slate-500">
          <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
          Connected as <span className="font-medium text-slate-700 dark:text-slate-300 ml-1">{status.googleEmail}</span>
          {status.lastSyncedAt && (
            <span className="ml-auto">Last synced {new Date(status.lastSyncedAt).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })}</span>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4 items-start">
        <div>
          <div className="flex items-center gap-2.5 mb-3.5">
            <div className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
              {MONTHS[month]} {year}
            </div>
            <div className="ml-auto flex gap-1.5">
              <button onClick={handlePrev} className="px-3 py-1.5 text-[12px] border border-black/[.06] dark:border-white/[.08] rounded-lg hover:bg-slate-50 dark:hover:bg-white/[.04] dark:bg-white/[.03] text-slate-600 dark:text-slate-400">
                Prev
              </button>
              <button onClick={handleNext} className="px-3 py-1.5 text-[12px] border border-black/[.06] dark:border-white/[.08] rounded-lg hover:bg-slate-50 dark:hover:bg-white/[.04] dark:bg-white/[.03] text-slate-600 dark:text-slate-400">
                Next
              </button>
              <button
                onClick={() => { setClickedDate(undefined); setShowCreateModal(true) }}
                className="px-3 py-1.5 text-[12px] bg-primary text-white rounded-lg hover:bg-primary/90 font-medium"
              >
                + Event
              </button>
            </div>
          </div>

          <div className="border border-black/[.06] dark:border-white/[.08] rounded-lg overflow-hidden bg-white dark:bg-[#1e1e21]">
            <div className="grid grid-cols-7 border-b border-black/[.06] dark:border-white/[.08]">
              {DAYS.map(d => (
                <div key={d} className="py-2.5 text-center text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {cells.map((cell, i) => {
                const isToday = cell.current && cell.day === today && isCurrentMonth
                const cellEvents = eventsByDate[cell.dateKey] ?? []
                const isLastCol = (i + 1) % 7 === 0
                const isLastRow = i >= 35

                return (
                  <div
                    key={i}
                    onClick={() => { if (cell.current) { setClickedDate(cell.dateKey); setShowCreateModal(true) } }}
                    className={cn(
                      'min-h-[72px] md:min-h-[96px] px-1.5 py-1 transition-colors',
                      !isLastCol && 'border-r border-black/[.06] dark:border-white/[.08]',
                      !isLastRow && 'border-b border-black/[.06] dark:border-white/[.08]',
                      isToday && 'bg-slate-50 dark:bg-white/[.04]',
                      cell.current && 'cursor-pointer hover:bg-slate-50/80 dark:hover:bg-white/[.03]',
                      !cell.current && 'opacity-30 cursor-default',
                    )}
                  >
                    <div className={cn(
                      'text-[11px] tabular-nums mb-1 w-5 h-5 flex items-center justify-center rounded-full',
                      isToday ? 'bg-primary text-white font-bold' : 'text-slate-500'
                    )}>
                      {cell.day}
                    </div>
                    <div className="space-y-0.5">
                      {cellEvents.slice(0, 3).map(ev => (
                        <div
                          key={ev.id}
                          className={cn('text-[10px] font-medium text-white rounded px-1 py-0.5 truncate leading-tight', EVENT_TYPE_COLORS[ev.eventType] ?? 'bg-slate-400')}
                          title={`${ev.title} - ${formatTime(ev.startAt)}`}
                        >
                          <span className="hidden md:inline">{ev.title}</span>
                          <span className="md:hidden">*</span>
                        </div>
                      ))}
                      {cellEvents.length > 3 && (
                        <div className="text-[10px] text-slate-400 pl-1">+{cellEvents.length - 3} more</div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="flex items-center gap-4 mt-2.5 flex-wrap">
            {Object.entries(EVENT_TYPE_COLORS).map(([type, color]) => (
              <div key={type} className="flex items-center gap-1.5">
                <span className={cn('w-2 h-2 rounded-sm', color)} />
                <span className="text-[11px] text-slate-500 capitalize">{type.replace('_', ' ')}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="border border-black/[.06] dark:border-white/[.08] rounded-lg bg-white dark:bg-[#1e1e21] overflow-hidden">
          <div className="px-4 py-3 border-b border-black/[.06] dark:border-white/[.08]">
            <p className="text-[13px] font-semibold text-slate-900 dark:text-white">Upcoming</p>
          </div>
          <div className="p-3">
            {!status?.connected ? (
              <EmptyState
                icon="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                title="No calendar connected"
                description="Connect Google Calendar to see events"
                compact
              />
            ) : upcoming.length === 0 ? (
              <EmptyState
                icon="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                title="No upcoming events"
                description="Events will appear here"
                compact
              />
            ) : (
              <div className="space-y-2">
                {upcoming.map(ev => (
                  <div key={ev.id} className="flex items-start gap-2.5 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-white/[.04]">
                    <div className={cn('w-1 self-stretch rounded-full shrink-0 mt-0.5', EVENT_TYPE_COLORS[ev.eventType])} />
                    <div className="min-w-0">
                      <p className="text-[12px] font-semibold text-slate-800 truncate">{ev.title}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {new Date(ev.startAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })} &middot; {formatTime(ev.startAt)}
                      </p>
                      {ev.location && <p className="text-[11px] text-slate-400 mt-0.5 truncate">{ev.location}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {showCreateModal && (
        <CreateEventModal
          defaultDate={clickedDate}
          onClose={() => setShowCreateModal(false)}
          onCreated={() => qc.invalidateQueries({ queryKey: ['calendar', 'events'] })}
          userId={userId}
        />
      )}
    </div>
  )
}
