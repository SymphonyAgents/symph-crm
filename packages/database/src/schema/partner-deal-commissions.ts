import { bigint, index, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { deals } from './deals'
import { partnerDealGroups } from './partner-deal-groups'
import { users } from './users'
import { workspaces } from './workspaces'

export const partnerDealCommissions = pgTable('partner_deal_commissions', {
  id: uuid('id').defaultRandom().primaryKey(),
  workspaceId: uuid('workspace_id').references(() => workspaces.id),
  dealId: uuid('deal_id').notNull().references(() => deals.id, { onDelete: 'cascade' }),
  partnerDealGroupId: uuid('partner_deal_group_id').notNull().references(() => partnerDealGroups.id, { onDelete: 'cascade' }),
  commissionAmountScaled: bigint('commission_amount_scaled', { mode: 'number' }).notNull().default(0),
  commissionStatus: text('commission_status', { enum: ['pending', 'approved', 'paid', 'void'] }).notNull().default('pending'),
  notes: text('notes'),
  createdBy: text('created_by').references(() => users.id),
  updatedBy: text('updated_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, table => ({
  dealGroupUnique: uniqueIndex('partner_deal_commissions_deal_group_unique').on(table.dealId, table.partnerDealGroupId),
  dealIdx: index('partner_deal_commissions_deal_idx').on(table.dealId),
  groupIdx: index('partner_deal_commissions_group_idx').on(table.partnerDealGroupId),
  workspaceIdx: index('partner_deal_commissions_workspace_idx').on(table.workspaceId),
}))
