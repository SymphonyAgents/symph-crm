import { Injectable, Inject } from '@nestjs/common'
import { eq } from 'drizzle-orm'
import { products, tiers } from '@symph-crm/database'
import { DB } from '../database/database.module'
import type { Database } from '../database/database.types'

@Injectable()
export class ProductsService {
  constructor(@Inject(DB) private db: Database) {}

  async findAllProducts() {
    return this.db.select().from(products).orderBy(products.sortOrder)
  }

  async findProduct(id: string) {
    const [product] = await this.db.select().from(products).where(eq(products.id, id))
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
