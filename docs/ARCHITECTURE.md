# Symph CRM — Architecture & Tech Stack

**Last Updated:** 2026-03-25
**Status:** Living document — update when stack decisions change

---

## Current Stack (Phase 1 — Live)

| Layer | Choice | Notes |
|---|---|---|
| Monorepo | pnpm workspaces | 3 packages: apps/api, apps/web, packages/database |
| Frontend | Next.js 15.2 + React 19 + TypeScript 5.7 | App Router, Turbopack |
| Backend | NestJS 11 | Port 4000, global module architecture |
| Database | PostgreSQL via Supabase | Managed hosting |
| ORM | Drizzle ORM v0.39 | Type-safe, explicit queries, postgres-js driver |
| Auth | NextAuth.js v5 + Google OAuth | Sessions + @auth/pg-adapter |
| Styling | Tailwind v4 + Radix UI | Custom component library on top of Radix primitives |
| Data Fetching | TanStack React Query v5 | 60s staleTime, no window focus refetch |
| Forms | react-hook-form + Zod | Client + API level validation |
| AI | Anthropic Claude API | Pitch deck generation (Phase 1), full integration Phase 4 |
| Hosting | VPS | PM2 process management |

---

## Application Architecture

```
Browser
  │
  ▼
Next.js 15 (apps/web) — port 3000
  │
  ├── React Server Components   ← Initial page load
  ├── Client Components         ← Interactive UI (React Query for data)
  └── /api/* proxy              ← Forwards to NestJS API
        │
        ▼
NestJS 11 (apps/api) — port 4000
  │
  ├── Controllers               ← HTTP handlers
  ├── Services                  ← Business logic
  └── DatabaseModule (Global)   ← Drizzle + postgres-js
        │
        ▼
PostgreSQL (Supabase)
  └── packages/database         ← Shared Drizzle schema (consumed by both apps)
```

---

## Monorepo Structure

```
symph-crm/
├── apps/
│   ├── api/                    # NestJS backend
│   │   └── src/
│   │       ├── main.ts         # Bootstrap — port 4000
│   │       ├── app.module.ts   # Root module
│   │       ├── database/       # Global DB provider (Drizzle + postgres-js)
│   │       ├── deals/          # Deals module (controller + service)
│   │       ├── companies/      # Companies module
│   │       ├── contacts/       # Contacts module
│   │       ├── notes/          # Notes module
│   │       └── activities/     # Activities module
│   │
│   └── web/                    # Next.js frontend
│       └── src/
│           ├── app/            # Next.js App Router
│           │   ├── page.tsx              # Dashboard
│           │   ├── deals/page.tsx
│           │   ├── deals/[id]/page.tsx
│           │   ├── pipeline/page.tsx
│           │   ├── inbox/page.tsx
│           │   ├── calendar/page.tsx
│           │   ├── chat/page.tsx
│           │   ├── proposals/page.tsx
│           │   └── reports/page.tsx
│           ├── components/     # Feature + UI components
│           │   ├── ui/         # Radix UI primitives (button, input, select, etc.)
│           │   ├── Dashboard.tsx
│           │   ├── Pipeline.tsx
│           │   ├── DealDetail.tsx
│           │   ├── Chat.tsx
│           │   └── ...
│           └── lib/
│               ├── constants.ts
│               └── utils.ts
│
└── packages/
    └── database/               # Shared Drizzle schema
        └── src/
            └── schema/
                ├── users.ts
                ├── auth.ts
                ├── workspaces.ts
                ├── companies.ts
                ├── contacts.ts
                ├── deals.ts
                ├── products.ts
                ├── notes.ts
                ├── activities.ts
                ├── files.ts
                ├── pipeline.ts
                ├── chat.ts
                ├── pitch-decks.ts
                └── customization-requests.ts
```

---

## Database Schema

All core entities are workspace-scoped for multi-tenancy.

### Auth & Users

| Table | Key Fields |
|---|---|
| users | id, name, email, emailVerified, image, role, passwordHash |
| accounts | userId, provider, providerAccountId, accessToken, refreshToken |
| sessions | sessionToken, userId, expires |
| verificationTokens | identifier, token, expires |

**Roles:** `super_admin | admin | manager | rep | viewer`

### Workspace

