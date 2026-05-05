import { pgTable, uuid, text, boolean, timestamp } from 'drizzle-orm/pg-core'
import { workspaces } from './workspaces'

export const internalProducts = pgTable('internal_products', {
  id: uuid('id').defaultRandom().primaryKey(),
  workspaceId: uuid('workspace_id').references(() => workspaces.id),
  name: text('name').notNull(),
  industry: text('industry'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})
