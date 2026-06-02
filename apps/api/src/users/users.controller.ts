import { Controller, Post, Patch, Delete, Get, Body, Param } from '@nestjs/common'
import { CurrentUserId } from '../auth/current-user.decorator'
import { Roles } from '../auth/roles.guard'
import { CrmUserRole } from '@symph-crm/shared'
import { UsersService } from './users.service'

const SESSION_USER_ROLES = [CrmUserRole.Sales, CrmUserRole.Build, CrmUserRole.Partner]

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('sync')
  sync(@Body() body: { id: string; email: string; name?: string; image?: string }) {
    return this.usersService.sync(body)
  }

  @Patch('onboarding')
  @Roles(...SESSION_USER_ROLES)
  completeOnboarding(
    @Body()
    body: {
      id: string
      currentTeam: string
    },
  ) {
    return this.usersService.completeOnboarding(body.id, { currentTeam: body.currentTeam })
  }

  @Get('me')
  @Roles(...SESSION_USER_ROLES)
  findMe(@CurrentUserId() userId?: string) {
    if (!userId) return null
    return this.usersService.findOne(userId)
  }

  @Get('external')
  @Roles(CrmUserRole.Sales)
  findExternalUsers() {
    return this.usersService.findExternalUsers()
  }

  @Patch('external/:id/approve')
  @Roles(CrmUserRole.Sales)
  approveExternalUser(
    @Param('id') id: string,
    @Body() body: { partnerGroupIds?: string[]; partnerDealGroupIds?: string[] },
    @CurrentUserId() userId?: string,
  ) {
    return this.usersService.approveExternalUser(id, userId, body.partnerGroupIds ?? [], body.partnerDealGroupIds ?? [])
  }

  @Patch('external/:id/reject')
  @Roles(CrmUserRole.Sales)
  rejectExternalUser(@Param('id') id: string, @CurrentUserId() userId?: string) {
    return this.usersService.rejectExternalUser(id, userId)
  }

  @Patch('external/:id/role')
  @Roles(CrmUserRole.Sales)
  updateExternalUserRole(
    @Param('id') id: string,
    @Body() body: { role: CrmUserRole.Partner },
    @CurrentUserId() userId?: string,
  ) {
    return this.usersService.updateExternalUserRole(id, body.role, userId)
  }

  @Delete('external/:id')
  @Roles(CrmUserRole.Sales)
  removeExternalUser(@Param('id') id: string, @CurrentUserId() userId?: string) {
    return this.usersService.removeExternalUser(id, userId)
  }

  @Get()
  findAll() {
    return this.usersService.findAll()
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id)
  }
}