| Table | Key Fields |
|---|---|
| workspaces | id, name, slug, settings (JSONB) |

### Core CRM

| Table | Key Fields |
|---|---|
| companies | id, name, domain, industry, headcountRange, website, linkedinUrl, assignedTo, workspaceId |
| contacts | id, companyId, name, email, phone, title, linkedinUrl, isPrimary |
| deals | id, companyId, productId, tierId, title, stage, value, probability, closeDate, assignedTo, lossReason, competitorNotes, demoLink, proposalLink, isFlagged, lastActivityAt, workspaceId |
| products | id, name, slug, description, color, icon, sortOrder |
| tiers | id, name, slug, description, customizationSlots, sortOrder |

**Deal stages:** `lead | discovery | assessment | proposal_demo | followup | closed_won | closed_lost`

### Notes & Activity

| Table | Key Fields |
|---|---|
| notes | id, content, templateType, authorId, dealId, companyId, contactId, tags, isPinned |
| noteAttachments | id, noteId, filename, storagePath, fileUrl, mimeType |
| activities | id, type, dealId, companyId, actorId, metadata (JSONB), workspaceId |
| files | id, filename, storagePath, fileUrl, dealId, companyId, uploadedBy |

**Activity types:** `deal_created | deal_stage_changed | deal_updated | deal_value_changed | note_added | note_updated | file_uploaded | contact_added | company_created | company_updated | customization_requested | customization_delivered | pitch_created | am_assigned | deal_flagged | deal_unflagged | deal_won | deal_lost | proposal_created | proposal_sent | attachment_added`

### Pipeline & AM Management

| Table | Key Fields |
|---|---|
| pipelineStages | id, slug, label, color, sortOrder, isActive, workspaceId |
| amRoster | id, userId, workspaceId, isActive, assignmentCount, lastAssignedAt |

### AI & Proposals

| Table | Key Fields |
|---|---|
| pitchDecks | id, companyId, productId, tierId, title, content (JSONB), htmlUrl, demoToken |
| customizationRequests | id, companyId, productId, tierId, title, status, requestedBy, year |

### Chat

| Table | Key Fields |
|---|---|
| chatSessions | id, userId, contextType, contextId, title, workspaceId |
| chatMessages | id, sessionId, userId, role, content, actionsTaken, attachments, voiceUrl |

---

## API Endpoints (Phase 1)

All routes served from NestJS at `http://localhost:4000/api`:

| Module | Endpoints |
|---|---|
| Deals | `GET /deals`, `GET /deals/:id`, `POST /deals`, `PUT /deals/:id`, `DELETE /deals/:id` |
| Companies | `GET /companies`, `GET /companies/:id`, `POST /companies`, `PUT /companies/:id`, `DELETE /companies/:id` |
| Contacts | `GET /contacts`, `GET /contacts?companyId=`, `GET /contacts/:id`, `POST /contacts`, `PUT /contacts/:id`, `DELETE /contacts/:id` |
| Notes | CRUD on `/notes` — queryable by dealId or companyId |
| Activities | `POST /activities`, `GET /activities?dealId=`, `GET /activities?companyId=` |

---

## Key Architectural Decisions

| Date | Decision | Reason |
|---|---|---|
| Phase 1 | NestJS for API (not Next.js API routes) | Clear service boundary, scalable module system, DI for complex future features |
| Phase 1 | Drizzle ORM over raw SQL | Type safety end-to-end via shared `@symph-crm/database` package; explicit enough to avoid magic |
| Phase 1 | Supabase over self-hosted PostgreSQL | Managed backups, connection pooling, dashboard — lower ops burden vs VPS DB |
| Phase 1 | pnpm monorepo (workspaces) | Shared DB schema between API and web without duplication or drift |
| Phase 1 | React Query v5 over SWR | Better for this monorepo's patterns; invalidation and mutations are cleaner |
| Phase 1 | JSONB for activity metadata | Flexible event data without schema migrations per new event type |
| Phase 1 | Multi-workspace from day one | Enables SaaS model when Symph sells this product externally |
| Phase 3 | PostgreSQL for graph layer (not Neo4j) | Sufficient at this scale; avoids separate infrastructure |
| Phase 4 | pgvector for semantic search | Colocates vectors with data; avoids external service (Pinecone) |

---

