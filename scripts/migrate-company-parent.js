#!/usr/bin/env node
/**
 * Migration: add parent_id to `companies` table for brand hierarchy.
 *
 * Models the Company → Brand relationship (e.g. Mlhuillier → ML ASYS, ML KP).
 * parent_id is null for top-level companies, set for brand sub-entities.
 *
 * Run once in prod:
 *   DATABASE_URL=<url> node scripts/migrate-company-parent.js
 *
 * Safe to re-run — uses ADD COLUMN IF NOT EXISTS.
 */

const postgres = require('postgres')

const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' })

async function run() {
  console.log('Running migration: add parent_id to companies table...')

  // Add the column (nullable — existing companies stay as-is)
  await sql`
    ALTER TABLE companies
      ADD COLUMN IF NOT EXISTS parent_id uuid
  `

  // Add self-referential FK (idempotent via DO block)
  await sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'companies_parent_id_fkey'
          AND table_name = 'companies'
      ) THEN
        ALTER TABLE companies
          ADD CONSTRAINT companies_parent_id_fkey
          FOREIGN KEY (parent_id)
          REFERENCES companies(id)
          ON DELETE SET NULL;
      END IF;
    END $$
  `

  // Index for fast "get all brands under a parent" queries
  await sql`
    CREATE INDEX IF NOT EXISTS idx_companies_parent_id ON companies(parent_id)
  `

  console.log('Done. All existing companies have parent_id = null (top-level).')
  await sql.end()
}

run().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})
