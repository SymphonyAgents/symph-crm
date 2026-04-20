import {
  Controller, Get, Post, Put, Delete,
  Param, Body, Query, Headers,
  UseInterceptors, UploadedFile, BadRequestException, HttpCode, Logger, NotFoundException, Res, StreamableFile,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { memoryStorage } from 'multer'
import { DocumentsService } from './documents.service'
import { FileParserService } from '../file-parser/file-parser.service'
import { StorageService, ATTACHMENTS_BUCKET } from '../storage/storage.service'
import { documents } from '@symph-crm/database'

@Controller('documents')
export class DocumentsController {
  private readonly logger = new Logger(DocumentsController.name)

  constructor(
    private readonly documentsService: DocumentsService,
    private readonly fileParser: FileParserService,
    private readonly storage: StorageService,
  ) {}

  @Get()
  find(
    @Query('dealId') dealId?: string,
    @Query('companyId') companyId?: string,
    @Query('type') type?: string,
  ) {
    if (dealId) return this.documentsService.findByDeal(dealId)
    if (companyId) return this.documentsService.findByCompany(companyId)
    if (type) return this.documentsService.findByType(type as any)
    return []
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.documentsService.findOne(id)
  }

  @Get(':id/content')
  readContent(@Param('id') id: string) {
    return this.documentsService.readContent(id).then(content => ({ content }))
  }

  @Get(':id/download')
  downloadUrl(@Param('id') id: string) {
    return this.documentsService.getDownloadUrl(id)
  }

  @Get(':id/preview')
  previewUrl(@Param('id') id: string) {
    return this.documentsService.getPreviewUrl(id)
  }

  /**
   * Serve a file from NFS.
   * GET /api/documents/{id}/file
   * Returns the actual file content with appropriate Content-Type and Content-Disposition headers.
   */
  @Get(':id/file')
  async serveFile(
    @Param('id') id: string,
    @Query('inline') inline: string | undefined,
    @Res({ passthrough: true }) res: any,
  ) {
    const doc = await this.documentsService.findOne(id)
    if (!doc) throw new NotFoundException(`Document ${id} not found`)

    // Only serve NFS files, not voice recordings
    const AUDIO_TAGS = ['mp3', 'm4a', 'mpeg', 'mp4', 'x-m4a']
    const isVoice = doc.tags?.some(t => AUDIO_TAGS.includes(t))
    if (isVoice) {
      throw new BadRequestException('Voice recordings are served from Supabase Storage')
    }

    // Read from NFS
    const buffer = await this.storage.readFile(doc.storagePath)
    if (!buffer) throw new NotFoundException(`File not found on NFS: ${doc.storagePath}`)

    // inline=1 → browser renders in-place (PDF preview); default → force download
    const filename = doc.storagePath.split('/').pop() ?? doc.title
    const mimeType = this.guessMimeType(doc.storagePath, doc.tags ?? [])
    const disposition = inline ? `inline; filename="${filename}"` : `attachment; filename="${filename}"`
    res.setHeader('Content-Type', mimeType)
    res.setHeader('Content-Disposition', disposition)
    return new StreamableFile(buffer)
  }

  /** Guess MIME type from file extension and tags */
  private guessMimeType(storagePath: string, tags: string[]): string {
    const ext = storagePath.split('.').pop()?.toLowerCase()
    const mimeMap: Record<string, string> = {
      md: 'text/markdown',
      txt: 'text/plain',
      pdf: 'application/pdf',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp',
    }
    if (ext && ext in mimeMap) return mimeMap[ext]
    if (tags[0]?.includes('image')) return 'image/octet-stream'
    return 'application/octet-stream'
  }

  @Post()
  create(
    @Body() data: Omit<typeof documents.$inferInsert, 'storagePath' | 'excerpt' | 'wordCount'> & {
      storagePath?: string
      content?: string
    },
    @Headers('x-user-id') userId?: string,
  ) {
    return this.documentsService.create(data, userId)
  }

  /**
   * POST /api/documents/upload
   * Multipart upload: parses file content and creates a document record.
   * Form fields: file (required), dealId (required), authorId (required)
   *
   * Supported MIME types: PDF, DOCX, HTML, Markdown, plain text, images
   * Image files are stored as stubs (no text extraction).
   * If Supabase Storage is not yet configured the parsed content is stored
   * in the document record's excerpt only — graceful degradation.
   */
  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 30 * 1024 * 1024 }, // 30 MB
    }),
  )
  async uploadFile(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body('dealId') dealId: string,
    @Body('authorId') authorId: string,
    @Body('dealStage') dealStage?: string,
    @Headers('x-user-id') userId?: string,
  ) {
    if (!file) throw new BadRequestException('No file provided')
    if (!dealId) throw new BadRequestException('dealId is required')
    if (!authorId) throw new BadRequestException('authorId is required')

    const { originalname, mimetype, buffer } = file
    const baseMime = mimetype.split(';')[0].trim()

    this.logger.log(`Document upload: ${originalname} (${baseMime}, ${buffer.length} bytes) for deal ${dealId}`)

    const titleBase = originalname.replace(/\.[^.]+$/, '') // strip extension

    // Classify MIME type to determine storage path and write strategy.
    // TEXT_MIMES: parsed and stored as markdown on NFS.
    // BINARY_DOC_MIMES: binary written verbatim to NFS (PDF, DOCX, XLSX, PPTX) — NOT via writeMarkdown.
    //   Previously these fell through to fileParser and had their extracted text written to the .pdf
    //   path via writeMarkdown(), overwriting the binary. The /file endpoint then served text as PDF.
    const TEXT_MIMES = new Set([
      'text/markdown', 'text/plain', 'text/csv', 'application/csv',
    ])
    const BINARY_DOC_MIMES = new Set([
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    ])

    const isTextNote = TEXT_MIMES.has(baseMime)
    const isBinaryDoc = BINARY_DOC_MIMES.has(baseMime)
    const isBinary = baseMime.startsWith('image/') || baseMime.startsWith('audio/') || isBinaryDoc

    let content: string | undefined

    if (isTextNote || (this.fileParser.canParse(baseMime) && !isBinaryDoc)) {
      // Pure text / parseable-as-text files: extract content for storage and search
      const parsed = await this.fileParser.parse(buffer, baseMime, originalname)
      content = parsed.text
    } else if (baseMime.startsWith('image/')) {
      content = `[Image attachment: ${originalname}]`
    } else if (baseMime.startsWith('audio/')) {
      content = `[Audio attachment: ${originalname}]`
    } else if (isBinaryDoc) {
      // Binary documents (PDF, DOCX, etc.): binary is written to NFS below.
      // Do NOT pass content so documentsService.create() skips writeMarkdown()
      // and does not clobber the binary with extracted text.
      content = undefined
    } else {
      throw new BadRequestException(`Unsupported file type: ${mimetype}`)
    }

    const bucket = isTextNote ? 'notes' : 'resources'
    const ext = originalname.includes('.') ? originalname.split('.').pop()!.toLowerCase() : 'bin'

    const timestamp = Date.now()
    const safeName = titleBase.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 60)
    const storagePath = `deals/${dealId}/${bucket}/${timestamp}-${safeName}.${isTextNote ? 'md' : ext}`

    // Write binary to NFS. Audio stays in Supabase (needs signed URLs for playback).
    if (baseMime.startsWith('audio/')) {
      await this.storage.uploadVoiceRecording(storagePath, buffer, baseMime)
      this.logger.log(`Audio stored in Supabase: ${storagePath} (${buffer.length} bytes)`)
    } else if (isBinary) {
      await this.storage.writeFile(storagePath, buffer)
      this.logger.log(`Binary stored on NFS: ${storagePath} (${buffer.length} bytes)`)
    }

    const tags = [bucket, baseMime.split('/')[1] ?? ext]
    if (dealStage) tags.push(`deal_stage:${dealStage}`)

    return this.documentsService.create(
      {
        dealId,
        authorId,
        type: 'general',
        title: titleBase,
        storagePath,
        content,
        tags,
      },
      userId ?? authorId,
    )
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() data: Partial<typeof documents.$inferInsert> & { content?: string },
    @Headers('x-user-id') userId?: string,
  ) {
    return this.documentsService.update(id, data, userId)
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string) {
    return this.documentsService.remove(id)
  }
}
