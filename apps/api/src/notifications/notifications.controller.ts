import { Controller, Get, Patch, Param } from '@nestjs/common'
import { CurrentUserId } from '../auth/current-user.decorator'
import { NotificationsService } from './notifications.service'

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  getNotifications(@CurrentUserId() userId: string) {
    return this.notificationsService.getForUser(userId)
  }

  @Patch('read-all')
  markAllRead(@CurrentUserId() userId: string) {
    return this.notificationsService.markAllRead(userId)
  }

  @Patch(':id/read')
  markOneRead(@Param('id') id: string, @CurrentUserId() userId: string) {
    return this.notificationsService.markOneRead(id, userId)
  }
}
