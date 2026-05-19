import { pgTable, uuid, text, integer, timestamp, jsonb, uniqueIndex, index } from 'drizzle-orm/pg-core'
import { workspaces } from './workspaces'
import { deals } from './deals'

export const meetings = pgTable('meetings', {
  id: uuid('id').defaultRandom().primaryKey(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  dealId: uuid('deal_id').references(() => deals.id, { onDelete: 'set null' }),

  sourceMeetingId: text('source_meeting_id').notNull(),
  sourceUrl: text('source_url').notNull(),
  title: text('title').notNull(),
  startedAt: timestamp('started_at', { withTimezone: true }),
  endedAt: timestamp('ended_at', { withTimezone: true }),
  attendees: text('attendees').array().default([]).notNull(),

  status: text('status', { enum: ['pending', 'done', 'failed'] }).notNull().default('pending'),
  lastError: text('last_error'),
  retryCount: integer('retry_count').notNull().default(0),

  summaryNotePath: text('summary_note_path'),
  transcriptNotePath: text('transcript_note_path'),
  ingestedAt: timestamp('ingested_at', { withTimezone: true }),
  rawPayload: jsonb('raw_payload').$type<Record<string, unknown>>(),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  sourceMeetingIdIdx: uniqueIndex('meetings_source_meeting_id_idx').on(t.sourceMeetingId),
  workspaceStatusIdx: index('meetings_workspace_status_idx').on(t.workspaceId, t.status),
  dealIdx: index('meetings_deal_id_idx').on(t.dealId),
}))
