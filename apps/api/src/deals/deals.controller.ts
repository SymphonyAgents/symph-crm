import { Controller, Get, Post, Put, Patch, Delete, Param, Body, Query } from '@nestjs/common'
import { CurrentUser, CurrentUserId, type CrmRequestUser } from '../auth/current-user.decorator'
import { Roles } from '../auth/roles.guard'
import { CrmUserRole } from '@symph-crm/shared'
import { DealsService } from './deals.service'
import type { CreateDealData, UpdateDealData, UpsertPartnerDealCommissionData } from './deals.types'
import { DealNotesService } from './deal-notes.service'
import { SaveDealNoteDto } from './dto/save-deal-note.dto'

const DEAL_READ_ROLES = [CrmUserRole.Sales, CrmUserRole.Build, CrmUserRole.Partner]
const INTERNAL_DEAL_READ_ROLES = [CrmUserRole.Sales, CrmUserRole.Build]

@Controller('deals')
export class DealsController {
  constructor(
    private readonly dealsService: DealsService,
    private readonly dealNotesService: DealNotesService,
  ) {}

  @Get()
  @Roles(...DEAL_READ_ROLES)
  findAll(
    @Query('stage') stage?: string,
    @Query('companyId') companyId?: string,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('dealType') dealType?: string,
    @CurrentUser() user?: CrmRequestUser,
  ) {
    return this.dealsService.findAll({
      stage,
      companyId,
      search,
      limit: limit ? parseInt(limit, 10) : undefined,
      from,
      to,
      dealType,
    }, { userId: user?.id, role: user?.role })
  }

  @Get(':id/notes/flat')
  @Roles(...INTERNAL_DEAL_READ_ROLES)
  async getDealNotesFlat(@Param('id') id: string, @CurrentUser() user?: CrmRequestUser) {
    await this.dealsService.assertCanReadDeal(id, { userId: user?.id, role: user?.role })
    return this.dealNotesService.getNotesFlat(id)
  }

  @Get(':id/notes')
  @Roles(...INTERNAL_DEAL_READ_ROLES)
  async getDealNotes(@Param('id') id: string, @CurrentUser() user?: CrmRequestUser) {
    await this.dealsService.assertCanReadDeal(id, { userId: user?.id, role: user?.role })
    return this.dealNotesService.getNotes(id)
  }

  @Get('trash')
  @Roles(CrmUserRole.Sales)
  listTrash() {
    return this.dealsService.listTrash()
  }

  @Get(':id')
  @Roles(...DEAL_READ_ROLES)
  findOne(@Param('id') id: string, @CurrentUser() user?: CrmRequestUser) {
    return this.dealsService.findOne(id, { userId: user?.id, role: user?.role })
  }

  @Post(':id/notes')
  saveDealNote(
    @Param('id') id: string,
    @Body() body: SaveDealNoteDto,
    @CurrentUserId() userId?: string,
  ) {
    const authorId = body.authorId || userId || null
    return this.dealNotesService.saveNote(id, body.type, body.title, body.content, authorId)
  }

  @Post()
  create(
    @Body() data: CreateDealData,
    @CurrentUserId() userId?: string,
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
    @Body() data: UpdateDealData,
    @CurrentUserId() userId?: string,
  ) {
    return this.dealsService.update(id, data, userId)
  }

  @Patch(':id/partner-commissions/:partnerDealGroupId')
  @Roles(CrmUserRole.Sales)
  upsertPartnerDealCommission(
    @Param('id') id: string,
    @Param('partnerDealGroupId') partnerDealGroupId: string,
    @Body() body: UpsertPartnerDealCommissionData,
    @CurrentUserId() userId?: string,
  ) {
    return this.dealsService.upsertPartnerDealCommission(id, partnerDealGroupId, body, userId)
  }

  @Patch(':id/stage')
  patchStage(
    @Param('id') id: string,
    @Body() body: { stage: string },
    @CurrentUserId() userId?: string,
  ) {
    return this.dealsService.updateStage(id, body.stage, userId)
  }

  @Get(':id/summaries')
  @Roles(...INTERNAL_DEAL_READ_ROLES)
  async listSummaries(@Param('id') id: string, @CurrentUser() user?: CrmRequestUser) {
    await this.dealsService.assertCanReadDeal(id, { userId: user?.id, role: user?.role })
    return this.dealNotesService.listSummaries(id)
  }

  @Get(':id/summaries/check')
  @Roles(...INTERNAL_DEAL_READ_ROLES)
  async checkNewNotes(@Param('id') id: string, @CurrentUser() user?: CrmRequestUser) {
    await this.dealsService.assertCanReadDeal(id, { userId: user?.id, role: user?.role })
    return this.dealNotesService.hasNewNotesSinceLastSummary(id)
  }

  @Get(':id/summaries/:filename')
  @Roles(...INTERNAL_DEAL_READ_ROLES)
  async readSummary(@Param('id') id: string, @Param('filename') filename: string, @CurrentUser() user?: CrmRequestUser) {
    await this.dealsService.assertCanReadDeal(id, { userId: user?.id, role: user?.role })
    return this.dealNotesService.readSummary(id, filename)
  }

  @Post(':id/summaries/generate')
  generateSummary(
    @Param('id') id: string,
    @CurrentUserId() userId?: string,
  ) {
    return this.dealNotesService.triggerSummaryGeneration(id, userId)
  }

  @Post(':id/summaries')
  writeSummary(
    @Param('id') id: string,
    @CurrentUserId() userId?: string,
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
    @CurrentUserId() userId?: string,
  ) {
    return this.dealNotesService.deleteNote(id, category, filename, userId)
  }

  @Post(':id/restore')
  restore(@Param('id') id: string, @CurrentUserId() userId?: string) {
    return this.dealsService.restore(id, userId)
  }

  @Delete(':id/permanent')
  deletePermanently(@Param('id') id: string, @CurrentUserId() userId?: string) {
    return this.dealsService.deletePermanently(id, userId)
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUserId() userId?: string) {
    return this.dealsService.remove(id, userId)
  }
}
