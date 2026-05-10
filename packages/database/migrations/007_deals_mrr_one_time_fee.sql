-- Migration 007: Add one_time_fee and mrr fields to deals
-- Project-based deals use `value` (total deal size, divided into monthly revenue in forecast)
-- Startup/HireAI deals use `one_time_fee` (setup/onboarding) + `mrr` (monthly recurring)

ALTER TABLE deals ADD COLUMN IF NOT EXISTS one_time_fee numeric;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS mrr numeric;
