-- Migration 021: Add proposal lifecycle status and signed PDF metadata
-- Run manually with psql using the target database connection.

ALTER TABLE proposals
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS signed_at timestamptz,
  ADD COLUMN IF NOT EXISTS signed_pdf_storage_path text,
  ADD COLUMN IF NOT EXISTS signed_pdf_file_name text,
  ADD COLUMN IF NOT EXISTS signed_pdf_mime_type text,
  ADD COLUMN IF NOT EXISTS signed_pdf_size_bytes integer,
  ADD COLUMN IF NOT EXISTS signed_pdf_uploaded_at timestamptz;

DO $$ BEGIN
  ALTER TABLE proposals
    ADD CONSTRAINT proposals_status_check
    CHECK (status IN ('draft', 'sent', 'signed'));
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS idx_proposals_status
  ON proposals(status)
  WHERE deleted_at IS NULL;
