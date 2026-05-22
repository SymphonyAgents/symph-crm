import { Module } from '@nestjs/common'
import { MeetingsService } from './meetings.service'
import { MeetingsController } from './meetings.controller'
import { DealsModule } from '../deals/deals.module'
import { AriaGatewayModule } from '../common/aria/aria-gateway.module'

@Module({
  imports: [DealsModule, AriaGatewayModule],
  controllers: [MeetingsController],
  providers: [MeetingsService],
  exports: [MeetingsService],
})
export class MeetingsModule {}
