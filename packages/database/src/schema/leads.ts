import { integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { companies } from './companies'
import { contacts } from './contacts'
import { deals } from './deals'
import { users } from './users'
import { workspaces } from './workspaces'

export const leads = pgTable('leads', {
  id: uuid('id').defaultRandom().primaryKey(),
  workspaceId: uuid('workspace_id').references(() => workspaces.id),
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
  status: text('status', {
    enum: [
      'to_contact',
      'contacted',
      'followed_up',
      'lost',
      'converted',
    ],
  }).notNull().default('to_contact'),
  followUpCount: integer('follow_up_count').notNull().default(0),
  score: integer('score').notNull().default(0),
  notes: text('notes'),
  rawPayload: jsonb('raw_payload').$type<Record<string, unknown>>(),
  matchedCompanyId: uuid('matched_company_id').references(() => companies.id),
  matchedContactId: uuid('matched_contact_id').references(() => contacts.id),
  createdBy: text('created_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const leadConversions = pgTable('lead_conversions', {
  id: uuid('id').defaultRandom().primaryKey(),
  workspaceId: uuid('workspace_id').references(() => workspaces.id),
  leadId: uuid('lead_id').references(() => leads.id),
  companyId: uuid('company_id').references(() => companies.id),
  contactId: uuid('contact_id').references(() => contacts.id),
  dealId: uuid('deal_id').references(() => deals.id),
  convertedBy: text('converted_by').references(() => users.id),
  conversionNotes: text('conversion_notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})
