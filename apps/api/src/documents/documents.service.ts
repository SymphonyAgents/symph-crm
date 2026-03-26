import { Injectable, Inject, NotFoundException } from '@nestjs/common'
import { eq, desc, and, isNull } from 'drizzle-orm'
import { documents } from '@symph-crm/database'
import { DB } from '../database/database.module'
import type { Database } from '../database/database.types'
import { StorageService } from '../storage/storage.service'

export type DocumentType = typeof documents.$inferInsert['type']

@Injectable()
export class DocumentsService {
  constructor(
    @Inject(DB) private db: Database,
    private storage: StorageService,
  ) {}

  // ── Metadata queries ──────────────────────────────────────────────────────

  async findByDeal(dealId: string) {
    return this.db
      .select()
      .from(documents)
      .where(and(eq(documents.dealId, dealId), isNull(documents.deletedAt)))
      .orderBy(desc(documents.updatedAt))
  }

  async findByCompany(companyId: string) {
    return this.db
      .select()
      .from(documents)
      .where(and(eq(documents.companyId, companyId), isNull(documents.deletedAt)))
      .orderBy(desc(documents.updatedAt))
  }

  async findByType(type: any) {
    return this.db
      .select()
      .from(documents)
      .where(and(eq(documents.type, type), isNull(documents.deletedAt)))
      .orderBy(desc(documents.updatedAt))
  }

  async findOne(id: string) {
    const [doc] = await this.db.select().from(documents).where(eq(documents.id, id))
    return doc
  }

  // ── Content read/write ────────────────────────────────────────────────────

  /**
   * Read the full markdown content from Supabase Storage.
   * Returns null if the file doesn't exist yet.
   */
  async readContent(id: string): Promise<string | null> {
    const doc = await this.findOne(id)
    if (!doc) throw new NotFoundException(`Document ${id} not found`)
    return this.storage.readMarkdown(doc.storagePath)
  }

  /**
   * Create a document metadata record + write content to Storage.
   * storagePath is derived automatically if not provided:
   *   deals/{dealId}/{type}.md  |  companies/{companyId}/profile.md  |  etc.
   */
  async create(
    data: Omit<typeof documents.$inferInsert, 'storagePath' | 'excerpt' | 'wordCount'> & {
      storagePath?: string
      content?: string
    },
  ) {
    const { content, ...rest } = data

    // Auto-derive storage path if not supplied
    const storagePath = rest.storagePath ?? this.derivePath(rest)

    let excerpt: string | undefined
    let wordCount = 0
    if (content) {
      const extracted = StorageService.extractExcerpt(content)
      excerpt = extracted.excerpt
      wordCount = extracted.wordCount
      await this.storage.writeMarkdown(storagePath, content)
    }

    const [doc] = await this.db
      .insert(documents)
      .values({ ...rest, storagePath, excerpt, wordCount })
      .returning()
    return doc
  }

  /**
   * Update document metadata and optionally replace content in Storage.
   */
  async update(
    id: string,
    data: Partial<typeof documents.$inferInsert> & { content?: string },
  ) {
    const { content, ...rest } = data
    const updates: Partial<typeof documents.$inferInsert> = {
      ...rest,
      updatedAt: new Date(),
    }

    if (content !== undefined) {
      const doc = await this.findOne(id)
      if (!doc) throw new NotFoundException(`Document ${id} not found`)
      await this.storage.writeMarkdown(doc.storagePath, content)
      const extracted = StorageService.extractExcerpt(content)
      updates.excerpt = extracted.excerpt
      updates.wordCount = extracted.wordCount
    }

    const [doc] = await this.db
      .update(documents)
      .set(updates)
      .where(eq(documents.id, id))
      .returning()
    return doc
  }

  /** Soft delete */
  async remove(id: string) {
    await this.db
      .update(documents)
      .set({ deletedAt: new Date() })
      .where(eq(documents.id, id))
  }

  /**
   * Upsert the AI context document for a deal. Creates if absent, updates if present.
   * This is the main file the AI agent writes to — deals/{dealId}/context.md
   */
  async upsertDealContext(params: {
    dealId: string
    workspaceId: string
    authorId: string
    content: string
  }) {
    const storagePath = `deals/${params.dealId}/context.md`
    const existing = await this.db
      .select()
      .from(documents)
      .where(and(eq(documents.storagePath, storagePath), isNull(documents.deletedAt)))
      .limit(1)

    const { excerpt, wordCount } = StorageService.extractExcerpt(params.content)
    await this.storage.writeMarkdown(storagePath, params.content)

    if (existing.length > 0) {
      const [doc] = await this.db
        .update(documents)
        .set({ excerpt, wordCount, updatedAt: new Date(), isAiGenerated: true })
        .where(eq(documents.id, existing[0].id))
        .returning()
      return doc
    }

    const [doc] = await this.db
      .insert(documents)
      .values({
        workspaceId: params.workspaceId,
        dealId: params.dealId,
        authorId: params.authorId,
        type: 'context',
        title: 'Deal Context',
        storagePath,
        excerpt,
        wordCount,
        isAiGenerated: true,
        isPinned: true,
      })
      .returning()
    return doc
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private derivePath(data: Partial<typeof documents.$inferInsert>): string {
    const type = data.type ?? 'general'
    if (data.dealId) return `deals/${data.dealId}/${type}.md`
    if (data.companyId) return `companies/${data.companyId}/${type}.md`
    if (data.contactId) return `contacts/${data.contactId}/${type}.md`
    return `workspace/${data.workspaceId ?? 'default'}/${type}-${Date.now()}.md`
  }
}
