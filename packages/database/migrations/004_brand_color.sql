-- Migration 004: Add proposal_link (re-add, dropped in 002) and client_brand_color
-- Run manually: psql $DATABASE_URL -f migrations/004_brand_color.sql

ALTER TABLE deals ADD COLUMN IF NOT EXISTS proposal_link text;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS client_brand_color text;
