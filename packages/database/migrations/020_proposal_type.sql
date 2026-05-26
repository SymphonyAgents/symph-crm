-- Migration 020: Add nullable proposal type
-- Run manually: psql $DATABASE_URL -f migrations/020_proposal_type.sql

ALTER TABLE proposals
  ADD COLUMN IF NOT EXISTS type text;

ALTER TABLE proposals
  ALTER COLUMN type DROP DEFAULT;

ALTER TABLE proposals
  ALTER COLUMN type DROP NOT NULL;

DO $$ BEGIN
  ALTER TABLE proposals
    ADD CONSTRAINT proposals_type_check
    CHECK (type IS NULL OR type IN ('presentation', 'formal'));
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
