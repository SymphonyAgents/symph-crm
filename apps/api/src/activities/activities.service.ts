import { Injectable, Inject } from '@nestjs/common'
import { eq, desc, and } from 'drizzle-orm'
import { activities } from '@symph-crm/database'
import { DB } from '../database/database.module'
import type { Database } from '../database/database.types'

export type ActivitiesFilterParams = {
  dealId?: string
  companyId?: string
  limit?: number
}

@Injectable()
export class ActivitiesService {
  constructor(@Inject(DB) private db: Database) {}

  async find(params: ActivitiesFilterParams = {}) {
    const limit = params.limit ?? 50
    const conditions = []
    if (params.dealId) conditions.push(eq(activities.dealId, params.dealId))
    if (params.companyId) conditions.push(eq(activities.companyId, params.companyId))

    const q = conditions.length > 0
      ? this.db.select().from(activities).where(and(...conditions)).orderBy(desc(activities.createdAt)).limit(limit)
      : this.db.select().from(activities).orderBy(desc(activities.createdAt)).limit(limit)

    return q
  }

  async findByDeal(dealId: string, limit = 50) {
    return this.db
      .select()
      .from(activities)
      .where(eq(activities.dealId, dealId))
      .orderBy(desc(activities.createdAt))
      .limit(limit)
  }

  async findByCompany(companyId: string, limit = 50) {
    return this.db
      .select()
      .from(activities)
      .where(eq(activities.companyId, companyId))
      .orderBy(desc(activities.createdAt))
      .limit(limit)
  }

  async create(data: typeof activities.$inferInsert) {
    const [activity] = await this.db.insert(activities).values(data).returning()
    return activity
  }
}
