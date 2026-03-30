import { Module } from '@nestjs/common'
import { InternalController } from './internal.controller'
import { InternalService } from './internal.service'
import { CalendarModule } from '../calendar/calendar.module'
import { DealsModule } from '../deals/deals.module'
import { CompaniesModule } from '../companies/companies.module'
import { ContactsModule } from '../contacts/contacts.module'
import { DocumentsModule } from '../documents/documents.module'
import { ActivitiesModule } from '../activities/activities.module'

@Module({
  imports: [
    CalendarModule,
    DealsModule,
    CompaniesModule,
    ContactsModule,
    DocumentsModule,
    ActivitiesModule,
  ],
  controllers: [InternalController],
  providers: [InternalService],
  exports: [InternalService],
})
export class InternalModule {}
