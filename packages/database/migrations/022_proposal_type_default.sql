-- Migration 022: Make formal the default proposal type
-- Run manually: psql $DATABASE_URL -f migrations/022_proposal_type_default.sql

UPDATE proposals
SET type = 'formal'
WHERE type IS NULL;

ALTER TABLE proposals
  ALTER COLUMN type SET DEFAULT 'formal';

ALTER TABLE proposals
  ALTER COLUMN type SET NOT NULL;
