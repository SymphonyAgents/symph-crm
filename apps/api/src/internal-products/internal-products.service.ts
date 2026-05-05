import { Injectable, Inject, OnModuleInit, Logger, NotFoundException } from '@nestjs/common'
import { eq, desc } from 'drizzle-orm'
import { internalProducts } from '@symph-crm/database'
import { DB } from '../database/database.module'
import type { Database } from '../database/database.types'
import type { CreateInternalProductDto } from './dto/create-internal-product.dto'
import type { UpdateInternalProductDto } from './dto/update-internal-product.dto'

@Injectable()
export class InternalProductsService implements OnModuleInit {
  private readonly logger = new Logger(InternalProductsService.name)

  constructor(@Inject(DB) private db: Database) {}

  async onModuleInit() {
    try {
      // Create internal_products table if missing
      await this.db.execute(`
        CREATE TABLE IF NOT EXISTS internal_products (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          workspace_id UUID REFERENCES workspaces(id),
          name TEXT NOT NULL,
          industry TEXT,
          is_active BOOLEAN NOT NULL DEFAULT TRUE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `)

      // Add new columns to deals (idempotent — IF NOT EXISTS)
      await this.db.execute(`
        ALTER TABLE deals ADD COLUMN IF NOT EXISTS sub_account_manager_id TEXT REFERENCES users(id)
      `)
      await this.db.execute(`
        ALTER TABLE deals ADD COLUMN IF NOT EXISTS builders TEXT[] DEFAULT '{}'
      `)
      await this.db.execute(`
        ALTER TABLE deals ADD COLUMN IF NOT EXISTS internal_product_id UUID REFERENCES internal_products(id)
      `)

      this.logger.log('Internal products tables ready')
    } catch (err) {
      this.logger.warn('Internal products migration skipped or failed:', err)
    }
  }

  async findAll(activeOnly = false) {
    const rows = activeOnly
      ? await this.db.select().from(internalProducts).where(eq(internalProducts.isActive, true)).orderBy(desc(internalProducts.createdAt))
      : await this.db.select().from(internalProducts).orderBy(desc(internalProducts.createdAt))
    return rows
  }

  async findOne(id: string) {
    const [row] = await this.db.select().from(internalProducts).where(eq(internalProducts.id, id))
    if (!row) throw new NotFoundException(`Internal product ${id} not found`)
    return row
  }

  async create(dto: CreateInternalProductDto) {
    const [row] = await this.db
      .insert(internalProducts)
      .values({
        name: dto.name,
        industry: dto.industry ?? null,
        isActive: dto.isActive ?? true,
      })
      .returning()
    return row
  }

  async update(id: string, dto: UpdateInternalProductDto) {
    const [existing] = await this.db.select().from(internalProducts).where(eq(internalProducts.id, id))
    if (!existing) throw new NotFoundException(`Internal product ${id} not found`)

    const [row] = await this.db
      .update(internalProducts)
      .set({
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.industry !== undefined ? { industry: dto.industry } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        updatedAt: new Date(),
      })
      .where(eq(internalProducts.id, id))
      .returning()
    return row
  }

  async remove(id: string) {
    const [row] = await this.db.delete(internalProducts).where(eq(internalProducts.id, id)).returning()
    if (!row) throw new NotFoundException(`Internal product ${id} not found`)
    return row
  }
}
