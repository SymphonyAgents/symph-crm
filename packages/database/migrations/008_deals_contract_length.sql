-- Migration 008: Add contract_length (months) to deals
-- Used to compute value = one_time_fee + (mrr * contract_length)
ALTER TABLE deals ADD COLUMN IF NOT EXISTS contract_length integer;
