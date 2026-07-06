CREATE TABLE IF NOT EXISTS "deal_intelligence" (
  "deal_id" uuid PRIMARY KEY REFERENCES "deals"("id") ON DELETE CASCADE,
  "workspace_id" uuid REFERENCES "workspaces"("id"),
  "temperature" text,
  "temperature_score" integer,
  "temperature_breakdown" jsonb,
  "temperature_source" text,
  "temperature_reason" text,
  "temperature_updated_at" timestamp with time zone,
  "temperature_updated_by" text REFERENCES "users"("id"),
  "ai_temperature" text,
  "ai_temperature_score" integer,
  "ai_temperature_breakdown" jsonb,
  "ai_temperature_reason" text,
  "ai_evidence_hash" text,
  "ai_updated_at" timestamp with time zone,
  "next_step" text,
  "next_step_target_date" date,
  "next_step_source" text,
  "next_step_reason" text,
  "next_step_updated_at" timestamp with time zone,
  "next_step_updated_by" text REFERENCES "users"("id"),
  "ai_next_step" text,
  "ai_next_step_target_date" date,
  "ai_next_step_reason" text,
  "ai_next_step_updated_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "deal_intelligence_temperature_check" CHECK ("temperature" IS NULL OR "temperature" IN ('cold', 'cool', 'warm', 'hot')),
  CONSTRAINT "deal_intelligence_ai_temperature_check" CHECK ("ai_temperature" IS NULL OR "ai_temperature" IN ('cold', 'cool', 'warm', 'hot')),
  CONSTRAINT "deal_intelligence_temperature_source_check" CHECK ("temperature_source" IS NULL OR "temperature_source" IN ('manual', 'ai')),
  CONSTRAINT "deal_intelligence_next_step_source_check" CHECK ("next_step_source" IS NULL OR "next_step_source" IN ('manual', 'ai')),
  CONSTRAINT "deal_intelligence_temperature_score_check" CHECK ("temperature_score" IS NULL OR ("temperature_score" >= 0 AND "temperature_score" <= 100)),
  CONSTRAINT "deal_intelligence_ai_temperature_score_check" CHECK ("ai_temperature_score" IS NULL OR ("ai_temperature_score" >= 0 AND "ai_temperature_score" <= 100))
);

CREATE INDEX IF NOT EXISTS "deal_intelligence_workspace_idx" ON "deal_intelligence" ("workspace_id");
CREATE INDEX IF NOT EXISTS "deal_intelligence_temperature_score_idx" ON "deal_intelligence" ("temperature_score");
CREATE INDEX IF NOT EXISTS "deal_intelligence_ai_evidence_hash_idx" ON "deal_intelligence" ("ai_evidence_hash");

CREATE TABLE IF NOT EXISTS "deal_intelligence_evaluation_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid REFERENCES "workspaces"("id"),
  "status" text DEFAULT 'pending' NOT NULL,
  "trigger" text DEFAULT 'scheduled' NOT NULL,
  "started_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "error" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "deal_intelligence_runs_status_check" CHECK ("status" IN ('pending', 'running', 'completed', 'failed')),
  CONSTRAINT "deal_intelligence_runs_trigger_check" CHECK ("trigger" IN ('scheduled', 'manual'))
);

CREATE INDEX IF NOT EXISTS "deal_intelligence_runs_workspace_status_idx" ON "deal_intelligence_evaluation_runs" ("workspace_id", "status");

CREATE TABLE IF NOT EXISTS "deal_intelligence_evaluation_jobs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid REFERENCES "workspaces"("id"),
  "run_id" uuid REFERENCES "deal_intelligence_evaluation_runs"("id") ON DELETE CASCADE,
  "deal_id" uuid REFERENCES "deals"("id") ON DELETE CASCADE,
  "status" text DEFAULT 'pending' NOT NULL,
  "evidence_hash" text,
  "aria_session_id" text,
  "attempt_count" integer DEFAULT 0 NOT NULL,
  "locked_at" timestamp with time zone,
  "locked_by" text,
  "next_attempt_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "error" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "deal_intelligence_jobs_status_check" CHECK ("status" IN ('pending', 'processing', 'completed', 'failed', 'skipped'))
);

CREATE INDEX IF NOT EXISTS "deal_intelligence_jobs_workspace_status_next_attempt_idx" ON "deal_intelligence_evaluation_jobs" ("workspace_id", "status", "next_attempt_at");
CREATE INDEX IF NOT EXISTS "deal_intelligence_jobs_deal_idx" ON "deal_intelligence_evaluation_jobs" ("deal_id");
CREATE INDEX IF NOT EXISTS "deal_intelligence_jobs_run_idx" ON "deal_intelligence_evaluation_jobs" ("run_id");
