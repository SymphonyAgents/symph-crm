import { Injectable, Inject } from '@nestjs/common'
import { products, tiers } from '@symph-crm/database'
import { DB } from '../database/database.module'
import type { Database } from '../database/database.types'

@Injectable()
export class ProductsService {
  constructor(@Inject(DB) private db: Database) {}

  async findAllProducts() {
    return this.db.select().from(products).orderBy(products.sortOrder)
  }

  async findAllTiers() {
    return this.db.select().from(tiers).orderBy(tiers.sortOrder)
  }
}
