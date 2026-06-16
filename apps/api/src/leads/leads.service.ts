import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import { and, desc, eq, ilike, or } from 'drizzle-orm'
import { LEAD_STATUSES, companies, contacts, dealContacts, leadConversions, leads, workspaces, type LeadStatus } from '@symph-crm/database'
import { DB } from '../database/database.module'
import type { Database } from '../database/database.types'
import { CompaniesService } from '../companies/companies.service'
import { ContactsService } from '../contacts/contacts.service'
import { DealsService } from '../deals/deals.service'
import type { ConvertLeadData, CreateLeadData, LeadListParams, UpdateLeadData } from './leads.types'

const DEFAULT_LEAD_LIMIT = 100
const MAX_LEAD_LIMIT = 500
const CONVERTED_STATUS = 'converted'

function isLeadStatus(value: string): value is LeadStatus {
  return LEAD_STATUSES.includes(value as LeadStatus)
}

@Injectable()
export class LeadsService {
  constructor(
    @Inject(DB) private db: Database,
    private companiesService: CompaniesService,
    private contactsService: ContactsService,
    private dealsService: DealsService,
  ) {}

  private async getDefaultWorkspaceId(): Promise<string> {
    const [workspace] = await this.db
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(eq(workspaces.slug, 'symph'))
      .limit(1)

    if (workspace) return workspace.id

    const [firstWorkspace] = await this.db
      .select({ id: workspaces.id })
      .from(workspaces)
      .orderBy(desc(workspaces.createdAt))
      .limit(1)

    if (!firstWorkspace) throw new BadRequestException('Cannot create lead without a workspace.')
    return firstWorkspace.id
  }

  private normalizeLimit(limit?: number): number {
    if (!limit || !Number.isFinite(limit)) return DEFAULT_LEAD_LIMIT
    return Math.min(Math.max(Math.trunc(limit), 1), MAX_LEAD_LIMIT)
  }

  async findAll(params: LeadListParams = {}) {
    const conditions = []
    if (params.workspaceId) conditions.push(eq(leads.workspaceId, params.workspaceId))
    if (params.status) {
      if (!isLeadStatus(params.status)) throw new BadRequestException('Invalid lead status')
      conditions.push(eq(leads.status, params.status))
    }
    if (params.sourceName) conditions.push(eq(leads.sourceName, params.sourceName))
    if (params.search?.trim()) {
      const pattern = `%${params.search.trim()}%`
      conditions.push(or(
        ilike(leads.personName, pattern),
        ilike(leads.companyName, pattern),
        ilike(leads.email, pattern),
        ilike(leads.linkedinUrl, pattern),
      )!)
    }

    const limit = this.normalizeLimit(params.limit)
    if (conditions.length > 0) {
      return this.db.select().from(leads).where(and(...conditions)).orderBy(desc(leads.createdAt)).limit(limit)
    }

    return this.db.select().from(leads).orderBy(desc(leads.createdAt)).limit(limit)
  }

  async findOne(id: string) {
    const [lead] = await this.db.select().from(leads).where(eq(leads.id, id)).limit(1)
    return lead
  }

  async findConversions(leadId: string) {
    return this.db
      .select()
      .from(leadConversions)
      .where(eq(leadConversions.leadId, leadId))
      .orderBy(desc(leadConversions.createdAt))
  }

  async create(data: CreateLeadData, performedBy?: string) {
    const workspaceId = data.workspaceId ?? await this.getDefaultWorkspaceId()
    const [lead] = await this.db
      .insert(leads)
      .values({ ...data, workspaceId, createdBy: data.createdBy ?? performedBy ?? null })
      .returning()
    return lead
  }

  async update(id: string, data: UpdateLeadData) {
    const existing = await this.findOne(id)
    if (!existing) throw new NotFoundException(`Lead ${id} not found`)

    const [lead] = await this.db
      .update(leads)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(leads.id, id))
      .returning()
    return lead
  }

  async convert(id: string, data: ConvertLeadData, performedBy?: string) {
    const lead = await this.findOne(id)
    if (!lead) throw new NotFoundException(`Lead ${id} not found`)

    const companyId = data.companyId ?? lead.matchedCompanyId ?? await this.createCompanyFromLead(lead, performedBy)
    const company = await this.companiesService.findOne(companyId)
    if (!company) throw new NotFoundException(`Company ${companyId} not found`)

    const contactId = data.contactId ?? lead.matchedContactId ?? await this.createContactFromLead(lead, companyId)
    const dealTitle = data.dealTitle?.trim() || `${company.name} - The Agency`
    const deal = await this.dealsService.create({
      title: dealTitle,
      companyId,
      workspaceId: lead.workspaceId,
      stage: 'lead',
      dealType: 'agency',
      outreachCategory: 'outbound',
      assignedTo: data.assignedTo ?? performedBy ?? null,
      createdBy: performedBy ?? null,
      sourceLeadId: lead.id,
    }, performedBy)

    if (contactId) {
      await this.db
        .insert(dealContacts)
        .values({ dealId: deal.id, contactId, role: 'poc' })
        .onConflictDoNothing()
    }

    const [conversion] = await this.db
      .insert(leadConversions)
      .values({
        workspaceId: lead.workspaceId,
        leadId: lead.id,
        companyId,
        contactId,
        dealId: deal.id,
        convertedBy: performedBy ?? null,
        conversionNotes: data.conversionNotes ?? null,
      })
      .returning()

    const [updatedLead] = await this.db
      .update(leads)
      .set({
        status: CONVERTED_STATUS,
        matchedCompanyId: companyId,
        matchedContactId: contactId,
        updatedAt: new Date(),
      })
      .where(eq(leads.id, lead.id))
      .returning()

    return { lead: updatedLead, conversion, company, contactId, deal }
  }

  async remove(id: string) {
    const existing = await this.findOne(id)
    if (!existing) throw new NotFoundException(`Lead ${id} not found`)
    await this.db.delete(leads).where(eq(leads.id, id))
    return existing
  }

  private async createCompanyFromLead(lead: typeof leads.$inferSelect, performedBy?: string): Promise<string> {
    const companyName = lead.companyName?.trim()
    if (!companyName) throw new BadRequestException('Lead must have a company name or selected company before conversion.')

    const company = await this.companiesService.create({
      name: companyName,
      industry: lead.industry,
      headcountRange: lead.companySize,
      hqLocation: lead.location,
      workspaceId: lead.workspaceId,
      createdBy: performedBy ?? lead.createdBy,
    } satisfies typeof companies.$inferInsert, performedBy)

    return company.id
  }

  private async createContactFromLead(lead: typeof leads.$inferSelect, companyId: string): Promise<string | null> {
    const personName = lead.personName?.trim()
    if (!personName) return null

    const contact = await this.contactsService.create({
      companyId,
      name: personName,
      email: lead.email,
      phone: lead.phone,
      title: lead.personTitle,
      linkedinUrl: lead.linkedinUrl,
      isPrimary: true,
    } satisfies typeof contacts.$inferInsert)

    return contact.id
  }
}
