import { Injectable, Inject } from '@nestjs/common'
import { eq, desc, and, sql, gte, lte } from 'drizzle-orm'
import { auditLogs, users } from '@symph-crm/database'
import { DB } from '../database/database.module'
import type { Database } from '../database/database.types'

export type AuditLogsFilterParams = {
  entityType?: string
  entityId?: string
  action?: string
  performedBy?: string
  limit?: number
  offset?: number
  from?: string   // ISO date
  to?: string     // ISO date
}

@Injectable()
export class AuditLogsService {
  constructor(@Inject(DB) private db: Database) {}

  async find(params: AuditLogsFilterParams = {}) {
    const limit = Math.min(params.limit ?? 50, 200)
    const offset = params.offset ?? 0
    const conditions = []

    if (params.entityType) conditions.push(eq(auditLogs.entityType, params.entityType))
    if (params.entityId) conditions.push(eq(auditLogs.entityId, params.entityId))
    if (params.action) conditions.push(eq(auditLogs.action, params.action as typeof auditLogs.action.enumValues[number]))
    if (params.performedBy) conditions.push(eq(auditLogs.performedBy, params.performedBy))
    if (params.from) conditions.push(gte(auditLogs.createdAt, new Date(params.from)))
    if (params.to) conditions.push(lte(auditLogs.createdAt, new Date(params.to)))

    const where = conditions.length > 0 ? and(...conditions) : undefined

    const rows = await this.db
      .select({
        id: auditLogs.id,
        createdAt: auditLogs.createdAt,
        action: auditLogs.action,
        auditType: auditLogs.auditType,
        entityType: auditLogs.entityType,
        entityId: auditLogs.entityId,
        source: auditLogs.source,
        performedBy: auditLogs.performedBy,
        details: auditLogs.details,
        performerName: users.name,
        performerImage: users.image,
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.performedBy, users.id))
      .where(where)
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit)
      .offset(offset)

    // Also get total count for pagination
    const [{ count }] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(auditLogs)
      .where(where)

    return { rows, total: count }
  }

  /**
   * Log an audit entry. Called internally by other services.
   */
  async log(data: {
    action: 'create' | 'update' | 'delete' | 'status_change'
    auditType: string
    entityType: string
    entityId?: string
    source?: string
    performedBy?: string
    details?: Record<string, unknown>
  }) {
    const [entry] = await this.db
      .insert(auditLogs)
      .values(data)
      .returning()
    return entry
  }
}
