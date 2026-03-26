import { Module } from '@nestjs/common'
import { CalendarController } from './calendar.controller'
import { CalendarConnectionsService } from './calendar-connections.service'
import { CalendarEventsService } from './calendar-events.service'
import { CalendarCryptoService } from './calendar-crypto.service'

@Module({
  controllers: [CalendarController],
  providers: [
    CalendarCryptoService,
    CalendarConnectionsService,
    CalendarEventsService,
  ],
  exports: [CalendarConnectionsService, CalendarEventsService],
})
export class CalendarModule {}
