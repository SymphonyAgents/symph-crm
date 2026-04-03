import { pgTable, uuid, text, numeric, integer, date, boolean, timestamp } from 'drizzle-orm/pg-core'
import { companies } from './companies'
import { products } from './products'
import { tiers } from './products'
import { users } from './users'
import { workspaces } from './workspaces'
import { pipelineStages, amRoster } from './pipeline'

export const deals = pgTable('deals', {
  id: uuid('id').defaultRandom().primaryKey(),
  companyId: uuid('company_id').references(() => companies.id),
  productId: uuid('product_id').references(() => products.id).notNull(),
  tierId: uuid('tier_id').references(() => tiers.id).notNull(),
  title: text('title').notNull(),

  // Pipeline stage — FK to workspace-configured stages (replaces hardcoded stage enum)
  stageId: uuid('stage_id').references(() => pipelineStages.id),

  value: numeric('value'),
  probability: integer('probability').default(10),
  closeDate: date('close_date'),
  lossReason: text('loss_reason'),
  competitiveNotes: text('competitive_notes'),

  // Deal ownership
  assignedTo: text('assigned_to').references(() => users.id),
  createdBy: text('created_by').references(() => users.id),

  // Account manager — FK to am_roster (replaces freetext accountsManagerName)
  amRosterId: uuid('am_roster_id').references(() => amRoster.id),

  // Build assignment — FK to users
  buildAssignedTo: text('build_assigned_to').references(() => users.id),

  outreachCategory: text('outreach_category', { enum: ['inbound', 'outbound'] }),
  dateCaptured: timestamp('date_captured', { withTimezone: true }).defaultNow(),
  demoLink: text('demo_link'),
  servicesTags: text('services_tags').array().default([]),
  lastActivityAt: timestamp('last_activity_at', { withTimezone: true }).defaultNow(),
  isFlagged: boolean('is_flagged').default(false),
  flagReason: text('flag_reason'),
  workspaceId: uuid('workspace_id').references(() => workspaces.id),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})
