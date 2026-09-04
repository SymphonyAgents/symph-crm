import { Injectable, Inject, NotFoundException, BadRequestException, Logger } from '@nestjs/common'
import * as crypto from 'crypto'
import { eq, inArray } from 'drizzle-orm'
import { deals, documents } from '@symph-crm/database'
import { DB } from '../database/database.module'
import type { Database } from '../database/database.types'
import { AuditLogsService } from '../audit-logs/audit-logs.service'
import { AriaGatewayService } from '../common/aria/aria-gateway.service'
import { StorageService } from '../storage/storage.service'

export type DealNoteFile = {
  filename: string
  content: string
  createdAt: number
}

export type DealNotesResponse = {
  categories: {
    general: DealNoteFile[]
    meeting: DealNoteFile[]
    notes: DealNoteFile[]
    discovery: DealNoteFile[]
    transcript: DealNoteFile[]
    proposal: DealNoteFile[]
  }
  resources: Array<{ filename: string; size: number; ext: string }>
  log: string | null
}

export type NfsDealNote = {
  id: string
  title: string
  type: string
  excerpt: string | null
  content: string
  createdAt: string
  updatedAt: string
  wordCount: number
  authorId: string | null
  storagePath: string
  tags: string[]
  filename: string
  category: string
}

export type UpsertDealNoteOptions = {
  filename: string
  createdAt?: Date
  metadata?: Record<string, string | number | boolean | null | undefined>
}

/** All supported file-backed note categories. */
const NOTE_CATEGORIES = ['general', 'meeting', 'notes', 'discovery', 'transcript', 'proposal'] as const

const TYPE_TO_CATEGORY: Record<string, string> = {
  general: 'general',
  discovery: 'discovery',
  meeting: 'meeting',
  transcript_raw: 'transcript',
  proposal: 'proposal',
}

/**
 * Extract the leading numeric timestamp from a filename.
 *
 * Handles two patterns:
 *   - "general-1775524712214.md"       → 1775524712214
 *   - "1775450672922-Virginia-Food-Corp-Deal-Overview.md" → 1775450672922
 */
