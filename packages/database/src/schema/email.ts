import { pgTable, uuid, text, timestamp, jsonb, uniqueIndex, index } from 'drizzle-orm/pg-core'
import { workspaces } from './workspaces'
import { deals } from './deals'
import { companies } from './companies'
import { contacts } from './contacts'
import { users } from './users'

export const gmailMailboxStates = pgTable('gmail_mailbox_states', {
  id: uuid('id').defaultRandom().primaryKey(),
  workspaceId: uuid('workspace_id').references(() => workspaces.id, { onDelete: 'cascade' }),
  mailbox: text('mailbox').notNull(),
  historyId: text('history_id'),
  lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
  lastError: text('last_error'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  mailboxIdx: uniqueIndex('gmail_mailbox_states_mailbox_idx').on(t.mailbox),
}))

export const emailThreads = pgTable('email_threads', {
  id: uuid('id').defaultRandom().primaryKey(),
  workspaceId: uuid('workspace_id').references(() => workspaces.id, { onDelete: 'cascade' }),
  mailbox: text('mailbox').notNull(),
  sourceRecipients: text('source_recipients').array().default([]).notNull(),
  gmailThreadId: text('gmail_thread_id').notNull(),
  latestGmailMessageId: text('latest_gmail_message_id'),
  latestProcessedGmailMessageId: text('latest_processed_gmail_message_id'),
  subject: text('subject'),
  snippet: text('snippet'),
  classification: text('classification', {
    enum: [
      'new_inbound_lead',
      'existing_deal_update',
      'needs_review',
      'internal_only',
      'vendor_sales',
      'newsletter_or_automation',
      'job_or_recruiting',
      'billing_or_admin',
    ],
  }).notNull().default('needs_review'),
  confidence: text('confidence'),
  status: text('status', {
    enum: ['new', 'processed', 'needs_review', 'ignored', 'failed'],
  }).notNull().default('new'),
  summary: text('summary'),
  dealId: uuid('deal_id').references(() => deals.id, { onDelete: 'set null' }),
  companyId: uuid('company_id').references(() => companies.id, { onDelete: 'set null' }),
  contactId: uuid('contact_id').references(() => contacts.id, { onDelete: 'set null' }),
  draftStatus: text('draft_status', {
    enum: ['none', 'creating', 'created', 'failed'],
  }).notNull().default('none'),
  draftGmailId: text('draft_gmail_id'),
  draftForGmailMessageId: text('draft_for_gmail_message_id'),
  draftLockUntil: timestamp('draft_lock_until', { withTimezone: true }),
  lastError: text('last_error'),
  rawClassification: jsonb('raw_classification').$type<Record<string, unknown>>(),
  firstMessageAt: timestamp('first_message_at', { withTimezone: true }),
  latestMessageAt: timestamp('latest_message_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  mailboxThreadIdx: uniqueIndex('email_threads_mailbox_thread_idx').on(t.mailbox, t.gmailThreadId),
  workspaceStatusIdx: index('email_threads_workspace_status_idx').on(t.workspaceId, t.status),
  classificationIdx: index('email_threads_classification_idx').on(t.classification),
  dealIdx: index('email_threads_deal_id_idx').on(t.dealId),
  companyIdx: index('email_threads_company_id_idx').on(t.companyId),
  contactIdx: index('email_threads_contact_id_idx').on(t.contactId),
}))

export const emailMessages = pgTable('email_messages', {
  id: uuid('id').defaultRandom().primaryKey(),
  workspaceId: uuid('workspace_id').references(() => workspaces.id, { onDelete: 'cascade' }),
  emailThreadId: uuid('email_thread_id').references(() => emailThreads.id, { onDelete: 'cascade' }),
  mailbox: text('mailbox').notNull(),
  gmailThreadId: text('gmail_thread_id').notNull(),
  gmailMessageId: text('gmail_message_id').notNull(),
  rfcMessageId: text('rfc_message_id'),
  inReplyTo: text('in_reply_to'),
  referencesHeader: text('references_header'),
  subject: text('subject'),
  fromName: text('from_name'),
  fromEmail: text('from_email'),
  toEmails: text('to_emails').array().default([]).notNull(),
  ccEmails: text('cc_emails').array().default([]).notNull(),
  deliveredToEmails: text('delivered_to_emails').array().default([]).notNull(),
  sourceRecipients: text('source_recipients').array().default([]).notNull(),
  direction: text('direction', { enum: ['inbound', 'outbound', 'internal'] }).notNull().default('inbound'),
  bodyText: text('body_text'),
  bodyHtml: text('body_html'),
  snippet: text('snippet'),
  labels: text('labels').array().default([]).notNull(),
  rawHeaders: jsonb('raw_headers').$type<Record<string, string>>(),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  mailboxMessageIdx: uniqueIndex('email_messages_mailbox_message_idx').on(t.mailbox, t.gmailMessageId),
  threadIdx: index('email_messages_thread_id_idx').on(t.emailThreadId),
  dealThreadIdx: index('email_messages_gmail_thread_idx').on(t.mailbox, t.gmailThreadId),
  sentAtIdx: index('email_messages_sent_at_idx').on(t.sentAt),
}))

export const followUpReminders = pgTable('follow_up_reminders', {
  id: uuid('id').defaultRandom().primaryKey(),
  workspaceId: uuid('workspace_id').references(() => workspaces.id, { onDelete: 'cascade' }),
  dealId: uuid('deal_id').references(() => deals.id, { onDelete: 'cascade' }),
  emailThreadId: uuid('email_thread_id').references(() => emailThreads.id, { onDelete: 'set null' }),
  assignedTo: text('assigned_to').references(() => users.id),
  remindAt: timestamp('remind_at', { withTimezone: true }).notNull(),
  status: text('status', { enum: ['pending', 'completed', 'snoozed', 'cancelled'] }).notNull().default('pending'),
  reason: text('reason').notNull(),
  idempotencyKey: text('idempotency_key').notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  snoozedFrom: timestamp('snoozed_from', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  idempotencyIdx: uniqueIndex('follow_up_reminders_idempotency_idx').on(t.idempotencyKey),
  dealIdx: index('follow_up_reminders_deal_id_idx').on(t.dealId),
  emailThreadIdx: index('follow_up_reminders_email_thread_id_idx').on(t.emailThreadId),
  statusRemindAtIdx: index('follow_up_reminders_status_remind_at_idx').on(t.status, t.remindAt),
}))
