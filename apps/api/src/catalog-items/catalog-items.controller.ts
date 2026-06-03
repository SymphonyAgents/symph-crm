import {
  Controller, Get, Post, Patch, Delete, Param, Body, Query,
  UploadedFile, UseInterceptors, BadRequestException,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { memoryStorage } from 'multer'
import { CatalogItemsService, type ProductType } from './catalog-items.service'
import { CreateCatalogItemDto } from './dto/create-catalog-item.dto'
import { UpdateCatalogItemDto } from './dto/update-catalog-item.dto'
import { StorageService } from '../storage/storage.service'

const ALLOWED_ICON_MIME = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'image/gif'])
const MAX_ICON_BYTES = 512 * 1024 // 512 KB — logos are tiny

@Controller('catalog-items')
export class CatalogItemsController {
  constructor(
    private readonly service: CatalogItemsService,
    private readonly storage: StorageService,
  ) {}

  @Get()
  findAll(
    @Query('active') active?: string,
    @Query('type') type?: ProductType,
  ) {
    return this.service.findAll({
      activeOnly: active === 'true',
      type: type && ['internal', 'service', 'reseller'].includes(type) ? type : undefined,
    })
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id)
  }

  @Post()
  create(@Body() dto: CreateCatalogItemDto) {
    return this.service.create(dto)
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCatalogItemDto) {
    return this.service.update(id, dto)
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id)
  }

  // POST /api/catalog-items/:id/icon
  // Multipart field: `icon`. Common image MIME types up to 512KB.
  // Uploads to Supabase Storage (public catalog-icons bucket), patches the
  // row's icon_url, and returns the updated row.
  @Post(':id/icon')
  @UseInterceptors(
    FileInterceptor('icon', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_ICON_BYTES },
    }),
  )
  async uploadIcon(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    if (!file) throw new BadRequestException('icon file is required (multipart field "icon")')
    if (!ALLOWED_ICON_MIME.has(file.mimetype)) {
      throw new BadRequestException(`unsupported mime type: ${file.mimetype}`)
    }
    const existing = await this.service.findOne(id)
    const ext = file.originalname.includes('.') ? file.originalname.split('.').pop()!.toLowerCase() : 'png'
    const storagePath = `${id}/icon-${Date.now()}.${ext}`
    const publicUrl = await this.storage.uploadCatalogIcon(storagePath, file.buffer, file.mimetype)
    return this.service.update(existing.id, { iconUrl: publicUrl })
  }
}
