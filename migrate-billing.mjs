import postgres from 'postgres'
import * as dotenv from 'dotenv'
dotenv.config({ path: './.env' })

const sql = postgres(process.env.DATABASE_URL)

await sql`
  CREATE TABLE IF NOT EXISTS deal_billing (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deal_id UUID NOT NULL UNIQUE REFERENCES deals(id) ON DELETE CASCADE,
    billing_type TEXT NOT NULL CHECK (billing_type IN ('annual', 'monthly', 'milestone')),
    contract_start DATE,
    contract_end DATE,
    amount NUMERIC,
    monthly_derived NUMERIC,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
`

await sql`
  CREATE TABLE IF NOT EXISTS billing_milestones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    billing_id UUID NOT NULL REFERENCES deal_billing(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    percentage NUMERIC,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_paid BOOLEAN NOT NULL DEFAULT FALSE,
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
`

console.log('Migration complete')
await sql.end()
