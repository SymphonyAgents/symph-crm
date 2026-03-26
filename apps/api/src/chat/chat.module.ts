import { Module } from '@nestjs/common'
import { ChatController } from './chat.controller'
import { ChatService } from './chat.service'
import { CompaniesModule } from '../companies/companies.module'
import { DocumentsModule } from '../documents/documents.module'
import { FileParserModule } from '../file-parser/file-parser.module'
import { VoiceModule } from '../voice/voice.module'
import { ContactsModule } from '../contacts/contacts.module'
import { ActivitiesModule } from '../activities/activities.module'
import { DealsModule } from '../deals/deals.module'

@Module({
  imports: [
    CompaniesModule,
    DocumentsModule,
    FileParserModule,
    VoiceModule,
    ContactsModule,
    ActivitiesModule,
    DealsModule,
  ],
  controllers: [ChatController],
  providers: [ChatService],
  exports: [ChatService],
})
export class ChatModule {}
