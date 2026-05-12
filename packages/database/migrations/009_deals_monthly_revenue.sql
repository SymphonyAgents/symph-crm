-- Migration 009: Add monthly_revenue jsonb to deals
-- Stores per-month revenue overrides: { "2026-05": 500000, "2026-06": 300000, ... }
-- When set, Revenue page uses per-month values instead of flat MRR
ALTER TABLE deals ADD COLUMN IF NOT EXISTS monthly_revenue jsonb;
