import { Controller, Get, Post, Put, Delete, Param, Body, Query, Headers } from '@nestjs/common'
import { CompaniesService } from './companies.service'
import { DealsService } from '../deals/deals.service'
import { ContactsService } from '../contacts/contacts.service'
import { companies } from '@symph-crm/database'

@Controller('companies')
export class CompaniesController {
  constructor(
    private readonly companiesService: CompaniesService,
    private readonly dealsService: DealsService,
    private readonly contactsService: ContactsService,
  ) {}

  /**
   * GET /api/companies
   * ?search=jollibee    — fuzzy search by name or domain
   */
  @Get()
  findAll(@Query('search') search?: string) {
    if (search?.trim()) {
      return this.companiesService.search(search.trim())
    }
    return this.companiesService.findAll()
  }

  /**
   * GET /api/companies/exists?name=Jollibee&domain=jollibee.com.ph
   * Returns { exists: boolean, company: Company | null }
   * Used by AI tools to avoid creating duplicates. Must appear before :id.
   */
  @Get('exists')
  checkExists(
    @Query('name') name?: string,
    @Query('domain') domain?: string,
  ) {
    return this.companiesService.checkExists({ name, domain })
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.companiesService.findOne(id)
  }

  /** GET /api/companies/:id/deals — all deals for this company */
  @Get(':id/deals')
  findDeals(@Param('id') id: string) {
    return this.dealsService.findByCompany(id)
  }

  /** GET /api/companies/:id/contacts — all contacts for this company, primary first */
  @Get(':id/contacts')
  findContacts(@Param('id') id: string) {
    return this.contactsService.findByCompany(id)
  }

  @Post()
  create(
    @Body() data: typeof companies.$inferInsert,
    @Headers('x-user-id') userId?: string,
  ) {
    return this.companiesService.create(data, userId)
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() data: Partial<typeof companies.$inferInsert>,
    @Headers('x-user-id') userId?: string,
  ) {
    return this.companiesService.update(id, data, userId)
  }

  @Delete(':id')
  remove(
    @Param('id') id: string,
    @Headers('x-user-id') userId?: string,
  ) {
    return this.companiesService.remove(id, userId)
  }
}
