import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common'
import { CurrentUserId } from '../auth/current-user.decorator'
import { LeadsService, type ConvertLeadInput, type LeadInput, type LeadStatus } from './leads.service'

@Controller('leads')
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @Get()
  findAll(
    @Query('workspaceId') workspaceId?: string,
    @Query('status') status?: LeadStatus | 'all',
    @Query('sourceName') sourceName?: string,
    @Query('segment') segment?: string,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.leadsService.findAll({
      workspaceId,
      status,
      sourceName,
      segment,
      search,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    })
  }

  @Get(':id/conversions')
  conversions(@Param('id') id: string) {
    return this.leadsService.conversions(id)
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.leadsService.findOne(id)
  }

  @Post()
  create(@Body() input: LeadInput, @CurrentUserId() userId?: string) {
    return this.leadsService.create(input, userId)
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() input: LeadInput) {
    return this.leadsService.update(id, input)
  }

  @Post(':id/convert')
  convert(
    @Param('id') id: string,
    @Body() input: ConvertLeadInput,
    @CurrentUserId() userId?: string,
  ) {
    return this.leadsService.convert(id, input, userId)
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.leadsService.remove(id)
  }
}
