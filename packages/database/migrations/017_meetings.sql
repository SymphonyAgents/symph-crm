CREATE TABLE IF NOT EXISTS meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  source_meeting_id TEXT NOT NULL,
  source_url TEXT NOT NULL,
  title TEXT NOT NULL,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  attendees TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'done', 'failed')),
  last_error TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  summary_note_path TEXT,
  transcript_note_path TEXT,
  ingested_at TIMESTAMPTZ,
  raw_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS meetings_source_meeting_id_idx
  ON meetings(source_meeting_id);

CREATE INDEX IF NOT EXISTS meetings_workspace_status_idx
  ON meetings(workspace_id, status);

CREATE INDEX IF NOT EXISTS meetings_deal_id_idx
  ON meetings(deal_id);

ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
