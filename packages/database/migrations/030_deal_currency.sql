ALTER TABLE deals
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'PHP';

UPDATE deals
SET currency = 'PHP'
WHERE currency IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'deals_currency_check'
      AND conrelid = 'deals'::regclass
  ) THEN
    ALTER TABLE deals
      ADD CONSTRAINT deals_currency_check CHECK (currency IN ('PHP', 'USD', 'SGD'));
  END IF;
END $$;
