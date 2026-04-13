import { Controller, Get, Post, Put, Patch, Delete, Param, Body, Query, Headers } from '@nestjs/common'
import { DealsService } from './deals.service'
import { DealNotesService } from './deal-notes.service'
import { SaveDealNoteDto } from './dto/save-deal-note.dto'
import { deals } from '@symph-crm/database'

@Controller('deals')
export class DealsController {
  constructor(
    private readonly dealsService: DealsService,
    private readonly dealNotesService: DealNotesService,
  ) {}

  @Get()
  findAll(
    @Query('stage') stage?: string,
    @Query('companyId') companyId?: string,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.dealsService.findAll({
      stage,
      companyId,
      search,
      limit: limit ? parseInt(limit, 10) : undefined,
      from,
      to,
    })
  }

  @Get(':id/notes/flat')
  getDealNotesFlat(@Param('id') id: string) {
    return this.dealNotesService.getNotesFlat(id)
  }

  @Get(':id/notes')
  getDealNotes(@Param('id') id: string) {
    return this.dealNotesService.getNotes(id)
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.dealsService.findOne(id)
  }

  @Post(':id/notes')
  saveDealNote(
    @Param('id') id: string,
    @Body() body: SaveDealNoteDto,
    @Headers('x-user-id') userId?: string,
  ) {
    const authorId = body.authorId || userId || null
    return this.dealNotesService.saveNote(id, body.type, body.title, body.content, authorId)
  }

  @Post()
  create(
    @Body() data: typeof deals.$inferInsert,
    @Headers('x-user-id') userId?: string,
  ) {
    // Auto-set createdBy and assignedTo from request context
    const enriched = {
      ...data,
      createdBy: data.createdBy || userId || null,
      assignedTo: data.assignedTo || data.createdBy || userId || null,
    }
    return this.dealsService.create(enriched, userId)
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() data: Partial<typeof deals.$inferInsert>,
    @Headers('x-user-id') userId?: string,
  ) {
    return this.dealsService.update(id, data, userId)
  }

  @Patch(':id/stage')
  patchStage(
    @Param('id') id: string,
    @Body() body: { stage: string },
    @Headers('x-user-id') userId?: string,
  ) {
    return this.dealsService.updateStage(id, body.stage, userId)
  }

  @Get(':id/summaries')
  listSummaries(@Param('id') id: string) {
    return this.dealNotesService.listSummaries(id)
  }

  @Get(':id/summaries/check')
  checkNewNotes(@Param('id') id: string) {
    return this.dealNotesService.hasNewNotesSinceLastSummary(id)
  }

  @Get(':id/summaries/:filename')
  readSummary(@Param('id') id: string, @Param('filename') filename: string) {
    return this.dealNotesService.readSummary(id, filename)
  }

  @Post(':id/summaries/generate')
  generateSummary(
    @Param('id') id: string,
    @Headers('x-user-id') userId?: string,
  ) {
    return this.dealNotesService.triggerSummaryGeneration(id, userId)
  }

  @Post(':id/summaries')
  writeSummary(
    @Param('id') id: string,
    @Headers('x-user-id') userId?: string,
    @Body() body?: { summary: string; nextSteps: string[]; notesIncluded: number },
  ) {
    return this.dealNotesService.writeSummary(
      id,
      body?.summary ?? '',
      body?.nextSteps ?? [],
      body?.notesIncluded ?? 0,
      userId,
    )
  }

  @Delete(':id/notes/:category/:filename')
  deleteDealNote(
    @Param('id') id: string,
    @Param('category') category: string,
    @Param('filename') filename: string,
    @Headers('x-user-id') userId?: string,
  ) {
    return this.dealNotesService.deleteNote(id, category, filename, userId)
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Headers('x-user-id') userId?: string) {
    return this.dealsService.remove(id, userId)
  }
}
