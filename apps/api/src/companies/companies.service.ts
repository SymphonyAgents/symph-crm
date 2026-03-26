import { Injectable, Inject } from '@nestjs/common'
import { eq, desc, ilike, or } from 'drizzle-orm'
import { companies } from '@symph-crm/database'
import { DB } from '../database/database.module'
import type { Database } from '../database/database.types'

@Injectable()
export class CompaniesService {
  constructor(@Inject(DB) private db: Database) {}

  async findAll() {
    return this.db.select().from(companies).orderBy(desc(companies.createdAt))
  }

  async findOne(id: string) {
    const [company] = await this.db.select().from(companies).where(eq(companies.id, id))
    return company
  }

  /** Fuzzy search by name or domain — used by the AI agent's search_companies tool. */
  async search(query: string) {
    const pattern = `%${query}%`
    return this.db
      .select()
      .from(companies)
      .where(or(ilike(companies.name, pattern), ilike(companies.domain, pattern)))
      .orderBy(desc(companies.createdAt))
      .limit(20)
  }

  /**
   * Find by exact domain, or create if absent.
   * Used by the AI agent when a new deal is mentioned for an unknown company.
   */
  async findOrCreate(
    data: Pick<typeof companies.$inferInsert, 'name' | 'domain' | 'workspaceId' | 'createdBy'> &
      Partial<typeof companies.$inferInsert>,
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
    return { company, created: true }
  }

  async create(data: typeof companies.$inferInsert) {
    const [company] = await this.db.insert(companies).values(data).returning()
    return company
  }

  async update(id: string, data: Partial<typeof companies.$inferInsert>) {
    const [company] = await this.db
      .update(companies)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(companies.id, id))
      .returning()
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

  async remove(id: string) {
    await this.db.delete(companies).where(eq(companies.id, id))
  }
}
