import { Module } from '@nestjs/common'
import { DatabaseModule } from '../database/database.module'
import { GmailModule } from '../gmail/gmail.module'
import { CompaniesModule } from '../companies/companies.module'
import { ContactsModule } from '../contacts/contacts.module'
import { DealsModule } from '../deals/deals.module'
import { ActivitiesModule } from '../activities/activities.module'
import { InboundEmailService } from './inbound-email.service'
import { EmailLeadClassifierService } from './email-lead-classifier.service'
import { FollowUpRemindersService } from './follow-up-reminders.service'

@Module({
  imports: [DatabaseModule, GmailModule, CompaniesModule, ContactsModule, DealsModule, ActivitiesModule],
  providers: [InboundEmailService, EmailLeadClassifierService, FollowUpRemindersService],
  exports: [InboundEmailService, EmailLeadClassifierService, FollowUpRemindersService],
})
export class InboundEmailModule {}
