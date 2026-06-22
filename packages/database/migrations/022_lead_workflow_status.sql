-- Manual Supabase patch. Not executed by drizzle-kit migrate.
-- Applied manually to the active Supabase database on 2026-06-22.
-- Standardize lead workflow statuses and track follow-up attempts.

DO $$
DECLARE
  check_constraint_name text;
BEGIN
  IF to_regclass('public.leads') IS NULL THEN
    RETURN;
  END IF;

  ALTER TABLE leads
    ADD COLUMN IF NOT EXISTS follow_up_count integer NOT NULL DEFAULT 0;

  ALTER TABLE leads
    ALTER COLUMN status SET DEFAULT 'to_contact';

  FOR check_constraint_name IN
    SELECT constraint_row.conname
    FROM pg_constraint constraint_row
    JOIN pg_attribute attribute_row
      ON attribute_row.attrelid = constraint_row.conrelid
      AND attribute_row.attnum = ANY(constraint_row.conkey)
    WHERE constraint_row.conrelid = 'public.leads'::regclass
      AND constraint_row.contype = 'c'
      AND attribute_row.attname = 'status'
  LOOP
    EXECUTE format('ALTER TABLE leads DROP CONSTRAINT %I', check_constraint_name);
  END LOOP;

  UPDATE leads
  SET
    status = CASE status
      WHEN 'new' THEN 'to_contact'
      WHEN 'reviewing' THEN 'to_contact'
      WHEN 'interested' THEN 'contacted'
      WHEN 'not_fit' THEN 'lost'
      WHEN 'duplicate' THEN 'lost'
      WHEN 'to_contact' THEN status
      WHEN 'contacted' THEN status
      WHEN 'followed_up' THEN status
      WHEN 'lost' THEN status
      WHEN 'converted' THEN status
      ELSE 'to_contact'
    END,
    follow_up_count = CASE
      WHEN status = 'followed_up' THEN LEAST(GREATEST(follow_up_count, 1), 5)
      ELSE 0
    END
  WHERE status NOT IN ('to_contact', 'contacted', 'followed_up', 'lost', 'converted')
     OR status = 'followed_up'
     OR follow_up_count < 0
     OR follow_up_count > 5;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.leads'::regclass
      AND conname = 'leads_status_check'
  ) THEN
    ALTER TABLE leads
      ADD CONSTRAINT leads_status_check
      CHECK (status IN ('to_contact', 'contacted', 'followed_up', 'lost', 'converted'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.leads'::regclass
      AND conname = 'leads_follow_up_count_check'
  ) THEN
    ALTER TABLE leads
      ADD CONSTRAINT leads_follow_up_count_check
      CHECK (follow_up_count BETWEEN 0 AND 5);
  END IF;
END $$;
