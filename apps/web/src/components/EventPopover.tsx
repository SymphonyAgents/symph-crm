'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { Popover, PopoverContent, PopoverAnchor } from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Users, Video, MapPin, AlignLeft } from 'lucide-react'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CalendarEventDraft {
  title: string
  type: 'event' | 'task' | 'out_of_office' | 'appointment'
  date: Date
  startTime: string // "HH:MM"
  endTime: string   // "HH:MM"
  repeat: string
}

export interface EventPopoverProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  anchorRef?: React.RefObject<HTMLElement | null>
  initialDate?: Date
  initialTime?: string // "HH:MM" 24h format
  onSave?: (event: CalendarEventDraft) => void
  onCancel?: () => void
}

// ─── Time helpers ───────────────────────────────────────────────────────────

const ALL_TIME_SLOTS = Array.from({ length: 96 }, (_, i) => {
  const h = Math.floor(i / 4)
  const m = (i % 4) * 15
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h
  const label = `${h12}:${String(m).padStart(2, '0')} ${ampm}`
  const value = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  return { label, value }
})

function addHour(time: string): string {
  const [hStr, mStr] = time.split(':')
  let h = parseInt(hStr, 10) + 1
  if (h >= 24) h = 23
  return `${String(h).padStart(2, '0')}:${mStr}`
}

function formatDateDisplay(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
}

function getDayName(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'long' })
}

function getOrdinalDate(date: Date): string {
  const d = date.getDate()
  const s = ['th', 'st', 'nd', 'rd']
  const v = d % 100
  return `${d}${s[(v - 20) % 10] || s[v] || s[0]}`
}

function getMonthDay(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
}

// ─── Event type tabs ────────────────────────────────────────────────────────

type EventType = CalendarEventDraft['type']

const EVENT_TYPES: { value: EventType; label: string }[] = [
  { value: 'event', label: 'Event' },
  { value: 'task', label: 'Task' },
  { value: 'out_of_office', label: 'Out of office' },
  { value: 'appointment', label: 'Appointment schedule' },
]

