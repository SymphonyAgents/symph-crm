import { Controller, Get, Post, Put, Delete, Param, Body, Query } from '@nestjs/common'
import { CompaniesService } from './companies.service'
import { DealsService } from '../deals/deals.service'
import { companies } from '@symph-crm/database'

@Controller('companies')
export class CompaniesController {
  constructor(
    private readonly companiesService: CompaniesService,
    private readonly dealsService: DealsService,
  ) {}

  /** GET /api/companies?search=jollibee — fuzzy search by name or domain */
  @Get()
  findAll(@Query('search') search?: string) {
    if (search?.trim()) {
      return this.companiesService.search(search.trim())
    }
    return this.companiesService.findAll()
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

  @Post()
  create(@Body() data: typeof companies.$inferInsert) {
    return this.companiesService.create(data)
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() data: Partial<typeof companies.$inferInsert>) {
    return this.companiesService.update(id, data)
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.companiesService.remove(id)
  }
}
