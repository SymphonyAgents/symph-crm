DROP TABLE IF EXISTS change_logs;

ALTER TABLE users DROP COLUMN IF EXISTS changelog_acked_at;
