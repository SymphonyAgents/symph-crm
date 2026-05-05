import { pgTable, uuid, text, integer, timestamp } from 'drizzle-orm/pg-core'
import { companies } from './companies'
import { tiers } from './products'
import { internalProducts } from './internal-products'
import { users } from './users'

export const customizationRequests = pgTable('customization_requests', {
  id: uuid('id').defaultRandom().primaryKey(),
  companyId: uuid('company_id').references(() => companies.id).notNull(),
  internalProductId: uuid('product_id').references(() => internalProducts.id).notNull(),
  tierId: uuid('tier_id').references(() => tiers.id).notNull(),
  title: text('title').notNull(),
  description: text('description'),
  status: text('status', {
    enum: ['requested', 'approved', 'in_progress', 'delivered', 'rejected'],
  }).default('requested').notNull(),
  requestedBy: text('requested_by').references(() => users.id).notNull(),
  year: integer('year'),
  deliveredAt: timestamp('delivered_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})
