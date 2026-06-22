# Database Migration Cleanup Plan

## Current situation

Symph CRM has two database-change paths:

1. Drizzle migrations
   - Config: `packages/database/drizzle.config.ts`
   - Schema source: `packages/database/src/schema/index.ts`
   - Generated SQL folder: `packages/database/drizzle/`
   - Commands:
     - `pnpm db:generate`
     - `pnpm db:migrate`

2. Manual SQL patches
   - Folder: `packages/database/migrations/`
   - These files are not executed by `drizzle-kit migrate`.
   - Several Supabase changes have been applied manually, so production Supabase and Drizzle schema are not guaranteed to match.

The intended long-term state is: Drizzle is the source of truth for schema and migrations.

## Recent example

Lead workflow status cleanup added this manual patch:

- `packages/database/migrations/022_lead_workflow_status.sql`

It was applied manually to the active Supabase database on 2026-06-22 because the `leads` table is not represented in the Drizzle schema. The API needed `leads.follow_up_count`, and Supabase did not have that column yet.

Applied DB changes:

- Added `leads.follow_up_count integer NOT NULL DEFAULT 0`
- Set `leads.status` default to `'to_contact'`
- Migrated old lead statuses:
  - `new`, `reviewing` -> `to_contact`
  - `interested` -> `contacted`
  - `not_fit`, `duplicate` -> `lost`
- Added status check constraint:
  - `to_contact`, `contacted`, `followed_up`, `lost`, `converted`
- Added follow-up count check constraint:
  - `follow_up_count BETWEEN 0 AND 5`

## Rule until cleanup happens

Do not assume `pnpm db:migrate` applies files in `packages/database/migrations/`.

For new schema changes:

1. Prefer Drizzle schema changes in `packages/database/src/schema/`.
2. Generate Drizzle migrations with `pnpm db:generate`.
3. Use manual SQL only when the affected table is not yet represented in Drizzle or an emergency patch is needed.
4. If manual SQL is used, add a header that says:
   - it is a manual Supabase patch
   - whether it has been applied
   - the date it was applied
   - why Drizzle could not handle it

## Cleanup goal

Make Drizzle the only source of truth for database schema.

After cleanup:

- All tables used by the API should exist in `packages/database/src/schema/`.
- All future schema changes should flow through `pnpm db:generate` and `pnpm db:migrate`.
- `packages/database/migrations/` should become an archive of historical manual patches, not an active migration path.
- Backend services should use Drizzle schema imports instead of raw SQL where practical.

## Proposed cleanup phases

### Phase 1: Inventory current production schema

Create a schema-only dump from Supabase without data.

Suggested command shape:

```bash
pg_dump "$DATABASE_URL" \
  --schema-only \
  --no-owner \
  --no-privileges \
  --schema public \
  > tmp/supabase-schema-current.sql
```

Then list tables and compare against `packages/database/src/schema/`.

Focus first on API-owned tables that are currently raw SQL or missing from Drizzle, especially:

- `leads`
- `lead_conversions`
- any tables introduced through manual SQL patches

### Phase 2: Map manual patches to current Supabase state

Review:

- `packages/database/migrations/*.sql`
- `packages/database/drizzle/*.sql`
- Supabase current schema dump

For each manual patch, mark one of:

- already represented in Drizzle schema
- exists in Supabase but missing from Drizzle schema
- obsolete or superseded
- unsafe to re-run

Create a table in this doc or a follow-up audit doc with file-by-file status.

### Phase 3: Backfill Drizzle schema definitions

Add missing tables, columns, constraints, and indexes to `packages/database/src/schema/`.

Use the current Supabase schema as the truth during this phase. Do not infer schema only from old migration files because the live DB may have manual drift.

Important checks:

- UUID primary keys use Postgres defaults.
- Foreign keys match production behavior.
- `workspace_id` exists on workspace-scoped tables.
- Indexes exist for foreign keys and common filters.
- Status values and defaults match production.

### Phase 4: Create a safe baseline strategy

Do not blindly run a generated migration against production.

Safer path:

1. Create a fresh local or temporary Supabase database.
2. Apply the current Drizzle migrations.
3. Apply or represent manual patches as needed.
4. Compare resulting schema with production schema dump.
5. Only then decide whether to:
   - generate an additive migration for missing pieces, or
   - create a new baseline and archive old manual patches.

### Phase 5: Cut over to one workflow

Once Drizzle schema matches production:

- Update `AGENTS.md` and `.claude/rules/backend.md` to state the final migration workflow.
- Rename `packages/database/migrations/` to something explicit, such as `packages/database/manual-patches-archive/`, if the team agrees.
- Add a README in the archive folder explaining that these files are historical and are not run by Drizzle.
- Add a CI or script check if needed to prevent new active manual patches.

## Risk notes

Low-risk work:

- Writing docs
- Inventorying schema
- Marking manual patch status
- Adding missing Drizzle schema files without running migrations

Medium-risk work:

- Generating migrations from a schema that may not match Supabase
- Applying additive-only migrations to a staging database
- Converting one raw-SQL service to Drizzle after schema types exist

High-risk work:

- Running generated migrations directly against production without schema diff review
- Dropping constraints or columns based only on Drizzle output
- Renaming tables or columns without a data migration plan
- Trying to rewrite all DB history in one PR

## Recommended next action when time is available

Start with `leads` because it already caused a runtime error and currently depends on manual schema.

Suggested first cleanup slice:

1. Add `leads` and `lead_conversions` to Drizzle schema.
2. Confirm schema matches Supabase.
3. Generate and inspect Drizzle output.
4. Do not apply to production until the generated SQL is proven no-op or additive on a staging copy.
5. Convert `apps/api/src/leads/leads.service.ts` away from raw SQL only after schema types exist.

## Raw SQL debt status

`apps/api/src/leads/leads.service.ts` previously used raw SQL because `leads` and `lead_conversions` were not represented in `packages/database/src/schema/`.

The lead workflow refactor added Drizzle schema definitions for those tables and moved the service to Drizzle query builder APIs.

Remaining cleanup work: compare the new Drizzle schema definitions against Supabase during the broader migration audit before relying on generated migrations for production.
