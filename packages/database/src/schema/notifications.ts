import { pgTable, uuid, text, boolean, jsonb, timestamp } from 'drizzle-orm/pg-core'
import { deals } from './deals'
import { users } from './users'
import { workspaces } from './workspaces'

export const notifications = pgTable('notifications', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').references(() => users.id).notNull(),
  type: text('type', {
    enum: ['dormant_deal', 'deal_won', 'mention'],
  }).notNull(),
  dealId: uuid('deal_id').references(() => deals.id, { onDelete: 'cascade' }),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
  isRead: boolean('is_read').default(false).notNull(),
  workspaceId: uuid('workspace_id').references(() => workspaces.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})
