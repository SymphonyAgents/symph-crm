'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { KANBAN_STAGES, CLOSED_STAGE_IDS } from '@/lib/constants'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CalendarEventDraft {
  title: string
  stage: string
  startDate: string  // "YYYY-MM-DD"
  startTime: string  // "HH:MM"
  endDate: string    // "YYYY-MM-DD"
  endTime: string    // "HH:MM"
  location?: string
  description?: string
}

export interface EventPopoverProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialDate?: Date
  initialTime?: string  // "HH:MM" 24h
  onSave?: (event: CalendarEventDraft) => void
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

function toDateInputValue(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// ─── Stage options (exclude terminal stages) ────────────────────────────────

const STAGE_OPTIONS = [
  { value: 'general', label: 'General' },
  ...KANBAN_STAGES
    .filter(s => !CLOSED_STAGE_IDS.has(s.id))
    .map(s => ({ value: s.id, label: s.label })),
]

// ─── Custom time picker (preserved from original) ──────────────────────────

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
        className="absolute top-full left-0 mt-1 z-[61] w-full max-h-[200px] overflow-y-auto rounded-lg bg-popover ring-1 ring-foreground/10 shadow-lg"
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
        className="w-full h-10 rounded-lg border border-slate-200 dark:border-white/[.12] bg-white dark:bg-white/[.04] text-sm px-3 text-left focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 text-slate-900 dark:text-white"
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

// ─── Label style ────────────────────────────────────────────────────────────

const labelClass = 'text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 block'
const inputClass = 'w-full h-10 rounded-lg border border-slate-200 dark:border-white/[.12] bg-white dark:bg-white/[.04] text-sm px-3 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500'

// ─── EventPopover (now a Dialog modal) ─────────────────────────────────────

export function EventPopover({
  open,
  onOpenChange,
  initialDate,
  initialTime,
  onSave,
}: EventPopoverProps) {
  const now = new Date()
  const date = initialDate ?? now
  const startTime = initialTime ?? `${String(now.getHours()).padStart(2, '0')}:00`
  const dateStr = toDateInputValue(date)

  const [title, setTitle] = useState('')
  const [stage, setStage] = useState('general')
  const [startDateVal, setStartDateVal] = useState(dateStr)
  const [startTimeVal, setStartTimeVal] = useState(startTime)
  const [endDateVal, setEndDateVal] = useState(dateStr)
  const [endTimeVal, setEndTimeVal] = useState(addHour(startTime))
  const [location, setLocation] = useState('')
  const [description, setDescription] = useState('')

  const titleRef = useRef<HTMLInputElement>(null)

  // Reset form state when the modal opens with new values
  useEffect(() => {
    if (open) {
      const st = initialTime ?? `${String(now.getHours()).padStart(2, '0')}:00`
      const ds = toDateInputValue(initialDate ?? now)
      setTitle('')
      setStage('general')
      setStartDateVal(ds)
      setStartTimeVal(st)
      setEndDateVal(ds)
      setEndTimeVal(addHour(st))
      setLocation('')
      setDescription('')
      setTimeout(() => titleRef.current?.focus(), 50)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialDate?.getTime(), initialTime])

  const handleSave = useCallback(() => {
    if (!title.trim()) return
    onSave?.({
      title: title.trim(),
      stage,
      startDate: startDateVal,
      startTime: startTimeVal,
      endDate: endDateVal,
      endTime: endTimeVal,
      location: location.trim() || undefined,
      description: description.trim() || undefined,
    })
    onOpenChange(false)
  }, [title, stage, startDateVal, startTimeVal, endDateVal, endTimeVal, location, description, onSave, onOpenChange])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-full max-w-[480px] mx-4"
        onOpenAutoFocus={e => e.preventDefault()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-black/[.06] dark:border-white/[.08]">
          <DialogTitle>New Event</DialogTitle>
          <DialogDescription className="sr-only">Create a new calendar event</DialogDescription>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[.08] transition-colors"
          >
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {/* Title */}
          <div>
            <label className={labelClass}>Title *</label>
            <input
              ref={titleRef}
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSave() }}
              placeholder="e.g. Discovery call"
              className={inputClass}
            />
          </div>

          {/* Stage */}
          <div>
            <label className={labelClass}>Stage</label>
            <Select value={stage} onValueChange={setStage}>
              <SelectTrigger className="h-10 text-sm w-full rounded-lg border-slate-200 dark:border-white/[.12] bg-white dark:bg-white/[.04]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STAGE_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value} className="text-sm">
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Start date + time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Start date *</label>
              <input
                type="date"
                value={startDateVal}
                onChange={e => {
                  setStartDateVal(e.target.value)
                  if (!endDateVal || endDateVal < e.target.value) setEndDateVal(e.target.value)
                }}
                className={cn(inputClass, 'dark:[color-scheme:dark]')}
              />
            </div>
            <div>
              <label className={labelClass}>Start time *</label>
              <TimeButton value={startTimeVal} onChange={setStartTimeVal} />
            </div>
          </div>

          {/* End date + time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>End date *</label>
              <input
                type="date"
                value={endDateVal}
                onChange={e => setEndDateVal(e.target.value)}
                className={cn(inputClass, 'dark:[color-scheme:dark]')}
              />
            </div>
            <div>
              <label className={labelClass}>End time *</label>
              <TimeButton value={endTimeVal} onChange={setEndTimeVal} />
            </div>
          </div>

          {/* Location */}
          <div>
            <label className={labelClass}>Location (optional)</label>
            <input
              type="text"
              value={location}
              onChange={e => setLocation(e.target.value)}
              placeholder="Google Meet, Zoom, office address..."
              className={inputClass}
            />
          </div>

          {/* Description */}
          <div>
            <label className={labelClass}>Description (optional)</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Agenda, notes..."
              rows={3}
              className={cn(inputClass, 'h-auto py-2.5 resize-none')}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-black/[.06] dark:border-white/[.08]">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={!title.trim()}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            Create Event
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
