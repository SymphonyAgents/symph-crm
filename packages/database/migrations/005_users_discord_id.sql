-- Migration 005: Add discord_id to users for Discord ↔ CRM account linking
-- Run manually: psql $DATABASE_URL -f migrations/005_users_discord_id.sql

ALTER TABLE users ADD COLUMN IF NOT EXISTS discord_id text UNIQUE;
CREATE INDEX IF NOT EXISTS users_discord_id_idx ON users (discord_id) WHERE discord_id IS NOT NULL;
