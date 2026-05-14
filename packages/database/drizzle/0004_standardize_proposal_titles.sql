-- Standardize active proposal titles to the canonical CRM proposal name:
-- [brandname]-[dealname]-[current_version padded to 3 digits]
-- Version labels and internal references stay in proposal_versions metadata
-- and change notes. The current visible version is reflected in proposals.title.

WITH active AS (
  SELECT
    p.id,
    p.current_version,
    c.name AS brand_name,
    d.title AS deal_name
  FROM proposals p
  LEFT JOIN deals d ON d.id = p.deal_id
  LEFT JOIN companies c ON c.id = d.company_id
  WHERE p.deleted_at IS NULL
),
cleaned AS (
  SELECT
    *,
    NULLIF(
      btrim(
        regexp_replace(
          coalesce(deal_name, 'unknown-deal'),
          '^' || regexp_replace(coalesce(brand_name, ''), '([\\.\\+\\*\\?\\^\\$\\(\\)\\[\\]\\{\\}\\|\\\\])', '\\\1', 'g') || '\s*(-|–|—|:)?\s*',
          '',
          'i'
        )
      ),
      ''
    ) AS deal_without_brand
  FROM active
),
canonical AS (
  SELECT
    id,
    lower(
      btrim(
        regexp_replace(
          regexp_replace(
            coalesce(brand_name, 'unknown-brand') || '-' || coalesce(deal_without_brand, deal_name, 'unknown-deal'),
            '&',
            ' and ',
            'g'
          ),
          '[^A-Za-z0-9]+',
          '-',
          'g'
        ),
        '-'
      )
    ) || '-' || lpad(current_version::text, 3, '0') AS title
  FROM cleaned
)
UPDATE proposals p
SET
  title = c.title,
  updated_at = now()
FROM canonical c
WHERE p.id = c.id
  AND p.title <> c.title;
