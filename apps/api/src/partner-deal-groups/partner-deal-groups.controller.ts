import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common'
import { CrmUserRole } from '@symph-crm/shared'
import { CurrentUserId } from '../auth/current-user.decorator'
import { Roles } from '../auth/roles.guard'
import { CreatePartnerDealGroupDto, PartnerDealGroupsService, UpdatePartnerDealGroupDto } from './partner-deal-groups.service'

@Controller('partner-deal-groups')
@Roles(CrmUserRole.Sales)
export class PartnerDealGroupsController {
  constructor(private readonly partnerDealGroups: PartnerDealGroupsService) {}

  @Get()
  findAll() {
    return this.partnerDealGroups.findAll()
  }

  @Get('me')
  @Roles(CrmUserRole.Sales, CrmUserRole.Partner)
  findMine(@CurrentUserId() userId?: string) {
    if (!userId) return []
    return this.partnerDealGroups.findForUser(userId)
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.partnerDealGroups.findOne(id)
  }

  @Post()
  create(@Body() body: CreatePartnerDealGroupDto, @CurrentUserId() userId?: string) {
    return this.partnerDealGroups.create(body, userId)
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: UpdatePartnerDealGroupDto, @CurrentUserId() userId?: string) {
    return this.partnerDealGroups.update(id, body, userId)
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUserId() userId?: string) {
    return this.partnerDealGroups.remove(id, userId)
  }
}
