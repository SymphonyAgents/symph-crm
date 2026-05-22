import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Query, BadRequestException } from '@nestjs/common'
import { Roles } from '../auth/roles.guard'
import { MeetingsService } from './meetings.service'

@Controller('meetings')
@Roles('SALES')
export class MeetingsController {
  constructor(private readonly meetings: MeetingsService) {}

  @Get()
  async findAll(
    @Query('workspaceId') workspaceId?: string,
    @Query('status') status?: 'pending' | 'done' | 'failed',
    @Query('dealId') dealId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.meetings.findAll({
      workspaceId,
      status,
      dealId,
      limit: limit ? parseInt(limit, 10) : 50,
    })
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.meetings.findOneWithArtifacts(id)
  }

  @Post(':id/retry-ingest')
  @HttpCode(HttpStatus.OK)
  async retryIngest(@Param('id') id: string) {
    return this.meetings.retryIngest(id)
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async deleteMeeting(@Param('id') id: string) {
    return this.meetings.deleteMeeting(id)
  }

  @Post(':id/assign-deal')
  @HttpCode(HttpStatus.OK)
  async assignDeal(
    @Param('id') id: string,
    @Body() body: { dealId: string },
  ) {
    if (!body.dealId) throw new BadRequestException('dealId is required')
    return this.meetings.assignDeal(id, body.dealId)
  }
}
