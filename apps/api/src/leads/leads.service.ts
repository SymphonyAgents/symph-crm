import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import { companies, contacts, leadConversions, leads, workspaces } from '@symph-crm/database'
import { LeadStatus, LEGACY_LEAD_STATUS_MAP } from '@symph-crm/shared'
import { and, asc, count, desc, eq, ilike, or, sql, type SQL } from 'drizzle-orm'
import { DB } from '../database/database.module'
import type { Database } from '../database/database.types'
import { DealsService } from '../deals/deals.service'

type LeadRow = {
  id: string
  workspaceId: string
  sourceName: string
  sourceFileName: string | null
  sourceRowNumber: number | null
  segment: string | null
  personName: string | null
  personTitle: string | null
  companyName: string | null
  industry: string | null
  companySize: string | null
  location: string | null
  email: string | null
  emailStatus: string | null
  linkedinUrl: string | null
  phone: string | null
  status: LeadStatus
  followUpCount: number
  score: number
  notes: string | null
  rawPayload: Record<string, unknown> | null
  matchedCompanyId: string | null
  matchedContactId: string | null
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

type LeadsListParams = {
  workspaceId?: string
  status?: LeadStatus | 'all'
  sourceName?: string
  segment?: string
  search?: string
  limit?: number
  offset?: number
}

type LeadsListResponse = {
  items: LeadRow[]
  count: number
  stats: {
    active: number
    followedUp: number
    converted: number
  }
  segmentCounts: Record<string, number>
}

type LeadInput = {
  sourceName?: string | null
  sourceFileName?: string | null
  sourceRowNumber?: number | null
  segment?: string | null
  personName?: string | null
  personTitle?: string | null
  companyName?: string | null
  industry?: string | null
  companySize?: string | null
  location?: string | null
  email?: string | null
  emailStatus?: string | null
  linkedinUrl?: string | null
  phone?: string | null
  status?: LeadStatus
  followUpCount?: number
  score?: number
  notes?: string | null
  rawPayload?: Record<string, unknown> | null
  matchedCompanyId?: string | null
  matchedContactId?: string | null
}

type ConvertLeadInput = {
  companyId?: string | null
  companyName?: string | null
  contactId?: string | null
  assignedTo?: string | null
  dealTitle?: string | null
  catalogItemId?: string | null
  serviceTag?: string | null
  conversionNotes?: string | null
}

type LeadDbRow = typeof leads.$inferSelect

type LeadConversionRow = typeof leadConversions.$inferSelect

const LEGACY_LEAD_STATUS_VALUES = Object.keys(LEGACY_LEAD_STATUS_MAP)

@Injectable()
export class LeadsService {
  constructor(
    @Inject(DB) private db: Database,
    private dealsService: DealsService,
  ) {}

  async findAll(params: LeadsListParams = {}): Promise<LeadsListResponse> {
    const workspaceId = params.workspaceId ?? await this.getDefaultWorkspaceId()
    const limit = Math.min(Math.max(params.limit ?? 20, 1), 100)
    const offset = Math.max(params.offset ?? 0, 0)
    const status = params.status && params.status !== 'all' ? params.status : null
    const sourceName = params.sourceName || null
    const segment = params.segment || null
    const search = params.search?.trim() || null

    const listWhere = this.buildLeadWhere({ workspaceId, status, sourceName, segment, search })
    const statsWhere = this.buildLeadWhere({ workspaceId, sourceName, segment, search })
    const segmentWhere = this.buildLeadWhere({ workspaceId, status, sourceName, search })

    const rows = await this.db
      .select()
      .from(leads)
      .where(listWhere)
      .orderBy(desc(leads.updatedAt), desc(leads.createdAt))
      .limit(limit)
      .offset(offset)

    const [countRow] = await this.db
      .select({ count: count() })
      .from(leads)
      .where(listWhere)

    const [statsRow] = await this.db
      .select({
        active: sql<number>`count(*) filter (where ${leads.status} not in ('converted', 'lost', 'not_fit', 'duplicate'))::int`,
        followedUp: sql<number>`count(*) filter (where ${leads.status} = 'followed_up')::int`,
        converted: sql<number>`count(*) filter (where ${leads.status} = 'converted')::int`,
      })
      .from(leads)
      .where(statsWhere)

    const segmentRows = await this.db
      .select({ segment: leads.segment, count: count() })
      .from(leads)
      .where(segmentWhere)
      .groupBy(leads.segment)

    return {
      items: rows.map(row => this.toLeadRow(row)),
      count: Number(countRow?.count ?? 0),
      stats: {
        active: Number(statsRow?.active ?? 0),
        followedUp: Number(statsRow?.followedUp ?? 0),
        converted: Number(statsRow?.converted ?? 0),
      },
      segmentCounts: Object.fromEntries(segmentRows.map(row => [row.segment ?? 'unknown', Number(row.count ?? 0)])),
    }
  }

  async findOne(id: string): Promise<LeadRow> {
    const [lead] = await this.db
      .select()
      .from(leads)
      .where(eq(leads.id, id))
      .limit(1)
    if (!lead) throw new NotFoundException('Lead not found')
    return this.toLeadRow(lead)
  }

  async conversions(id: string) {
    await this.findOne(id)
    const rows = await this.db
      .select()
      .from(leadConversions)
      .where(eq(leadConversions.leadId, id))
      .orderBy(desc(leadConversions.createdAt))
    return rows.map(row => this.toLeadConversionRow(row))
  }

  async create(input: LeadInput, userId?: string): Promise<LeadRow> {
    const workspaceId = await this.getDefaultWorkspaceId()
    const status = input.status ?? LeadStatus.ToContact
    const [lead] = await this.db
      .insert(leads)
      .values({
        workspaceId,
        sourceName: input.sourceName ?? 'manual',
        sourceFileName: input.sourceFileName ?? null,
        sourceRowNumber: input.sourceRowNumber ?? null,
        segment: input.segment ?? null,
        personName: input.personName ?? null,
        personTitle: input.personTitle ?? null,
        companyName: input.companyName ?? null,
        industry: input.industry ?? null,
        companySize: input.companySize ?? null,
        location: input.location ?? null,
        email: input.email ?? null,
        emailStatus: input.emailStatus ?? null,
        linkedinUrl: input.linkedinUrl ?? null,
        phone: input.phone ?? null,
        status,
        followUpCount: this.resolveFollowUpCount(status, input.followUpCount),
        score: input.score ?? 0,
        notes: input.notes ?? null,
        rawPayload: input.rawPayload ?? null,
        matchedCompanyId: input.matchedCompanyId ?? null,
        matchedContactId: input.matchedContactId ?? null,
        createdBy: userId ?? null,
      })
      .returning()
    return this.toLeadRow(lead)
  }

  async update(id: string, input: LeadInput): Promise<LeadRow> {
    const existing = await this.findOne(id)
    const nextStatus = input.status ?? existing.status
    const updateData: Partial<typeof leads.$inferInsert> = {
      updatedAt: new Date(),
      followUpCount: this.resolveFollowUpCount(nextStatus, input.followUpCount, existing.followUpCount),
    }

    if (input.sourceName != null) updateData.sourceName = input.sourceName
    if (input.sourceFileName != null) updateData.sourceFileName = input.sourceFileName
    if (input.sourceRowNumber != null) updateData.sourceRowNumber = input.sourceRowNumber
    if (input.segment != null) updateData.segment = input.segment
    if (input.personName != null) updateData.personName = input.personName
    if (input.personTitle != null) updateData.personTitle = input.personTitle
    if (input.companyName != null) updateData.companyName = input.companyName
    if (input.industry != null) updateData.industry = input.industry
    if (input.companySize != null) updateData.companySize = input.companySize
    if (input.location != null) updateData.location = input.location
    if (input.email != null) updateData.email = input.email
    if (input.emailStatus != null) updateData.emailStatus = input.emailStatus
    if (input.linkedinUrl != null) updateData.linkedinUrl = input.linkedinUrl
    if (input.phone != null) updateData.phone = input.phone
    if (input.status != null) updateData.status = input.status
    if (input.score != null) updateData.score = input.score
    if (input.notes != null) updateData.notes = input.notes
    if (input.rawPayload != null) updateData.rawPayload = input.rawPayload
    if (input.matchedCompanyId != null) updateData.matchedCompanyId = input.matchedCompanyId
    if (input.matchedContactId != null) updateData.matchedContactId = input.matchedContactId

    const [lead] = await this.db
      .update(leads)
      .set(updateData)
      .where(eq(leads.id, id))
      .returning()
    return this.toLeadRow(lead)
  }

  async remove(id: string): Promise<LeadRow> {
    await this.findOne(id)
    const [lead] = await this.db
      .delete(leads)
      .where(eq(leads.id, id))
      .returning()
    return this.toLeadRow(lead)
  }

  async convert(id: string, input: ConvertLeadInput, userId?: string) {
    const lead = await this.findOne(id)
    const workspaceId = lead.workspaceId
    const companyId = input.companyId || (input.companyName?.trim()
      ? await this.findOrCreateCompany(lead, userId, input.companyName)
      : lead.matchedCompanyId || await this.findOrCreateCompany(lead, userId))
    const contactId = input.contactId || lead.matchedContactId || await this.findOrCreateContact(lead, companyId)
    const deal = await this.dealsService.create({
      title: input.dealTitle || lead.companyName || lead.personName || 'Untitled lead',
      companyId,
      workspaceId,
      stage: 'lead',
      dealType: 'agency',
      outreachCategory: 'outbound',
      servicesTags: input.serviceTag ? [input.serviceTag] : [],
      catalogItemId: input.catalogItemId || null,
      assignedTo: input.assignedTo || userId || null,
      createdBy: userId || null,
      sourceLeadId: lead.id,
    } as never, userId)

    await this.db
      .update(leads)
      .set({
        status: LeadStatus.Converted,
        followUpCount: 0,
        matchedCompanyId: companyId,
        matchedContactId: contactId,
        updatedAt: new Date(),
      })
      .where(eq(leads.id, id))

    const [conversion] = await this.db
      .insert(leadConversions)
      .values({
        workspaceId,
        leadId: id,
        companyId,
        contactId,
        dealId: deal.id,
        convertedBy: userId ?? null,
        conversionNotes: input.conversionNotes ?? null,
      })
      .returning()

    return {
      lead: await this.findOne(id),
      conversion: this.toLeadConversionRow(conversion),
      company: { id: companyId, name: lead.companyName || lead.personName || 'Converted lead' },
      contactId,
      deal,
    }
  }

  private async getDefaultWorkspaceId(): Promise<string> {
    const [workspace] = await this.db
      .select({ id: workspaces.id })
      .from(workspaces)
      .orderBy(asc(workspaces.createdAt))
      .limit(1)
    if (!workspace) throw new BadRequestException('No workspace found')
    return workspace.id
  }

  private async findOrCreateCompany(lead: LeadRow, userId?: string, overrideName?: string | null): Promise<string> {
    const companyName = overrideName?.trim() || lead.companyName?.trim() || lead.personName?.trim()
    if (!companyName) throw new BadRequestException('Lead needs a company or person name before conversion')

    const [existing] = await this.db
      .select({ id: companies.id })
      .from(companies)
      .where(and(eq(companies.workspaceId, lead.workspaceId), ilike(companies.name, companyName)))
      .limit(1)
    if (existing) return existing.id

    const [company] = await this.db
      .insert(companies)
      .values({
        name: companyName,
        industry: lead.industry,
        headcountRange: lead.companySize,
        hqLocation: lead.location,
        linkedinUrl: lead.linkedinUrl,
        workspaceId: lead.workspaceId,
        createdBy: userId ?? null,
      })
      .returning({ id: companies.id })
    return company.id
  }

  private async findOrCreateContact(lead: LeadRow, companyId: string): Promise<string> {
    const personName = lead.personName?.trim() || lead.email?.trim() || 'Unknown contact'
    const matchConditions: SQL[] = [ilike(contacts.name, personName)]
    if (lead.email) matchConditions.unshift(ilike(contacts.email, lead.email))

    const [existing] = await this.db
      .select({ id: contacts.id })
      .from(contacts)
      .where(and(eq(contacts.companyId, companyId), or(...matchConditions)))
      .limit(1)
    if (existing) return existing.id

    const [contact] = await this.db
      .insert(contacts)
      .values({
        companyId,
        name: personName,
        email: lead.email,
        phone: lead.phone,
        title: lead.personTitle,
        linkedinUrl: lead.linkedinUrl,
        isPrimary: true,
      })
      .returning({ id: contacts.id })
    return contact.id
  }

  private buildLeadWhere(params: {
    workspaceId: string
    status?: LeadStatus | null
    sourceName?: string | null
    segment?: string | null
    search?: string | null
  }) {
    const conditions: SQL[] = [eq(leads.workspaceId, params.workspaceId)]

    if (params.status) conditions.push(this.buildStatusCondition(params.status))
    if (params.sourceName) conditions.push(eq(leads.sourceName, params.sourceName))
    if (params.segment) conditions.push(eq(leads.segment, params.segment))

    if (params.search) {
      const pattern = `%${params.search}%`
      conditions.push(or(
        ilike(leads.personName, pattern),
        ilike(leads.personTitle, pattern),
        ilike(leads.companyName, pattern),
        ilike(leads.industry, pattern),
        ilike(leads.companySize, pattern),
        ilike(leads.location, pattern),
        ilike(leads.email, pattern),
        ilike(leads.emailStatus, pattern),
        ilike(leads.linkedinUrl, pattern),
        ilike(leads.phone, pattern),
        ilike(leads.segment, pattern),
      )!)
    }

    return and(...conditions)
  }

  private buildStatusCondition(status: LeadStatus): SQL {
    const legacyStatuses = LEGACY_LEAD_STATUS_VALUES.filter(value => LEGACY_LEAD_STATUS_MAP[value] === status)
    const statusConditions: SQL[] = [eq(leads.status, status)]
    for (const legacyStatus of legacyStatuses) {
      statusConditions.push(eq(leads.status, legacyStatus as LeadStatus))
    }
    return or(...statusConditions)!
  }

  private resolveFollowUpCount(status: LeadStatus, countValue?: number | null, fallback = 0) {
    if (status !== LeadStatus.FollowedUp) return 0
    const countToClamp = countValue ?? (fallback > 0 ? fallback : 1)
    return Math.min(Math.max(countToClamp, 1), 5)
  }

  private normalizeLeadStatus(status: LeadStatus | string | null | undefined): LeadStatus {
    if (!status) return LeadStatus.ToContact
    if (Object.values(LeadStatus).includes(status as LeadStatus)) return status as LeadStatus
    return LEGACY_LEAD_STATUS_MAP[status] ?? LeadStatus.ToContact
  }

  private toLeadRow(row: LeadDbRow): LeadRow {
    return {
      ...row,
      workspaceId: row.workspaceId ?? '',
      status: this.normalizeLeadStatus(row.status),
      followUpCount: this.resolveFollowUpCount(this.normalizeLeadStatus(row.status), row.followUpCount),
      score: row.score ?? 0,
      rawPayload: row.rawPayload ?? null,
      createdAt: this.formatTimestamp(row.createdAt),
      updatedAt: this.formatTimestamp(row.updatedAt),
    }
  }

  private toLeadConversionRow(row: LeadConversionRow) {
    return {
      ...row,
      workspaceId: row.workspaceId ?? null,
      leadId: row.leadId ?? null,
      companyId: row.companyId ?? null,
      contactId: row.contactId ?? null,
      dealId: row.dealId ?? null,
      convertedBy: row.convertedBy ?? null,
      conversionNotes: row.conversionNotes ?? null,
      createdAt: this.formatTimestamp(row.createdAt),
    }
  }

  private formatTimestamp(value: Date | string): string {
    return value instanceof Date ? value.toISOString() : value
  }
}

export { LeadStatus }
export type { LeadInput, LeadsListParams, LeadsListResponse, ConvertLeadInput }
