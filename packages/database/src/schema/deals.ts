import { pgTable, uuid, text, numeric, integer, date, boolean, timestamp } from 'drizzle-orm/pg-core'
import { companies } from './companies'
import { products } from './products'
import { tiers } from './products'
import { users } from './users'
import { contacts } from './contacts'
import { workspaces } from './workspaces'

export const deals = pgTable('deals', {
  id: uuid('id').defaultRandom().primaryKey(),
  companyId: uuid('company_id').references(() => companies.id),
  productId: uuid('product_id').references(() => products.id).notNull(),
  tierId: uuid('tier_id').references(() => tiers.id).notNull(),
  title: text('title').notNull(),
  stage: text('stage', {
    enum: ['lead', 'discovery', 'assessment', 'proposal_demo', 'followup', 'closed_won', 'closed_lost', 'qualified', 'demo', 'proposal', 'negotiation'],
  }).default('lead').notNull(),
  value: numeric('value'),
  probability: integer('probability').default(10),
  closeDate: date('close_date'),
  lossReason: text('loss_reason'),
  competitiveNotes: text('competitive_notes'),
  assignedTo: text('assigned_to').references(() => users.id),
  createdBy: text('created_by').references(() => users.id),
  outreachCategory: text('outreach_category', { enum: ['inbound', 'outbound'] }),
  dateCaptured: timestamp('date_captured', { withTimezone: true }).defaultNow(),
  pocContactId: uuid('poc_contact_id').references(() => contacts.id),
  demoLink: text('demo_link'),
  proposalLink: text('proposal_link'),
  pricingModel: text('pricing_model', { enum: ['fixed', 'monthly', 'annual'] }),
  servicesTags: text('services_tags').array().default([]),
  lastActivityAt: timestamp('last_activity_at', { withTimezone: true }).defaultNow(),
  isFlagged: boolean('is_flagged').default(false),
  flagReason: text('flag_reason'),
  workspaceId: uuid('workspace_id').references(() => workspaces.id),
  // Extended fields for real sales data
  engagementModel: text('engagement_model'),
  accountsManagerName: text('accounts_manager_name'),
  salesNotes: text('sales_notes'),
  buildAssignedTo: text('build_assigned_to'),
  buildNotes: text('build_notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})
