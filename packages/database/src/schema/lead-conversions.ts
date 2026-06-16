import { pgTable, uuid, text, timestamp, index } from 'drizzle-orm/pg-core'
import { workspaces } from './workspaces'
import { leads } from './leads'
import { companies } from './companies'
import { contacts } from './contacts'
import { deals } from './deals'
import { users } from './users'

export const leadConversions = pgTable('lead_conversions', {
  id: uuid('id').defaultRandom().primaryKey(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),

  leadId: uuid('lead_id').notNull().references(() => leads.id, { onDelete: 'cascade' }),
  companyId: uuid('company_id').references(() => companies.id, { onDelete: 'set null' }),
  contactId: uuid('contact_id').references(() => contacts.id, { onDelete: 'set null' }),
  dealId: uuid('deal_id').references(() => deals.id, { onDelete: 'set null' }),

  convertedBy: text('converted_by').references(() => users.id, { onDelete: 'set null' }),
  conversionNotes: text('conversion_notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  workspaceIdx: index('lead_conversions_workspace_idx').on(t.workspaceId),
  leadIdx: index('lead_conversions_lead_idx').on(t.leadId),
  dealIdx: index('lead_conversions_deal_idx').on(t.dealId),
  companyIdx: index('lead_conversions_company_idx').on(t.companyId),
  contactIdx: index('lead_conversions_contact_idx').on(t.contactId),
}))
