import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'
import { BRAND_PALETTE, AVATAR_COLORS, STAGE_ORDER, KANBAN_STAGES, COLUMN_TO_STAGE, PROGRESS_STAGES, SERVICE_TYPES } from './constants'
import { formatDealName } from './format-deal-name'

// ─── Tailwind ────────────────────────────────────────────────────────────────

const customTwMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': ['text-atom', 'text-xxs', 'text-ssm', 'text-sbase'],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return customTwMerge(clsx(inputs))
}

// ─── Currency Formatting ─────────────────────────────────────────────────────

export function formatPeso(n: number): string {
  return 'P' + new Intl.NumberFormat('en-PH').format(n)
}

export function formatPesoShort(n: number): string {
  if (n >= 1_000_000) return 'P' + (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return 'P' + Math.round(n / 1_000) + 'K'
  return formatPeso(n)
}

/** Short currency formatter — "P1.2M / P350K / P1,234" */
export function formatCurrency(n: number): string {
  if (n >= 1_000_000) return `P${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `P${(n / 1_000).toFixed(0)}K`
  return `P${n.toLocaleString()}`
}

/** Full currency display — "₱1,234,567.00" (shows ₱0.00 for null/zero) */
export function formatCurrencyFull(v: string | null | undefined): string {
  const n = v ? parseFloat(v) : 0
  if (isNaN(n)) return '\u20B10.00'
  return `\u20B1${n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/** Compact deal value display — "P1.2M" or "—" for null */
export function formatDealValue(v: string | null): string {
  if (!v) return '—'
  const n = parseFloat(v)
  if (isNaN(n)) return '—'
  return formatCurrency(n)
}

/** Sum all numeric deal values */
export function totalNumericValue(deals: { value: string | null }[]): number {
  return deals.reduce((sum, d) => {
    const n = parseFloat(d.value ?? '')
    return sum + (isNaN(n) ? 0 : n)
  }, 0)
}

// ─── Date / Time Formatting ──────────────────────────────────────────────────

/** Relative time: "Just now", "5m ago", "3h ago", "2d ago", "Mar 15" */
export function timeAgo(iso: string | null): string {
  if (!iso) return '—'
  const date = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60_000)
  const diffHours = Math.floor(diffMs / 3_600_000)
  const diffDays = Math.floor(diffMs / 86_400_000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  })
}

/** Full date+time: "Mar 31, 2026, 1:56 PM" */
export function formatFullDate(iso: string): string {
  return new Date(iso).toLocaleString('en-PH', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  })
}

/** Short date: "Mar 31, 2026" */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
}

/** Calendar date key: "2026-03-31" */
export function toDateKey(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Calendar time: "2:30 PM" */
export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit', hour12: true })
}

/** Inbox chat time: "2:30 PM" */
export function formatChatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit', hour12: true })
}

/** Date separator: "Today", "Yesterday", or "Monday, March 31" */
export function formatDateSeparator(iso: string): string {
  const date = new Date(iso)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86_400_000)
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  return date.toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric' })
}

/** Inbox relative date for thread list: "2:30 PM", "Yesterday", "Mar 15" */
export function formatRelativeDate(iso: string): string {
  const date = new Date(iso)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86_400_000)
  if (diffDays === 0) return formatChatTime(iso)
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return date.toLocaleDateString('en-PH', { weekday: 'short' })
  return date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
}

export function isSameDay(a: string, b: string): boolean {
  return toDateKey(a) === toDateKey(b)
}

// ─── Calendar Helpers ────────────────────────────────────────────────────────

export function getWeekStart(date: Date): Date {
  const d = new Date(date)
  d.setDate(d.getDate() - d.getDay())
  d.setHours(0, 0, 0, 0)
  return d
}

export function monthRange(year: number, month: number) {
  const from = new Date(year, month, 1).toISOString()
  const to = new Date(year, month + 1, 0, 23, 59, 59).toISOString()
  return { from, to }
}

