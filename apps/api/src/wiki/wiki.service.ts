import { Injectable } from '@nestjs/common'
import * as crypto from 'crypto'
import { StorageService } from '../storage/storage.service'

/**
 * WikiService owns CRM wiki semantics while StorageService owns persistence.
 * Three global files: WIKI_SCHEMA.md, MASTER_INDEX.md, and log.md.
 * Per-entity directories contain synthesized index.md and operation log.md files.
 */
@Injectable()
export class WikiService {
  constructor(private readonly storage: StorageService) {}

  async readPage(relativePath: string): Promise<string | null> {
    return this.storage.readText(relativePath)
  }

  async writePage(relativePath: string, content: string): Promise<void> {
    await this.storage.writeText(relativePath, content)
  }

  async appendPage(relativePath: string, content: string): Promise<void> {
    await this.storage.appendText(relativePath, content)
  }

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

    await this.appendPage('log.md', block)

    if (scope !== 'global' && scopeId) {
      const entityDir = scope === 'person' ? 'people' : `${scope}s`
      await this.appendPage(`${entityDir}/${scopeId}/log.md`, block)
    }
  }

  async readIndex(scope: 'global' | 'deal' | 'company' | 'person', id?: string): Promise<string | null> {
    if (scope === 'global') return this.readPage('MASTER_INDEX.md')
    if (!id) return null
    const dir = scope === 'person' ? 'people' : `${scope}s`
    return this.readPage(`${dir}/${id}/index.md`)
  }

  async isDuplicate(dirRelPath: string, content: string): Promise<boolean> {
    const incomingHash = crypto.createHash('sha256').update(content).digest('hex')
    const files = (await this.storage.listEntries(dirRelPath))
      .filter(entry => !entry.isDirectory && entry.name.endsWith('.md'))

    for (const file of files) {
      const existing = await this.storage.readText(`${dirRelPath}/${file.name}`)
      if (existing === null) continue
      const existingHash = crypto.createHash('sha256').update(existing).digest('hex')
      if (existingHash === incomingHash) return true
    }
    return false
  }

  async listEntityIds(scope: 'deals' | 'companies' | 'people'): Promise<string[]> {
    return (await this.storage.listEntries(scope))
      .filter(entry => entry.isDirectory)
      .map(entry => entry.name)
  }

  async statFile(relativePath: string): Promise<Date | null> {
    return (await this.storage.stat(relativePath))?.modifiedAt ?? null
  }

  async listMarkdownFiles(dirRelPath: string): Promise<string[]> {
    return (await this.storage.listEntries(dirRelPath))
      .filter(entry => !entry.isDirectory && entry.name.endsWith('.md'))
      .map(entry => entry.name)
  }
}
