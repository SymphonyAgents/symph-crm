import { Controller, Get, Post, Put, Delete, Param, Body, Query, Headers } from '@nestjs/common'
import { DocumentsService } from './documents.service'
import { documents } from '@symph-crm/database'

@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

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
