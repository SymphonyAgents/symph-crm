import { Injectable, Inject } from '@nestjs/common'
import { eq, asc } from 'drizzle-orm'
import { internalProducts, tiers } from '@symph-crm/database'
import { DB } from '../database/database.module'
import type { Database } from '../database/database.types'

@Injectable()
export class ProductsService {
  constructor(@Inject(DB) private db: Database) {}

  async findAllProducts() {
    return this.db.select().from(internalProducts)
      .where(eq(internalProducts.isActive, true))
      .orderBy(asc(internalProducts.name))
  }

  async findProduct(id: string) {
    const [product] = await this.db.select().from(internalProducts).where(eq(internalProducts.id, id))
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
