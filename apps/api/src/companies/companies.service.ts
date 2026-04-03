import { Injectable, Inject } from '@nestjs/common'
import { eq, desc, ilike, or, inArray } from 'drizzle-orm'
import { companies, deals } from '@symph-crm/database'
import { DB } from '../database/database.module'
import type { Database } from '../database/database.types'
import { AuditLogsService } from '../audit-logs/audit-logs.service'

@Injectable()
export class CompaniesService {
  constructor(
    @Inject(DB) private db: Database,
    private auditLogs: AuditLogsService,
  ) {}

  /** Batch-fetch deal IDs for a set of company IDs — one query, O(1) round trips. */
  private async batchDealIds(companyIds: string[]): Promise<Map<string, string[]>> {
    if (companyIds.length === 0) return new Map()
    const rows = await this.db
      .select({ id: deals.id, companyId: deals.companyId })
      .from(deals)
      .where(inArray(deals.companyId, companyIds as [string, ...string[]]))
    const map = new Map<string, string[]>()
    for (const row of rows) {
      if (!row.companyId) continue
      const existing = map.get(row.companyId) ?? []
      existing.push(row.id)
      map.set(row.companyId, existing)
    }
    return map
  }

  async findAll() {
    const rows = await this.db.select().from(companies).orderBy(desc(companies.createdAt))
    if (rows.length === 0) return []
    const dealMap = await this.batchDealIds(rows.map(c => c.id))
    return rows.map(c => ({ ...c, dealIds: dealMap.get(c.id) ?? [] }))
  }

  async findOne(id: string) {
    const [company] = await this.db.select().from(companies).where(eq(companies.id, id))
    if (!company) return undefined
    const dealMap = await this.batchDealIds([company.id])
    return { ...company, dealIds: dealMap.get(company.id) ?? [] }
  }

  /** Fuzzy search by name or domain — used by the AI agent's search_companies tool. */
  async search(query: string) {
    const pattern = `%${query}%`
    const rows = await this.db
      .select()
      .from(companies)
      .where(or(ilike(companies.name, pattern), ilike(companies.domain, pattern)))
      .orderBy(desc(companies.createdAt))
      .limit(20)
    if (rows.length === 0) return []
    const dealMap = await this.batchDealIds(rows.map(c => c.id))
    return rows.map(c => ({ ...c, dealIds: dealMap.get(c.id) ?? [] }))
  }

  /**
   * Find by exact domain, or create if absent.
   * Used by the AI agent when a new deal is mentioned for an unknown company.
   */
  async findOrCreate(
    data: Pick<typeof companies.$inferInsert, 'name' | 'domain' | 'workspaceId' | 'createdBy'> &
      Partial<typeof companies.$inferInsert>,
    performedBy?: string,
  ) {
    if (data.domain) {
      const [existing] = await this.db
        .select()
        .from(companies)
        .where(eq(companies.domain, data.domain))
        .limit(1)
      if (existing) return { company: existing, created: false }
    }
    const [company] = await this.db.insert(companies).values(data).returning()

    this.auditLogs.log({
      action: 'create',
      auditType: 'company_created',
      entityType: 'company',
      entityId: company.id,
      performedBy: performedBy ?? data.createdBy ?? undefined,
      details: { name: company.name, domain: company.domain },
    }).catch(() => {})

    return { company, created: true }
  }

  async create(data: typeof companies.$inferInsert, performedBy?: string) {
    const [company] = await this.db.insert(companies).values(data).returning()

    this.auditLogs.log({
      action: 'create',
      auditType: 'company_created',
      entityType: 'company',
      entityId: company.id,
      performedBy: performedBy ?? data.createdBy ?? undefined,
      details: { name: company.name, domain: company.domain },
    }).catch(() => {})

    return company
  }

  async update(id: string, data: Partial<typeof companies.$inferInsert>, performedBy?: string) {
    const [company] = await this.db
      .update(companies)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(companies.id, id))
      .returning()

    this.auditLogs.log({
      action: 'update',
      auditType: 'company_updated',
      entityType: 'company',
      entityId: id,
      performedBy: performedBy ?? undefined,
      details: { fields: Object.keys(data).filter(k => k !== 'updatedAt') },
    }).catch(() => {})

    return company
  }

  /**
   * Check whether a company with the given name (case-insensitive) or domain exists.
   * Used by AI tools before creating a duplicate.
   */
  async checkExists(params: { name?: string; domain?: string }) {
    if (!params.name && !params.domain) return { exists: false, company: null }

    const conditions = []
    if (params.name) conditions.push(ilike(companies.name, params.name))
    if (params.domain) conditions.push(eq(companies.domain, params.domain))

    const [company] = await this.db
      .select()
      .from(companies)
      .where(or(...conditions))
      .limit(1)

    return { exists: !!company, company: company ?? null }
  }

  async remove(id: string, performedBy?: string) {
    const existing = await this.findOne(id)

    // Nullify companyId on all associated deals so they become "No Brand" deals
    await this.db
      .update(deals)
      .set({ companyId: null, updatedAt: new Date() })
      .where(eq(deals.companyId, id))

    await this.db.delete(companies).where(eq(companies.id, id))

    this.auditLogs.log({
      action: 'delete',
      auditType: 'company_deleted',
      entityType: 'company',
      entityId: id,
      performedBy: performedBy ?? undefined,
      details: { name: existing?.name, dealCount: existing?.dealIds?.length ?? 0 },
    }).catch(() => {})
  }
}
