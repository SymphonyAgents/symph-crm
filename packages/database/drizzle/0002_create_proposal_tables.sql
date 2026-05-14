-- Create dedicated proposal tables.
-- These were previously created at API boot by ProposalsService.onModuleInit().
-- Keep this migration idempotent so environments that already boot-created
-- the tables can still adopt the normal Drizzle migration path cleanly.

CREATE TABLE IF NOT EXISTS proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id),
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  current_version INTEGER NOT NULL DEFAULT 1,
  is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS proposal_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  html TEXT NOT NULL,
  change_note TEXT,
  excerpt TEXT,
  word_count INTEGER DEFAULT 0,
  pdf_storage_path TEXT,
  author_id TEXT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS proposal_share_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_version_id UUID NOT NULL REFERENCES proposal_versions(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ,
  view_count INTEGER NOT NULL DEFAULT 0,
  last_viewed_at TIMESTAMPTZ,
  created_by TEXT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS proposal_versions_proposal_id_version_key
  ON proposal_versions(proposal_id, version);

CREATE INDEX IF NOT EXISTS idx_proposal_versions_proposal
  ON proposal_versions(proposal_id);

CREATE INDEX IF NOT EXISTS idx_share_links_version
  ON proposal_share_links(proposal_version_id)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_share_links_token
  ON proposal_share_links(token)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_proposals_deal
  ON proposals(deal_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_proposals_updated
  ON proposals(updated_at DESC)
  WHERE deleted_at IS NULL;
