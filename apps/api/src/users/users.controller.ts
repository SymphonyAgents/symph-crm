import { Controller, Post, Get, Body, Param } from '@nestjs/common'
import { UsersService } from './users.service'

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * POST /api/users/sync
   * Called by NextAuth signIn callback on every login.
   * Upserts the Google OAuth user into public.users.
   */
  @Post('sync')
  sync(@Body() body: { id: string; email: string; name?: string; image?: string }) {
    return this.usersService.sync(body)
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
