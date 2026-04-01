import { Injectable, Logger } from '@nestjs/common'
import mammoth from 'mammoth'
import * as XLSX from 'xlsx'

// pdf-parse has no bundled types — require directly
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse') as (
  buf: Buffer,
) => Promise<{ text: string; numpages: number }>

export interface ParseResult {
  text: string
  wordCount: number
  pageCount?: number
}

const SUPPORTED_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/plain',
  'text/csv',
  'application/csv',
  'text/markdown',
  'text/html',
])

@Injectable()
export class FileParserService {
  private readonly logger = new Logger(FileParserService.name)

  /** Returns true if this service can handle the given mime type. */
  canParse(mimetype: string): boolean {
    return SUPPORTED_MIME_TYPES.has(mimetype)
  }

  async parse(buffer: Buffer, mimetype: string, filename: string): Promise<ParseResult> {
    this.logger.log(`Parsing file: ${filename} (${mimetype}, ${buffer.length} bytes)`)

    try {
      if (mimetype === 'application/pdf') {
        return await this.parsePdf(buffer)
      }

      if (
        mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        mimetype === 'application/msword'
      ) {
        return await this.parseDocx(buffer)
      }

      if (
        mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        mimetype === 'application/vnd.ms-excel'
      ) {
        return this.parseXlsx(buffer)
      }

      if (mimetype === 'text/html') {
        return this.parseHtml(buffer)
      }

      // Plain text / CSV / Markdown
      return this.parsePlainText(buffer)
    } catch (err) {
      this.logger.error(`Failed to parse ${filename}: ${(err as Error).message}`)
      throw new Error(`Could not parse file "${filename}": ${(err as Error).message}`)
    }
  }

  private async parsePdf(buffer: Buffer): Promise<ParseResult> {
    const result = await pdfParse(buffer)
    const text = result.text.trim()
    return {
      text,
      wordCount: this.countWords(text),
      pageCount: result.numpages,
    }
  }

  private async parseDocx(buffer: Buffer): Promise<ParseResult> {
    const result = await mammoth.extractRawText({ buffer })
    const text = result.value.trim()
    return { text, wordCount: this.countWords(text) }
  }

  private parseXlsx(buffer: Buffer): ParseResult {
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    const lines: string[] = []

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName]
      const csv = XLSX.utils.sheet_to_csv(sheet)
      if (csv.trim()) {
        lines.push(`### Sheet: ${sheetName}`)
        lines.push(csv.trim())
      }
    }

    const text = lines.join('\n\n')
    return { text, wordCount: this.countWords(text) }
  }

  private parseHtml(buffer: Buffer): ParseResult {
    let html = buffer.toString('utf-8')

    // Remove script and style tags (including their content)
    html = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    html = html.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')

    // Remove HTML tags
    const text = html
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim()

    return { text, wordCount: this.countWords(text) }
  }

  private parsePlainText(buffer: Buffer): ParseResult {
    const text = buffer.toString('utf-8').trim()
    return { text, wordCount: this.countWords(text) }
  }

  private countWords(text: string): number {
    return text.split(/\s+/).filter(Boolean).length
  }
}