function extractTimestamp(filename: string): number {
  // Try leading digits first (e.g. "1775450672922-…")
  const leadingMatch = filename.match(/^(\d{10,})/)
  if (leadingMatch) return parseInt(leadingMatch[1], 10)

  // Support UTC note names from CRM ingest (e.g. "20260515T104105Z-meeting.md")
  const compactUtcMatch = filename.match(/(\d{8}T\d{6}Z)/)
  if (compactUtcMatch) {
    const raw = compactUtcMatch[1]
    const iso = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}T${raw.slice(9, 11)}:${raw.slice(11, 13)}:${raw.slice(13, 15)}Z`
    const parsed = Date.parse(iso)
    if (!Number.isNaN(parsed)) return parsed
  }

  // Support dashed UTC note names from CRM ingest (e.g. "notes-2026-05-01T054646Z.md")
  const dashedUtcMatch = filename.match(/(\d{4}-\d{2}-\d{2}T\d{6}Z)/)
  if (dashedUtcMatch) {
    const raw = dashedUtcMatch[1]
    const iso = `${raw.slice(0, 13)}:${raw.slice(13, 15)}:${raw.slice(15, 17)}Z`
    const parsed = Date.parse(iso)
    if (!Number.isNaN(parsed)) return parsed
  }

  // Fallback: digits after a prefix (e.g. "general-1775524712214.md")
  const trailingMatch = filename.match(/(\d{10,})/)
  if (trailingMatch) return parseInt(trailingMatch[1], 10)

  return 0
}

function extractFrontmatter(content: string): string | null {
  const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  return fmMatch ? fmMatch[1] : null
}

function extractFrontmatterValue(content: string, key: string): string | null {
  const frontmatter = extractFrontmatter(content)
  if (!frontmatter) return null

  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = frontmatter.match(new RegExp(`^${escapedKey}:\\s*(.+)$`, 'm'))
  if (!match) return null

  const value = match[1].trim().replace(/^['"]|['"]$/g, '')
  return value || null
}

function parseDateToTimestamp(value: string | null): number {
  if (!value) return 0

  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? 0 : parsed
}

function extractNoteTimestamp(filename: string, content: string): number {
  return (
    parseDateToTimestamp(extractFrontmatterValue(content, 'createdAt')) ||
    parseDateToTimestamp(extractFrontmatterValue(content, 'created_at')) ||
    parseDateToTimestamp(extractFrontmatterValue(content, 'submitted_at')) ||
    parseDateToTimestamp(extractFrontmatterValue(content, 'submittedAt')) ||
    extractTimestamp(filename)
  )
}

/**
 * Extract a title from markdown content.
 * Looks for first heading (# ...), then falls back to first non-empty line,
 * then falls back to the filename without extension.
 */
function extractTitle(content: string, filename: string): string {
  const lines = content.split('\n')
  for (const line of lines) {
    const headingMatch = line.match(/^#+\s+(.+)/)
    if (headingMatch) return headingMatch[1].trim()
  }
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed && !trimmed.startsWith('---')) return trimmed
  }
  return filename.replace(/\.md$/, '')
}

/**
 * Extract an excerpt from markdown content: first 200 chars after
 * any frontmatter (---...---) and first heading.
 */
function extractExcerpt(content: string): string | null {
  let body = content
  // Strip YAML frontmatter
  const fmMatch = body.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n/)
  if (fmMatch) body = body.slice(fmMatch[0].length)
  // Strip first heading line
  body = body.replace(/^#+\s+.+\r?\n/, '')
  const trimmed = body.trim()
  if (!trimmed) return null
  return trimmed.slice(0, 200)
}

/**
 * Build the legacy-named NfsDealNote API shape from stored markdown.
 */
// Parse author attribution from YAML frontmatter if present.
function extractAuthorId(content: string): string | null {
  const value =
    extractFrontmatterValue(content, 'authorId') ??
    extractFrontmatterValue(content, 'crm_user_id') ??
    extractFrontmatterValue(content, 'crmUserId') ??
    extractFrontmatterValue(content, 'user_id')

  return value && value !== 'null' ? value : null
}

function contentHash(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex')
}

function assertSafeMarkdownFilename(filename: string): void {
  if (!filename.endsWith('.md') || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    throw new BadRequestException('Invalid markdown filename')
  }
}

function serializeFrontmatterValue(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined || value === '') return 'null'
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return JSON.stringify(value)
}

function isTimestampedCrmIngestFile(filename: string): boolean {
  return /^\d{8}T\d{6}Z-/.test(filename)
}

function preferNoteCandidate(current: NfsDealNote, candidate: NfsDealNote): NfsDealNote {
  if (isTimestampedCrmIngestFile(candidate.filename) && !isTimestampedCrmIngestFile(current.filename)) {
    return candidate
  }

  if (!isTimestampedCrmIngestFile(candidate.filename) && isTimestampedCrmIngestFile(current.filename)) {
    return current
  }

  return candidate.filename.localeCompare(current.filename) < 0 ? candidate : current
}

function fileToNfsDealNote(
  filename: string,
  content: string,
  category: string,
  dealId: string,
): NfsDealNote {
  const ts = extractNoteTimestamp(filename, content)
  const isoDate = ts ? new Date(ts).toISOString() : new Date(0).toISOString()
  return {
    id: filename.replace(/\.md$/, ''),
    title: extractTitle(content, filename),
    type: category,
    excerpt: extractExcerpt(content),
    content,
    createdAt: isoDate,
    updatedAt: isoDate,
    wordCount: content.split(/\s+/).filter(Boolean).length,
    authorId: extractAuthorId(content),
    storagePath: `deals/${dealId}/${category}/${filename}`,
    tags: [],
    filename,
    category,
  }
}

@Injectable()
export class DealNotesService {
  private readonly logger = new Logger(DealNotesService.name)

  /**
   * Per-deal debounce timers for wiki sync. The production API is intentionally
   * limited to one Cloud Run instance. Scaling beyond one instance requires a
   * distributed debounce and cross-instance storage coordination first.
   */
  private readonly pendingWikiSyncs = new Map<string, ReturnType<typeof setTimeout>>()

  constructor(
    private readonly auditLogs: AuditLogsService,
    @Inject(DB) private readonly db: Database,
    private readonly ariaGateway: AriaGatewayService,
    private readonly storage: StorageService,
  ) {}

  private fireWikiSync(dealId: string, performedBy?: string | null): void {
    const sessionId = `crm-wiki-sync-${dealId}-${Date.now()}`
    const message = `[CRM_WIKI_SYNC] deal_id=${dealId}${performedBy ? ` performed_by=${performedBy}` : ''}`

    this.ariaGateway.sendFireAndForget({ sessionId, content: message, userId: performedBy })
    this.logger.log(`Wiki sync triggered for deal ${dealId} (session ${sessionId})`)
  }

  private scheduleWikiSync(dealId: string, performedBy?: string | null): void {
    const existing = this.pendingWikiSyncs.get(dealId)
    if (existing) clearTimeout(existing)

    const timer = setTimeout(() => {
      this.pendingWikiSyncs.delete(dealId)
      this.fireWikiSync(dealId, performedBy)
    }, 3_000)
    this.pendingWikiSyncs.set(dealId, timer)
  }

  private async getDealName(dealId: string): Promise<string | null> {
    try {
      const rows = await this.db
        .select({ title: deals.title })
        .from(deals)
        .where(eq(deals.id, dealId))
        .limit(1)
      return rows[0]?.title ?? null
    } catch {
      return null
    }
  }

  private async readNoteFiles(dealId: string, category: string): Promise<DealNoteFile[]> {
    const categoryPath = `deals/${dealId}/${category}`
    const files = (await this.storage.listEntries(categoryPath))
      .filter(entry => !entry.isDirectory && entry.name.endsWith('.md'))

    const notes = await Promise.all(files.map(async file => {
      const content = await this.storage.readText(`${categoryPath}/${file.name}`)
      if (content === null) return null
      return {
        filename: file.name,
        content,
        createdAt: extractNoteTimestamp(file.name, content),
      }
    }))

    return notes
      .filter((note): note is DealNoteFile => note !== null)
      .sort((a, b) => b.createdAt - a.createdAt)
  }

  async getNotes(dealId: string): Promise<DealNotesResponse> {
    const result: DealNotesResponse = {
      categories: { general: [], meeting: [], notes: [], discovery: [], transcript: [], proposal: [] },
      resources: [],
      log: null,
    }

    for (const category of NOTE_CATEGORIES) {
      result.categories[category] = await this.readNoteFiles(dealId, category)
    }

    result.log = await this.storage.readText(`deals/${dealId}/log.md`)
    result.resources = (await this.storage.listEntries(`deals/${dealId}/resources`))
      .filter(entry => !entry.isDirectory)
      .map(entry => ({
        filename: entry.name,
        size: entry.size,
        ext: entry.name.includes('.') ? `.${entry.name.split('.').pop()!.toLowerCase()}` : '',
      }))

    return result
  }

  async getNotesFlat(dealId: string): Promise<NfsDealNote[]> {
    const notesByContent = new Map<string, NfsDealNote>()

    for (const category of NOTE_CATEGORIES) {
      const categoryPath = `deals/${dealId}/${category}`
      const files = (await this.storage.listEntries(categoryPath))
        .filter(entry => !entry.isDirectory && entry.name.endsWith('.md'))

      for (const file of files) {
        const content = await this.storage.readText(`${categoryPath}/${file.name}`)
        if (content === null) continue

        const note = fileToNfsDealNote(file.name, content, category, dealId)
        const key = contentHash(note.content)
        const existing = notesByContent.get(key)
        notesByContent.set(key, existing ? preferNoteCandidate(existing, note) : note)
      }
    }

    const allNotes = Array.from(notesByContent.values())
    await this.hydrateMissingAuthorsFromDocuments(allNotes)
    allNotes.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    return allNotes
  }

  private async hydrateMissingAuthorsFromDocuments(notes: NfsDealNote[]): Promise<void> {
    const missingAuthorPaths = notes
      .filter(note => !note.authorId)
      .map(note => note.storagePath)

    if (missingAuthorPaths.length === 0) return

    const rows = await this.db
      .select({ storagePath: documents.storagePath, authorId: documents.authorId })
      .from(documents)
      .where(inArray(documents.storagePath, missingAuthorPaths))

    const authorByStoragePath = new Map(rows.map(row => [row.storagePath, row.authorId]))
    for (const note of notes) {
      if (!note.authorId) note.authorId = authorByStoragePath.get(note.storagePath) ?? null
    }
  }

  async saveNote(dealId: string, type: string, title: string, content: string, authorId?: string | null): Promise<NfsDealNote> {
    const category = TYPE_TO_CATEGORY[type] || 'notes'
    if (!NOTE_CATEGORIES.includes(category as typeof NOTE_CATEGORIES[number])) {
      throw new BadRequestException(`Invalid note category resolved: ${category}`)
    }

    const timestamp = Date.now()
    const filename = `${category}-${timestamp}.md`
    const storagePath = `deals/${dealId}/${category}/${filename}`
    const frontmatter = [
      '---',
      `authorId: ${authorId || 'null'}`,
      `createdAt: ${new Date(timestamp).toISOString()}`,
      '---',
    ].join('\n')
    const fullContent = `${frontmatter}\n\n# ${title}\n\n${content}`

    await this.storage.writeText(storagePath, fullContent)
    await this.touchDealActivity(dealId)

    const dealName = await this.getDealName(dealId)
    this.auditLogs.log({
      action: 'create',
      auditType: 'note',
      entityType: 'deal',
      entityId: dealId,
      performedBy: authorId || undefined,
      details: { noteTitle: title, category, filename, dealName },
    }).catch(() => {})

    this.scheduleWikiSync(dealId, authorId)
    return fileToNfsDealNote(filename, fullContent, category, dealId)
  }

  async upsertNote(
    dealId: string,
    type: string,
    title: string,
    content: string,
    authorId: string | null | undefined,
    options: UpsertDealNoteOptions,
  ): Promise<NfsDealNote> {
    const category = TYPE_TO_CATEGORY[type] || 'notes'
    if (!NOTE_CATEGORIES.includes(category as typeof NOTE_CATEGORIES[number])) {
      throw new BadRequestException(`Invalid note category resolved: ${category}`)
    }

    assertSafeMarkdownFilename(options.filename)

    const createdAt = options.createdAt ?? new Date()
    const metadata = options.metadata ?? {}
    const frontmatterEntries = Object.entries(metadata).map(([key, value]) => `${key}: ${serializeFrontmatterValue(value)}`)
    const frontmatter = [
      '---',
      `authorId: ${authorId || 'null'}`,
      `createdAt: ${createdAt.toISOString()}`,
      ...frontmatterEntries,
      '---',
    ].join('\n')
    const fullContent = `${frontmatter}\n\n# ${title}\n\n${content}`
    const storagePath = `deals/${dealId}/${category}/${options.filename}`

    await this.storage.writeText(storagePath, fullContent)
    await this.touchDealActivity(dealId)

    const dealName = await this.getDealName(dealId)
    this.auditLogs.log({
      action: 'update',
      auditType: 'note',
      entityType: 'deal',
      entityId: dealId,
      performedBy: authorId || undefined,
      details: { noteTitle: title, category, filename: options.filename, dealName },
    }).catch(() => {})

    this.scheduleWikiSync(dealId, authorId)
    return fileToNfsDealNote(options.filename, fullContent, category, dealId)
  }

  async backfillMeetingArtifactAuthor(dealId: string, authorId: string): Promise<{ updated: number }> {
    let updated = 0
    const categories: Array<typeof NOTE_CATEGORIES[number]> = ['meeting', 'transcript']

    for (const category of categories) {
      const categoryPath = `deals/${dealId}/${category}`
      const files = (await this.storage.listEntries(categoryPath))
        .filter(entry => !entry.isDirectory && entry.name.endsWith('.md') && entry.name.startsWith('circleback-'))

      for (const file of files) {
        const storagePath = `${categoryPath}/${file.name}`
        const content = await this.storage.readText(storagePath)
        if (content === null) continue

        const currentAuthor = extractAuthorId(content)
        const source = extractFrontmatterValue(content, 'source')
        if (currentAuthor || source !== 'meetings.symph.co') continue

        const nextContent = content.replace(/^authorId:\s*(null|['"]?null['"]?)$/m, `authorId: ${authorId}`)
        if (nextContent === content) continue

        await this.storage.writeText(storagePath, nextContent)
        updated += 1
      }
    }

    if (updated > 0) this.scheduleWikiSync(dealId, authorId)
    return { updated }
  }

  async readNoteByStoragePath(storagePath: string): Promise<NfsDealNote | null> {
    const parts = storagePath.split('/')
    if (parts.length !== 4 || parts[0] !== 'deals') {
      throw new BadRequestException('Invalid note storage path')
    }

    const [, dealId, category, filename] = parts
    if (!NOTE_CATEGORIES.includes(category as typeof NOTE_CATEGORIES[number])) {
      throw new BadRequestException('Invalid note category')
    }
    assertSafeMarkdownFilename(filename)

    const content = await this.storage.readText(storagePath)
    return content === null ? null : fileToNfsDealNote(filename, content, category, dealId)
  }

  async deleteNote(dealId: string, category: string, filename: string, performedBy?: string): Promise<{ deleted: true }> {
    if (!NOTE_CATEGORIES.includes(category as typeof NOTE_CATEGORIES[number])) {
      throw new BadRequestException(`Invalid category: ${category}`)
    }
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      throw new BadRequestException('Invalid filename: path traversal not allowed')
    }

    const storagePath = `deals/${dealId}/${category}/${filename}`
    if (!(await this.storage.exists(storagePath))) {
      throw new NotFoundException(`Note not found: ${category}/${filename}`)
    }

    await this.storage.deleteFile(storagePath)

    const dealName = await this.getDealName(dealId)
    this.auditLogs.log({
      action: 'delete',
      auditType: 'note',
      entityType: 'deal',
      entityId: dealId,
      performedBy: performedBy || undefined,
      details: { category, filename, dealName },
    }).catch(() => {})

    return { deleted: true }
  }

  private async touchDealActivity(dealId: string): Promise<void> {
    await this.db
      .update(deals)
      .set({ lastActivityAt: new Date(), updatedAt: new Date() })
      .where(eq(deals.id, dealId))
  }

  async triggerSummaryGeneration(dealId: string, userId?: string): Promise<{ status: 'generating'; triggeredAt: string }> {
    const allNotes = await this.getNotesFlat(dealId)
    if (allNotes.length === 0) {
      throw new BadRequestException('No notes to summarize')
    }

    const triggeredAt = new Date().toISOString()
    const sessionId = `crm-summary-${dealId}-${Date.now()}`
    const triggerMessage = `[CRM_SUMMARY] deal_id=${dealId}${userId ? ` performed_by=${userId}` : ''}`

    this.ariaGateway.sendFireAndForget({ sessionId, content: triggerMessage, userId })
    this.logger.log(`Summary generation triggered for deal ${dealId} (session ${sessionId})`)
    return { status: 'generating', triggeredAt }
  }

  async listSummaries(dealId: string): Promise<DealSummaryMeta[]> {
    const summaryPath = `deals/${dealId}/summaries`
    const files = (await this.storage.listEntries(summaryPath))
      .filter(entry => !entry.isDirectory && entry.name.endsWith('.md'))
    const metas: DealSummaryMeta[] = []

    for (const file of files) {
      const content = await this.storage.readText(`${summaryPath}/${file.name}`)
      if (content === null) continue
      const meta = parseSummaryFrontmatter(file.name, content)
      if (meta) metas.push(meta)
    }

    metas.sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime())
    return metas
  }

  async readSummary(dealId: string, filename: string): Promise<{ meta: DealSummaryMeta; content: string } | null> {
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      throw new BadRequestException('Invalid filename')
    }

    const content = await this.storage.readText(`deals/${dealId}/summaries/${filename}`)
    if (content === null) return null
    const meta = parseSummaryFrontmatter(filename, content)
    return meta ? { meta, content } : null
  }

  async hasNewNotesSinceLastSummary(dealId: string): Promise<{ hasNew: boolean; noteCount: number; latestSummaryAt: string | null }> {
    const summaries = await this.listSummaries(dealId)
    const latestSummary = summaries[0] ?? null
    const latestSummaryAt = latestSummary?.generatedAt ?? null
    const currentCount = (await this.getNotesFlat(dealId)).length
    const hasNew = latestSummary
      ? currentCount !== latestSummary.notesIncluded
      : currentCount > 0

    return { hasNew, noteCount: currentCount, latestSummaryAt }
  }

  async writeSummary(
    dealId: string,
    summary: string,
    nextSteps: string[],
    notesIncluded: number,
    generatedBy?: string | null,
  ): Promise<DealSummaryMeta> {
    const timestamp = Date.now()
    const isoDate = new Date(timestamp).toISOString()
    const filename = `summary-${timestamp}.md`
    const storagePath = `deals/${dealId}/summaries/${filename}`
    const frontmatter = [
      '---',
      `generatedAt: ${isoDate}`,
      `notesIncluded: ${notesIncluded}`,
      `generatedBy: ${generatedBy || 'system'}`,
      '---',
    ].join('\n')
    const nextStepsMd = nextSteps.length > 0
      ? `\n\n## Next Steps\n\n${nextSteps.map(step => `- ${step}`).join('\n')}`
      : ''
    const fullContent = `${frontmatter}\n\n# Deal Summary\n\n${summary}${nextStepsMd}\n`

    await this.storage.writeText(storagePath, fullContent)

    this.auditLogs.log({
      action: 'create',
      auditType: 'summary',
      entityType: 'deal',
      entityId: dealId,
      performedBy: generatedBy || undefined,
      details: { filename, notesIncluded },
    }).catch(() => {})

    return {
      filename,
      generatedAt: isoDate,
      notesIncluded,
      generatedBy: generatedBy || 'system',
      storagePath,
    }
  }
}

// ─── Summary types & helpers ──────────────────────────────────────────────

export type DealSummaryMeta = {
  filename: string
  generatedAt: string
  notesIncluded: number
  generatedBy: string
  storagePath: string
}

function parseSummaryFrontmatter(filename: string, content: string): DealSummaryMeta | null {
  const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!fmMatch) {
    // Fallback: extract timestamp from filename
    const ts = extractTimestamp(filename)
    return {
      filename,
      generatedAt: ts ? new Date(ts).toISOString() : new Date(0).toISOString(),
      notesIncluded: 0,
      generatedBy: 'system',
      storagePath: '',
    }
  }

  const fm = fmMatch[1]
  const get = (key: string) => {
    const m = fm.match(new RegExp(`${key}:\\s*(.+)`))
    return m ? m[1].trim() : null
  }

  return {
    filename,
    generatedAt: get('generatedAt') || new Date(0).toISOString(),
    notesIncluded: parseInt(get('notesIncluded') || '0', 10),
    generatedBy: get('generatedBy') || 'system',
    storagePath: '',
  }
}
