import { pgTable, uuid, text, numeric, integer, boolean, timestamp, date } from 'drizzle-orm/pg-core'
import { deals } from './deals'

export const dealBilling = pgTable('deal_billing', {
  id: uuid('id').defaultRandom().primaryKey(),
  dealId: uuid('deal_id').references(() => deals.id, { onDelete: 'cascade' }).notNull().unique(),
  billingType: text('billing_type', { enum: ['annual', 'monthly', 'milestone'] }).notNull(),
  contractStart: date('contract_start'),
  contractEnd: date('contract_end'),
  // For annual: total annual amount. For monthly: monthly amount. For milestone: null (derived from milestones)
  amount: numeric('amount'),
  // Auto-derived: annual/12 for annual type, same as amount for monthly, sum_milestones/contract_months for milestone
  monthlyDerived: numeric('monthly_derived'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const billingMilestones = pgTable('billing_milestones', {
  id: uuid('id').defaultRandom().primaryKey(),
  billingId: uuid('billing_id').references(() => dealBilling.id, { onDelete: 'cascade' }).notNull(),
  name: text('name').notNull(),
  amount: numeric('amount').notNull(),
  percentage: numeric('percentage'), // auto-calc: (amount / total) * 100
  sortOrder: integer('sort_order').default(0).notNull(),
  isPaid: boolean('is_paid').default(false).notNull(),
  paidAt: timestamp('paid_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})
