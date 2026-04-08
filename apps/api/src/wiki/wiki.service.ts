import { Injectable, Logger } from '@nestjs/common'
import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'

/**
 * WikiService — NFS-backed read/write operations for the CRM wiki vault.
 *
 * The vault lives at /share/crm/ (or NFS_CRM_PATH env var).
 * Three global files: WIKI_SCHEMA.md, MASTER_INDEX.md, log.md
 * Per-entity dirs: deals/{id}/, companies/{id}/, people/{id}/
 * Each entity dir has: index.md (synthesis), log.md (op log)
 */
@Injectable()
export class WikiService {
  private readonly logger = new Logger(WikiService.name)
  readonly basePath: string

  constructor() {
    this.basePath = process.env.NFS_CRM_PATH || '/share/crm'
  }

  /**
   * Resolve a relative path like "deals/abc123/index.md" to an absolute NFS path.
   * Prevents path traversal outside /share/crm/.
   */
  private resolve(relativePath: string): string {
    const resolved = path.resolve(this.basePath, relativePath)
    if (!resolved.startsWith(this.basePath)) {
      throw new Error(`Path traversal rejected: ${relativePath}`)
    }
    return resolved
  }

  /**
   * Read a wiki page by relative path (e.g. "deals/abc123/index.md").
   * Returns null if the file does not exist.
   */
  async readPage(relativePath: string): Promise<string | null> {
    const abs = this.resolve(relativePath)
    if (!fs.existsSync(abs)) return null
    return fs.promises.readFile(abs, 'utf-8')
  }

  /**
   * Write (create or overwrite) a wiki page.
   * Creates parent directories if they don't exist.
   */
  async writePage(relativePath: string, content: string): Promise<void> {
    const abs = this.resolve(relativePath)
    await fs.promises.mkdir(path.dirname(abs), { recursive: true })
    await fs.promises.writeFile(abs, content, 'utf-8')
  }

  /**
   * Append content to an existing page (creates it if missing).
   */
  async appendPage(relativePath: string, content: string): Promise<void> {
    const abs = this.resolve(relativePath)
    await fs.promises.mkdir(path.dirname(abs), { recursive: true })
    await fs.promises.appendFile(abs, content, 'utf-8')
  }

  /**
   * Append a structured log entry to log.md.
   *
   * @param entry      The human-readable log body (1–3 lines)
   * @param operation  e.g. 'ingest', 'query', 'lint', 'update', 'create'
   * @param actor      Who triggered this (CRM user name or 'aria')
   * @param scope      'global' | 'deal' | 'company' | 'person'
   * @param scopeId    Entity UUID (omit for global)
   */
  async appendLog(params: {
    entry: string
    operation?: string
    actor?: string
    scope?: 'global' | 'deal' | 'company' | 'person'
    scopeId?: string
  }): Promise<void> {
    const { entry, operation = 'update', actor = 'aria', scope = 'global', scopeId } = params
    const ts = new Date().toISOString().replace('T', ' ').slice(0, 19)
    const entityLabel = scopeId ? `${scope}:${scopeId.slice(0, 8)}` : scope
    const header = `## [${ts}] ${operation} | ${entityLabel} | ${actor}`
    const block = `\n${header}\n${entry.trim()}\n`

    // Write to global log
    await this.appendPage('log.md', block)

    // Also write to entity-level log if scoped
    if (scope !== 'global' && scopeId) {
      const entityDir = scope === 'person' ? 'people' : `${scope}s`
      const entityLogPath = `${entityDir}/${scopeId}/log.md`
      await this.appendPage(entityLogPath, block)
    }
  }

  /**
   * Read the master index or a scoped entity index.
   *
   * scope = 'global'  → MASTER_INDEX.md
   * scope = 'deal'    → deals/{id}/index.md
   * scope = 'company' → companies/{id}/index.md
   * scope = 'person'  → people/{id}/index.md
   */
  async readIndex(scope: 'global' | 'deal' | 'company' | 'person', id?: string): Promise<string | null> {
    if (scope === 'global') return this.readPage('MASTER_INDEX.md')
    if (!id) return null
    const dir = scope === 'person' ? 'people' : `${scope}s`
    return this.readPage(`${dir}/${id}/index.md`)
  }

  /**
   * Check if a raw note with identical content already exists (idempotency).
   * Compares SHA-256 hash of content against all .md files in the target directory.
   */
  async isDuplicate(dirRelPath: string, content: string): Promise<boolean> {
    const abs = this.resolve(dirRelPath)
    if (!fs.existsSync(abs)) return false
    const incomingHash = crypto.createHash('sha256').update(content).digest('hex')
    const files = fs.readdirSync(abs).filter(f => f.endsWith('.md'))
    for (const file of files) {
      const existing = await fs.promises.readFile(path.join(abs, file), 'utf-8')
      const existingHash = crypto.createHash('sha256').update(existing).digest('hex')
      if (existingHash === incomingHash) return true
    }
    return false
  }

  /**
   * List all entity IDs for a given scope (for LINT and INDEX building).
   */
  listEntityIds(scope: 'deals' | 'companies' | 'people'): string[] {
    const dir = path.join(this.basePath, scope)
    if (!fs.existsSync(dir)) return []
    return fs.readdirSync(dir, { withFileTypes: true })
      .filter(e => e.isDirectory())
      .map(e => e.name)
  }

  /**
   * Stat a file — returns mtime or null.
   */
  statFile(relativePath: string): Date | null {
    try {
      const abs = this.resolve(relativePath)
      const s = fs.statSync(abs)
      return s.mtime
    } catch {
      return null
    }
  }

  /**
   * List all markdown files in a directory (non-recursive).
   */
  listMarkdownFiles(dirRelPath: string): string[] {
    const abs = this.resolve(dirRelPath)
    if (!fs.existsSync(abs)) return []
    return fs.readdirSync(abs).filter(f => f.endsWith('.md'))
  }
}
