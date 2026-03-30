import { Module } from '@nestjs/common'
import { CompaniesController } from './companies.controller'
import { CompaniesService } from './companies.service'
import { DealsModule } from '../deals/deals.module'
import { ContactsModule } from '../contacts/contacts.module'
import { AuditLogsModule } from '../audit-logs/audit-logs.module'

@Module({
  imports: [DealsModule, ContactsModule, AuditLogsModule],
  controllers: [CompaniesController],
  providers: [CompaniesService],
  exports: [CompaniesService],
})
export class CompaniesModule {}
