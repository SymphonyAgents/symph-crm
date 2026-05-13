import { Injectable, Inject, NotFoundException } from '@nestjs/common'
import { and, eq, desc } from 'drizzle-orm'
import { catalogItems } from '@symph-crm/database'
import { DB } from '../database/database.module'
import type { Database } from '../database/database.types'
import type { CreateCatalogItemDto } from './dto/create-catalog-item.dto'
import type { UpdateCatalogItemDto } from './dto/update-catalog-item.dto'

export type ProductType = 'internal' | 'service' | 'reseller' | 'partnership'

@Injectable()
export class CatalogItemsService {
  constructor(@Inject(DB) private db: Database) {}

  async findAll(opts: { activeOnly?: boolean; type?: ProductType } = {}) {
    const conds = [] as ReturnType<typeof eq>[]
    if (opts.activeOnly) conds.push(eq(catalogItems.isActive, true))
    if (opts.type) conds.push(eq(catalogItems.productType, opts.type))
    const where = conds.length === 0 ? undefined : conds.length === 1 ? conds[0] : and(...conds)
    const q = where
      ? this.db.select().from(catalogItems).where(where).orderBy(desc(catalogItems.createdAt))
      : this.db.select().from(catalogItems).orderBy(desc(catalogItems.createdAt))
    return q
  }

  async findOne(id: string) {
    const [row] = await this.db.select().from(catalogItems).where(eq(catalogItems.id, id))
    if (!row) throw new NotFoundException(`Catalog item ${id} not found`)
    return row
  }

  async create(dto: CreateCatalogItemDto) {
    const [row] = await this.db
      .insert(catalogItems)
      .values({
        productType: dto.productType ?? 'internal',
        slug: dto.slug ?? null,
        name: dto.name,
        industry: dto.industry ?? null,
        landingPageLink: dto.landingPageLink ?? null,
        iconUrl: dto.iconUrl ?? null,
        isActive: dto.isActive ?? true,
      })
      .returning()
    return row
  }

  async update(id: string, dto: UpdateCatalogItemDto) {
    const [existing] = await this.db.select().from(catalogItems).where(eq(catalogItems.id, id))
    if (!existing) throw new NotFoundException(`Catalog item ${id} not found`)

    const [row] = await this.db
      .update(catalogItems)
      .set({
        ...(dto.productType !== undefined ? { productType: dto.productType } : {}),
        ...(dto.slug !== undefined ? { slug: dto.slug } : {}),
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.industry !== undefined ? { industry: dto.industry } : {}),
        ...(dto.landingPageLink !== undefined ? { landingPageLink: dto.landingPageLink } : {}),
        ...(dto.iconUrl !== undefined ? { iconUrl: dto.iconUrl } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        updatedAt: new Date(),
      })
      .where(eq(catalogItems.id, id))
      .returning()
    return row
  }

  async remove(id: string) {
    const [row] = await this.db.delete(catalogItems).where(eq(catalogItems.id, id)).returning()
    if (!row) throw new NotFoundException(`Catalog item ${id} not found`)
    return row
  }
}
