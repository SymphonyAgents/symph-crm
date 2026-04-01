import { Module } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { ConfigModule } from '@nestjs/config'
import { RolesGuard } from './auth/roles.guard'
import { DatabaseModule } from './database/database.module'
import { StorageModule } from './storage/storage.module'
import { DealsModule } from './deals/deals.module'
import { CompaniesModule } from './companies/companies.module'
import { ContactsModule } from './contacts/contacts.module'
import { DocumentsModule } from './documents/documents.module'
import { ActivitiesModule } from './activities/activities.module'
import { FileParserModule } from './file-parser/file-parser.module'
import { VoiceModule } from './voice/voice.module'
import { ChatModule } from './chat/chat.module'
import { ProductsModule } from './products/products.module'
import { PipelineModule } from './pipeline/pipeline.module'
import { InternalModule } from './internal/internal.module'
import { CalendarModule } from './calendar/calendar.module'
import { UsersModule } from './users/users.module'
import { AuditLogsModule } from './audit-logs/audit-logs.module'
import { GmailModule } from './gmail/gmail.module'
import { BillingModule } from './billing/billing.module'

@Module({
  providers: [
    // Global RBAC guard — mutations require SALES role, reads open to all
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '../../.env' }),
    DatabaseModule,
    StorageModule,
    DealsModule,
    CompaniesModule,
    ContactsModule,
    DocumentsModule,
    ActivitiesModule,
    FileParserModule,
    VoiceModule,
    ChatModule,
    ProductsModule,
    PipelineModule,
    CalendarModule,
    InternalModule,
    UsersModule,
    AuditLogsModule,
    GmailModule,
    BillingModule,
  ],
})
export class AppModule {}
