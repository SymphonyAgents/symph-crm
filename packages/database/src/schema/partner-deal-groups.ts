import { boolean, index, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { users } from './users'
import { workspaces } from './workspaces'
import { deals } from './deals'

export const partnerDealGroups = pgTable('partner_deal_groups', {
  id: uuid('id').defaultRandom().primaryKey(),
  workspaceId: uuid('workspace_id').references(() => workspaces.id),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  description: text('description'),
  isActive: boolean('is_active').default(true).notNull(),
  createdBy: text('created_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, table => ({
  workspaceSlugUnique: uniqueIndex('partner_deal_groups_workspace_slug_unique').on(table.workspaceId, table.slug),
  workspaceIdx: index('partner_deal_groups_workspace_idx').on(table.workspaceId),
}))

export const partnerDealGroupMembers = pgTable('partner_deal_group_members', {
  id: uuid('id').defaultRandom().primaryKey(),
  workspaceId: uuid('workspace_id').references(() => workspaces.id),
  groupId: uuid('group_id').notNull().references(() => partnerDealGroups.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdBy: text('created_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, table => ({
  groupUserUnique: uniqueIndex('partner_deal_group_members_group_user_unique').on(table.groupId, table.userId),
  userIdx: index('partner_deal_group_members_user_idx').on(table.userId),
  groupIdx: index('partner_deal_group_members_group_idx').on(table.groupId),
  workspaceIdx: index('partner_deal_group_members_workspace_idx').on(table.workspaceId),
}))

export const dealPartnerDealGroups = pgTable('deal_partner_deal_groups', {
  id: uuid('id').defaultRandom().primaryKey(),
  workspaceId: uuid('workspace_id').references(() => workspaces.id),
  dealId: uuid('deal_id').notNull().references(() => deals.id, { onDelete: 'cascade' }),
  groupId: uuid('group_id').notNull().references(() => partnerDealGroups.id, { onDelete: 'cascade' }),
  createdBy: text('created_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, table => ({
  dealGroupUnique: uniqueIndex('deal_partner_deal_groups_deal_group_unique').on(table.dealId, table.groupId),
  dealIdx: index('deal_partner_deal_groups_deal_idx').on(table.dealId),
  groupIdx: index('deal_partner_deal_groups_group_idx').on(table.groupId),
  workspaceIdx: index('deal_partner_deal_groups_workspace_idx').on(table.workspaceId),
}))
