import { meetings } from '@symph-crm/database'

export type MeetingRow = typeof meetings.$inferSelect
export type MeetingAttendeeProfile = { email: string | null; name: string | null; avatarUrl: string | null }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function stringField(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return null
}

function parseAttendeeString(value: string): MeetingAttendeeProfile {
  const trimmed = value.trim()
  const match = trimmed.match(/^(.+?)\s*<([^>]+)>$/)
  if (match) {
    return {
      name: match[1].trim() || null,
      email: match[2].trim() || null,
      avatarUrl: null,
    }
  }
  return trimmed.includes('@')
    ? { email: trimmed, name: null, avatarUrl: null }
    : { email: null, name: trimmed || null, avatarUrl: null }
}

export function normalizeAttendeeEmails(attendees: Array<string | Record<string, unknown>> | undefined): string[] {
  if (!attendees) return []
  return attendees
    .map((item) => {
      if (typeof item === 'string') {
        const parsed = parseAttendeeString(item)
        return parsed.email ?? parsed.name ?? ''
      }
      return stringField(item, ['email', 'mail', 'address']) ?? stringField(item, ['name', 'displayName', 'fullName']) ?? ''
    })
    .filter((value): value is string => Boolean(value))
}

export function normalizeMeetingAttendees(attendees: string[], rawPayload: Record<string, unknown> | null | undefined): MeetingAttendeeProfile[] {
  const rawAttendees = Array.isArray(rawPayload?.attendees) ? rawPayload.attendees : []
  const profiles = new Map<string, MeetingAttendeeProfile>()

  function hasSameName(name: string | null): boolean {
    if (!name) return false
    const normalized = name.toLowerCase()
    return Array.from(profiles.values()).some((profile) => profile.name?.toLowerCase() === normalized)
  }

  function addProfile(profile: MeetingAttendeeProfile, fallbackKey: string): void {
    const key = (profile.email || profile.name || fallbackKey).toLowerCase()
    if (!key || hasSameName(profile.name)) return
    profiles.set(key, profile)
  }

  rawAttendees.forEach((item, index) => {
    if (typeof item === 'string') {
      addProfile(parseAttendeeString(item), `attendee-${index}`)
      return
    }
    if (!isRecord(item)) return
    addProfile({
      email: stringField(item, ['email', 'mail', 'address']),
      name: stringField(item, ['name', 'displayName', 'fullName']),
      avatarUrl: stringField(item, ['avatarUrl', 'picture', 'photoUrl', 'image']),
    }, `attendee-${index}`)
  })

  for (const attendee of attendees) {
    const value = attendee.trim()
    if (!value) continue
    addProfile(parseAttendeeString(value), value)
  }

  return Array.from(profiles.values())
}

export function withMeetingAttendeeDetails<T extends MeetingRow>(meeting: T): T & { attendeeDetails: MeetingAttendeeProfile[] } {
  return {
    ...meeting,
    attendeeDetails: normalizeMeetingAttendees(meeting.attendees, meeting.rawPayload),
  }
}
