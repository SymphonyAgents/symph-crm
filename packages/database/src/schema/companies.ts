import { pgTable, uuid, text, timestamp, foreignKey } from 'drizzle-orm/pg-core'
import { workspaces } from './workspaces'
import { users } from './users'

export const companies = pgTable('companies', {
  id: uuid('id').defaultRandom().primaryKey(),
  /**
   * Parent company — models the brand hierarchy (e.g. Mlhuillier → ML ASYS, ML KP).
   * Null for top-level parent companies. Child "brands" point here.
   * Self-referential FK declared via foreignKey() below (Drizzle limitation).
   */
  parentId: uuid('parent_id'),
  name: text('name').notNull(),
  domain: text('domain'),
  industry: text('industry'),
  headcountRange: text('headcount_range'),
  revenueRange: text('revenue_range'),
  hqLocation: text('hq_location'),
  website: text('website'),
  linkedinUrl: text('linkedin_url'),
  description: text('description'),
  logoUrl: text('logo_url'),
  tags: text('tags').array(),
  assignedTo: text('assigned_to').references(() => users.id),
  createdBy: text('created_by').references(() => users.id),
  workspaceId: uuid('workspace_id').references(() => workspaces.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  // Self-referential FK: brand.parentId → company.id
  foreignKey({ columns: [table.parentId], foreignColumns: [table.id] })
    .onDelete('set null'),
])
