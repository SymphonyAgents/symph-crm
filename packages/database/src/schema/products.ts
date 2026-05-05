import { pgTable, uuid, text, integer, timestamp } from 'drizzle-orm/pg-core'

export const tiers = pgTable('tiers', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').unique().notNull(),
  description: text('description'),
  customizationSlots: integer('customization_slots'),
  sortOrder: integer('sort_order').default(0).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})
