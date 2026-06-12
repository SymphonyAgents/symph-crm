'use client'

import { useState, useMemo, useCallback, useEffect, useRef, type CSSProperties } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'next/navigation'
import { cn, toDateKey, formatTime, getWeekStart, monthRange, weekRange } from '@/lib/utils'
import type { ApiCalendarEvent, ApiTeamDemoEvent, CalendarStatus, CreateEventForm, CalendarView } from '@/lib/types'
import {
  MONTHS, MONTHS_SHORT, DAYS,
  EVENT_TYPE_COLORS, EVENT_TYPE_BADGE, EVENT_TYPE_HEX, TIME_SLOTS, HOURS, HOUR_PX,
} from '@/lib/constants'
import { BACKEND_API_URL } from '@/lib/backend-url'
import { queryKeys } from '@/lib/query-keys'
import { useGetCalendarStatus, useGetCalendarEvents, useGetTeamDemos } from '@/lib/hooks/queries'
import { useCreateCalendarEvent } from '@/lib/hooks/mutations'
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
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { EventPopover, type CalendarEventDraft } from './EventPopover'

// ─── Event style helpers ───────────────────────────────────────────────────────
// Google Calendar convention:
//   isOwner = true  → solid fill (you created/organized this event)
//   isOwner = false → outline / ghost (you were invited — shows the color but not filled)

function getEventChipStyle(ev: ApiCalendarEvent): CSSProperties {
  const hex = EVENT_TYPE_HEX[ev.eventType] ?? '#94a3b8'
  if (ev.isOwner !== false) {
    // Solid fill — owned event
    return { background: hex }
  }
  // Outline — non-owned / invited event
  return {
    background: `${hex}18`,
    border: `1.5px solid ${hex}`,
    color: hex,
  }
}

function eventTextClass(ev: ApiCalendarEvent): string {
  return ev.isOwner !== false ? 'text-white' : ''
}

// ─── TimePicker ───────────────────────────────────────────────────────────────

function TimePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-9 text-ssm">
        <SelectValue placeholder="Select time" />
      </SelectTrigger>
      <SelectContent className="max-h-[200px]">
        {TIME_SLOTS.map(slot => (
          <SelectItem key={slot.value} value={slot.value} className="text-ssm">
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
        className="w-full sm:w-[380px] bg-card rounded-lg shadow-xl overflow-hidden animate-in slide-in-from-bottom sm:zoom-in-95 duration-150"
        onClick={e => e.stopPropagation()}
      >
        {/* Colored header strip */}
        <div className={cn('px-4 py-3 flex items-center justify-between', EVENT_TYPE_BADGE[event.eventType] ?? EVENT_TYPE_BADGE.general)}>
          <div className="flex items-center gap-2">
            <span className={cn('w-2.5 h-2.5 rounded-full shrink-0', EVENT_TYPE_COLORS[event.eventType] ?? 'bg-slate-400')} />
            <span className="text-xxs font-semibold capitalize">
              {event.eventType.replace('_', ' ')}
            </span>
            {event.isOwner === false && (
              <span className="text-atom opacity-60 font-normal">(invited)</span>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center rounded opacity-60 hover:opacity-100 transition-opacity"
          >
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="px-4 py-4 space-y-3 overflow-y-auto" style={{ maxHeight: 'calc(80vh - 120px)' }}>
          <h2 className="text-sbase font-semibold text-foreground leading-snug">
            {event.title}
          </h2>

          <div className="flex items-start gap-2.5 text-ssm text-muted-foreground">
            <Clock size={14} className="shrink-0 mt-0.5" />
            <span>
              {new Date(event.startAt).toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' })}
              {' · '}
              {formatTime(event.startAt)} – {formatTime(event.endAt)}
            </span>
          </div>

          {event.location && (
            <div className="flex items-start gap-2.5 text-ssm text-muted-foreground">
              <MapPin size={14} className="shrink-0 mt-0.5" />
              <span>{event.location}</span>
            </div>
          )}

          {event.attendeeEmails.length > 0 && (
            <div className="flex items-start gap-2.5 text-ssm text-muted-foreground">
              <Users size={14} className="shrink-0 mt-0.5" />
              <div className="space-y-0.5 max-h-[200px] overflow-y-auto">
                {event.attendeeEmails.map(email => (
                  <div key={email}>{email}</div>
                ))}
              </div>
            </div>
          )}

          {event.description && (
            <div className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap border-t border-border pt-3">
              {event.description}
            </div>
          )}
        </div>

        {event.dealId && onOpenDeal && (
          <div className="px-4 py-3 border-t border-border">
            <button
              onClick={() => { onOpenDeal(event.dealId!); onClose() }}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-ssm font-medium text-primary hover:bg-primary/[.06] rounded-lg transition-colors"
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

  const mutation = useCreateCalendarEvent({
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
        className="bg-card rounded-lg shadow-xl w-full max-w-md mx-4 p-6 animate-in zoom-in-95 duration-150"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sbase font-semibold text-foreground">New Event</h2>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:text-foreground hover:bg-surface-hover transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Title *</label>
            <Input
              className="h-9 text-ssm"
              value={form.title}
              onChange={e => set('title', e.target.value)}
              placeholder="e.g. Discovery call with Jollibee"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Type</label>
            <Select value={form.eventType} onValueChange={v => set('eventType', v as CreateEventForm['eventType'])}>
              <SelectTrigger className="h-9 text-ssm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="general" className="text-ssm">General</SelectItem>
                <SelectItem value="demo" className="text-ssm">Demo</SelectItem>
                <SelectItem value="discovery_call" className="text-ssm">Discovery Call</SelectItem>
                <SelectItem value="followup" className="text-ssm">Follow-up</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Start date *</label>
              <Input
                type="date"
                className="h-9 text-ssm"
                value={form.startDate}
                onChange={e => { set('startDate', e.target.value); if (!form.endDate || form.endDate < e.target.value) set('endDate', e.target.value) }}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Start time *</label>
              <TimePicker value={form.startTime} onChange={v => set('startTime', v)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">End date *</label>
              <Input
                type="date"
                className="h-9 text-ssm"
                value={form.endDate}
                onChange={e => set('endDate', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">End time *</label>
              <TimePicker value={form.endTime} onChange={v => set('endTime', v)} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Location</label>
            <Input
              className="h-9 text-ssm"
              value={form.location}
              onChange={e => set('location', e.target.value)}
              placeholder="Google Meet, Zoom, office address..."
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Description</label>
            <Textarea
              className="text-ssm min-h-[72px] resize-none"
              value={form.description}
              onChange={e => set('description', e.target.value)}
              placeholder="Agenda, notes..."
            />
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={onClose}
              className="px-4 py-2 text-ssm rounded-lg border border-border text-muted-foreground hover:bg-surface-hover transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => mutation.mutate(form)}
              disabled={!canSubmit || mutation.isPending}
              className="flex items-center gap-1.5 px-4 py-2 text-ssm rounded-lg bg-primary text-white font-semibold disabled:opacity-40 hover:bg-primary/90 transition-colors"
            >
              <>{mutation.isPending && <span className="inline-block w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />}Create Event</>
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
  onTimeCellClick,
}: {
  weekStart: Date
  events: ApiCalendarEvent[]
  onEventClick: (ev: ApiCalendarEvent) => void
  onDayClick: (dateKey: string) => void
  onTimeCellClick?: (dateKey: string, hour: number, rect: DOMRect) => void
}) {
  const now = new Date()
  const today = toDateKey(now.toISOString())
  const scrollRef = useRef<HTMLDivElement>(null)
  const [nowMinutes, setNowMinutes] = useState(() => now.getHours() * 60 + now.getMinutes())

  const gridStartHour = HOURS[0]

  // Scroll to current time (or 8 AM if before 8) on mount
  useEffect(() => {
    if (scrollRef.current) {
      const currentHour = new Date().getHours()
      const scrollHour = Math.max(currentHour - 1, gridStartHour)
      scrollRef.current.scrollTop = (scrollHour - gridStartHour) * HOUR_PX
    }
  }, [gridStartHour])

  // Update current time indicator every minute
  useEffect(() => {
    const tick = () => {
      const n = new Date()
      setNowMinutes(n.getHours() * 60 + n.getMinutes())
    }
    const interval = setInterval(tick, 60_000)
    return () => clearInterval(interval)
  }, [])

  // Position of "now" line
  const nowTop = (() => {
    const gridStartMin = gridStartHour * 60
    const gridEndMin = HOURS[HOURS.length - 1] * 60
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
    const gridStartMin = gridStartHour * 60
    const top = Math.max(((startMin - gridStartMin) / 60) * HOUR_PX, 0)
    const height = Math.max(((endMin - startMin) / 60) * HOUR_PX, HOUR_PX * 0.4)
    return { top, height, position: 'absolute', ...getEventChipStyle(ev) }
  }

  return (
    // h-full so it expands to fill the flex container on desktop
    <div className="border border-border rounded-lg overflow-hidden bg-card flex flex-col h-full">
      {/* Day headers — fixed, never scrolls */}
      <div
        className="grid border-b border-border shrink-0"
        style={{ gridTemplateColumns: '44px repeat(7, 1fr)' }}
      >
        <div className="py-2" />
        {weekDays.map(d => {
          const key = toDateKey(d.toISOString())
          const isToday = key === today
          return (
            <div key={key} className="py-2 text-center">
              <div className="eyebrow-label">
                {DAYS[d.getDay()]}
              </div>
              <div className={cn(
                'text-sbase font-bold mx-auto w-7 h-7 flex items-center justify-center rounded-full mt-0.5 transition-colors',
                isToday ? 'bg-primary text-white' : 'text-muted-foreground',
              )}>
                {d.getDate()}
              </div>
            </div>
          )
        })}
      </div>

      {/* Scrollable time grid — flex-1 fills remaining height */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0" style={{ minHeight: 320 }}>
        <div
          className="relative"
          style={{ display: 'grid', gridTemplateColumns: '44px repeat(7, 1fr)' }}
        >
          {/* Hour labels */}
          <div>
            {HOURS.map(h => (
              <div key={h} className="relative border-t border-border" style={{ height: HOUR_PX }}>
                <span className="absolute -top-2 right-2 text-atom text-slate-400 tabular-nums select-none">
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
                  'relative border-l border-border cursor-pointer',
                  isToday && 'bg-primary/[.02]',
                )}
                style={{ height: totalHeight }}
                onClick={(e) => {
                  // Calculate which hour was clicked based on position
                  const rect = e.currentTarget.getBoundingClientRect()
                  const clickY = e.clientY - rect.top
                  const clickedHour = gridStartHour + Math.floor(clickY / HOUR_PX)
                  if (onTimeCellClick) {
                    // Get position for popover anchoring
                    const cellRect = new DOMRect(
                      rect.left,
                      rect.top + (clickedHour - gridStartHour) * HOUR_PX,
                      rect.width,
                      HOUR_PX,
                    )
                    onTimeCellClick(key, clickedHour, cellRect)
                  } else {
                    onDayClick(key)
                  }
                }}
              >
                {/* Hour lines */}
                {HOURS.map(h => (
                  <div
                    key={h}
                    className="absolute left-0 right-0 border-t border-border"
                    style={{ top: (h - gridStartHour) * HOUR_PX }}
                  />
                ))}

                {/* Half-hour lines */}
                {HOURS.map(h => (
                  <div
                    key={`${h}-half`}
                    className="absolute left-0 right-0 border-t border-border"
                    style={{ top: (h - gridStartHour) * HOUR_PX + HOUR_PX / 2 }}
                  />
                ))}

                {/* Current time indicator */}
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
                      eventTextClass(ev),
                    )}
                    style={getEventStyle(ev)}
                    onClick={e => { e.stopPropagation(); onEventClick(ev) }}
                    title={`${ev.title} · ${formatTime(ev.startAt)}`}
                  >
                    <div className="text-xxs font-semibold truncate leading-tight">{ev.title}</div>
                    <div className="text-atom opacity-80 truncate">{formatTime(ev.startAt)}</div>
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

// ─── Team Demos Panel ──────────────────────────────────────────────────────────

function groupDemosByDay(demos: ApiTeamDemoEvent[]): { label: string; demos: ApiTeamDemoEvent[] }[] {
  const now = new Date()
  const todayStr = toDateKey(now.toISOString())
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = toDateKey(tomorrow.toISOString())

  // End of the current week (Sunday)
  const endOfWeek = new Date(now)
  endOfWeek.setDate(endOfWeek.getDate() + (7 - endOfWeek.getDay()))
  const endOfWeekStr = toDateKey(endOfWeek.toISOString())

  const groups: Record<string, ApiTeamDemoEvent[]> = {
    Today: [],
    Tomorrow: [],
    'This Week': [],
    Later: [],
  }

  for (const d of demos) {
    const dateStr = toDateKey(d.startAt)
    if (dateStr === todayStr) groups['Today'].push(d)
    else if (dateStr === tomorrowStr) groups['Tomorrow'].push(d)
    else if (dateStr <= endOfWeekStr) groups['This Week'].push(d)
    else groups['Later'].push(d)
  }

  return Object.entries(groups)
    .filter(([, arr]) => arr.length > 0)
    .map(([label, arr]) => ({ label, demos: arr }))
}

function getInitialsColor(name: string | null): string {
  const colors = [
    '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
    '#ec4899', '#06b6d4', '#f97316', '#14b8a6', '#6366f1',
  ]
  if (!name) return colors[0]
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}

function TeamDemosPanel({
  demos,
  loading,
  onOpenDeal,
}: {
  demos: ApiTeamDemoEvent[]
  loading: boolean
  onOpenDeal?: (id: string) => void
}) {
  const grouped = useMemo(() => groupDemosByDay(demos), [demos])

  return (
    <div className="border border-border rounded-lg bg-card overflow-hidden flex flex-col">
      <div className="px-4 py-3 border-b border-border shrink-0 flex items-center justify-between">
        <p className="text-ssm font-semibold text-foreground">Team Demos</p>
        <Badge variant="muted" className="text-xxs font-medium">
          {demos.length}
        </Badge>
      </div>
      <div className="p-3 flex-1 overflow-y-auto max-h-[360px]">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex items-start gap-2.5 p-2">
                <Skeleton className="w-7 h-7 rounded-full shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3 w-3/4 rounded" />
                  <Skeleton className="h-2.5 w-1/2 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : demos.length === 0 ? (
          <EmptyState
            icon="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
            title="No upcoming demos"
            description="Demos from all team members will appear here"
            compact
          />
        ) : (
          <div className="space-y-3">
            {grouped.map(group => (
              <div key={group.label}>
                <p className="eyebrow-label mb-1.5 px-2">{group.label}</p>
                <div className="space-y-0.5">
                  {group.demos.map(demo => {
                    const initials = demo.userName
                      ? demo.userName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
                      : '??'
                    const bgColor = getInitialsColor(demo.userName)
                    return (
                      <button
                        key={demo.id}
                        onClick={() => demo.dealId && onOpenDeal?.(demo.dealId)}
                        disabled={!demo.dealId}
                        className={cn(
                          'w-full flex items-start gap-2.5 p-2 rounded-lg text-left transition-colors',
                          demo.dealId
                            ? 'hover:bg-surface-hover cursor-pointer'
                            : 'cursor-default'
                        )}
                      >
                        {/* AM initials avatar */}
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xxs font-bold shrink-0"
                          style={{ background: bgColor }}
                          title={demo.userName || 'Unknown'}
                        >
                          {initials}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-foreground truncate">{demo.title}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-xxs text-muted-foreground">
                              {new Date(demo.startAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })} · {formatTime(demo.startAt)}
                            </span>
                          </div>
                          {demo.userName && (
                            <p className="text-xxs text-text-faint mt-0.5 truncate">{demo.userName}</p>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
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
  const [view, setView] = useState<CalendarView>('week')
  const [month, setMonth] = useState(now.getMonth())
  const [year, setYear] = useState(now.getFullYear())
  const [weekStart, setWeekStart] = useState(() => getWeekStart(now))
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [clickedDate, setClickedDate] = useState<string | undefined>()
  const [selectedEvent, setSelectedEvent] = useState<ApiCalendarEvent | null>(null)
  // EventPopover state (for week/day view time cell clicks)
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [popoverDate, setPopoverDate] = useState<Date | undefined>()
  const [popoverTime, setPopoverTime] = useState<string | undefined>()
  const [popoverAnchorRect, setPopoverAnchorRect] = useState<DOMRect | null>(null)
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

  const { data: status } = useGetCalendarStatus({ enabled: !!userId })
  const { data: events = [] } = useGetCalendarEvents(
    { from, to },
    { enabled: !!status?.connected },
  )

  // Team demos query — always-on, shows all demos across the entire team
  const teamDemosFrom = new Date().toISOString()
  const teamDemosTo = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
  const { data: teamDemos = [], isLoading: teamDemosLoading } = useGetTeamDemos(
    { from: teamDemosFrom, to: teamDemosTo },
  )

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

  // ─── Layout: flush to viewport height ─────────────────────────────────────
  // Outer div is h-full — fills the <main> container in CrmShell.
  // Banners / header are shrink-0. The main grid is flex-1 min-h-0.
  // On mobile (< lg): single column, outer container scrolls.
  // On desktop (lg+): two-column grid, internal scroll only (overflow-hidden).

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── Fixed top area: banners + connection status ─────────────────── */}
      <div className="shrink-0 px-4 md:px-6 pt-4 md:pt-5 flex flex-col gap-2.5">
        {/* OAuth result banner */}
        {oauthBanner && (
          <div className={cn(
            'flex items-center justify-between rounded-lg px-4 py-3 border text-ssm',
            oauthBanner.type === 'success'
              ? 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800/40 text-green-800 dark:text-green-300'
              : 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800/40 text-red-800 dark:text-red-300',
          )}>
            <span className="font-medium">
              {oauthBanner.type === 'success' ? '✓ ' : '⚠ '}{oauthBanner.message}
            </span>
            <button
              onClick={() => setOauthBanner(null)}
              className="ml-4 shrink-0 text-xxs opacity-60 hover:opacity-100 transition-opacity"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Connect Google Calendar banner */}
        {status && !status.connected && (
          <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/40 rounded-lg px-4 py-3">
            <div>
              <p className="text-ssm font-semibold text-blue-900 dark:text-blue-300">Connect Google Calendar</p>
              <p className="text-xs text-blue-700 dark:text-blue-400 mt-0.5">Sync your events and schedule demos directly from the CRM.</p>
            </div>
            <a
              href={`${BACKEND_API_URL}/auth/google-calendar/connect?returnTo=%2Fcalendar`}
              className="ml-4 shrink-0 px-4 py-2 bg-blue-600 text-white text-ssm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              Connect
            </a>
          </div>
        )}

        {/* Connection status pill */}
        {status?.connected && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
            Connected as <span className="font-medium text-muted-foreground ml-1">{status.googleEmail}</span>
            {status.lastSyncedAt && (
              <span className="ml-auto tabular-nums">
                Last synced {new Date(status.lastSyncedAt).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })}
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── Main content area ────────────────────────────────────────────── */}
      {/* On mobile: flex-col + overflow-y-auto (natural page scroll)        */}
      {/* On desktop: grid two-column + overflow-hidden (internal scroll)    */}
      <div className={cn(
        'flex-1 min-h-0 px-4 md:px-6 pb-4 md:pb-5 pt-3',
        'flex flex-col gap-4',
        'lg:grid lg:grid-cols-[1fr_280px]',
        'overflow-y-auto lg:overflow-hidden',
      )}>

        {/* ── Calendar column ───────────────────────────────────────────── */}
        <div className="flex flex-col min-h-0">

          {/* Nav header */}
          <div className="shrink-0 flex items-center gap-2 mb-3 flex-wrap">
            <div className="text-sbase font-bold text-foreground tracking-tight truncate">
              {headerTitle}
            </div>
            <div className="ml-auto flex items-center gap-1.5 flex-wrap">
              {/* Month / Week toggle */}
              <div className="flex items-center bg-secondary rounded-lg p-0.5 gap-0.5">
                {(['month', 'week'] as CalendarView[]).map(v => (
                  <button
                    key={v}
                    onClick={() => setView(v)}
                    className={cn(
                      'h-[26px] px-2.5 rounded-lg text-xs font-medium transition-all',
                      view === v
                        ? 'bg-card text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-slate-700 hover:text-foreground',
                    )}
                  >
                    {v.charAt(0).toUpperCase() + v.slice(1)}
                  </button>
                ))}
              </div>

              <button
                onClick={handlePrev}
                className="w-7 h-7 flex items-center justify-center rounded-lg border border-border hover:bg-surface-hover text-muted-foreground transition-colors"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                onClick={handleNext}
                className="w-7 h-7 flex items-center justify-center rounded-lg border border-border hover:bg-surface-hover text-muted-foreground transition-colors"
              >
                <ChevronRight size={14} />
              </button>

              <button
                onClick={handleToday}
                className="px-3 py-1.5 text-xs border border-border rounded-lg hover:bg-surface-hover text-muted-foreground transition-colors"
              >
                Today
              </button>
              <button
                onClick={() => { setClickedDate(undefined); setShowCreateModal(true) }}
                className="px-3 py-1.5 text-xs bg-primary text-white rounded-lg hover:bg-primary/90 font-medium transition-colors"
              >
                + Event
              </button>
            </div>
          </div>

          {/* Month view — natural height, scroll on mobile */}
          {view === 'month' && (
            <div className="flex-1 min-h-0 overflow-y-auto">
              <div className="border border-border rounded-lg overflow-hidden bg-card">
                <div className="grid grid-cols-7 border-b border-border">
                  {DAYS.map(d => (
                    <div key={d} className="py-2.5 text-center eyebrow-label">{d}</div>
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
                          'min-h-[72px] md:min-h-[88px] px-1.5 py-1 transition-colors',
                          !isLastCol && 'border-r border-border',
                          !isLastRow && 'border-b border-border',
                          isToday && 'bg-surface-alt',
                          cell.current && 'cursor-pointer hover:bg-surface-alt',
                          !cell.current && 'opacity-30 cursor-default',
                        )}
                      >
                        <div className={cn(
                          'text-xxs tabular-nums mb-1 w-5 h-5 flex items-center justify-center rounded-full',
                          isToday ? 'bg-primary text-white font-bold' : 'text-muted-foreground',
                        )}>
                          {cell.day}
                        </div>
                        <div className="space-y-0.5">
                          {cellEvents.slice(0, 3).map(ev => {
                            const chipStyle = getEventChipStyle(ev)
                            const isOwned = ev.isOwner !== false
                            return (
                              <div
                                key={ev.id}
                                className={cn(
                                  'text-atom font-medium rounded px-1 py-px truncate leading-tight cursor-pointer hover:opacity-80 transition-opacity',
                                  isOwned ? 'text-white' : '',
                                )}
                                style={chipStyle}
                                title={`${ev.title} · ${formatTime(ev.startAt)}`}
                                onClick={e => { e.stopPropagation(); setSelectedEvent(ev) }}
                              >
                                <span className="hidden md:inline">{ev.title}</span>
                                <span className="md:hidden">•</span>
                              </div>
                            )
                          })}
                          {cellEvents.length > 3 && (
                            <div className="text-atom text-text-faint pl-1">
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
                {Object.entries(EVENT_TYPE_HEX).map(([type, hex]) => (
                  <div key={type} className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-sm" style={{ background: hex }} />
                    <span className="text-xxs text-muted-foreground capitalize">{type.replace('_', ' ')}</span>
                  </div>
                ))}
                {/* Legend: owned vs invited */}
                <div className="ml-auto flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-sm bg-violet-500" />
                    <span className="text-xxs text-slate-400">Organized</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-sm border-2 border-violet-500" style={{ background: 'rgba(139,92,246,0.1)' }} />
                    <span className="text-xxs text-slate-400">Invited</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Week view — flex-1 so it fills remaining height on desktop */}
          {view === 'week' && (
            <div className="flex-1 min-h-0">
              <WeekView
                weekStart={weekStart}
                events={events}
                onEventClick={setSelectedEvent}
                onDayClick={dateKey => { setClickedDate(dateKey); setShowCreateModal(true) }}
                onTimeCellClick={(dateKey, hour, rect) => {
                  const [y, m, d] = dateKey.split('-').map(Number)
                  setPopoverDate(new Date(y, m - 1, d))
                  setPopoverTime(`${String(hour).padStart(2, '0')}:00`)
                  setPopoverAnchorRect(rect ?? null)
                  setPopoverOpen(true)
                }}
              />
            </div>
          )}
        </div>

        {/* ── Right sidebar ────────────────────────────────────────────── */}
        <div className="flex flex-col gap-4 min-h-0 overflow-y-auto">

        {/* Upcoming */}
        <div className="border border-border rounded-lg bg-card overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-border shrink-0">
            <p className="text-ssm font-semibold text-foreground">Upcoming</p>
          </div>
          <div className="p-3 flex-1 overflow-y-auto">
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
              <div className="space-y-0.5">
                {upcoming.map(ev => {
                  const hex = EVENT_TYPE_HEX[ev.eventType] ?? '#94a3b8'
                  return (
                    <button
                      key={ev.id}
                      onClick={() => setSelectedEvent(ev)}
                      className="w-full flex items-start gap-2.5 p-2 rounded-lg hover:bg-surface-hover text-left transition-colors"
                    >
                      {/* Color strip — solid for owned, dashed/outline for invited */}
                      <div
                        className="w-1 self-stretch rounded-full shrink-0 mt-0.5"
                        style={{
                          background: ev.isOwner !== false ? hex : 'transparent',
                          border: ev.isOwner !== false ? 'none' : `1.5px solid ${hex}`,
                        }}
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-foreground truncate">{ev.title}</p>
                        <p className="text-xxs text-muted-foreground mt-0.5">
                          {new Date(ev.startAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })} · {formatTime(ev.startAt)}
                        </p>
                        {ev.location && (
                          <p className="text-xxs text-text-faint mt-0.5 truncate">{ev.location}</p>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Team Demos ──────────────────────────────────────────────── */}
        <TeamDemosPanel demos={teamDemos} loading={teamDemosLoading} onOpenDeal={onOpenDeal} />

        </div>
      </div>

      {/* ── Modals ───────────────────────────────────────────────────────── */}
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

      {/* Dialog modal for quick event creation */}
      <EventPopover
        open={popoverOpen}
        onOpenChange={setPopoverOpen}
        anchorRect={popoverAnchorRect}
        initialDate={popoverDate}
        initialTime={popoverTime}
        onSave={(draft) => {
          console.log('EventPopover save:', draft)
          setPopoverOpen(false)
        }}
      />
    </div>
  )
}
