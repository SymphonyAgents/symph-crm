import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import { sql } from 'drizzle-orm'
import { DB } from '../database/database.module'
import type { Database } from '../database/database.types'
import { DealsService } from '../deals/deals.service'

type LeadStatus = 'new' | 'reviewing' | 'contacted' | 'interested' | 'not_fit' | 'duplicate' | 'converted'

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
    interested: number
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

const LEAD_SELECT = sql`
  id,
  workspace_id AS "workspaceId",
  source_name AS "sourceName",
  source_file_name AS "sourceFileName",
  source_row_number AS "sourceRowNumber",
  segment,
  person_name AS "personName",
  person_title AS "personTitle",
  company_name AS "companyName",
  industry,
  company_size AS "companySize",
  location,
  email,
  email_status AS "emailStatus",
  linkedin_url AS "linkedinUrl",
  phone,
  status,
  score,
  notes,
  raw_payload AS "rawPayload",
  matched_company_id AS "matchedCompanyId",
  matched_contact_id AS "matchedContactId",
  created_by AS "createdBy",
  created_at AS "createdAt",
  updated_at AS "updatedAt"
`

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

    const rows = await this.db.execute(sql`
      SELECT ${LEAD_SELECT}
      FROM leads
      WHERE workspace_id = ${workspaceId}::uuid
        AND (${status}::text IS NULL OR status = ${status})
        AND (${sourceName}::text IS NULL OR source_name = ${sourceName})
        AND (${segment}::text IS NULL OR segment = ${segment})
        AND (
          ${search}::text IS NULL
          OR person_name ILIKE '%' || ${search} || '%'
          OR person_title ILIKE '%' || ${search} || '%'
          OR company_name ILIKE '%' || ${search} || '%'
          OR industry ILIKE '%' || ${search} || '%'
          OR company_size ILIKE '%' || ${search} || '%'
          OR location ILIKE '%' || ${search} || '%'
          OR email ILIKE '%' || ${search} || '%'
          OR email_status ILIKE '%' || ${search} || '%'
          OR linkedin_url ILIKE '%' || ${search} || '%'
          OR phone ILIKE '%' || ${search} || '%'
          OR segment ILIKE '%' || ${search} || '%'
        )
      ORDER BY updated_at DESC, created_at DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `)

    const [countRow] = await this.db.execute<{ count: number }>(sql`
      SELECT COUNT(*)::int AS count
      FROM leads
      WHERE workspace_id = ${workspaceId}::uuid
        AND (${status}::text IS NULL OR status = ${status})
        AND (${sourceName}::text IS NULL OR source_name = ${sourceName})
        AND (${segment}::text IS NULL OR segment = ${segment})
        AND (
          ${search}::text IS NULL
          OR person_name ILIKE '%' || ${search} || '%'
          OR person_title ILIKE '%' || ${search} || '%'
          OR company_name ILIKE '%' || ${search} || '%'
          OR industry ILIKE '%' || ${search} || '%'
          OR company_size ILIKE '%' || ${search} || '%'
          OR location ILIKE '%' || ${search} || '%'
          OR email ILIKE '%' || ${search} || '%'
          OR email_status ILIKE '%' || ${search} || '%'
          OR linkedin_url ILIKE '%' || ${search} || '%'
          OR phone ILIKE '%' || ${search} || '%'
          OR segment ILIKE '%' || ${search} || '%'
        )
    `)

    const [statsRow] = await this.db.execute<{ active: number; interested: number; converted: number }>(sql`
      SELECT
        COUNT(*) FILTER (WHERE status NOT IN ('converted', 'not_fit', 'duplicate'))::int AS active,
        COUNT(*) FILTER (WHERE status = 'interested')::int AS interested,
        COUNT(*) FILTER (WHERE status = 'converted')::int AS converted
      FROM leads
      WHERE workspace_id = ${workspaceId}::uuid
        AND (${sourceName}::text IS NULL OR source_name = ${sourceName})
        AND (${segment}::text IS NULL OR segment = ${segment})
        AND (
          ${search}::text IS NULL
          OR person_name ILIKE '%' || ${search} || '%'
          OR person_title ILIKE '%' || ${search} || '%'
          OR company_name ILIKE '%' || ${search} || '%'
          OR industry ILIKE '%' || ${search} || '%'
          OR company_size ILIKE '%' || ${search} || '%'
          OR location ILIKE '%' || ${search} || '%'
          OR email ILIKE '%' || ${search} || '%'
          OR email_status ILIKE '%' || ${search} || '%'
          OR linkedin_url ILIKE '%' || ${search} || '%'
          OR phone ILIKE '%' || ${search} || '%'
          OR segment ILIKE '%' || ${search} || '%'
        )
    `)

    const segmentRows = await this.db.execute<{ segment: string | null; count: number }>(sql`
      SELECT segment, COUNT(*)::int AS count
      FROM leads
      WHERE workspace_id = ${workspaceId}::uuid
        AND (${status}::text IS NULL OR status = ${status})
        AND (${sourceName}::text IS NULL OR source_name = ${sourceName})
        AND (
          ${search}::text IS NULL
          OR person_name ILIKE '%' || ${search} || '%'
          OR person_title ILIKE '%' || ${search} || '%'
          OR company_name ILIKE '%' || ${search} || '%'
          OR industry ILIKE '%' || ${search} || '%'
          OR company_size ILIKE '%' || ${search} || '%'
          OR location ILIKE '%' || ${search} || '%'
          OR email ILIKE '%' || ${search} || '%'
          OR email_status ILIKE '%' || ${search} || '%'
          OR linkedin_url ILIKE '%' || ${search} || '%'
          OR phone ILIKE '%' || ${search} || '%'
          OR segment ILIKE '%' || ${search} || '%'
        )
      GROUP BY segment
    `)

    return {
      items: rows as unknown as LeadRow[],
      count: Number(countRow?.count ?? 0),
      stats: {
        active: Number(statsRow?.active ?? 0),
        interested: Number(statsRow?.interested ?? 0),
        converted: Number(statsRow?.converted ?? 0),
      },
      segmentCounts: Object.fromEntries(segmentRows.map(row => [row.segment ?? 'unknown', Number(row.count ?? 0)])),
    }
  }

  async findOne(id: string): Promise<LeadRow> {
    const [lead] = await this.db.execute(sql`
      SELECT ${LEAD_SELECT}
      FROM leads
      WHERE id = ${id}::uuid
      LIMIT 1
    `)
    if (!lead) throw new NotFoundException('Lead not found')
    return lead as LeadRow
  }

  async conversions(id: string) {
    await this.findOne(id)
    return this.db.execute(sql`
      SELECT
        id,
        workspace_id AS "workspaceId",
        lead_id AS "leadId",
        company_id AS "companyId",
        contact_id AS "contactId",
        deal_id AS "dealId",
        converted_by AS "convertedBy",
        conversion_notes AS "conversionNotes",
        created_at AS "createdAt"
      FROM lead_conversions
      WHERE lead_id = ${id}::uuid
      ORDER BY created_at DESC
    `)
  }

  async create(input: LeadInput, userId?: string): Promise<LeadRow> {
    const workspaceId = await this.getDefaultWorkspaceId()
    const [lead] = await this.db.execute(sql`
      INSERT INTO leads (
        workspace_id,
        source_name,
        source_file_name,
        source_row_number,
        segment,
        person_name,
        person_title,
        company_name,
        industry,
        company_size,
        location,
        email,
        email_status,
        linkedin_url,
        phone,
        status,
        score,
        notes,
        raw_payload,
        matched_company_id,
        matched_contact_id,
        created_by
      ) VALUES (
        ${workspaceId}::uuid,
        COALESCE(${input.sourceName ?? null}, 'manual'),
        ${input.sourceFileName ?? null},
        ${input.sourceRowNumber ?? null},
        ${input.segment ?? null},
        ${input.personName ?? null},
        ${input.personTitle ?? null},
        ${input.companyName ?? null},
        ${input.industry ?? null},
        ${input.companySize ?? null},
        ${input.location ?? null},
        ${input.email ?? null},
        ${input.emailStatus ?? null},
        ${input.linkedinUrl ?? null},
        ${input.phone ?? null},
        COALESCE(${input.status ?? null}, 'new'),
        COALESCE(${input.score ?? null}, 0),
        ${input.notes ?? null},
        ${input.rawPayload ? JSON.stringify(input.rawPayload) : null}::jsonb,
        ${input.matchedCompanyId ?? null}::uuid,
        ${input.matchedContactId ?? null}::uuid,
        ${userId ?? null}
      )
      RETURNING ${LEAD_SELECT}
    `)
    return lead as LeadRow
  }

  async update(id: string, input: LeadInput): Promise<LeadRow> {
    await this.findOne(id)
    const [lead] = await this.db.execute(sql`
      UPDATE leads
      SET
        source_name = COALESCE(${input.sourceName ?? null}, source_name),
        source_file_name = COALESCE(${input.sourceFileName ?? null}, source_file_name),
        source_row_number = COALESCE(${input.sourceRowNumber ?? null}, source_row_number),
        segment = COALESCE(${input.segment ?? null}, segment),
        person_name = COALESCE(${input.personName ?? null}, person_name),
        person_title = COALESCE(${input.personTitle ?? null}, person_title),
        company_name = COALESCE(${input.companyName ?? null}, company_name),
        industry = COALESCE(${input.industry ?? null}, industry),
        company_size = COALESCE(${input.companySize ?? null}, company_size),
        location = COALESCE(${input.location ?? null}, location),
        email = COALESCE(${input.email ?? null}, email),
        email_status = COALESCE(${input.emailStatus ?? null}, email_status),
        linkedin_url = COALESCE(${input.linkedinUrl ?? null}, linkedin_url),
        phone = COALESCE(${input.phone ?? null}, phone),
        status = COALESCE(${input.status ?? null}, status),
        score = COALESCE(${input.score ?? null}, score),
        notes = COALESCE(${input.notes ?? null}, notes),
        raw_payload = COALESCE(${input.rawPayload ? JSON.stringify(input.rawPayload) : null}::jsonb, raw_payload),
        matched_company_id = COALESCE(${input.matchedCompanyId ?? null}::uuid, matched_company_id),
        matched_contact_id = COALESCE(${input.matchedContactId ?? null}::uuid, matched_contact_id),
        updated_at = now()
      WHERE id = ${id}::uuid
      RETURNING ${LEAD_SELECT}
    `)
    return lead as LeadRow
  }

  async remove(id: string): Promise<LeadRow> {
    await this.findOne(id)
    const [lead] = await this.db.execute(sql`
      DELETE FROM leads
      WHERE id = ${id}::uuid
      RETURNING ${LEAD_SELECT}
    `)
    return lead as LeadRow
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

    await this.db.execute(sql`
      UPDATE leads
      SET status = 'converted', matched_company_id = ${companyId}::uuid, matched_contact_id = ${contactId}::uuid, updated_at = now()
      WHERE id = ${id}::uuid
    `)

    const [conversion] = await this.db.execute(sql`
      INSERT INTO lead_conversions (workspace_id, lead_id, company_id, contact_id, deal_id, converted_by, conversion_notes)
      VALUES (${workspaceId}::uuid, ${id}::uuid, ${companyId}::uuid, ${contactId}::uuid, ${deal.id}::uuid, ${userId ?? null}, ${input.conversionNotes ?? null})
      RETURNING
        id,
        workspace_id AS "workspaceId",
        lead_id AS "leadId",
        company_id AS "companyId",
        contact_id AS "contactId",
        deal_id AS "dealId",
        converted_by AS "convertedBy",
        conversion_notes AS "conversionNotes",
        created_at AS "createdAt"
    `)

    return {
      lead: await this.findOne(id),
      conversion,
      company: { id: companyId, name: lead.companyName || lead.personName || 'Converted lead' },
      contactId,
      deal,
    }
  }

  private async getDefaultWorkspaceId(): Promise<string> {
    const [workspace] = await this.db.execute<{ id: string }>(sql`
      SELECT id FROM workspaces ORDER BY created_at ASC LIMIT 1
    `)
    if (!workspace) throw new BadRequestException('No workspace found')
    return workspace.id
  }

  private async findOrCreateCompany(lead: LeadRow, userId?: string, overrideName?: string | null): Promise<string> {
    const companyName = overrideName?.trim() || lead.companyName?.trim() || lead.personName?.trim()
    if (!companyName) throw new BadRequestException('Lead needs a company or person name before conversion')

    const [existing] = await this.db.execute<{ id: string }>(sql`
      SELECT id
      FROM companies
      WHERE lower(name) = lower(${companyName})
      LIMIT 1
    `)
    if (existing) return existing.id

    const [company] = await this.db.execute<{ id: string }>(sql`
      INSERT INTO companies (name, industry, headcount_range, hq_location, linkedin_url, workspace_id, created_by)
      VALUES (${companyName}, ${lead.industry}, ${lead.companySize}, ${lead.location}, ${lead.linkedinUrl}, ${lead.workspaceId}::uuid, ${userId ?? null})
      RETURNING id
    `)
    return company.id
  }

  private async findOrCreateContact(lead: LeadRow, companyId: string): Promise<string> {
    const personName = lead.personName?.trim() || lead.email?.trim() || 'Unknown contact'
    const [existing] = await this.db.execute<{ id: string }>(sql`
      SELECT id
      FROM contacts
      WHERE company_id = ${companyId}::uuid
        AND (
          (${lead.email}::text IS NOT NULL AND lower(email) = lower(${lead.email}))
          OR lower(name) = lower(${personName})
        )
      LIMIT 1
    `)
    if (existing) return existing.id

    const [contact] = await this.db.execute<{ id: string }>(sql`
      INSERT INTO contacts (company_id, name, email, phone, title, linkedin_url, is_primary)
      VALUES (${companyId}::uuid, ${personName}, ${lead.email}, ${lead.phone}, ${lead.personTitle}, ${lead.linkedinUrl}, true)
      RETURNING id
    `)
    return contact.id
  }
}

export type { LeadInput, LeadsListParams, LeadsListResponse, ConvertLeadInput, LeadStatus }
