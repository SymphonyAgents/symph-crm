'use client'

import { useState, useMemo, useCallback, useEffect, useRef, type CSSProperties } from 'react'
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
import { X, ChevronLeft, ChevronRight, Clock, MapPin, Users } from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

const EVENT_TYPE_COLORS: Record<string, string> = {
  demo:           'bg-violet-500',
  discovery_call: 'bg-blue-500',
  followup:       'bg-amber-500',
  general:        'bg-slate-400',
}

const EVENT_TYPE_BADGE: Record<string, string> = {
  demo:           'bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-300',
  discovery_call: 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300',
  followup:       'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300',
  general:        'bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300',
}

// 7:00 AM to 10:00 PM in 15-minute intervals
const TIME_SLOTS = Array.from({ length: (22 - 7) * 4 + 1 }, (_, i) => {
  const totalMinutes = 7 * 60 + i * 15
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h
  const label = `${h12}:${String(m).padStart(2, '0')} ${ampm}`
  const value = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  return { label, value }
})

// Hours shown in week view grid (7am–10pm)
const HOURS = Array.from({ length: 16 }, (_, i) => i + 7)
const HOUR_PX = 64

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
  startDate: string
  startTime: string
  endDate: string
  endTime: string
  description: string
  location: string
  eventType: 'demo' | 'discovery_call' | 'followup' | 'general'
}

type CalendarView = 'month' | 'week'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toDateKey(iso: string) {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit', hour12: true })
}

function getWeekStart(date: Date): Date {
  const d = new Date(date)
  d.setDate(d.getDate() - d.getDay())
  d.setHours(0, 0, 0, 0)
  return d
}

function monthRange(year: number, month: number) {
  const from = new Date(year, month, 1).toISOString()
  const to = new Date(year, month + 1, 0, 23, 59, 59).toISOString()
  return { from, to }
}

function weekRange(weekStart: Date) {
  const from = new Date(weekStart)
  from.setHours(0, 0, 0, 0)
  const to = new Date(weekStart)
  to.setDate(to.getDate() + 6)
  to.setHours(23, 59, 59, 999)
  return { from: from.toISOString(), to: to.toISOString() }
}

// ─── TimePicker ───────────────────────────────────────────────────────────────

function TimePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-9 text-[12.5px]">
        <SelectValue placeholder="Select time" />
      </SelectTrigger>
      <SelectContent className="max-h-[200px]">
        {TIME_SLOTS.map(slot => (
          <SelectItem key={slot.value} value={slot.value} className="text-[12.5px]">
            {slot.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

// ─── EventDetailPanel ─────────────────────────────────────────────────────────

function EventDetailPanel({
  event,
  onClose,
  onOpenDeal,
}: {
  event: ApiCalendarEvent
  onClose: () => void
  onOpenDeal?: (id: string) => void
}) {
  useEscapeKey(useCallback(onClose, [onClose]))

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full sm:w-[380px] bg-white dark:bg-[#1e1e21] rounded-lg shadow-xl overflow-hidden animate-in slide-in-from-bottom sm:zoom-in-95 duration-150"
        onClick={e => e.stopPropagation()}
      >
        {/* Colored header strip */}
        <div className={cn('px-4 py-3 flex items-center justify-between', EVENT_TYPE_BADGE[event.eventType] ?? EVENT_TYPE_BADGE.general)}>
          <div className="flex items-center gap-2">
            <span className={cn('w-2.5 h-2.5 rounded-full shrink-0', EVENT_TYPE_COLORS[event.eventType] ?? 'bg-slate-400')} />
            <span className="text-[11px] font-semibold capitalize">
              {event.eventType.replace('_', ' ')}
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center rounded opacity-60 hover:opacity-100 transition-opacity"
          >
            <X size={14} />
          </button>
        </div>

        {/* Body — scrollable to prevent overflow on long attendee lists */}
        <div className="px-4 py-4 space-y-3 overflow-y-auto" style={{ maxHeight: 'calc(80vh - 120px)' }}>
          <h2 className="text-[15px] font-semibold text-slate-900 dark:text-white leading-snug">
            {event.title}
          </h2>

          <div className="flex items-start gap-2.5 text-[12.5px] text-slate-600 dark:text-slate-400">
            <Clock size={14} className="shrink-0 mt-0.5" />
            <span>
              {new Date(event.startAt).toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' })}
              {' · '}
              {formatTime(event.startAt)} – {formatTime(event.endAt)}
            </span>
          </div>

          {event.location && (
            <div className="flex items-start gap-2.5 text-[12.5px] text-slate-600 dark:text-slate-400">
              <MapPin size={14} className="shrink-0 mt-0.5" />
              <span>{event.location}</span>
            </div>
          )}

          {event.attendeeEmails.length > 0 && (
            <div className="flex items-start gap-2.5 text-[12.5px] text-slate-600 dark:text-slate-400">
              <Users size={14} className="shrink-0 mt-0.5" />
              <div className="space-y-0.5 max-h-[200px] overflow-y-auto">
                {event.attendeeEmails.map(email => (
                  <div key={email}>{email}</div>
                ))}
              </div>
            </div>
          )}

          {event.description && (
            <div className="text-[12px] text-slate-500 dark:text-slate-400 leading-relaxed whitespace-pre-wrap border-t border-black/[.06] dark:border-white/[.06] pt-3">
              {event.description}
            </div>
          )}
        </div>

        {event.dealId && onOpenDeal && (
          <div className="px-4 py-3 border-t border-black/[.06] dark:border-white/[.06]">
            <button
              onClick={() => { onOpenDeal(event.dealId!); onClose() }}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-[12.5px] font-medium text-primary hover:bg-primary/[.06] rounded-lg transition-colors"
            >
              Open deal
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── CreateEventModal ─────────────────────────────────────────────────────────

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

  const todayStr = new Date().toISOString().slice(0, 10)
  const [form, setForm] = useState<CreateEventForm>({
    title: '',
    startDate: defaultDate ?? todayStr,
    startTime: '09:00',
    endDate: defaultDate ?? todayStr,
    endTime: '10:00',
    description: '',
    location: '',
    eventType: 'general',
  })
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: async (data: CreateEventForm) => {
      const startAt = new Date(`${data.startDate}T${data.startTime}`).toISOString()
      const endAt = new Date(`${data.endDate}T${data.endTime}`).toISOString()
      const res = await fetch(`${API}/calendar/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': userId ?? '' },
        body: JSON.stringify({
          title: data.title,
          description: data.description || undefined,
          location: data.location || undefined,
          eventType: data.eventType,
          startAt,
          endAt,
        }),
      })
      if (!res.ok) throw new Error(await res.text())
      return res.json()
    },
    onSuccess: () => { onCreated(); onClose() },
    onError: (err: Error) => setError(err.message),
  })

  const set = <K extends keyof CreateEventForm>(k: K, v: CreateEventForm[K]) =>
    setForm(f => ({ ...f, [k]: v }))

  const canSubmit = !!form.title && !!form.startDate && !!form.startTime && !!form.endDate && !!form.endTime

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-[#1e1e21] rounded-lg shadow-xl w-full max-w-md p-6 animate-in zoom-in-95 duration-150"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-[15px] font-semibold text-slate-900 dark:text-white">New Event</h2>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[.08] transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-[11.5px] font-medium text-slate-500 dark:text-slate-400 mb-1">Title *</label>
            <Input
              className="h-9 text-[13px]"
              value={form.title}
              onChange={e => set('title', e.target.value)}
              placeholder="e.g. Discovery call with Jollibee"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-[11.5px] font-medium text-slate-500 dark:text-slate-400 mb-1">Type</label>
            <Select value={form.eventType} onValueChange={v => set('eventType', v as CreateEventForm['eventType'])}>
              <SelectTrigger className="h-9 text-[12.5px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="general" className="text-[12.5px]">General</SelectItem>
                <SelectItem value="demo" className="text-[12.5px]">Demo</SelectItem>
                <SelectItem value="discovery_call" className="text-[12.5px]">Discovery Call</SelectItem>
                <SelectItem value="followup" className="text-[12.5px]">Follow-up</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11.5px] font-medium text-slate-500 dark:text-slate-400 mb-1">Start date *</label>
              <Input
                type="date"
                className="h-9 text-[12.5px]"
                value={form.startDate}
                onChange={e => { set('startDate', e.target.value); if (!form.endDate || form.endDate < e.target.value) set('endDate', e.target.value) }}
              />
            </div>
            <div>
              <label className="block text-[11.5px] font-medium text-slate-500 dark:text-slate-400 mb-1">Start time *</label>
              <TimePicker value={form.startTime} onChange={v => set('startTime', v)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11.5px] font-medium text-slate-500 dark:text-slate-400 mb-1">End date *</label>
              <Input
                type="date"
                className="h-9 text-[12.5px]"
                value={form.endDate}
                onChange={e => set('endDate', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-[11.5px] font-medium text-slate-500 dark:text-slate-400 mb-1">End time *</label>
              <TimePicker value={form.endTime} onChange={v => set('endTime', v)} />
            </div>
          </div>

          <div>
            <label className="block text-[11.5px] font-medium text-slate-500 dark:text-slate-400 mb-1">Location</label>
            <Input
              className="h-9 text-[12.5px]"
              value={form.location}
              onChange={e => set('location', e.target.value)}
              placeholder="Google Meet, Zoom, office address..."
            />
          </div>

          <div>
            <label className="block text-[11.5px] font-medium text-slate-500 dark:text-slate-400 mb-1">Description</label>
            <Textarea
              className="text-[12.5px] min-h-[72px] resize-none"
              value={form.description}
              onChange={e => set('description', e.target.value)}
              placeholder="Agenda, notes..."
            />
          </div>

          {error && <p className="text-[12px] text-red-500">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={onClose}
              className="px-4 py-2 text-[12.5px] rounded-lg border border-black/[.06] dark:border-white/[.08] text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/[.04] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => mutation.mutate(form)}
              disabled={!canSubmit || mutation.isPending}
              className="px-4 py-2 text-[12.5px] rounded-lg bg-primary text-white font-semibold disabled:opacity-40 hover:bg-primary/90 transition-colors"
            >
              {mutation.isPending ? 'Creating…' : 'Create Event'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── WeekView ─────────────────────────────────────────────────────────────────

function WeekView({
  weekStart,
  events,
  onEventClick,
  onDayClick,
}: {
  weekStart: Date
  events: ApiCalendarEvent[]
  onEventClick: (ev: ApiCalendarEvent) => void
  onDayClick: (dateKey: string) => void
}) {
  const now = new Date()
  const today = toDateKey(now.toISOString())
  const scrollRef = useRef<HTMLDivElement>(null)
  const [nowMinutes, setNowMinutes] = useState(() => now.getHours() * 60 + now.getMinutes())

  // Scroll to current time (or 8 AM if before 8) on mount
  useEffect(() => {
    if (scrollRef.current) {
      const currentHour = new Date().getHours()
      const scrollHour = Math.max(currentHour - 1, 7) // scroll 1 hour before current time
      scrollRef.current.scrollTop = (scrollHour - 7) * HOUR_PX
    }
  }, [])

  // Update current time indicator every minute
  useEffect(() => {
    const tick = () => {
      const n = new Date()
      setNowMinutes(n.getHours() * 60 + n.getMinutes())
    }
    const interval = setInterval(tick, 60_000)
    return () => clearInterval(interval)
  }, [])

  // Position of "now" line — only shown if within the visible hours range (7am–10pm)
  const nowTop = (() => {
    const gridStartMin = 7 * 60
    const gridEndMin = 22 * 60
    if (nowMinutes < gridStartMin || nowMinutes > gridEndMin) return null
    return ((nowMinutes - gridStartMin) / 60) * HOUR_PX
  })()

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + i)
    return d
  })

  const eventsByDay: Record<string, ApiCalendarEvent[]> = {}
  for (const d of weekDays) {
    eventsByDay[toDateKey(d.toISOString())] = []
  }
  for (const ev of events) {
    const key = toDateKey(ev.startAt)
    if (eventsByDay[key]) eventsByDay[key].push(ev)
  }

  function getEventStyle(ev: ApiCalendarEvent): CSSProperties {
    const start = new Date(ev.startAt)
    const end = new Date(ev.endAt)
    const startMin = start.getHours() * 60 + start.getMinutes()
    const endMin = end.getHours() * 60 + end.getMinutes()
    const gridStartMin = 7 * 60
    const top = Math.max(((startMin - gridStartMin) / 60) * HOUR_PX, 0)
    const height = Math.max(((endMin - startMin) / 60) * HOUR_PX, HOUR_PX * 0.4)
    return { top, height, position: 'absolute' }
  }

  return (
    <div className="border border-black/[.06] dark:border-white/[.08] rounded-lg overflow-hidden bg-white dark:bg-[#1e1e21] flex flex-col">
      {/* Day headers */}
      <div
        className="grid border-b border-black/[.06] dark:border-white/[.08] shrink-0"
        style={{ gridTemplateColumns: '48px repeat(7, 1fr)' }}
      >
        <div className="py-2" />
        {weekDays.map(d => {
          const key = toDateKey(d.toISOString())
          const isToday = key === today
          return (
            <div key={key} className="py-2 text-center">
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
                {DAYS[d.getDay()]}
              </div>
              <div className={cn(
                'text-[15px] font-bold mx-auto w-7 h-7 flex items-center justify-center rounded-full mt-0.5 transition-colors',
                isToday ? 'bg-primary text-white' : 'text-slate-700 dark:text-slate-300',
              )}>
                {d.getDate()}
              </div>
            </div>
          )
        })}
      </div>

      {/* Scrollable time grid */}
      <div ref={scrollRef} className="overflow-y-auto" style={{ maxHeight: 520 }}>
        <div
          className="relative"
          style={{ display: 'grid', gridTemplateColumns: '48px repeat(7, 1fr)' }}
        >
          {/* Hour labels */}
          <div>
            {HOURS.map(h => (
              <div key={h} className="relative border-t border-black/[.04] dark:border-white/[.04]" style={{ height: HOUR_PX }}>
                <span className="absolute -top-2 right-2 text-[10px] text-slate-400 tabular-nums">
                  {h === 12 ? '12 PM' : h > 12 ? `${h - 12} PM` : `${h} AM`}
                </span>
              </div>
            ))}
          </div>

          {/* Day columns */}
          {weekDays.map(d => {
            const key = toDateKey(d.toISOString())
            const dayEvents = eventsByDay[key] ?? []
            const isToday = key === today
            const totalHeight = HOURS.length * HOUR_PX

            return (
              <div
                key={key}
                className={cn(
                  'relative border-l border-black/[.04] dark:border-white/[.04] cursor-pointer',
                  isToday && 'bg-primary/[.02]',
                )}
                style={{ height: totalHeight }}
                onClick={() => onDayClick(key)}
              >
                {/* Hour lines */}
                {HOURS.map(h => (
                  <div
                    key={h}
                    className="absolute left-0 right-0 border-t border-black/[.04] dark:border-white/[.04]"
                    style={{ top: (h - 7) * HOUR_PX }}
                  />
                ))}

                {/* Half-hour lines */}
                {HOURS.map(h => (
                  <div
                    key={`${h}-half`}
                    className="absolute left-0 right-0 border-t border-black/[.02] dark:border-white/[.02]"
                    style={{ top: (h - 7) * HOUR_PX + HOUR_PX / 2 }}
                  />
                ))}

                {/* Current time indicator — only on today's column */}
                {isToday && nowTop !== null && (
                  <div
                    className="absolute left-0 right-0 z-20 pointer-events-none flex items-center"
                    style={{ top: nowTop - 1 }}
                  >
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0 -ml-1.5 shadow-sm" />
                    <div className="flex-1 h-[1.5px] bg-red-500 -ml-1" />
                  </div>
                )}

                {/* Events */}
                {dayEvents.map(ev => (
                  <div
                    key={ev.id}
                    className={cn(
                      'absolute left-0.5 right-0.5 rounded px-1.5 py-0.5 overflow-hidden cursor-pointer hover:opacity-80 z-10 transition-opacity',
                      EVENT_TYPE_COLORS[ev.eventType] ?? 'bg-slate-400',
                    )}
                    style={getEventStyle(ev)}
                    onClick={e => { e.stopPropagation(); onEventClick(ev) }}
                    title={`${ev.title} · ${formatTime(ev.startAt)}`}
                  >
                    <div className="text-[10.5px] font-semibold text-white truncate leading-tight">{ev.title}</div>
                    <div className="text-[10px] text-white/80 truncate">{formatTime(ev.startAt)}</div>
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Main Calendar ────────────────────────────────────────────────────────────

type CalendarProps = {
  onOpenDeal?: (id: string) => void
}

export function Calendar({ onOpenDeal }: CalendarProps = {}) {
  const { userId } = useUser()
  const now = new Date()
  const [view, setView] = useState<CalendarView>('week')
  const [month, setMonth] = useState(now.getMonth())
  const [year, setYear] = useState(now.getFullYear())
  const [weekStart, setWeekStart] = useState(() => getWeekStart(now))
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [clickedDate, setClickedDate] = useState<string | undefined>()
  const [selectedEvent, setSelectedEvent] = useState<ApiCalendarEvent | null>(null)
  const [oauthBanner, setOauthBanner] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const searchParams = useSearchParams()
  const qc = useQueryClient()

  useEffect(() => {
    const connected = searchParams.get('connected')
    const oauthError = searchParams.get('oauth_error')
    if (connected === 'true') {
      setOauthBanner({ type: 'success', message: 'Google connected successfully!' })
      qc.invalidateQueries({ queryKey: queryKeys.calendar.status })
    } else if (oauthError) {
      setOauthBanner({ type: 'error', message: oauthError })
    }
    if (connected || oauthError) {
      const url = new URL(window.location.href)
      url.searchParams.delete('connected')
      url.searchParams.delete('oauth_error')
      window.history.replaceState({}, '', url.toString())
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const { from: mFrom, to: mTo } = monthRange(year, month)
  const { from: wFrom, to: wTo } = weekRange(weekStart)
  const from = view === 'month' ? mFrom : wFrom
  const to = view === 'month' ? mTo : wTo

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
  }, [events]) // eslint-disable-line react-hooks/exhaustive-deps

  // Month grid cells
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const prevMonthDays = new Date(year, month, 0).getDate()
  const todayDate = now.getDate()
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

  function handlePrev() {
    if (view === 'month') {
      if (month === 0) { setMonth(11); setYear(y => y - 1) } else setMonth(m => m - 1)
    } else {
      setWeekStart(prev => { const d = new Date(prev); d.setDate(d.getDate() - 7); return d })
    }
  }

  function handleNext() {
    if (view === 'month') {
      if (month === 11) { setMonth(0); setYear(y => y + 1) } else setMonth(m => m + 1)
    } else {
      setWeekStart(prev => { const d = new Date(prev); d.setDate(d.getDate() + 7); return d })
    }
  }

  function handleToday() {
    setMonth(now.getMonth())
    setYear(now.getFullYear())
    setWeekStart(getWeekStart(now))
  }

  const headerTitle = view === 'month'
    ? `${MONTHS[month]} ${year}`
    : (() => {
        const end = new Date(weekStart)
        end.setDate(end.getDate() + 6)
        if (weekStart.getMonth() === end.getMonth()) {
          return `${MONTHS_SHORT[weekStart.getMonth()]} ${weekStart.getDate()} – ${end.getDate()}, ${weekStart.getFullYear()}`
        }
        return `${MONTHS_SHORT[weekStart.getMonth()]} ${weekStart.getDate()} – ${MONTHS_SHORT[end.getMonth()]} ${end.getDate()}, ${weekStart.getFullYear()}`
      })()

  return (
    <div className="p-4 md:p-6 flex flex-col gap-4">
      {/* OAuth banner */}
      {oauthBanner && (
        <div className={cn(
          'flex items-center justify-between rounded-lg px-4 py-3 border text-[13px]',
          oauthBanner.type === 'success'
            ? 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800/40 text-green-800 dark:text-green-300'
            : 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800/40 text-red-800 dark:text-red-300',
        )}>
          <span className="font-medium">
            {oauthBanner.type === 'success' ? '✓ ' : '⚠ '}{oauthBanner.message}
          </span>
          <button
            onClick={() => setOauthBanner(null)}
            className="ml-4 shrink-0 text-[11px] opacity-60 hover:opacity-100 transition-opacity"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Connect banner */}
      {status && !status.connected && (
        <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/40 rounded-lg px-4 py-3">
          <div>
            <p className="text-[13px] font-semibold text-blue-900 dark:text-blue-300">Connect Google Calendar</p>
            <p className="text-[12px] text-blue-700 dark:text-blue-400 mt-0.5">Sync your events and schedule demos directly from the CRM.</p>
          </div>
          <a
            href={`${API}/auth/google-calendar/connect?userId=${encodeURIComponent(userId ?? '')}&returnTo=%2Fcalendar`}
            className="ml-4 shrink-0 px-4 py-2 bg-blue-600 text-white text-[12.5px] font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            Connect
          </a>
        </div>
      )}

      {/* Connection status */}
      {status?.connected && (
        <div className="flex items-center gap-2 text-[12px] text-slate-500 dark:text-slate-400">
          <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
          Connected as <span className="font-medium text-slate-700 dark:text-slate-300 ml-1">{status.googleEmail}</span>
          {status.lastSyncedAt && (
            <span className="ml-auto">
              Last synced {new Date(status.lastSyncedAt).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })}
            </span>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4 items-start">
        <div>
          {/* Calendar header — nav + view toggle */}
          <div className="flex items-center gap-2 mb-3.5 flex-wrap">
            <div className="text-base font-bold text-slate-900 dark:text-white tracking-tight">{headerTitle}</div>
            <div className="ml-auto flex items-center gap-1.5 flex-wrap">
              {/* Month / Week toggle */}
              <div className="flex rounded-lg overflow-hidden border border-black/[.06] dark:border-white/[.08]">
                <button
                  onClick={() => setView('month')}
                  className={cn(
                    'px-3 py-1.5 text-[11.5px] font-medium transition-colors',
                    view === 'month'
                      ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                      : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/[.04]',
                  )}
                >
                  Month
                </button>
                <button
                  onClick={() => setView('week')}
                  className={cn(
                    'px-3 py-1.5 text-[11.5px] font-medium border-l border-black/[.06] dark:border-white/[.08] transition-colors',
                    view === 'week'
                      ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                      : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/[.04]',
                  )}
                >
                  Week
                </button>
              </div>

              <button
                onClick={handlePrev}
                className="w-7 h-7 flex items-center justify-center rounded-lg border border-black/[.06] dark:border-white/[.08] hover:bg-slate-50 dark:hover:bg-white/[.04] text-slate-500 dark:text-slate-400 transition-colors"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                onClick={handleNext}
                className="w-7 h-7 flex items-center justify-center rounded-lg border border-black/[.06] dark:border-white/[.08] hover:bg-slate-50 dark:hover:bg-white/[.04] text-slate-500 dark:text-slate-400 transition-colors"
              >
                <ChevronRight size={14} />
              </button>

              <button
                onClick={handleToday}
                className="px-3 py-1.5 text-[11.5px] border border-black/[.06] dark:border-white/[.08] rounded-lg hover:bg-slate-50 dark:hover:bg-white/[.04] dark:bg-white/[.03] text-slate-600 dark:text-slate-400 transition-colors"
              >
                Today
              </button>
              <button
                onClick={() => { setClickedDate(undefined); setShowCreateModal(true) }}
                className="px-3 py-1.5 text-[11.5px] bg-primary text-white rounded-lg hover:bg-primary/90 font-medium transition-colors"
              >
                + Event
              </button>
            </div>
          </div>

          {/* Month view */}
          {view === 'month' && (
            <>
              <div className="border border-black/[.06] dark:border-white/[.08] rounded-lg overflow-hidden bg-white dark:bg-[#1e1e21]">
                <div className="grid grid-cols-7 border-b border-black/[.06] dark:border-white/[.08]">
                  {DAYS.map(d => (
                    <div key={d} className="py-2.5 text-center text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{d}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7">
                  {cells.map((cell, i) => {
                    const isToday = cell.current && cell.day === todayDate && isCurrentMonth
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
                          isToday ? 'bg-primary text-white font-bold' : 'text-slate-500 dark:text-slate-400',
                        )}>
                          {cell.day}
                        </div>
                        <div className="space-y-0.5">
                          {cellEvents.slice(0, 3).map(ev => (
                            <div
                              key={ev.id}
                              className={cn(
                                'text-[10px] font-medium text-white rounded px-1 py-0.5 truncate leading-tight cursor-pointer hover:opacity-80 transition-opacity',
                                EVENT_TYPE_COLORS[ev.eventType] ?? 'bg-slate-400',
                              )}
                              title={`${ev.title} · ${formatTime(ev.startAt)}`}
                              onClick={e => { e.stopPropagation(); setSelectedEvent(ev) }}
                            >
                              <span className="hidden md:inline">{ev.title}</span>
                              <span className="md:hidden">•</span>
                            </div>
                          ))}
                          {cellEvents.length > 3 && (
                            <div className="text-[10px] text-slate-400 dark:text-slate-500 pl-1">
                              +{cellEvents.length - 3} more
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Legend */}
              <div className="flex items-center gap-4 mt-2.5 flex-wrap">
                {Object.entries(EVENT_TYPE_COLORS).map(([type, color]) => (
                  <div key={type} className="flex items-center gap-1.5">
                    <span className={cn('w-2 h-2 rounded-sm', color)} />
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 capitalize">{type.replace('_', ' ')}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Week view */}
          {view === 'week' && (
            <WeekView
              weekStart={weekStart}
              events={events}
              onEventClick={setSelectedEvent}
              onDayClick={dateKey => { setClickedDate(dateKey); setShowCreateModal(true) }}
            />
          )}
        </div>

        {/* Upcoming sidebar */}
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
              <div className="space-y-1">
                {upcoming.map(ev => (
                  <button
                    key={ev.id}
                    onClick={() => setSelectedEvent(ev)}
                    className="w-full flex items-start gap-2.5 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-white/[.04] text-left transition-colors"
                  >
                    <div className={cn('w-1 self-stretch rounded-full shrink-0 mt-0.5', EVENT_TYPE_COLORS[ev.eventType])} />
                    <div className="min-w-0">
                      <p className="text-[12px] font-semibold text-slate-800 dark:text-slate-200 truncate">{ev.title}</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {new Date(ev.startAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })} · {formatTime(ev.startAt)}
                      </p>
                      {ev.location && (
                        <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 truncate">{ev.location}</p>
                      )}
                    </div>
                  </button>
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

      {selectedEvent && (
        <EventDetailPanel
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onOpenDeal={onOpenDeal}
        />
      )}
    </div>
  )
}
