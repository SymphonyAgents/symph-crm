-- Migration 010: Reseller Pipeline
-- Adds deal_type to separate Reseller deals from Agency/HireAI deals
-- Adds cost_price and margin_percent for margin-based revenue calculation
-- Revenue formula: selling_price (value) = cost_price / (1 - margin_percent / 100)

-- Primary separator: 'agency' (default) | 'reseller'
ALTER TABLE deals ADD COLUMN IF NOT EXISTS deal_type text NOT NULL DEFAULT 'agency';

-- Reseller revenue fields
-- cost_price: what Symph pays the vendor (GWS, GCP, Josys)
-- margin_percent: gross margin percentage (0-100)
--   gross margin = (selling_price - cost_price) / selling_price * 100
--   selling_price = cost_price / (1 - margin_percent / 100)
ALTER TABLE deals ADD COLUMN IF NOT EXISTS cost_price numeric;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS margin_percent numeric;

-- Index for fast reseller pipeline queries
CREATE INDEX IF NOT EXISTS idx_deals_deal_type ON deals(deal_type);
