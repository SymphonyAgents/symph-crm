import { Module } from '@nestjs/common'
import { DealsController } from './deals.controller'
import { DealsService } from './deals.service'
import { DealNotesService } from './deal-notes.service'
import { AuditLogsModule } from '../audit-logs/audit-logs.module'

@Module({
  imports: [AuditLogsModule],
  controllers: [DealsController],
  providers: [DealsService, DealNotesService],
  exports: [DealsService, DealNotesService],
})
export class DealsModule {}
