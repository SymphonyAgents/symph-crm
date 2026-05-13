-- Seeds the Partnership catalog row and re-tags every deal whose title
-- contains "partnership" to point at it. Idempotent.

INSERT INTO catalog_items (product_type, slug, name, is_active)
SELECT 'partnership', 'partnership', 'Partnership', true
WHERE NOT EXISTS (
  SELECT 1 FROM catalog_items WHERE product_type = 'partnership' AND slug = 'partnership'
);

UPDATE deals d
SET catalog_item_id = ci.id
FROM catalog_items ci
WHERE ci.product_type = 'partnership' AND ci.slug = 'partnership'
  AND d.title ILIKE '%partnership%';
