-- Soft-delete support for deals. Normal CRM views filter deleted_at IS NULL.

ALTER TABLE deals
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by TEXT REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS delete_after TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_deals_active_created_at
  ON deals (created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_deals_trash_delete_after
  ON deals (delete_after ASC)
  WHERE deleted_at IS NOT NULL;
