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
  async serveFile(@Param('id') id: string, @Res({ passthrough: true }) res: any) {
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

    // Set response headers via NestJS
    const filename = doc.storagePath.split('/').pop() ?? doc.title
    const mimeType = this.guessMimeType(doc.storagePath, doc.tags ?? [])
    res.setHeader('Content-Type', mimeType)
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
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

    let content: string | undefined
    const titleBase = originalname.replace(/\.[^.]+$/, '') // strip extension

    // Extract text content from parseable types; skip for pure binary images
    if (this.fileParser.canParse(baseMime)) {
      const parsed = await this.fileParser.parse(buffer, baseMime, originalname)
      content = parsed.text
    } else if (baseMime.startsWith('image/')) {
      // Images: store text stub for content, binary uploaded separately below
      content = `[Image attachment: ${originalname}]`
    } else if (baseMime.startsWith('audio/')) {
      // Audio: store text stub for content, binary uploaded separately below
      content = `[Audio attachment: ${originalname}]`
    } else {
      throw new BadRequestException(`Unsupported file type: ${mimetype}`)
    }

    // Derive a unique storage path for this upload
    // Classify upload: text files (md/txt/csv) → notes bucket; binary → resources bucket
    const TEXT_MIMES = new Set([
      'text/markdown', 'text/plain', 'text/csv', 'application/csv',
    ])
    const isTextNote = TEXT_MIMES.has(baseMime)
    const isBinary = baseMime.startsWith('image/') || baseMime.startsWith('audio/')
    const bucket = isTextNote ? 'notes' : 'resources'
    const ext = originalname.includes('.') ? originalname.split('.').pop()!.toLowerCase() : 'bin'

    const timestamp = Date.now()
    const safeName = titleBase.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 60)
    const storagePath = `deals/${dealId}/${bucket}/${timestamp}-${safeName}.${isTextNote ? 'md' : ext}`

    // Binary files: audio stays in Supabase (needs signed URLs for playback).
    // Images and everything else goes to NFS via writeFile.
    if (baseMime.startsWith('audio/')) {
      await this.storage.uploadVoiceRecording(storagePath, buffer, baseMime)
      this.logger.log(`Audio attachment stored in Supabase: ${storagePath} (${buffer.length} bytes)`)
    } else if (isBinary) {
      await this.storage.writeFile(storagePath, buffer)
      this.logger.log(`Binary attachment stored on NFS: ${storagePath} (${buffer.length} bytes)`)
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
