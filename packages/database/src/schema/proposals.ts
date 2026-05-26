import { pgTable, uuid, text, integer, boolean, timestamp } from 'drizzle-orm/pg-core'
import { workspaces } from './workspaces'
import { deals } from './deals'
import { users } from './users'

export const PROPOSAL_TYPES = ['presentation', 'formal'] as const
export type ProposalType = typeof PROPOSAL_TYPES[number]

/**
 * proposals — chain identity for a versioned proposal document.
 *
 * One row per proposal (the "chain"). Each version of the HTML lives in
 * `proposal_versions`. Title, deal binding, pin state, and soft-delete live
 * here so they apply to the whole chain regardless of which version is
 * being viewed.
 *
 * NOTE: Proposals deliberately do NOT use the `documents` table. `documents`
 * is for AI-consumed long-form content (context.md, transcripts) stored on
 * NFS so Aria can grep the filesystem. Proposals are discrete versioned
 * client-facing artifacts; HTML lives inline in `proposal_versions.html`
 * for atomicity and operational simplicity.
 */
export const proposals = pgTable('proposals', {
  id: uuid('id').defaultRandom().primaryKey(),

  workspaceId: uuid('workspace_id').references(() => workspaces.id),
  dealId: uuid('deal_id').references(() => deals.id, { onDelete: 'set null' }),

  title: text('title').notNull(),
  type: text('type', { enum: PROPOSAL_TYPES }),

  // Denormalized counter — equals MAX(proposal_versions.version) for this proposal.
  // Used as the basis for the next version number on save (with FOR UPDATE locking).
  currentVersion: integer('current_version').default(1).notNull(),

  isPinned: boolean('is_pinned').default(false).notNull(),

  createdBy: text('created_by').references(() => users.id).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
})
