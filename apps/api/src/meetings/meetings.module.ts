import { Module } from '@nestjs/common'
import { MeetingsService } from './meetings.service'
import { MeetingsController } from './meetings.controller'
import { DealsModule } from '../deals/deals.module'

@Module({
  imports: [DealsModule],
  controllers: [MeetingsController],
  providers: [MeetingsService],
  exports: [MeetingsService],
})
export class MeetingsModule {}
