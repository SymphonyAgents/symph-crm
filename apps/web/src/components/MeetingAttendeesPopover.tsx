'use client'

import { Info } from 'lucide-react'
import { AvatarFallback, AvatarImage, AvatarRoot } from '@/components/ui/avatar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import type { ApiMeetingAttendee } from '@/lib/types'

function initialsFor(value: string): string {
  const clean = value.trim()
  if (!clean) return 'A'
  const parts = clean.includes('@') ? clean.split('@')[0].split(/[._\-\s]+/) : clean.split(/\s+/)
  return parts
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || clean[0]?.toUpperCase() || 'A'
}

function attendeeLabel(attendee: ApiMeetingAttendee): string {
  return attendee.name?.trim() || attendee.email || 'Unknown attendee'
}

export function MeetingAttendeeIdentity({ attendee, compact = false }: { attendee: ApiMeetingAttendee; compact?: boolean }) {
  const label = attendeeLabel(attendee)

  return (
    <div className="flex min-w-0 items-center gap-2">
      <AvatarRoot className={cn(compact ? 'h-6 w-6' : 'h-7 w-7', 'ring-1 ring-border-strong')}>
        {attendee.avatarUrl && <AvatarImage src={attendee.avatarUrl} alt={label} referrerPolicy="no-referrer" />}
        <AvatarFallback className="bg-secondary text-[10px] text-muted-foreground">
          {initialsFor(label)}
        </AvatarFallback>
      </AvatarRoot>
      <p className={cn('min-w-0 truncate font-medium text-foreground', compact ? 'text-xxs' : 'text-xs')}>
        {label}
      </p>
    </div>
  )
}

function uniqueAttendees(attendees: ApiMeetingAttendee[]): ApiMeetingAttendee[] {
  const seen = new Set<string>()
  return attendees.filter((attendee) => {
    const key = (attendee.email || attendee.name || '').toLowerCase()
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function MeetingAttendeesPopover({ attendees }: { attendees: ApiMeetingAttendee[] }) {
  const visibleAttendees = uniqueAttendees(attendees)

  if (visibleAttendees.length === 0) {
    return <span className="text-xxs text-text-faint">No attendees</span>
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-2 text-xxs font-medium text-slate-600 transition-colors duration-150 hover:bg-surface-alt active:scale-[0.96]"
          aria-label={`View ${visibleAttendees.length} attendees`}
        >
          <Info size={13} strokeWidth={1.7} />
          <span className="tabular-nums">{visibleAttendees.length}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(320px,calc(100vw-2rem))] rounded-md bg-card p-2 shadow-lg ring-1 ring-border-strong">
        <div className="px-1.5 pb-2 pt-1 eyebrow-label">
          Attendees
        </div>
        <div className="max-h-[280px] space-y-1 overflow-auto">
          {visibleAttendees.map((attendee, index) => (
            <div key={`${attendee.email || attendee.name || 'attendee'}-${index}`} className="rounded-md px-1.5 py-1.5 hover:bg-surface-hover">
              <MeetingAttendeeIdentity attendee={attendee} />
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
