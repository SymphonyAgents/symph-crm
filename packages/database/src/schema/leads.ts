import { pgTable, uuid, text, integer, timestamp, jsonb, index } from 'drizzle-orm/pg-core'
import { workspaces } from './workspaces'
import { users } from './users'
import { companies } from './companies'
import { contacts } from './contacts'

export const LEAD_STATUSES = ['new', 'reviewing', 'contacted', 'interested', 'not_fit', 'duplicate', 'converted'] as const
export type LeadStatus = typeof LEAD_STATUSES[number]

export const leads = pgTable('leads', {
  id: uuid('id').defaultRandom().primaryKey(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),

  sourceName: text('source_name').notNull().default('manual'),
  sourceFileName: text('source_file_name'),
  sourceRowNumber: integer('source_row_number'),

  segment: text('segment'),
  personName: text('person_name'),
  personTitle: text('person_title'),
  companyName: text('company_name'),
  industry: text('industry'),
  companySize: text('company_size'),
  location: text('location'),
  email: text('email'),
  emailStatus: text('email_status'),
  linkedinUrl: text('linkedin_url'),
  phone: text('phone'),

  status: text('status', { enum: LEAD_STATUSES }).notNull().default('new'),
  score: integer('score').notNull().default(0),
  notes: text('notes'),
  rawPayload: jsonb('raw_payload').$type<Record<string, unknown>>(),

  matchedCompanyId: uuid('matched_company_id').references(() => companies.id, { onDelete: 'set null' }),
  matchedContactId: uuid('matched_contact_id').references(() => contacts.id, { onDelete: 'set null' }),

  createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  workspaceIdx: index('leads_workspace_idx').on(t.workspaceId),
  workspaceStatusIdx: index('leads_workspace_status_idx').on(t.workspaceId, t.status),
  emailIdx: index('leads_email_idx').on(t.email),
  companyNameIdx: index('leads_company_name_idx').on(t.companyName),
  sourceNameIdx: index('leads_source_name_idx').on(t.sourceName),
  matchedCompanyIdx: index('leads_matched_company_idx').on(t.matchedCompanyId),
  matchedContactIdx: index('leads_matched_contact_idx').on(t.matchedContactId),
}))
