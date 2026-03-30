import { Injectable, Inject } from '@nestjs/common'
import { eq, desc, and, ilike } from 'drizzle-orm'
import { deals } from '@symph-crm/database'
import { DB } from '../database/database.module'
import type { Database } from '../database/database.types'
import { AuditLogsService } from '../audit-logs/audit-logs.service'

export type DealsFilterParams = {
  companyId?: string
  stage?: string
  search?: string
  limit?: number
}

@Injectable()
export class DealsService {
  constructor(
    @Inject(DB) private db: Database,
    private auditLogs: AuditLogsService,
  ) {}

  async findAll(params?: DealsFilterParams) {
    const limit = params?.limit ?? 200
    const conditions = []

    if (params?.companyId) conditions.push(eq(deals.companyId, params.companyId))
    if (params?.stage) conditions.push(eq(deals.stage, params.stage as typeof deals.$inferSelect['stage']))
    if (params?.search) conditions.push(ilike(deals.title, `%${params.search}%`))

    const query = conditions.length > 0
      ? this.db.select().from(deals).where(and(...conditions)).orderBy(desc(deals.createdAt)).limit(limit)
      : this.db.select().from(deals).orderBy(desc(deals.createdAt)).limit(limit)

    return query
  }

  async findByCompany(companyId: string) {
    return this.db
      .select()
      .from(deals)
      .where(eq(deals.companyId, companyId))
      .orderBy(desc(deals.createdAt))
  }

  async findOne(id: string) {
    const [deal] = await this.db.select().from(deals).where(eq(deals.id, id))
    return deal
  }

  async updateStage(id: string, stage: string, performedBy?: string) {
    // Capture old stage for audit trail
    const existing = await this.findOne(id)
    const [deal] = await this.db
      .update(deals)
      .set({
        stage: stage as typeof deals.$inferSelect['stage'],
        updatedAt: new Date(),
        lastActivityAt: new Date(),
      })
      .where(eq(deals.id, id))
      .returning()

    this.auditLogs.log({
      action: 'status_change',
      auditType: 'deal_stage_change',
      entityType: 'deal',
      entityId: id,
      performedBy: performedBy ?? undefined,
      details: {
        title: existing?.title,
        from: existing?.stage ?? null,
        to: stage,
      },
    }).catch(() => {}) // non-blocking

    return deal
  }

  async create(data: typeof deals.$inferInsert, performedBy?: string) {
    const [deal] = await this.db.insert(deals).values(data).returning()

    this.auditLogs.log({
      action: 'create',
      auditType: 'deal_created',
      entityType: 'deal',
      entityId: deal.id,
      performedBy: performedBy ?? data.createdBy ?? undefined,
      details: { title: deal.title, stage: deal.stage },
    }).catch(() => {})

    return deal
  }

  async update(id: string, data: Partial<typeof deals.$inferInsert>, performedBy?: string) {
    const [deal] = await this.db.update(deals).set(data).where(eq(deals.id, id)).returning()

    this.auditLogs.log({
      action: 'update',
      auditType: 'deal_updated',
      entityType: 'deal',
      entityId: id,
      performedBy: performedBy ?? undefined,
      details: { fields: Object.keys(data).filter(k => k !== 'updatedAt') },
    }).catch(() => {})

    return deal
  }

  async remove(id: string, performedBy?: string) {
    const existing = await this.findOne(id)

    await this.db.delete(deals).where(eq(deals.id, id))

    this.auditLogs.log({
      action: 'delete',
      auditType: 'deal_deleted',
      entityType: 'deal',
      entityId: id,
      performedBy: performedBy ?? undefined,
      details: { title: existing?.title },
    }).catch(() => {})
  }

  /**
   * Touch lastActivityAt and clear dormancy flag in one atomic UPDATE.
   * Call this from any service that records activity against a deal:
   *   - chat message about a deal
   *   - document created / updated
   *   - file uploaded
   *   - calendar event linked
   *   - stage change (already handled in updateStage)
   */
  async updateLastActivity(id: string): Promise<void> {
    await this.db
      .update(deals)
      .set({
        lastActivityAt: new Date(),
        isFlagged: false,
        flagReason: null,
        updatedAt: new Date(),
      })
      .where(eq(deals.id, id))
  }
}
