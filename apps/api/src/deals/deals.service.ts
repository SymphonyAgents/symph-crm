import { Injectable, Inject } from '@nestjs/common'
import { eq, desc, and, ilike } from 'drizzle-orm'
import { deals } from '@symph-crm/database'
import { DB } from '../database/database.module'
import type { Database } from '../database/database.types'

export type DealsFilterParams = {
  companyId?: string
  stage?: string
  search?: string
  limit?: number
}

@Injectable()
export class DealsService {
  constructor(@Inject(DB) private db: Database) {}

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

  async updateStage(id: string, stage: string) {
    const [deal] = await this.db
      .update(deals)
      .set({
        stage: stage as typeof deals.$inferSelect['stage'],
        updatedAt: new Date(),
        lastActivityAt: new Date(),
      })
      .where(eq(deals.id, id))
      .returning()
    return deal
  }

  async create(data: typeof deals.$inferInsert) {
    const [deal] = await this.db.insert(deals).values(data).returning()
    return deal
  }

  async update(id: string, data: Partial<typeof deals.$inferInsert>) {
    const [deal] = await this.db.update(deals).set(data).where(eq(deals.id, id)).returning()
    return deal
  }

  async remove(id: string) {
    await this.db.delete(deals).where(eq(deals.id, id))
  }
}
