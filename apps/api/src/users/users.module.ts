import { Module } from '@nestjs/common'
import { UsersController } from './users.controller'
import { UsersService } from './users.service'
import { AuditLogsModule } from '../audit-logs/audit-logs.module'
import { PartnerGroupsModule } from '../partner-groups/partner-groups.module'
import { PartnerDealGroupsModule } from '../partner-deal-groups/partner-deal-groups.module'

@Module({
  imports: [AuditLogsModule, PartnerGroupsModule, PartnerDealGroupsModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
