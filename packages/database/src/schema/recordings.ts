import { pgTable, uuid, text, integer, bigint, timestamp } from 'drizzle-orm/pg-core'
import { users } from './users'
import { deals } from './deals'
import { workspaces } from './workspaces'

export const recordings = pgTable('recordings', {
  id:          uuid('id').defaultRandom().primaryKey(),
  userId:      text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  dealId:      uuid('deal_id').references(() => deals.id, { onDelete: 'set null' }),
  workspaceId: uuid('workspace_id').references(() => workspaces.id, { onDelete: 'cascade' }),
  title:       text('title').notNull(),
  duration:    integer('duration'),                      // seconds
  storageKey:  text('storage_key').notNull(),            // path in attachments bucket
  mimeType:    text('mime_type').notNull().default('audio/webm'),
  sizeBytes:   bigint('size_bytes', { mode: 'number' }),
  createdAt:   timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt:   timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})
