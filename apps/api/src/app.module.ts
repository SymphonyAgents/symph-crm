import { Module } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { ConfigModule } from '@nestjs/config'
import { RolesGuard } from './auth/roles.guard'
import { AuthModule } from './auth/auth.module'
import { DatabaseModule } from './database/database.module'
import { StorageModule } from './storage/storage.module'
import { DealsModule } from './deals/deals.module'
import { CompaniesModule } from './companies/companies.module'
import { ContactsModule } from './contacts/contacts.module'
import { DocumentsModule } from './documents/documents.module'
import { ProposalsModule } from './proposals/proposals.module'
import { ActivitiesModule } from './activities/activities.module'
import { FileParserModule } from './file-parser/file-parser.module'
import { VoiceModule } from './voice/voice.module'
import { ChatModule } from './chat/chat.module'
import { ProductsModule } from './products/products.module'
import { CatalogItemsModule } from './catalog-items/catalog-items.module'
import { PipelineModule } from './pipeline/pipeline.module'
import { InternalModule } from './internal/internal.module'
import { OwnerModule } from './owner/owner.module'
import { CalendarModule } from './calendar/calendar.module'
import { UsersModule } from './users/users.module'
import { AuditLogsModule } from './audit-logs/audit-logs.module'
import { GmailModule } from './gmail/gmail.module'
import { BillingModule } from './billing/billing.module'
import { NotificationsModule } from './notifications/notifications.module'
import { RecordingsModule } from './recordings/recordings.module'
import { MeetingsModule } from './meetings/meetings.module'
import { PartnerGroupsModule } from './partner-groups/partner-groups.module'
import { PartnerDealGroupsModule } from './partner-deal-groups/partner-deal-groups.module'

@Module({
  providers: [
    // Global RBAC guard — backend cookies authenticate CRM users; reads and mutations require role checks.
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '../../.env' }),
    DatabaseModule,
    AuthModule,
    StorageModule,
    DealsModule,
    CompaniesModule,
    ContactsModule,
    DocumentsModule,
    ProposalsModule,
    ActivitiesModule,
    FileParserModule,
    VoiceModule,
    ChatModule,
    ProductsModule,
    CatalogItemsModule,
    PipelineModule,
    CalendarModule,
    InternalModule,
    OwnerModule,
    UsersModule,
    AuditLogsModule,
    GmailModule,
    BillingModule,
    NotificationsModule,
    RecordingsModule,
    MeetingsModule,
    PartnerGroupsModule,
    PartnerDealGroupsModule,
  ],
})
export class AppModule {}