## What We Are NOT Using (and Why)

| Technology | Why Not |
|---|---|
| Raw SQL | Replaced by Drizzle — same control, full TypeScript types |
| Prisma | Too much magic and migration complexity for our patterns |
| Redis | Supabase connection pooler handles concurrency; revisit at scale |
| Neo4j | PostgreSQL handles our graph needs at this scale |
| Pinecone | pgvector keeps vectors in the same DB — simpler ops |
| Firebase / Firestore | Replaced by PostgreSQL — better for relational CRM data |

---

## Phase Architecture Changes

### Phase 2 — CRM Depth

New tables:
```sql
tasks (id, title, type, due_at, done_at, assigned_to, company_id, deal_id, contact_id)
custom_field_definitions (id, object_type, name, field_type, options JSONB)
custom_field_values (id, definition_id, object_id, value)

-- Materialized view for analytics (refresh on deal stage change)
CREATE MATERIALIZED VIEW pipeline_analytics AS
  SELECT stage, COUNT(*), SUM(value), AVG(days_in_stage) FROM deals GROUP BY stage;
```

Gmail integration via OAuth2 — email threads auto-linked to deal records.

### Phase 3 — Knowledge Graph

New tables:
```sql
note_links (id, source_note_id, target_type, target_id, link_text, created_at)
tags (id, name, slug)
note_tags (note_id, tag_id)
note_versions (id, note_id, body, author_id, created_at)
daily_notes (id, user_id, date, note_id)
```

Graph view via React Flow or D3.js. Global search via PostgreSQL FTS (`tsvector` + GIN index).

Wikilink flow:
1. User types `[[Acme Corp]]` in note
2. On save: remark plugin parses `[[...]]` tokens
3. Resolves to CRM objects by name (fuzzy match)
4. Writes rows to `note_links`
5. Backlinks panel queries `WHERE target_id = :id AND target_type = :type`

### Phase 4 — AI & Automation

New infrastructure:
```sql
-- pgvector for semantic search
CREATE EXTENSION vector;
ALTER TABLE notes ADD COLUMN embedding vector(1536);
```

Background jobs via `pg-boss` (PostgreSQL-native job queue — no Redis needed):
```typescript
await boss.send('follow-up-reminder', { dealId, amId, sendAt })
await boss.work('follow-up-reminder', async (job) => { ... })
```

### Phase 5 — Scale

Only add when traffic demands it:

| Addition | Trigger |
|---|---|
| Typesense / Meilisearch | Search >500ms consistently |
| PostgreSQL read replica | DB CPU >70% |
| Redis + BullMQ | pg-boss hitting throughput limits |
| Cloud Run migration | Team needs zero-maintenance hosting |

---

## Running Locally

```bash
# Install dependencies
pnpm install

# Set up environment
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
# Fill in: DATABASE_URL (Supabase), NEXTAUTH_SECRET, GOOGLE_CLIENT_ID/SECRET, ANTHROPIC_API_KEY

# Run migrations
cd packages/database && pnpm db:migrate

# Start both apps
pnpm dev
# API: http://localhost:4000
# Web: http://localhost:3000
```

---

## Security Checklist

- [ ] Rate limiting on auth routes (`/api/auth/*`)
- [ ] Centralized `withAuth()` guard in NestJS (not per-controller)
- [ ] Auth events logged to activities table (login, role change, failed attempt)
- [ ] `npm audit` in CI pipeline
- [ ] No `.env` files committed — environment variables via PM2 ecosystem config
- [ ] DB backups automated (Supabase handles this — verify schedule)

---

## Performance Checklist

Priority indexes to add before data grows:

```sql
CREATE INDEX idx_deals_company_id ON deals(company_id);
CREATE INDEX idx_deals_stage ON deals(stage);
CREATE INDEX idx_deals_assigned_to ON deals(assigned_to);
CREATE INDEX idx_notes_deal_id ON notes(deal_id);
CREATE INDEX idx_notes_company_id ON notes(company_id);
CREATE INDEX idx_activities_company_id ON activities(company_id);
CREATE INDEX idx_activities_deal_id ON activities(deal_id);
CREATE INDEX idx_contacts_company_id ON contacts(company_id);
```

---

*Maintained by Vince Tapdasan. Update when stack decisions change.*
