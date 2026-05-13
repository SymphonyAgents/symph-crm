-- Normalize services_tags on every deal whose catalog row is 'The Agency'.
-- Pre-rename, services_tags accumulated free-text values
-- (Custom Software, Construction Tech, Operations, AI, HR, Alignly, FMS,
--  app_development, internal_products, capital-A 'Agency', etc.).
-- Canonical now: ['agency'] — the 'existing_client' flag is preserved when
-- present because that's a separate business axis.

UPDATE deals d
SET services_tags = CASE
  WHEN 'existing_client' = ANY(d.services_tags) THEN ARRAY['agency','existing_client']
  ELSE ARRAY['agency']
END
FROM catalog_items ci
WHERE ci.id = d.catalog_item_id
  AND ci.name = 'The Agency'
  AND ci.product_type = 'service';
