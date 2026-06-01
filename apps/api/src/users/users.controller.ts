import { Controller, Post, Patch, Delete, Get, Body, Param, Headers } from '@nestjs/common'
import { Roles } from '../auth/roles.guard'
import { UsersService } from './users.service'

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('sync')
  sync(@Body() body: { id: string; email: string; name?: string; image?: string }) {
    return this.usersService.sync(body)
  }

  @Patch('onboarding')
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
  findMe(@Headers('x-user-id') userId?: string) {
    if (!userId) return null
    return this.usersService.findOne(userId)
  }

  @Get('external')
  @Roles('SALES')
  findExternalUsers() {
    return this.usersService.findExternalUsers()
  }

  @Patch('external/:id/approve')
  @Roles('SALES')
  approveExternalUser(@Param('id') id: string, @Headers('x-user-id') userId?: string) {
    return this.usersService.approveExternalUser(id, userId)
  }

  @Patch('external/:id/reject')
  @Roles('SALES')
  rejectExternalUser(@Param('id') id: string, @Headers('x-user-id') userId?: string) {
    return this.usersService.rejectExternalUser(id, userId)
  }

  @Patch('external/:id/role')
  @Roles('SALES')
  updateExternalUserRole(
    @Param('id') id: string,
    @Body() body: { role: 'PARTNER' },
    @Headers('x-user-id') userId?: string,
  ) {
    return this.usersService.updateExternalUserRole(id, body.role, userId)
  }

  @Delete('external/:id')
  @Roles('SALES')
  removeExternalUser(@Param('id') id: string, @Headers('x-user-id') userId?: string) {
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
