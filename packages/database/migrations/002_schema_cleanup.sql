-- =============================================================================
-- Migration 002: Schema cleanup — remove denormalized columns, add proper FKs
-- Run manually: psql $DATABASE_URL -f migrations/002_schema_cleanup.sql
--
-- What this does:
--   1. Wipe dev data (deals, pitch_decks, deal-related activities)
--   2. Drop denormalized / redundant columns from deals
--   3. Add FK columns: stage_id, am_roster_id, build_assigned_to (FK)
--   4. Update pitch_decks: drop content jsonb, add storage_path + deal_id
--   5. Update contacts: drop inline notes text
--   7. Create deal_contacts junction table
--   8. Seed pipeline_stages with default stages for the default workspace
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Wipe dev data
-- ---------------------------------------------------------------------------

DELETE FROM activities;
DELETE FROM chat_messages;
DELETE FROM chat_sessions;
DELETE FROM documents;
DELETE FROM files;
DELETE FROM pitch_decks;
DELETE FROM deals;

-- ---------------------------------------------------------------------------
-- 2. Drop denormalized columns from deals
-- ---------------------------------------------------------------------------

ALTER TABLE deals
  DROP COLUMN IF EXISTS stage,
  DROP COLUMN IF EXISTS accounts_manager_name,
  DROP COLUMN IF EXISTS sales_notes,
  DROP COLUMN IF EXISTS build_notes,
  DROP COLUMN IF EXISTS proposal_link,
  DROP COLUMN IF EXISTS pricing_model,
  DROP COLUMN IF EXISTS poc_contact_id,
  DROP COLUMN IF EXISTS engagement_model;

-- ---------------------------------------------------------------------------
-- 3. Add new FK columns to deals
-- ---------------------------------------------------------------------------

-- Pipeline stage (replaces hardcoded stage enum)
ALTER TABLE deals
  ADD COLUMN IF NOT EXISTS stage_id UUID REFERENCES pipeline_stages(id);

-- Account manager (replaces freetext accounts_manager_name)
ALTER TABLE deals
  ADD COLUMN IF NOT EXISTS am_roster_id UUID REFERENCES am_roster(id);

-- Build assignment — FK to users (replaces freetext build_assigned_to)
-- Drop the existing text column first, then re-add as a FK
ALTER TABLE deals
  DROP COLUMN IF EXISTS build_assigned_to;

ALTER TABLE deals
  ADD COLUMN IF NOT EXISTS build_assigned_to TEXT REFERENCES users(id);

-- ---------------------------------------------------------------------------
-- 4. Update pitch_decks
-- ---------------------------------------------------------------------------

-- Drop inline content (files go in Supabase Storage)
ALTER TABLE pitch_decks
  DROP COLUMN IF EXISTS content;

-- Add storage path (path inside Supabase Storage `content` bucket)
ALTER TABLE pitch_decks
  ADD COLUMN IF NOT EXISTS storage_path TEXT;

-- Link pitch deck to a deal (nullable — can be company-level)
ALTER TABLE pitch_decks
  ADD COLUMN IF NOT EXISTS deal_id UUID REFERENCES deals(id);

-- ---------------------------------------------------------------------------
-- 6. Update contacts — drop inline notes (go in documents / storage)
-- ---------------------------------------------------------------------------

ALTER TABLE contacts
  DROP COLUMN IF EXISTS notes;

-- ---------------------------------------------------------------------------
-- 7. Create deal_contacts junction table
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS deal_contacts (
  deal_id    UUID NOT NULL REFERENCES deals(id)    ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  role       TEXT NOT NULL DEFAULT 'stakeholder'
               CHECK (role IN ('poc', 'stakeholder', 'champion', 'blocker', 'technical', 'executive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (deal_id, contact_id)
);

-- ---------------------------------------------------------------------------
-- 8. Seed default pipeline_stages for the default workspace
--    (idempotent — won't duplicate if already present)
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  ws_id UUID := '60f84f03-283e-4c1a-8c88-b8330dc71d32';
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pipeline_stages WHERE workspace_id = ws_id LIMIT 1
  ) THEN
    INSERT INTO pipeline_stages (workspace_id, slug, label, color, sort_order) VALUES
      (ws_id, 'lead',          'Lead',             '#94a3b8', 0),
      (ws_id, 'discovery',     'Discovery',        '#8b5cf6', 1),
      (ws_id, 'assessment',    'Assessment',       '#3b82f6', 2),
      (ws_id, 'proposal_demo', 'Proposal and Demo','#f59e0b', 3),
      (ws_id, 'followup',      'Follow-up',        '#10b981', 4),
      (ws_id, 'closed_won',    'Close Won',        '#22c55e', 5),
      (ws_id, 'closed_lost',   'Close Lost',       '#ef4444', 6);
  END IF;
END $$;

COMMIT;
