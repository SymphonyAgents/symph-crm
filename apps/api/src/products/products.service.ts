import { Injectable, Inject } from '@nestjs/common'
import { eq, asc } from 'drizzle-orm'
import { catalogItems, tiers } from '@symph-crm/database'
import { DB } from '../database/database.module'
import type { Database } from '../database/database.types'

@Injectable()
export class ProductsService {
  constructor(@Inject(DB) private db: Database) {}

  async findAllProducts() {
    return this.db.select().from(catalogItems)
      .where(eq(catalogItems.isActive, true))
      .orderBy(asc(catalogItems.name))
  }

  async findProduct(id: string) {
    const [product] = await this.db.select().from(catalogItems).where(eq(catalogItems.id, id))
    return product
  }

  async findAllTiers() {
    return this.db.select().from(tiers).orderBy(tiers.sortOrder)
  }

  async findTier(id: string) {
    const [tier] = await this.db.select().from(tiers).where(eq(tiers.id, id))
    return tier
  }
}
