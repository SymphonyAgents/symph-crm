import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common'
import { CrmUserRole } from '@symph-crm/shared'
import { CurrentUserId } from '../auth/current-user.decorator'
import { Roles } from '../auth/roles.guard'
import { LeadsService } from './leads.service'
import type { ConvertLeadData, CreateLeadData, UpdateLeadData } from './leads.types'

@Controller('leads')
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @Get()
  @Roles(CrmUserRole.Sales, CrmUserRole.Build)
  findAll(
    @Query('workspaceId') workspaceId?: string,
    @Query('status') status?: string,
    @Query('sourceName') sourceName?: string,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
  ) {
    return this.leadsService.findAll({
      workspaceId,
      status,
      sourceName,
      search,
      limit: limit ? parseInt(limit, 10) : undefined,
    })
  }

  @Get(':id/conversions')
  @Roles(CrmUserRole.Sales, CrmUserRole.Build)
  findConversions(@Param('id') id: string) {
    return this.leadsService.findConversions(id)
  }

  @Get(':id')
  @Roles(CrmUserRole.Sales, CrmUserRole.Build)
  findOne(@Param('id') id: string) {
    return this.leadsService.findOne(id)
  }

  @Post()
  @Roles(CrmUserRole.Sales)
  create(
    @Body() data: CreateLeadData,
    @CurrentUserId() userId?: string,
  ) {
    return this.leadsService.create(data, userId)
  }

  @Patch(':id')
  @Roles(CrmUserRole.Sales)
  update(@Param('id') id: string, @Body() data: UpdateLeadData) {
    return this.leadsService.update(id, data)
  }

  @Post(':id/convert')
  @Roles(CrmUserRole.Sales)
  convert(
    @Param('id') id: string,
    @Body() data: ConvertLeadData,
    @CurrentUserId() userId?: string,
  ) {
    return this.leadsService.convert(id, data, userId)
  }

  @Delete(':id')
  @Roles(CrmUserRole.Sales)
  remove(@Param('id') id: string) {
    return this.leadsService.remove(id)
  }
}
