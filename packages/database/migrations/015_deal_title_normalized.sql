-- Store a normalized deal title for backend/agent search while preserving
-- deals.title as the display value users entered.

ALTER TABLE deals
  ADD COLUMN IF NOT EXISTS deal_title_normalized TEXT;

UPDATE deals
SET deal_title_normalized = lower(
  btrim(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          regexp_replace(title, '&', ' and ', 'g'),
          '[[:cntrl:]]',
          '',
          'g'
        ),
        '[^[:alnum:]]+',
        ' ',
        'g'
      ),
      '[[:space:]]+',
      ' ',
      'g'
    )
  )
)
WHERE deal_title_normalized IS NULL;

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_deals_deal_title_normalized_trgm
  ON deals USING gin (deal_title_normalized gin_trgm_ops);
