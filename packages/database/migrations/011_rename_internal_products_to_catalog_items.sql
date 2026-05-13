-- Renames internal_products → catalog_items so the table name reflects what
-- it actually holds (full product/service/reseller/partnership catalog).
-- Backfills deals.catalog_item_id on the 77 deals that weren't linked to a
-- catalog row, then locks the column NOT NULL.

-- 1. Rename table + column + FK constraint
ALTER TABLE internal_products RENAME TO catalog_items;
ALTER TABLE deals RENAME COLUMN internal_product_id TO catalog_item_id;
ALTER TABLE deals RENAME CONSTRAINT deals_internal_product_id_fkey TO deals_catalog_item_id_fkey;
ALTER TABLE pitch_decks RENAME COLUMN product_id TO catalog_item_id;
ALTER TABLE customization_requests RENAME COLUMN product_id TO catalog_item_id;

-- 2. Backfill: every deal must point at a catalog row.
-- Reseller deals — derive from services_tags.
UPDATE deals d SET catalog_item_id = ci.id
  FROM catalog_items ci
  WHERE d.catalog_item_id IS NULL AND d.deal_type = 'reseller'
    AND ci.name = 'Google Apigee' AND 'reseller_apigee' = ANY(d.services_tags);

UPDATE deals d SET catalog_item_id = ci.id
  FROM catalog_items ci
  WHERE d.catalog_item_id IS NULL AND d.deal_type = 'reseller'
    AND ci.name = 'GWS' AND 'GWS' = ANY(d.services_tags);

UPDATE deals d SET catalog_item_id = ci.id
  FROM catalog_items ci
  WHERE d.catalog_item_id IS NULL AND d.deal_type = 'reseller'
    AND ci.name = 'Google SCC - GCP' AND 'GCP' = ANY(d.services_tags);

UPDATE deals d SET catalog_item_id = ci.id
  FROM catalog_items ci
  WHERE d.catalog_item_id IS NULL AND d.deal_type = 'reseller'
    AND ci.name = 'Josys' AND 'Josys' = ANY(d.services_tags);

-- Agency deals — derive from services_tags where we can, otherwise default
-- to The Agency. Admin re-tags later from /catalog if any default is wrong.
UPDATE deals d SET catalog_item_id = ci.id
  FROM catalog_items ci
  WHERE d.catalog_item_id IS NULL AND d.deal_type = 'agency'
    AND ci.name = 'Consulting'
    AND ('consulting' = ANY(d.services_tags) OR 'consultancy' = ANY(d.services_tags));

UPDATE deals d SET catalog_item_id = ci.id
  FROM catalog_items ci
  WHERE d.catalog_item_id IS NULL AND d.deal_type = 'agency'
    AND ci.name = 'HireAI'
    AND 'internal_products' = ANY(d.services_tags);

UPDATE deals d SET catalog_item_id = ci.id
  FROM catalog_items ci
  WHERE d.catalog_item_id IS NULL AND d.deal_type = 'agency'
    AND ci.name = 'The Agency';

-- 3. Lock NOT NULL.
ALTER TABLE deals ALTER COLUMN catalog_item_id SET NOT NULL;
