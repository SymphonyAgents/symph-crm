import { Module } from '@nestjs/common'
import { AuditLogsModule } from '../audit-logs/audit-logs.module'
import { PartnerDealGroupsController } from './partner-deal-groups.controller'
import { PartnerDealGroupsService } from './partner-deal-groups.service'

@Module({
  imports: [AuditLogsModule],
  controllers: [PartnerDealGroupsController],
  providers: [PartnerDealGroupsService],
  exports: [PartnerDealGroupsService],
})
export class PartnerDealGroupsModule {}
