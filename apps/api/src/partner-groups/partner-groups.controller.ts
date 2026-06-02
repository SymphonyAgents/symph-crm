import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common'
import { CurrentUserId } from '../auth/current-user.decorator'
import { Roles } from '../auth/roles.guard'
import { CrmUserRole } from '@symph-crm/shared'
import { CreatePartnerGroupDto, PartnerGroupsService, UpdatePartnerGroupDto } from './partner-groups.service'

@Controller('partner-groups')
@Roles(CrmUserRole.Sales)
export class PartnerGroupsController {
  constructor(private readonly partnerGroups: PartnerGroupsService) {}

  @Get()
  findAll() {
    return this.partnerGroups.findAll()
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.partnerGroups.findOne(id)
  }

  @Post()
  create(@Body() body: CreatePartnerGroupDto, @CurrentUserId() userId?: string) {
    return this.partnerGroups.create(body, userId)
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: UpdatePartnerGroupDto, @CurrentUserId() userId?: string) {
    return this.partnerGroups.update(id, body, userId)
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUserId() userId?: string) {
    return this.partnerGroups.remove(id, userId)
  }
}
