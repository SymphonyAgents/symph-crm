import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Query, BadRequestException } from '@nestjs/common'
import { CurrentUserId } from '../auth/current-user.decorator'
import { Roles } from '../auth/roles.guard'
import { CrmUserRole } from '@symph-crm/shared'
import { MeetingsService } from './meetings.service'
import { MeetingActionsService } from './meeting-actions.service'
import type { CreateMeetingActionPackageBody } from './meeting-actions.types'

@Controller('meetings')
@Roles(CrmUserRole.Sales)
export class MeetingsController {
  constructor(
    private readonly meetings: MeetingsService,
    private readonly meetingActions: MeetingActionsService,
  ) {}

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
  async retryIngest(
    @Param('id') id: string,
    @CurrentUserId() userId?: string,
  ) {
    return this.meetings.retryIngest(id, { authorId: userId ?? null })
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
    @CurrentUserId() userId?: string,
  ) {
    if (!body.dealId) throw new BadRequestException('dealId is required')
    return this.meetings.assignDeal(id, body.dealId, { authorId: userId ?? null })
  }

  @Post(':id/action-package')
  @HttpCode(HttpStatus.OK)
  async createActionPackage(
    @Param('id') id: string,
    @Body() body: CreateMeetingActionPackageBody,
    @CurrentUserId() userId?: string,
  ) {
    return this.meetingActions.createActionPackage(id, body ?? {}, { authorId: userId ?? null })
  }
}
