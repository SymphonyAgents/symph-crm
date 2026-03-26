import { Module } from '@nestjs/common'
import { InternalController } from './internal.controller'
import { InternalService } from './internal.service'
import { CalendarModule } from '../calendar/calendar.module'

@Module({
  imports: [CalendarModule],
  controllers: [InternalController],
  providers: [InternalService],
  exports: [InternalService],
})
export class InternalModule {}
