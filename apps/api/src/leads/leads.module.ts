import { Module } from '@nestjs/common'
import { LeadsController } from './leads.controller'
import { LeadsService } from './leads.service'
import { CompaniesModule } from '../companies/companies.module'
import { ContactsModule } from '../contacts/contacts.module'
import { DealsModule } from '../deals/deals.module'

@Module({
  imports: [CompaniesModule, ContactsModule, DealsModule],
  controllers: [LeadsController],
  providers: [LeadsService],
  exports: [LeadsService],
})
export class LeadsModule {}
