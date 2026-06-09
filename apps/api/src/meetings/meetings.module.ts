import { Module } from '@nestjs/common'
import { MeetingsService } from './meetings.service'
import { MeetingsController } from './meetings.controller'
import { MeetingActionsService } from './meeting-actions.service'
import { DealsModule } from '../deals/deals.module'
import { AriaGatewayModule } from '../common/aria/aria-gateway.module'
import { GmailModule } from '../gmail/gmail.module'
import { InboundEmailModule } from '../inbound-email/inbound-email.module'

@Module({
  imports: [DealsModule, AriaGatewayModule, GmailModule, InboundEmailModule],
  controllers: [MeetingsController],
  providers: [MeetingsService, MeetingActionsService],
  exports: [MeetingsService, MeetingActionsService],
})
export class MeetingsModule {}
