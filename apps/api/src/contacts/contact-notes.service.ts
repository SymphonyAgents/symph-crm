import { Injectable } from '@nestjs/common'
import * as path from 'path'
import { StorageService } from '../storage/storage.service'

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

function extractTimestamp(filename: string): number {
  const leadingMatch = filename.match(/^(\d{10,})/)
  if (leadingMatch) return parseInt(leadingMatch[1], 10)

  const trailingMatch = filename.match(/(\d{10,})/)
  if (trailingMatch) return parseInt(trailingMatch[1], 10)

  return 0
}

@Injectable()
export class ContactNotesService {
  constructor(private readonly storage: StorageService) {}

  async getNotes(contactId: string): Promise<ContactNotesResponse> {
    const contactPath = `people/${contactId}`
    const result: ContactNotesResponse = {
      categories: { general: [], meeting: [], log: [] },
      resources: [],
    }

    for (const category of NOTE_CATEGORIES) {
      const categoryPath = `${contactPath}/${category}`
      const files = (await this.storage.listEntries(categoryPath))
        .filter(entry => !entry.isDirectory && entry.name.endsWith('.md'))

      const noteFiles = await Promise.all(files.map(async file => ({
        filename: file.name,
        content: (await this.storage.readText(`${categoryPath}/${file.name}`)) ?? '',
        createdAt: extractTimestamp(file.name),
      })))

      noteFiles.sort((a, b) => b.createdAt - a.createdAt)
      result.categories[category] = noteFiles
    }

    result.resources = (await this.storage.listEntries(`${contactPath}/resources`))
      .filter(entry => !entry.isDirectory)
      .map(entry => ({
        filename: entry.name,
        size: entry.size,
        ext: path.extname(entry.name).toLowerCase(),
      }))

    return result
  }
}
