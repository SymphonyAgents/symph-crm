import { pgTable, uuid, text, integer, boolean, timestamp } from 'drizzle-orm/pg-core'
import { workspaces } from './workspaces'
import { deals } from './deals'
import { companies } from './companies'
import { contacts } from './contacts'
import { users } from './users'

/**
 * documents — metadata-only index for all long-form content.
 *
 * ZERO content is stored in this table. CRM-managed content lives behind
 * StorageService in the private Cloud Storage FUSE mount. This table is the
 * queryable index: search metadata here, then fetch content through the API.
 *
 * Replaces the old `notes` table which incorrectly stored content in DB.
 * See docs/ARCHITECTURE-HYBRID.md for full rationale.
 */
export const documents = pgTable('documents', {
  id: uuid('id').defaultRandom().primaryKey(),

  // Tenant
  workspaceId: uuid('workspace_id').references(() => workspaces.id),

  // Ownership — any can be null; a document can belong to a deal, company, or contact
  dealId: uuid('deal_id').references(() => deals.id, { onDelete: 'set null' }),
  companyId: uuid('company_id').references(() => companies.id, { onDelete: 'set null' }),
  contactId: uuid('contact_id').references(() => contacts.id, { onDelete: 'set null' }),
  authorId: text('author_id').references(() => users.id).notNull(),

  // Classification
  type: text('type', {
    enum: [
      'context',           // AI-maintained living record per deal (THE key file)
      'discovery',         // discovery call notes
      'transcript_raw',    // verbatim call/voice transcript
      'transcript_clean',  // AI-cleaned and structured transcript
      'meeting',           // multi-person meeting notes
      'proposal',          // proposal draft (versioned)
      'summary',           // AI-generated summary
      'email_thread',      // archived email thread
      'company_profile',   // AI-maintained company brief
      'weekly_digest',     // weekly AM rollup
      'general',           // freeform markdown
    ],
  }).notNull().default('general'),

  // Metadata
  title: text('title').notNull(),
  tags: text('tags').array().default([]),

  // Preview — first ~500 chars for list views and pg_trgm search.
  // Updated by the service layer on every write. NEVER the full content.
  excerpt: text('excerpt'),
  wordCount: integer('word_count').default(0),

  // Storage reference: relative path inside CRM-managed mounted storage.
  // Format: 'deals/{deal_id}/context.md', 'companies/{co_id}/profile.md', etc.
  // UNIQUE: one DB row per file.
  storagePath: text('storage_path').notNull().unique(),

  // Versioning — kept for legacy markdown document types (transcripts, etc).
  // Proposals do NOT use this table — see packages/database/src/schema/proposals.ts.
  version: integer('version').default(1),
  parentId: uuid('parent_id'), // self-reference; Drizzle doesn't support inline self-refs

  // Flags
  isAiGenerated: boolean('is_ai_generated').default(false).notNull(),
  isPinned: boolean('is_pinned').default(false).notNull(),

  // Timestamps (soft delete via deleted_at)
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
})
