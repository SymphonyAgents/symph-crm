import { Module } from '@nestjs/common'
import { GmailController } from './gmail.controller'
import { GmailService } from './gmail.service'
import { CentralGmailService } from './central-gmail.service'
import { CalendarModule } from '../calendar/calendar.module'

@Module({
  imports: [CalendarModule],
  controllers: [GmailController],
  providers: [GmailService, CentralGmailService],
  exports: [GmailService, CentralGmailService],
})
export class GmailModule {}
