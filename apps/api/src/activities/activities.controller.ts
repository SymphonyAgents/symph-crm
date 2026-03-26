import { Controller, Get, Post, Body, Query } from '@nestjs/common'
import { ActivitiesService } from './activities.service'
import { activities } from '@symph-crm/database'

@Controller('activities')
export class ActivitiesController {
  constructor(private readonly activitiesService: ActivitiesService) {}

  /**
   * GET /api/activities
   * ?dealId=<uuid>       — filter by deal
   * ?companyId=<uuid>    — filter by company
   * ?limit=<number>      — max results (default 50)
   *
   * At least one of dealId or companyId is required — returns [] otherwise
   * to prevent unbounded queries.
   */
  @Get()
  find(
    @Query('dealId') dealId?: string,
    @Query('companyId') companyId?: string,
    @Query('limit') limit?: string,
  ) {
    if (!dealId && !companyId) return []
    return this.activitiesService.find({
      dealId,
      companyId,
      limit: limit ? parseInt(limit, 10) : undefined,
    })
  }

  /** POST /api/activities — log an activity manually */
  @Post()
  create(@Body() data: typeof activities.$inferInsert) {
    return this.activitiesService.create(data)
  }
}
