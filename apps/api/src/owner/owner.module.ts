import { Module } from '@nestjs/common'
import { OwnerController } from './owner.controller'
import { OwnerGuard } from './owner.guard'
import { DealsModule } from '../deals/deals.module'
import { CompaniesModule } from '../companies/companies.module'
import { ContactsModule } from '../contacts/contacts.module'
import { DocumentsModule } from '../documents/documents.module'
import { ActivitiesModule } from '../activities/activities.module'
import { UsersModule } from '../users/users.module'
import { PipelineModule } from '../pipeline/pipeline.module'
import { WikiModule } from '../wiki/wiki.module'
import { ChatModule } from '../chat/chat.module'

@Module({
  imports: [
    DealsModule,
    CompaniesModule,
    ContactsModule,
    DocumentsModule,
    ActivitiesModule,
    UsersModule,
    PipelineModule,
    WikiModule,
    ChatModule,
  ],
  controllers: [OwnerController],
  providers: [OwnerGuard],
})
export class OwnerModule {}
