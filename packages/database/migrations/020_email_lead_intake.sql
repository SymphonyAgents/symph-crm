-- Shared-inbox lead intake storage.
-- Gmail drafts are allowed; sends are intentionally not represented here.

CREATE TABLE IF NOT EXISTS gmail_mailbox_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  mailbox TEXT NOT NULL,
  history_id TEXT,
  last_synced_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT gmail_mailbox_states_mailbox_unique UNIQUE (mailbox)
);

CREATE TABLE IF NOT EXISTS email_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  mailbox TEXT NOT NULL,
  source_recipients TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  gmail_thread_id TEXT NOT NULL,
  latest_gmail_message_id TEXT,
  latest_processed_gmail_message_id TEXT,
  subject TEXT,
  snippet TEXT,
  classification TEXT NOT NULL DEFAULT 'needs_review',
  confidence TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  summary TEXT,
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  draft_status TEXT NOT NULL DEFAULT 'none',
  draft_gmail_id TEXT,
  draft_for_gmail_message_id TEXT,
  draft_lock_until TIMESTAMPTZ,
  last_error TEXT,
  raw_classification JSONB,
  first_message_at TIMESTAMPTZ,
  latest_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT email_threads_mailbox_thread_unique UNIQUE (mailbox, gmail_thread_id),
  CONSTRAINT email_threads_classification_check CHECK (classification IN (
    'new_inbound_lead',
    'existing_deal_update',
    'needs_review',
    'internal_only',
    'vendor_sales',
    'newsletter_or_automation',
    'job_or_recruiting',
    'billing_or_admin'
  )),
  CONSTRAINT email_threads_status_check CHECK (status IN ('new', 'processed', 'needs_review', 'ignored', 'failed')),
  CONSTRAINT email_threads_draft_status_check CHECK (draft_status IN ('none', 'creating', 'created', 'failed'))
);

CREATE TABLE IF NOT EXISTS email_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  email_thread_id UUID REFERENCES email_threads(id) ON DELETE CASCADE,
  mailbox TEXT NOT NULL,
  gmail_thread_id TEXT NOT NULL,
  gmail_message_id TEXT NOT NULL,
  rfc_message_id TEXT,
  in_reply_to TEXT,
  references_header TEXT,
  subject TEXT,
  from_name TEXT,
  from_email TEXT,
  to_emails TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  cc_emails TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  delivered_to_emails TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  source_recipients TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  direction TEXT NOT NULL DEFAULT 'inbound',
  body_text TEXT,
  body_html TEXT,
  snippet TEXT,
  labels TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  raw_headers JSONB,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT email_messages_mailbox_message_unique UNIQUE (mailbox, gmail_message_id),
  CONSTRAINT email_messages_direction_check CHECK (direction IN ('inbound', 'outbound', 'internal'))
);

CREATE TABLE IF NOT EXISTS follow_up_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
  email_thread_id UUID REFERENCES email_threads(id) ON DELETE SET NULL,
  assigned_to TEXT REFERENCES users(id),
  remind_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  reason TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  completed_at TIMESTAMPTZ,
  snoozed_from TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT follow_up_reminders_idempotency_unique UNIQUE (idempotency_key),
  CONSTRAINT follow_up_reminders_status_check CHECK (status IN ('pending', 'completed', 'snoozed', 'cancelled'))
);

CREATE UNIQUE INDEX IF NOT EXISTS gmail_mailbox_states_mailbox_idx
  ON gmail_mailbox_states (mailbox);

CREATE UNIQUE INDEX IF NOT EXISTS email_threads_mailbox_thread_idx
  ON email_threads (mailbox, gmail_thread_id);
CREATE INDEX IF NOT EXISTS email_threads_workspace_status_idx
  ON email_threads (workspace_id, status);
CREATE INDEX IF NOT EXISTS email_threads_classification_idx
  ON email_threads (classification);
CREATE INDEX IF NOT EXISTS email_threads_deal_id_idx
  ON email_threads (deal_id);
CREATE INDEX IF NOT EXISTS email_threads_company_id_idx
  ON email_threads (company_id);
CREATE INDEX IF NOT EXISTS email_threads_contact_id_idx
  ON email_threads (contact_id);

CREATE UNIQUE INDEX IF NOT EXISTS email_messages_mailbox_message_idx
  ON email_messages (mailbox, gmail_message_id);
CREATE INDEX IF NOT EXISTS email_messages_thread_id_idx
  ON email_messages (email_thread_id);
CREATE INDEX IF NOT EXISTS email_messages_gmail_thread_idx
  ON email_messages (mailbox, gmail_thread_id);
CREATE INDEX IF NOT EXISTS email_messages_sent_at_idx
  ON email_messages (sent_at);

CREATE UNIQUE INDEX IF NOT EXISTS follow_up_reminders_idempotency_idx
  ON follow_up_reminders (idempotency_key);
CREATE INDEX IF NOT EXISTS follow_up_reminders_deal_id_idx
  ON follow_up_reminders (deal_id);
CREATE INDEX IF NOT EXISTS follow_up_reminders_email_thread_id_idx
  ON follow_up_reminders (email_thread_id);
CREATE INDEX IF NOT EXISTS follow_up_reminders_status_remind_at_idx
  ON follow_up_reminders (status, remind_at);
