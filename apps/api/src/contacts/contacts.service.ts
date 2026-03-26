import { Injectable, Inject } from '@nestjs/common'
import { eq, desc, or, ilike, and } from 'drizzle-orm'
import { contacts } from '@symph-crm/database'
import { DB } from '../database/database.module'
import type { Database } from '../database/database.types'

@Injectable()
export class ContactsService {
  constructor(@Inject(DB) private db: Database) {}

  async findAll(params?: { companyId?: string; search?: string }) {
    const conditions = []
    if (params?.companyId) conditions.push(eq(contacts.companyId, params.companyId))
    if (params?.search) {
      const pattern = `%${params.search}%`
      conditions.push(or(ilike(contacts.name, pattern), ilike(contacts.email, pattern))!)
    }
    const q = conditions.length > 0
      ? this.db.select().from(contacts).where(and(...conditions)).orderBy(desc(contacts.createdAt))
      : this.db.select().from(contacts).orderBy(desc(contacts.createdAt))
    return q
  }

  async findByCompany(companyId: string) {
    return this.db.select().from(contacts).where(eq(contacts.companyId, companyId)).orderBy(contacts.isPrimary, desc(contacts.createdAt))
  }

  async findOne(id: string) {
    const [contact] = await this.db.select().from(contacts).where(eq(contacts.id, id))
    return contact
  }

  async create(data: typeof contacts.$inferInsert) {
    const [contact] = await this.db.insert(contacts).values(data).returning()
    return contact
  }

  async update(id: string, data: Partial<typeof contacts.$inferInsert>) {
    const [contact] = await this.db.update(contacts).set(data).where(eq(contacts.id, id)).returning()
    return contact
  }

  async remove(id: string) {
    await this.db.delete(contacts).where(eq(contacts.id, id))
  }
}
