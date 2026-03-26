import { Controller, Get, Post, Put, Patch, Delete, Param, Body, Query } from '@nestjs/common'
import { DealsService } from './deals.service'
import { deals } from '@symph-crm/database'

@Controller('deals')
export class DealsController {
  constructor(private readonly dealsService: DealsService) {}

  /**
   * GET /api/deals
   * Optional query params:
   *   ?stage=discovery        — filter by pipeline stage
   *   ?companyId=<uuid>       — filter by company
   *   ?search=acme            — fuzzy search by title
   *   ?limit=50               — max results (default 200)
   */
  @Get()
  findAll(
    @Query('stage') stage?: string,
    @Query('companyId') companyId?: string,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
  ) {
    return this.dealsService.findAll({
      stage,
      companyId,
      search,
      limit: limit ? parseInt(limit, 10) : undefined,
    })
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.dealsService.findOne(id)
  }

  @Post()
  create(@Body() data: typeof deals.$inferInsert) {
    return this.dealsService.create(data)
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() data: Partial<typeof deals.$inferInsert>) {
    return this.dealsService.update(id, data)
  }

  /** PATCH /api/deals/:id/stage — atomic stage transition, triggers lastActivityAt update */
  @Patch(':id/stage')
  patchStage(@Param('id') id: string, @Body() body: { stage: string }) {
    return this.dealsService.updateStage(id, body.stage)
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.dealsService.remove(id)
  }
}
