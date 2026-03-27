import { Controller, Get, Post, Put, Patch, Delete, Param, Body, Query, Headers } from '@nestjs/common'
import { DealsService } from './deals.service'
import { deals } from '@symph-crm/database'

@Controller('deals')
export class DealsController {
  constructor(private readonly dealsService: DealsService) {}

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
    return this.dealsService.create(enriched)
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() data: Partial<typeof deals.$inferInsert>) {
    return this.dealsService.update(id, data)
  }

  @Patch(':id/stage')
  patchStage(@Param('id') id: string, @Body() body: { stage: string }) {
    return this.dealsService.updateStage(id, body.stage)
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.dealsService.remove(id)
  }
}
