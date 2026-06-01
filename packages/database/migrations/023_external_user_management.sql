ALTER TABLE users
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_role_check;

UPDATE users
SET status = 'active'
WHERE status IS NULL;

UPDATE users
SET is_active = true
WHERE is_active IS NULL;
