import { Module } from '@nestjs/common'
import { AuditLogsModule } from '../audit-logs/audit-logs.module'
import { PartnerGroupsController } from './partner-groups.controller'
import { PartnerGroupsService } from './partner-groups.service'

@Module({
  imports: [AuditLogsModule],
  controllers: [PartnerGroupsController],
  providers: [PartnerGroupsService],
  exports: [PartnerGroupsService],
})
export class PartnerGroupsModule {}
