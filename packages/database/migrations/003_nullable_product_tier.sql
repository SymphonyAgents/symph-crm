-- Migration 003: Make product_id and tier_id nullable on deals
-- These fields are no longer required in the deal creation flow.
ALTER TABLE deals ALTER COLUMN product_id DROP NOT NULL;
ALTER TABLE deals ALTER COLUMN tier_id DROP NOT NULL;
