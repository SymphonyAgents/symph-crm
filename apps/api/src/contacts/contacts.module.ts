import { Module } from '@nestjs/common'
import { ContactsController } from './contacts.controller'
import { ContactsService } from './contacts.service'
import { ContactNotesService } from './contact-notes.service'

@Module({
  controllers: [ContactsController],
  providers: [ContactsService, ContactNotesService],
  exports: [ContactsService],
})
export class ContactsModule {}