export function weekRange(weekStart: Date) {
  const from = new Date(weekStart)
  from.setHours(0, 0, 0, 0)
  const to = new Date(weekStart)
  to.setDate(to.getDate() + 6)
  to.setHours(23, 59, 59, 999)
  return { from: from.toISOString(), to: to.toISOString() }
}

// ─── String Helpers ──────────────────────────────────────────────────────────

export function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .substring(0, 2)
    .toUpperCase()
}

export function toPascalCase(str: string): string {
  if (!str) return ''
  return str
    .split(/[\s_-]+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

/** Format deal title: preserves user capitalization while recognizing acronyms */
export function formatDealTitle(title: string): string {
  return formatDealName(title)
}

/** Extract display name from email address: "Foo Bar <foo@bar.com>" → "Foo Bar" */
export function parseDisplayName(address: string): string {
  const match = address.match(/^"?([^"<]+)"?\s*</)
  return match ? match[1].trim() : address.split('@')[0]
}

/** Ensure reply subject has "Re:" prefix */
export function replySubject(subject: string): string {
  if (/^re:/i.test(subject)) return subject
  return `Re: ${subject}`
}

// ─── Color Helpers ───────────────────────────────────────────────────────────

/** Deterministic brand color from a name string */
export function getBrandColor(name: string | null | undefined): string {
  if (!name) return BRAND_PALETTE[0]
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return BRAND_PALETTE[Math.abs(hash) % BRAND_PALETTE.length]
}

/** Deterministic avatar color from an email string */
export function avatarColor(email: string): string {
  let hash = 0
  for (let i = 0; i < email.length; i++) hash = email.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

// ─── Email Cleaning ──────────────────────────────────────────────────────────

/**
 * Strips email cruft to leave only the new message content.
 * Removes: quoted reply chains (>>> / >), "On ... wrote:" headers,
 * signature separators (-- / ---), and common footer boilerplate.
 */
export function cleanEmailBody(text: string): string {
  if (!text) return text

  const lines = text.split('\n')
  const cleaned: string[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()

    // Stop at bare signature separators
    if (trimmed === '--' || trimmed === '---' || trimmed === '––' || trimmed === '—') break
    // Stop at "-- \n" (email signature with trailing space)
    if (trimmed === '-- ') break

    // Stop at reply header: "On Mon, Jan 1, 2024 at 12:00 PM, Someone wrote:"
    if (/^On .{10,200}wrote:\s*$/i.test(trimmed)) break

    // Stop at Outlook-style "From: ... Sent: ..." forward block
    if (/^From:\s+/i.test(trimmed) && i > 2) break
    if (/^-{5,}\s*(original message|forwarded message)/i.test(trimmed)) break

    // Skip quoted lines (> or >>>) — these are prior messages
    if (/^>+/.test(trimmed)) continue

    // Stop at footer boilerplate
    if (/^(unsubscribe|this e.?mail (was sent|is intended|contains)|you are receiving this|to (stop receiving|unsubscribe)|confidentiality notice|disclaimer:|legal notice|this message is intended for)/i.test(trimmed)) break

    // Skip long separator lines (_____ or ===== etc.)
    if (/^[_=*-]{6,}$/.test(trimmed)) continue

    cleaned.push(line)
  }

  // Trim trailing blank lines
  while (cleaned.length > 0 && cleaned[cleaned.length - 1].trim() === '') cleaned.pop()

  return cleaned.join('\n').trim()
}

// ─── HTML Processing ─────────────────────────────────────────────────────────

/** Converts email HTML to readable plain text for native CRM rendering */
export function htmlToText(html: string): string {
  return html
    .replace(/<\/(p|div|tr|li|blockquote|h[1-6]|table|ul|ol|section|article|header|footer|br)[^>]*>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<a[^>]*>([^<]*)<\/a>/gi, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&apos;/g, "'")
    .replace(/\n[ \t]+\n/g, '\n\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

// ─── Chat Helpers ────────────────────────────────────────────────────────────

export function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function getAudioMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return 'audio/webm'
  if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) return 'audio/webm;codecs=opus'
  if (MediaRecorder.isTypeSupported('audio/mp4')) return 'audio/mp4'
  if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) return 'audio/ogg;codecs=opus'
  return 'audio/webm'
}

export function mimeToExt(mimetype: string): string {
  if (mimetype.includes('mp4')) return 'm4a'
  if (mimetype.includes('ogg')) return 'ogg'
  if (mimetype.includes('webm')) return 'webm'
  if (mimetype.includes('wav')) return 'wav'
  return 'webm'
}


// ─── Service Type Formatting ────────────────────────────────────────────────

/** Build a flat slug→label map from the hierarchical SERVICE_TYPES tree */
const SERVICE_LABEL_MAP: Record<string, string> = (() => {
  const map: Record<string, string> = {}
  for (const s of SERVICE_TYPES) {
    map[s.value] = s.label
    if (s.children) {
      for (const c of s.children) {
        map[c.value] = c.label
      }
    }
  }
  return map
})()

/** Maps a service slug (e.g. "agency") to its human label (e.g. "The Agency") */
export function formatServiceType(value: string | null | undefined): string {
  if (!value) return ''
  return SERVICE_LABEL_MAP[value] ?? value.replace(/_/g, ' ').replace(/\w/g, c => c.toUpperCase())
}

// ─── Pipeline Helpers ────────────────────────────────────────────────────────

/** Get all kanban columns a deal can advance to (forward only) */
export function getAdvanceTargets(currentStage: string): { id: string; label: string; color: string; dbStage: string }[] {
  const currentOrder = STAGE_ORDER[currentStage] ?? 0
  return KANBAN_STAGES
    .filter(col => {
      const colOrder = STAGE_ORDER[COLUMN_TO_STAGE[col.id]] ?? 0
      return colOrder > currentOrder
    })
    .map(col => ({ id: col.id, label: col.label, color: col.color, dbStage: COLUMN_TO_STAGE[col.id] }))
}

/** Get all kanban columns a deal can move back to (backward) */
export function getMoveBackTargets(currentStage: string): { id: string; label: string; color: string; dbStage: string }[] {
  const currentOrder = STAGE_ORDER[currentStage] ?? 0
  return KANBAN_STAGES
    .filter(col => {
      const colOrder = STAGE_ORDER[COLUMN_TO_STAGE[col.id]] ?? 0
      return colOrder < currentOrder
    })
    .map(col => ({ id: col.id, label: col.label, color: col.color, dbStage: COLUMN_TO_STAGE[col.id] }))
}

/** Get the stage progress index for the deal detail progress bar */
/** Matches any DB stage to its progress bar index (0–5), used in DealDetail */
export function getStageProgressIndex(stage: string): number {
  return PROGRESS_STAGES.findIndex(ps => ps.matches.includes(stage))
}

export function getDaysInStage(activities: { type: string; createdAt: string }[], createdAt: string): number {
  const lastChange = activities.find(a => a.type === 'status_change')
  const since = lastChange ? new Date(lastChange.createdAt) : new Date(createdAt)
  return Math.max(0, Math.floor((Date.now() - since.getTime()) / 86_400_000))
}

// ─── Audit Log Helpers ───────────────────────────────────────────────────────

export function describeAuditDetails(entry: { action: string; details: Record<string, unknown> | null }): string {
  const details = entry.details
  if (!details) return ''
  if (entry.action === 'status_change' && details.from && details.to) return `${details.from} → ${details.to}`
  if (entry.action === 'update' && details.fields) return (details.fields as string[]).join(', ')
  if (details.title) return String(details.title)
  if (details.name) return String(details.name)
  return ''
}

export function userDisplayName(u: { nickname?: string | null; firstName?: string | null; lastName?: string | null; name?: string | null; email: string }): string {
  if (u.nickname) return u.nickname
  if (u.firstName && u.lastName) return `${u.firstName} ${u.lastName}`
  return u.name || u.email
}