function EventTypeTabs({ value, onChange }: { value: EventType; onChange: (v: EventType) => void }) {
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {EVENT_TYPES.map(t => (
        <button
          key={t.value}
          type="button"
          onClick={() => onChange(t.value)}
          className={cn(
            'px-3 py-1 rounded-full text-sm font-medium transition-colors whitespace-nowrap',
            value === t.value
              ? 'bg-blue-600 text-white'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[.06]',
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

// ─── Custom time picker ─────────────────────────────────────────────────────

function TimePickerDropdown({
  value,
  onChange,
  onClose,
}: {
  value: string
  onChange: (v: string) => void
  onClose: () => void
}) {
  const listRef = useRef<HTMLDivElement>(null)
  const selectedRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (selectedRef.current) {
      selectedRef.current.scrollIntoView({ block: 'center' })
    }
  }, [])

  return (
    <>
      {/* Invisible backdrop to close picker when clicking outside */}
      <div className="fixed inset-0 z-[60]" onClick={onClose} />
      <div
        ref={listRef}
        className="absolute top-full left-0 mt-1 z-[61] w-[130px] max-h-[200px] overflow-y-scroll rounded-lg bg-popover ring-1 ring-foreground/10 shadow-lg"
      >
        {ALL_TIME_SLOTS.map(slot => (
          <button
            key={slot.value}
            ref={slot.value === value ? selectedRef : undefined}
            type="button"
            onClick={() => { onChange(slot.value); onClose() }}
            className={cn(
              'w-full text-left px-3 py-1.5 text-sm transition-colors',
              slot.value === value
                ? 'bg-blue-600 text-white'
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[.08]',
            )}
          >
            {slot.label}
          </button>
        ))}
      </div>
    </>
  )
}

function TimeButton({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  const [open, setOpen] = useState(false)
  const slot = ALL_TIME_SLOTS.find(s => s.value === value)

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="px-2 py-1 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded transition-colors"
      >
        {slot?.label ?? value}
      </button>
      {open && (
        <TimePickerDropdown
          value={value}
          onChange={onChange}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  )
}

// ─── Repeat options ─────────────────────────────────────────────────────────

function getRepeatOptions(date: Date) {
  return [
    { value: 'none', label: 'Does not repeat' },
    { value: 'daily', label: 'Every day' },
    { value: 'weekly', label: `Every week on ${getDayName(date)}` },
    { value: 'monthly', label: `Every month on the ${getOrdinalDate(date)}` },
    { value: 'yearly', label: `Every year on ${getMonthDay(date)}` },
    { value: 'weekday', label: 'Every weekday (Mon\u2013Fri)' },
    { value: 'custom', label: 'Custom...' },
  ]
}

// ─── EventPopover ───────────────────────────────────────────────────────────

export function EventPopover({
  open,
  onOpenChange,
  anchorRef,
  initialDate,
  initialTime,
  onSave,
  onCancel,
}: EventPopoverProps) {
  const now = new Date()
  const date = initialDate ?? now
  const startTime = initialTime ?? `${String(now.getHours()).padStart(2, '0')}:00`

  const [title, setTitle] = useState('')
  const [eventType, setEventType] = useState<EventType>('event')
  const [startTimeVal, setStartTimeVal] = useState(startTime)
  const [endTimeVal, setEndTimeVal] = useState(addHour(startTime))
  const [repeat, setRepeat] = useState('none')

  const titleRef = useRef<HTMLInputElement>(null)

  // Reset form state when the popover opens with new values
  useEffect(() => {
    if (open) {
      const st = initialTime ?? `${String(now.getHours()).padStart(2, '0')}:00`
      setTitle('')
      setEventType('event')
      setStartTimeVal(st)
      setEndTimeVal(addHour(st))
      setRepeat('none')
      // Focus title input after a tick (Radix needs to mount first)
      setTimeout(() => titleRef.current?.focus(), 50)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialDate?.getTime(), initialTime])

  const repeatOptions = getRepeatOptions(date)

  const handleSave = useCallback(() => {
    if (!title.trim()) return
    onSave?.({
      title: title.trim(),
      type: eventType,
      date,
      startTime: startTimeVal,
      endTime: endTimeVal,
      repeat,
    })
    onOpenChange(false)
  }, [title, eventType, date, startTimeVal, endTimeVal, repeat, onSave, onOpenChange])

  const handleCancel = useCallback(() => {
    onCancel?.()
    onOpenChange(false)
  }, [onCancel, onOpenChange])

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      {/* Invisible anchor positioned at the click target */}
      {anchorRef?.current && (
        <PopoverAnchor virtualRef={anchorRef as React.RefObject<HTMLElement>} />
      )}
      <PopoverContent
        side="bottom"
        align="start"
        sideOffset={4}
        className="w-[380px] p-0"
        onOpenAutoFocus={e => e.preventDefault()}
      >
        <div className="p-4 space-y-3">
          {/* Title input */}
          <input
            ref={titleRef}
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSave() }}
            placeholder="Add title"
            className="w-full text-lg font-medium bg-transparent border-0 border-b-2 border-blue-600 dark:border-blue-400 pb-1 placeholder:text-slate-400 dark:placeholder:text-slate-500 text-slate-900 dark:text-white focus:outline-none"
          />

          {/* Event type tabs */}
          <EventTypeTabs value={eventType} onChange={setEventType} />

          {/* Date + time row */}
          <div className="flex items-center gap-1 flex-wrap">
            <button
              type="button"
              className="px-2 py-1 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[.06] rounded transition-colors"
            >
              {formatDateDisplay(date)}
            </button>
            <TimeButton value={startTimeVal} onChange={setStartTimeVal} />
            <span className="text-sm text-slate-400">&ndash;</span>
            <TimeButton value={endTimeVal} onChange={setEndTimeVal} />
          </div>

          {/* Repeat dropdown */}
          <Select value={repeat} onValueChange={setRepeat}>
            <SelectTrigger className="h-8 text-[12.5px] w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {repeatOptions.map(opt => (
                <SelectItem key={opt.value} value={opt.value} className="text-[12.5px]">
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Optional fields row (icons only) */}
          <div className="flex items-center gap-1">
            {[
              { icon: Users, label: 'Add guests' },
              { icon: Video, label: 'Add video conferencing' },
              { icon: MapPin, label: 'Add location' },
              { icon: AlignLeft, label: 'Add description' },
            ].map(({ icon: Icon, label }) => (
              <button
                key={label}
                type="button"
                title={label}
                className="w-8 h-8 flex items-center justify-center rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[.08] transition-colors"
              >
                <Icon size={16} />
              </button>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-black/[.06] dark:border-white/[.08]">
          <button
            type="button"
            onClick={handleCancel}
            className="px-4 py-1.5 text-sm rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[.06] transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!title.trim()}
            className="px-4 py-1.5 text-sm rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-40 transition-colors"
          >
            Save
          </button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
