import { Injectable } from '@nestjs/common'
import * as fs from 'fs'
import * as path from 'path'

export type ContactNoteFile = {
  filename: string
  content: string
  createdAt: number
}

export type ContactNotesResponse = {
  categories: {
    general: ContactNoteFile[]
    meeting: ContactNoteFile[]
    log: ContactNoteFile[]
  }
  resources: Array<{ filename: string; size: number; ext: string }>
}

const NOTE_CATEGORIES = ['general', 'meeting', 'log'] as const

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

@Injectable()
export class ContactNotesService {
  private readonly basePath: string

  constructor() {
    this.basePath = process.env.NFS_CRM_PATH || '/share/crm'
  }

  async getNotes(contactId: string): Promise<ContactNotesResponse> {
    const contactDir = path.join(this.basePath, 'people', contactId)

    const result: ContactNotesResponse = {
      categories: { general: [], meeting: [], log: [] },
      resources: [],
    }

    // If the contact's NFS folder doesn't exist, return empty
    if (!fs.existsSync(contactDir)) return result

    // Read markdown notes from each category folder
    for (const category of NOTE_CATEGORIES) {
      const catDir = path.join(contactDir, category)
      if (!fs.existsSync(catDir)) continue

      const files = fs.readdirSync(catDir).filter(f => f.endsWith('.md'))

      const noteFiles: ContactNoteFile[] = await Promise.all(
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

    // Read resources folder — metadata only, no content
    const resourcesDir = path.join(contactDir, 'resources')
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
}
