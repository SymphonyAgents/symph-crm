import { Injectable, Inject, NotFoundException, BadRequestException, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as fs from 'fs'
import * as path from 'path'
import { eq } from 'drizzle-orm'
import { deals } from '@symph-crm/database'
import { DB } from '../database/database.module'
import type { Database } from '../database/database.types'
import { AuditLogsService } from '../audit-logs/audit-logs.service'

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

/** All supported NFS note categories */
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

  // Fallback: digits after a prefix (e.g. "general-1775524712214.md")
  const trailingMatch = filename.match(/(\d{10,})/)
  if (trailingMatch) return parseInt(trailingMatch[1], 10)

  return 0
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
 * Build an NfsDealNote from a file on disk.
 */
// Parse authorId from YAML frontmatter if present
function extractAuthorId(content: string): string | null {
  const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!fmMatch) return null
  const authorMatch = fmMatch[1].match(/authorId:\s*(.+)/)
  if (!authorMatch) return null
  const val = authorMatch[1].trim()
  return val && val !== 'null' ? val : null
}

function fileToNfsDealNote(
  filename: string,
  content: string,
  category: string,
  dealId: string,
): NfsDealNote {
  const ts = extractTimestamp(filename)
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
  private readonly basePath: string
  private readonly logger = new Logger(DealNotesService.name)
  private readonly gatewayUrl: string
  private readonly apiToken: string

  constructor(
    private readonly auditLogs: AuditLogsService,
    @Inject(DB) private readonly db: Database,
    private readonly config: ConfigService,
  ) {
    this.basePath = process.env.NFS_CRM_PATH || '/share/crm'
    this.gatewayUrl = (
      config.get<string>('ARIA_GATEWAY_URL') ?? 'https://aria-gateway.symph.co'
    ).replace(/\/+$/, '')
    this.apiToken = config.get<string>('ARIA_API_TOKEN') ?? ''
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

  async getNotes(dealId: string): Promise<DealNotesResponse> {
    const dealDir = path.join(this.basePath, 'deals', dealId)

    const result: DealNotesResponse = {
      categories: { general: [], meeting: [], notes: [], discovery: [], transcript: [], proposal: [] },
      resources: [],
      log: null,
    }

    // If the deal's NFS folder doesn't exist, return empty
    if (!fs.existsSync(dealDir)) return result

    // Read markdown notes from all category folders
    for (const category of NOTE_CATEGORIES) {
      const catDir = path.join(dealDir, category)
      if (!fs.existsSync(catDir)) continue

      const files = fs.readdirSync(catDir).filter(f => f.endsWith('.md'))

      const noteFiles: DealNoteFile[] = await Promise.all(
        files.map(async (filename) => {
          const filePath = path.join(catDir, filename)
          const content = await fs.promises.readFile(filePath, 'utf-8')
          const createdAt = extractTimestamp(filename)
          return { filename, content, createdAt }
        }),
      )

      // Sort newest first
      noteFiles.sort((a, b) => b.createdAt - a.createdAt)
      result.categories[category] = noteFiles
    }

    // Read deal log.md if it exists
    const logPath = path.join(dealDir, 'log.md')
    if (fs.existsSync(logPath)) {
      result.log = await fs.promises.readFile(logPath, 'utf-8')
    }

    // Read resources folder — metadata only, no content
    const resourcesDir = path.join(dealDir, 'resources')
    if (fs.existsSync(resourcesDir)) {
      const resourceFiles = fs.readdirSync(resourcesDir)
      result.resources = resourceFiles.map((filename) => {
        const filePath = path.join(resourcesDir, filename)
        const stat = fs.statSync(filePath)
        return {
          filename,
          size: stat.size,
          ext: path.extname(filename).toLowerCase(),
        }
      })
    }

    return result
  }

  async getNotesFlat(dealId: string): Promise<NfsDealNote[]> {
    const dealDir = path.join(this.basePath, 'deals', dealId)
    const allNotes: NfsDealNote[] = []

    if (!fs.existsSync(dealDir)) return allNotes

    for (const category of NOTE_CATEGORIES) {
      const catDir = path.join(dealDir, category)
      if (!fs.existsSync(catDir)) continue

      const files = fs.readdirSync(catDir).filter(f => f.endsWith('.md'))

      const notes = await Promise.all(
        files.map(async (filename) => {
          const filePath = path.join(catDir, filename)
          const content = await fs.promises.readFile(filePath, 'utf-8')
          return fileToNfsDealNote(filename, content, category, dealId)
        }),
      )

      allNotes.push(...notes)
    }

    // Sort newest first by createdAt
    allNotes.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    return allNotes
  }

  async saveNote(dealId: string, type: string, title: string, content: string, authorId?: string | null): Promise<NfsDealNote> {
    const category = TYPE_TO_CATEGORY[type] || 'notes'

    if (!NOTE_CATEGORIES.includes(category as typeof NOTE_CATEGORIES[number])) {
      throw new BadRequestException(`Invalid note category resolved: ${category}`)
    }

    const catDir = path.join(this.basePath, 'deals', dealId, category)
    fs.mkdirSync(catDir, { recursive: true })

    const timestamp = Date.now()
    const filename = `${category}-${timestamp}.md`
    const filePath = path.join(catDir, filename)

    // Build YAML frontmatter with author and timestamp metadata
    const frontmatter = [
      '---',
      `authorId: ${authorId || 'null'}`,
      `createdAt: ${new Date(timestamp).toISOString()}`,
      '---',
    ].join('\n')

    const fullContent = `${frontmatter}\n\n# ${title}\n\n${content}`
    await fs.promises.writeFile(filePath, fullContent, 'utf-8')

    // Audit log — fire and forget (enrich with deal name)
    const dealName = await this.getDealName(dealId)
    this.auditLogs.log({
      action: 'create',
      auditType: 'note',
      entityType: 'deal',
      entityId: dealId,
      performedBy: authorId || undefined,
      details: { noteTitle: title, category, filename, dealName },
    }).catch(() => {})

    return fileToNfsDealNote(filename, fullContent, category, dealId)
  }

  async deleteNote(dealId: string, category: string, filename: string, performedBy?: string): Promise<{ deleted: true }> {
    // Validate category
    if (!NOTE_CATEGORIES.includes(category as typeof NOTE_CATEGORIES[number])) {
      throw new BadRequestException(`Invalid category: ${category}`)
    }

    // Validate filename — no path traversal
    if (filename.includes('..') || filename.includes('/')) {
      throw new BadRequestException('Invalid filename: path traversal not allowed')
    }

    const filePath = path.join(this.basePath, 'deals', dealId, category, filename)

    if (!fs.existsSync(filePath)) {
      throw new NotFoundException(`Note not found: ${category}/${filename}`)
    }

    await fs.promises.unlink(filePath)

    // Audit log — fire and forget (enrich with deal name)
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

  // ── Summary Generation (async via Aria — crm-summarize-deal skill) ────────

  /**
   * Fires an async summary generation request to Aria via the gateway.
   * Aria invokes the crm-summarize-deal skill which reads all NFS notes,
   * cross-references the company wiki, and writes the result to NFS.
   * The caller returns immediately — the frontend polls GET /summaries
   * until the new file appears.
   */
  async triggerSummaryGeneration(dealId: string, userId?: string): Promise<{ status: 'generating'; triggeredAt: string }> {
    const allNotes = await this.getNotesFlat(dealId)
    if (allNotes.length === 0) {
      throw new BadRequestException('No notes to summarize')
    }

    const triggeredAt = new Date().toISOString()
    const sessionId = `crm-summary-${dealId}-${Date.now()}`
    const triggerMessage = `[CRM_SUMMARY] deal_id=${dealId}${userId ? ` performed_by=${userId}` : ''}`

    // Fire-and-forget — do not await or poll. Aria writes the file to NFS when done.
    fetch(`${this.gatewayUrl}/v1/chat/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiToken}`,
      },
      body: JSON.stringify({
        session_id: sessionId,
        content: triggerMessage,
        user_id: userId ?? 'system',
        user_tier: 3,
        workspace_path: '/share/agency/products/symph-crm',
      }),
    }).catch(err => {
      this.logger.error(`Failed to trigger summary generation for deal ${dealId}: ${err}`)
    })

    this.logger.log(`Summary generation triggered for deal ${dealId} (session ${sessionId})`)
    return { status: 'generating', triggeredAt }
  }

  // ── Deal Summaries (NFS markdown files) ──────────────────────────────────

  /** List all existing summaries for a deal, newest first */
  async listSummaries(dealId: string): Promise<DealSummaryMeta[]> {
    const summaryDir = path.join(this.basePath, 'deals', dealId, 'summaries')
    if (!fs.existsSync(summaryDir)) return []

    const files = fs.readdirSync(summaryDir).filter(f => f.endsWith('.md'))
    const metas: DealSummaryMeta[] = []

    for (const filename of files) {
      const filePath = path.join(summaryDir, filename)
      const content = await fs.promises.readFile(filePath, 'utf-8')
      const meta = parseSummaryFrontmatter(filename, content)
      if (meta) metas.push(meta)
    }

    // Newest first
    metas.sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime())
    return metas
  }

  /** Read a specific summary file */
  async readSummary(dealId: string, filename: string): Promise<{ meta: DealSummaryMeta; content: string } | null> {
    if (filename.includes('..') || filename.includes('/')) {
      throw new BadRequestException('Invalid filename')
    }
    const filePath = path.join(this.basePath, 'deals', dealId, 'summaries', filename)
    if (!fs.existsSync(filePath)) return null
    const content = await fs.promises.readFile(filePath, 'utf-8')
    const meta = parseSummaryFrontmatter(filename, content)
    if (!meta) return null
    return { meta, content }
  }

  /** Check if new notes exist since the latest summary */
  async hasNewNotesSinceLastSummary(dealId: string): Promise<{ hasNew: boolean; noteCount: number; latestSummaryAt: string | null }> {
    const summaries = await this.listSummaries(dealId)
    const latestSummary = summaries[0] ?? null
    const latestSummaryAt = latestSummary?.generatedAt ?? null
    const latestSummaryTs = latestSummaryAt ? new Date(latestSummaryAt).getTime() : 0

    const allNotes = await this.getNotesFlat(dealId)
    const newNotes = latestSummaryTs > 0
      ? allNotes.filter(n => new Date(n.createdAt).getTime() > latestSummaryTs)
      : allNotes

    return { hasNew: newNotes.length > 0, noteCount: newNotes.length, latestSummaryAt }
  }

  /** Write a generated summary as a new markdown file */
  async writeSummary(
    dealId: string,
    summary: string,
    nextSteps: string[],
    notesIncluded: number,
    generatedBy?: string | null,
  ): Promise<DealSummaryMeta> {
    const summaryDir = path.join(this.basePath, 'deals', dealId, 'summaries')
    fs.mkdirSync(summaryDir, { recursive: true })

    const timestamp = Date.now()
    const isoDate = new Date(timestamp).toISOString()
    const filename = `summary-${timestamp}.md`
    const filePath = path.join(summaryDir, filename)

    const frontmatter = [
      '---',
      `generatedAt: ${isoDate}`,
      `notesIncluded: ${notesIncluded}`,
      `generatedBy: ${generatedBy || 'system'}`,
      '---',
    ].join('\n')

    const nextStepsMd = nextSteps.length > 0
      ? `\n\n## Next Steps\n\n${nextSteps.map(s => `- ${s}`).join('\n')}`
      : ''

    const fullContent = `${frontmatter}\n\n# Deal Summary\n\n${summary}${nextStepsMd}\n`
    await fs.promises.writeFile(filePath, fullContent, 'utf-8')

    // Audit log
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
      storagePath: `deals/${dealId}/summaries/${filename}`,
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
