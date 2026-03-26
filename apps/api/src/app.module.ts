import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
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

@Module({
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
  ],
})
export class AppModule {}
