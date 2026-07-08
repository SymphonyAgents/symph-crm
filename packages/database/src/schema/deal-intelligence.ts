import { date, index, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { deals } from './deals'
import { users } from './users'
import { workspaces } from './workspaces'

export const DEAL_TEMPERATURES = ['cold', 'cool', 'warm', 'hot'] as const
export type DealTemperature = typeof DEAL_TEMPERATURES[number]

export const DEAL_INTELLIGENCE_SOURCES = ['manual', 'ai'] as const
export type DealIntelligenceSource = typeof DEAL_INTELLIGENCE_SOURCES[number]

export const DEAL_INTELLIGENCE_RUN_STATUSES = ['pending', 'running', 'completed', 'failed'] as const
export type DealIntelligenceRunStatus = typeof DEAL_INTELLIGENCE_RUN_STATUSES[number]

export const DEAL_INTELLIGENCE_JOB_STATUSES = ['pending', 'processing', 'completed', 'failed', 'skipped'] as const
export type DealIntelligenceJobStatus = typeof DEAL_INTELLIGENCE_JOB_STATUSES[number]

export const DEAL_INTELLIGENCE_EVALUATION_TRIGGERS = ['scheduled', 'manual'] as const
export type DealIntelligenceEvaluationTrigger = typeof DEAL_INTELLIGENCE_EVALUATION_TRIGGERS[number]

export type DealTemperatureBreakdown = {
  engagement?: number
  intent?: number
  fit?: number
  timing?: number
}

export const dealIntelligence = pgTable('deal_intelligence', {
  dealId: uuid('deal_id').primaryKey().references(() => deals.id, { onDelete: 'cascade' }),
  workspaceId: uuid('workspace_id').references(() => workspaces.id),

  temperature: text('temperature', { enum: DEAL_TEMPERATURES }),
  temperatureScore: integer('temperature_score'),
  temperatureBreakdown: jsonb('temperature_breakdown').$type<DealTemperatureBreakdown>(),
  temperatureSource: text('temperature_source', { enum: DEAL_INTELLIGENCE_SOURCES }),
  temperatureReason: text('temperature_reason'),
  temperatureUpdatedAt: timestamp('temperature_updated_at', { withTimezone: true }),
  temperatureUpdatedBy: text('temperature_updated_by').references(() => users.id),

  aiTemperature: text('ai_temperature', { enum: DEAL_TEMPERATURES }),
  aiTemperatureScore: integer('ai_temperature_score'),
  aiTemperatureBreakdown: jsonb('ai_temperature_breakdown').$type<DealTemperatureBreakdown>(),
  aiTemperatureReason: text('ai_temperature_reason'),
  aiEvidenceHash: text('ai_evidence_hash'),
  aiUpdatedAt: timestamp('ai_updated_at', { withTimezone: true }),

  nextStep: text('next_step'),
  nextStepTargetDate: date('next_step_target_date'),
  nextStepSource: text('next_step_source', { enum: DEAL_INTELLIGENCE_SOURCES }),
  nextStepReason: text('next_step_reason'),
  nextStepUpdatedAt: timestamp('next_step_updated_at', { withTimezone: true }),
  nextStepUpdatedBy: text('next_step_updated_by').references(() => users.id),

  aiNextStep: text('ai_next_step'),
  aiNextStepTargetDate: date('ai_next_step_target_date'),
  aiNextStepReason: text('ai_next_step_reason'),
  aiNextStepUpdatedAt: timestamp('ai_next_step_updated_at', { withTimezone: true }),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, table => ({
  workspaceIdx: index('deal_intelligence_workspace_idx').on(table.workspaceId),
  temperatureScoreIdx: index('deal_intelligence_temperature_score_idx').on(table.temperatureScore),
  aiEvidenceHashIdx: index('deal_intelligence_ai_evidence_hash_idx').on(table.aiEvidenceHash),
}))

export const dealIntelligenceEvaluationRuns = pgTable('deal_intelligence_evaluation_runs', {
  id: uuid('id').defaultRandom().primaryKey(),
  workspaceId: uuid('workspace_id').references(() => workspaces.id),
  status: text('status', { enum: DEAL_INTELLIGENCE_RUN_STATUSES }).notNull().default('pending'),
  trigger: text('trigger', { enum: DEAL_INTELLIGENCE_EVALUATION_TRIGGERS }).notNull().default('scheduled'),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  error: text('error'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, table => ({
  workspaceStatusIdx: index('deal_intelligence_runs_workspace_status_idx').on(table.workspaceId, table.status),
}))

export const dealIntelligenceEvaluationJobs = pgTable('deal_intelligence_evaluation_jobs', {
  id: uuid('id').defaultRandom().primaryKey(),
  workspaceId: uuid('workspace_id').references(() => workspaces.id),
  runId: uuid('run_id').references(() => dealIntelligenceEvaluationRuns.id, { onDelete: 'cascade' }),
  dealId: uuid('deal_id').references(() => deals.id, { onDelete: 'cascade' }),
  status: text('status', { enum: DEAL_INTELLIGENCE_JOB_STATUSES }).notNull().default('pending'),
  evidenceHash: text('evidence_hash'),
  ariaSessionId: text('aria_session_id'),
  attemptCount: integer('attempt_count').notNull().default(0),
  lockedAt: timestamp('locked_at', { withTimezone: true }),
  lockedBy: text('locked_by'),
  nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  error: text('error'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, table => ({
  workspaceStatusNextAttemptIdx: index('deal_intelligence_jobs_workspace_status_next_attempt_idx').on(table.workspaceId, table.status, table.nextAttemptAt),
  dealIdx: index('deal_intelligence_jobs_deal_idx').on(table.dealId),
  runIdx: index('deal_intelligence_jobs_run_idx').on(table.runId),
}))
