import { Controller, Get, Post, Put, Delete, Param, Body, Query } from '@nestjs/common'
import { ContactsService } from './contacts.service'
import { contacts } from '@symph-crm/database'

@Controller('contacts')
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  /**
   * GET /api/contacts
   * ?companyId=<uuid>   — filter by company
   * ?search=john        — fuzzy search by name or email
   */
  @Get()
  findAll(
    @Query('companyId') companyId?: string,
    @Query('search') search?: string,
  ) {
    return this.contactsService.findAll({ companyId, search })
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.contactsService.findOne(id)
  }

  @Post()
  create(@Body() data: typeof contacts.$inferInsert) {
    return this.contactsService.create(data)
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() data: Partial<typeof contacts.$inferInsert>) {
    return this.contactsService.update(id, data)
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.contactsService.remove(id)
  }
}
