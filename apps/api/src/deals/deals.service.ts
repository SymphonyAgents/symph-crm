import { Injectable, Inject } from '@nestjs/common'
import { eq, desc, and, ilike, gte, lte, inArray, isNull, count, sql } from 'drizzle-orm'
import { deals, documents, users, amRoster, pipelineStages, catalogItems } from '@symph-crm/database'
import { DB } from '../database/database.module'
import type { Database } from '../database/database.types'
import { AuditLogsService } from '../audit-logs/audit-logs.service'

export type DealsFilterParams = {
  companyId?: string
  stage?: string        // pipeline stage slug (e.g. 'lead', 'discovery')
  search?: string
  limit?: number
  from?: string
  to?: string
  dealType?: string     // legacy 'agency' | 'reseller', kept for back-compat
}

/** Batch-resolve stageId UUIDs → slug/label/color in one query */
async function resolveStages(
  db: Database,
  stageIds: string[],
): Promise<Map<string, { slug: string; label: string; color: string }>> {
  if (stageIds.length === 0) return new Map()
  const rows = await db
    .select({ id: pipelineStages.id, slug: pipelineStages.slug, label: pipelineStages.label, color: pipelineStages.color })
    .from(pipelineStages)
    .where(inArray(pipelineStages.id, stageIds as [string, ...string[]]))
  return new Map(rows.map(r => [r.id, { slug: r.slug, label: r.label, color: r.color }]))
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
    if (params?.search) conditions.push(ilike(deals.title, `%${params.search}%`))
    if (params?.from) conditions.push(gte(deals.createdAt, new Date(params.from)))
    if (params?.to) conditions.push(lte(deals.createdAt, new Date(params.to)))
    if (params?.dealType) conditions.push(eq(deals.dealType, params.dealType))

    // Filter by stage slug — resolve to stage_id via subquery
    if (params?.stage) {
      conditions.push(
        sql`${deals.stageId} = (SELECT id FROM pipeline_stages WHERE slug = ${params.stage} LIMIT 1)`,
      )
    }

    const query = conditions.length > 0
      ? this.db.select().from(deals).where(and(...conditions)).orderBy(desc(deals.createdAt)).limit(limit)
      : this.db.select().from(deals).orderBy(desc(deals.createdAt)).limit(limit)

    const rawDeals = await query
    if (rawDeals.length === 0) return []

    const dealIds = rawDeals.map(d => d.id)

    // Batch-fetch document counts, user names, stage slugs, and internal product names
    const productIds = [...new Set(rawDeals.map(d => d.catalogItemId).filter((id): id is string => !!id))]

    const [docCounts, userRows, stageMap, productRows] = await Promise.all([
      this.db
        .select({ dealId: documents.dealId, cnt: count() })
        .from(documents)
        .where(and(
          inArray(documents.dealId, dealIds as [string, ...string[]]),
          isNull(documents.deletedAt),
        ))
        .groupBy(documents.dealId),

      (() => {
        const creatorIds = [...new Set(rawDeals.map(d => d.createdBy).filter((id): id is string => !!id))]
        return creatorIds.length > 0
          ? this.db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, creatorIds as [string, ...string[]]))
          : Promise.resolve([])
      })(),

      resolveStages(
        this.db,
        [...new Set(rawDeals.map(d => d.stageId).filter((id): id is string => !!id))],
      ),

      productIds.length > 0
        ? this.db.select({ id: catalogItems.id, name: catalogItems.name, productType: catalogItems.productType })
            .from(catalogItems)
            .where(inArray(catalogItems.id, productIds as [string, ...string[]]))
        : Promise.resolve([]),
    ])

    const docCountMap = new Map(docCounts.map(r => [r.dealId, r.cnt]))
    const userNameMap = new Map(userRows.map(u => [u.id, u.name]))
    const productMap = new Map(productRows.map(p => [p.id, p]))

    return rawDeals.map(d => {
      const stageMeta = d.stageId ? stageMap.get(d.stageId) : undefined
      const catalog = d.catalogItemId ? productMap.get(d.catalogItemId) : undefined
      return {
        ...d,
        // Inject stage slug so FE can use deal.stage as before
        stage: stageMeta?.slug ?? null,
        stageLabel: stageMeta?.label ?? null,
        stageColor: stageMeta?.color ?? null,
        documentCount: docCountMap.get(d.id) ?? 0,
        createdByName: d.createdBy ? (userNameMap.get(d.createdBy) ?? null) : null,
        catalogItemName: catalog?.name ?? null,
        catalogItemType: catalog?.productType ?? null,
      }
    })
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
    if (!deal) return undefined
    const [stageMap, productRows] = await Promise.all([
      resolveStages(this.db, deal.stageId ? [deal.stageId] : []),
      deal.catalogItemId
        ? this.db.select({ id: catalogItems.id, name: catalogItems.name, productType: catalogItems.productType })
            .from(catalogItems)
            .where(eq(catalogItems.id, deal.catalogItemId))
            .limit(1)
        : Promise.resolve([]),
    ])
    const stageMeta = deal.stageId ? stageMap.get(deal.stageId) : undefined
    return {
      ...deal,
      stage: stageMeta?.slug ?? null,
      stageLabel: stageMeta?.label ?? null,
      stageColor: stageMeta?.color ?? null,
      catalogItemName: productRows[0]?.name ?? null,
      catalogItemType: productRows[0]?.productType ?? null,
    }
  }

  async updateStage(id: string, stage: string, performedBy?: string) {
    // Resolve slug → pipeline_stage ID
    const [pipelineStage] = await this.db
      .select({ id: pipelineStages.id })
      .from(pipelineStages)
      .where(eq(pipelineStages.slug, stage))
      .limit(1)

    // Capture current stage slug for audit trail
    const existing = await this.findOne(id)
    const oldStageSlug = existing?.stage ?? null

    const [deal] = await this.db
      .update(deals)
      .set({
        stageId: pipelineStage?.id ?? null,
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
        dealName: existing?.title,
        from: oldStageSlug,
        to: stage,
      },
    }).catch(() => {}) // non-blocking

    return deal
  }

  async create(
    data: Omit<typeof deals.$inferInsert, 'stageId'> & {
      stage?: string | null
      stageId?: string | null
      pricingModel?: unknown
      tierId?: unknown
    },
    performedBy?: string,
  ) {
    // Strip fields that no longer exist in the schema
    const { stage, pricingModel, tierId, ...cleanData } = data as any

    // Resolve stage slug → stageId UUID if a slug was passed
    let stageId: string | null = cleanData.stageId ?? null
    if (!stageId && stage) {
      const [ps] = await this.db
        .select({ id: pipelineStages.id })
        .from(pipelineStages)
        .where(eq(pipelineStages.slug, stage))
        .limit(1)
      stageId = ps?.id ?? null
    }

    // CRITICAL: deals.stage_id is NOT NULL at the DB level. Every creation
    // path (controller, internal API, owner API, AI tool calls) routes through
    // this service. If no stage was supplied — or the slug didn't resolve —
    // default to 'lead' so the insert never violates the constraint.
    // If 'lead' itself isn't configured, fail loud with a clear error rather
    // than surfacing a generic Postgres constraint violation.
    if (!stageId) {
      const [lead] = await this.db
        .select({ id: pipelineStages.id })
        .from(pipelineStages)
        .where(eq(pipelineStages.slug, 'lead'))
        .limit(1)
      if (!lead) {
        throw new Error(
          "Cannot create deal: pipeline_stages has no row with slug='lead'. " +
          'Seed the Lead stage before creating deals.',
        )
      }
      stageId = lead.id
    }

    // CRITICAL: deals.catalog_item_id is NOT NULL since migration 011.
    // Frontend forms only send it for the 'internal_products' service flow,
    // so default everything else to The Agency (matches the 011 backfill
    // default — admin re-tags from /catalog if needed). Fail loud if the
    // canonical row is missing.
    let catalogItemId: string | null = cleanData.catalogItemId ?? null
    if (!catalogItemId) {
      const [agency] = await this.db
        .select({ id: catalogItems.id })
        .from(catalogItems)
        .where(and(eq(catalogItems.productType, 'service'), eq(catalogItems.name, 'The Agency')))
        .limit(1)
      if (!agency) {
        throw new Error(
          "Cannot create deal: catalog_items has no service row named 'The Agency'. " +
          'Seed that catalog item before creating deals without an explicit catalog_item_id.',
        )
      }
      catalogItemId = agency.id
    }

    const [deal] = await this.db.insert(deals).values({ ...cleanData, stageId, catalogItemId }).returning()

    // Auto-add assigned user to AM roster
    if (deal.assignedTo) {
      this.ensureOnRoster(deal.assignedTo, deal.workspaceId).catch(() => {})
    }

    this.auditLogs.log({
      action: 'create',
      auditType: 'deal_created',
      entityType: 'deal',
      entityId: deal.id,
      performedBy: performedBy ?? data.createdBy ?? undefined,
      details: { dealName: deal.title, stageId: deal.stageId },
    }).catch(() => {})

    return deal
  }

  async update(id: string, data: Partial<typeof deals.$inferInsert> & { pricingModel?: unknown }, performedBy?: string) {
    // Strip any dropped columns that FE might still send
    const { pricingModel, ...cleanData } = data as any

    // Guard the NOT NULL catalog_item_id constraint: EditDealModal currently
    // sends catalogItemId: null when the user picks a service type other than
    // 'internal_products'. Treat that as "keep the existing link" — drop the
    // field so the column retains its current value instead of being nulled.
    if (cleanData.catalogItemId === null) {
      delete cleanData.catalogItemId
    }

    // Fetch current deal to determine dealType and fill in missing revenue fields
    const current = await this.db
      .select({
        oneTimeFee: deals.oneTimeFee,
        mrr: deals.mrr,
        contractLength: deals.contractLength,
        dealType: deals.dealType,
        costPrice: deals.costPrice,
        marginPercent: deals.marginPercent,
      })
      .from(deals)
      .where(eq(deals.id, id))
      .limit(1)
      .then(r => r[0] ?? { oneTimeFee: null, mrr: null, contractLength: null, dealType: 'agency', costPrice: null, marginPercent: null })

    const effectiveDealType = cleanData.dealType ?? current.dealType ?? 'agency'

    if (effectiveDealType === 'reseller') {
      // Reseller revenue: value = costPrice / (1 - marginPercent / 100)
      const resellerFields = ['costPrice', 'marginPercent', 'value']
      const isResellerRevenueUpdate = resellerFields.some(f => f in cleanData)
      if (isResellerRevenueUpdate) {
        const cost = parseFloat(String(cleanData.costPrice ?? current.costPrice ?? 0)) || 0
        const margin = parseFloat(String(cleanData.marginPercent ?? current.marginPercent ?? 0)) || 0
        if (cost > 0 && margin > 0 && margin < 100) {
          cleanData.value = String(cost / (1 - margin / 100))
        } else if (cost > 0) {
          cleanData.value = String(cost) // no margin set, value = cost
        }
      }
    } else {
      // Agency revenue: value = oneTimeFee + (mrr × contractLength)
      const revenueFields = ['oneTimeFee', 'mrr', 'contractLength', 'value']
      const isRevenueUpdate = revenueFields.some(f => f in cleanData)
      if (isRevenueUpdate) {
        const otf = parseFloat(String(cleanData.oneTimeFee ?? current.oneTimeFee ?? 0)) || 0
        const mrr = parseFloat(String(cleanData.mrr ?? current.mrr ?? 0)) || 0
        const len = parseInt(String(cleanData.contractLength ?? current.contractLength ?? 0), 10) || 0

        if (otf > 0 || mrr > 0) {
          cleanData.value = String(otf + mrr * (len || 1))
        }
      }
    }

    const [deal] = await this.db.update(deals).set(cleanData).where(eq(deals.id, id)).returning()

    // Auto-add assigned user to AM roster when assignedTo changes
    if (data.assignedTo && deal) {
      this.ensureOnRoster(data.assignedTo, deal.workspaceId).catch(() => {})
    }

    this.auditLogs.log({
      action: 'update',
      auditType: 'deal_updated',
      entityType: 'deal',
      entityId: id,
      performedBy: performedBy ?? undefined,
      details: { dealName: deal?.title, fields: Object.keys(data).filter(k => k !== 'updatedAt') },
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
      details: { dealName: existing?.title },
    }).catch(() => {})
  }

  /**
   * Touch lastActivityAt and clear dormancy flag in one atomic UPDATE.
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

  /**
   * Ensure a user is on the AM roster. Auto-called when a deal is assigned.
   */
  private async ensureOnRoster(userId: string, workspaceId: string | null): Promise<void> {
    const [existing] = await this.db
      .select()
      .from(amRoster)
      .where(eq(amRoster.userId, userId))
      .limit(1)

    if (existing) {
      await this.db
        .update(amRoster)
        .set({
          lastAssignedAt: new Date(),
          assignmentCount: sql`${amRoster.assignmentCount} + 1`,
          isActive: true,
        })
        .where(eq(amRoster.userId, userId))
    } else {
      await this.db
        .insert(amRoster)
        .values({
          userId,
          workspaceId: workspaceId ?? undefined,
          isActive: true,
          lastAssignedAt: new Date(),
          assignmentCount: 1,
        })
    }
  }
}
