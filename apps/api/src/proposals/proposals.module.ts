import { Module } from '@nestjs/common'
import { ProposalsController } from './proposals.controller'
import { PublicProposalsController } from './public-proposals.controller'
import { ProposalsService } from './proposals.service'
import { AuditLogsModule } from '../audit-logs/audit-logs.module'
import { DealsModule } from '../deals/deals.module'

// StorageModule is @Global() — no need to import.
@Module({
  imports: [AuditLogsModule, DealsModule],
  controllers: [ProposalsController, PublicProposalsController],
  providers: [ProposalsService],
  exports: [ProposalsService],
})
export class ProposalsModule {}
