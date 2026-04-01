import {
  Controller, Get, Post, Put, Delete,
  Param, Body, Query, Headers,
  UseInterceptors, UploadedFile, BadRequestException, Logger,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { memoryStorage } from 'multer'
import { DocumentsService } from './documents.service'
import { FileParserService } from '../file-parser/file-parser.service'
import { documents } from '@symph-crm/database'

@Controller('documents')
export class DocumentsController {
  private readonly logger = new Logger(DocumentsController.name)

  constructor(
    private readonly documentsService: DocumentsService,
    private readonly fileParser: FileParserService,
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
      // Images are stored as attachment stubs — no text to extract
      content = `[Image attachment: ${originalname}]`
    } else {
      throw new BadRequestException(`Unsupported file type: ${mimetype}`)
    }

    // Derive a unique storage path for this upload
    const timestamp = Date.now()
    const safeName = titleBase.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 60)
    const storagePath = `deals/${dealId}/uploads/${timestamp}-${safeName}.md`

    return this.documentsService.create(
      {
        dealId,
        authorId,
        type: 'general',
        title: titleBase,
        storagePath,
        content,
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
  remove(@Param('id') id: string) {
    return this.documentsService.remove(id)
  }
}
