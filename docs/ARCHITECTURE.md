# Symph CRM — Architecture & Tech Stack

**Last Updated:** 2026-04-14  
**Status:** Living document — update when stack decisions change

---

## What Symph CRM Is

An **AI-first sales CRM** for Symph's internal team. The key difference from a traditional CRM: **chat is the primary input, not forms**. AMs don't fill in fields — they talk to AI, and the AI maintains all structured data and deal documents.

---

## Core Loop

```
AM sends a message
        │
        ├─── Via Discord (Aria) ──────────────────────────────────┐
        │                                                          │
        └─── Via CRM Chat UI (crm.symph.co/chat) ─────────────────┤
                                                                   │
                                                                   ▼
                                                          ┌─────────────────┐
                                                          │   Aria (Claude) │
                                                          │   AI Processing │
                                                          └──┬──┬──┬──┬────┘
                                                             │  │  │  │
                                   Update deal fields (DB) ◄─┘  │  │  │
                                         Log activity (DB) ◄────┘  │  │
                                  Update context.md (NFS) ◄─────────┘  │
                                        Respond to AM ◄────────────────┘
```

**Chat is the only input AMs need.** Everything else — structured data, living documents, activity logs — is maintained by AI automatically.

---

## Two Ways to Use

### 1. Aria on Discord

AMs interact with the CRM directly from Discord by invoking Aria with CRM-related requests.

```
Discord message → Aria (agent-worker)
                    │
                    ├── Reads: GET /api/internal/* (deals, contacts, companies)
                    ├── Writes: POST/PUT /api/internal/* (create deals, update stages)
                    └── Notes: NFS vault at /share/crm/deals/{id}/
```

**Auth:** `X-Internal-Secret` header (secret: `symph-crm-internal-secret` in GCP Secret Manager)  
**Attribution:** `X-Performed-By: {crmUserId}`, `X-Performed-By-Name: {displayName}`  
**Used for:** Quick deal lookups, logging call notes, updating stages, generating summaries

### 2. CRM Chat UI

AMs use the embedded chat interface at `crm.symph.co/chat` — a full Aria-powered assistant scoped to the CRM context.

```
crm.symph.co/chat → POST /api/chat/message → ChatService → Aria SDK
                                                                │
                                                                ├── 11 CRM tools
                                                                ├── Deal context reads
                                                                └── Document writes
```

**Used for:** Deep deal discussions, deal Q&A with full context, on-the-fly proposals, document generation

Both channels write to the same data layer — same deals, same NFS notes, same activity log.

---

## Current Stack

| Layer | Choice | Notes |
|---|---|---|
| Monorepo | pnpm workspaces | 3 packages: apps/api, apps/web, packages/database |
| Frontend | Next.js 15.2 + React 19 + TypeScript 5.7 | App Router, Turbopack |
| Backend | NestJS 11 | Port 4000, global module architecture |
| Database | PostgreSQL via Supabase | Managed hosting, daily backups |
| ORM | Drizzle ORM v0.39 | Type-safe, explicit queries, postgres-js driver |
| Auth | NextAuth.js v5 + Google OAuth | Sessions + @auth/pg-adapter |
| Styling | Tailwind v4 + Radix UI | Custom component library on Radix primitives |
| Data Fetching | TanStack React Query v5 | 60s staleTime, no window focus refetch |
| Forms | react-hook-form + Zod | Client + API validation |
| AI | Anthropic Claude API (via Aria SDK) | Chat, doc generation, deal intelligence |
| Google | googleapis SDK | Gmail inbox sync, Calendar integration |
| Voice | Groq SDK (Whisper) | Fast speech-to-text for voice notes |
| Hosting | Google Cloud Run (asia-southeast1) | API + Web as separate services |
| CI/CD | GitHub Actions → Cloud Build | Push to main → parallel build & deploy |
| Doc Storage | NFS (/share/crm/) | Markdown files via Aria's shared Filestore |
| Binary Storage | Supabase Storage `attachments` bucket | Voice recordings only (audio needs Supabase signed URLs for playback) |
| Image Storage | NFS /share/crm/ | Images routed to NFS via writeFile() — same layer as markdown |

---

## Application Architecture

```
Browser
  │
  ▼
Next.js 15 (apps/web) — crm.symph.co
  │
  ├── React Server Components        ← Initial page load
  ├── Client Components              ← Interactive UI (React Query for data)
  └── /api/* proxy                   ← Forwards to NestJS API
        │
        ▼
NestJS 11 (apps/api) — symph-crm-api Cloud Run
  │
  ├── /api/*                         ← User-facing endpoints
  │     ├── /api/chat/message        ← Chat → AI processing loop
  │     ├── /api/deals/*
  │     ├── /api/companies/*
  │     ├── /api/contacts/*
  │     ├── /api/documents/*
  │     ├── /api/gmail/*
  │     ├── /api/calendar/*
  │     └── /api/notes/*
  │
  ├── /api/internal/*                ← Aria-only API (35+ endpoints)
  │     ├── X-Internal-Secret auth
  │     ├── X-Performed-By attribution
  │     └── Full CRUD on all entities
  │
  ├── DatabaseModule (Global)        ← Drizzle + postgres-js
  ├── StorageService                 ← NFS primary, Supabase fallback
  └── ChatService (11 tools)         ← AI chat loop via Aria SDK
        │
        ▼
  ┌─────────────────┬──────────────────┐
  │ PostgreSQL      │ NFS /share/crm/  │
  │ (Supabase)      │ (markdown docs)  │
  └─────────────────┴──────────────────┘
        ▲
        └── packages/database         ← Shared Drizzle schema
```

---

## Three-Layer Storage (Critical)

> Full spec: `docs/ARCHITECTURE-HYBRID.md` and `docs/nfs-storage-architecture.md`

```
Layer 1 — PostgreSQL (structured/queryable)
  users, workspaces, companies, contacts, deals, activities
  chat_sessions, chat_messages (raw input)
  documents (metadata index ONLY — no content column)
  files (attachment metadata)

Layer 2 — NFS /share/crm/ (markdown documents)
  deals/{id}/context/context-{ts}.md     ← AI-maintained living record
  deals/{id}/general/general-{ts}.md
  deals/{id}/meeting/meeting-{ts}.md
  deals/{id}/transcript_raw/...
  deals/{id}/proposal/...
  companies/{id}/{type}/{type}-{ts}.md

Layer 3 — Supabase Storage `attachments` (binary)
  Voice recordings (.m4a) only — audio requires Supabase signed URLs for in-browser playback
  NOTE: Images and PDFs now route to NFS (Layer 2) via writeFile(), not Supabase
```

**Rule:** Zero content in PostgreSQL. All markdown on NFS. All binaries in Supabase Storage. No exceptions.

The `documents` table is a **metadata-only index** — `id`, `deal_id`, `title`, `type`, `storage_path`, `excerpt` (500 chars max), `word_count`. The `storage_path` field points to the NFS file.

---

## Chat → Document Pipeline

```
AM sends chat message (either Discord or CRM Chat UI)
        │
        ▼
chat_messages (DB) ← raw input stored
        │
        ▼
ChatService / Aria (11 tools)
  │
  ├── update_deal_fields()   → deals table (stage, value, last_activity_at)
  ├── log_activity()         → activities table
  ├── update_context_doc()   → NFS context.md (append + rewrite)
  └── respond()              → confirmation, draft, next steps
```

---

## Wiki Sync System

Notes saved in the CRM UI trigger an automatic wiki sync (3-second debounce per deal):

```
Note saved (UI)
  → 3s in-memory debounce (Map<dealId, NodeJS.Timeout>)
  → Debounce fires
  → Aria reads all NFS notes for the deal
  → Updates deal + company wiki pages + MASTER_INDEX
  → Triggers summary generation (Aria SDK)
```

The `[CRM_WIKI_SYNC]` trigger mode in `crm-ingest` handles the sync. Implementation: `docs/WIKI-SYNC.md`.

---

## Monorepo Structure

```
symph-crm/
├── apps/
│   ├── api/                    # NestJS backend
│   │   ├── src/
│   │   │   ├── main.ts         # Bootstrap — port 4000
│   │   │   ├── app.module.ts
│   │   │   ├── auth/
│   │   │   ├── chat/           # Chat loop + AI integration (11 tools)
│   │   │   ├── companies/
│   │   │   ├── contacts/
│   │   │   ├── deals/
│   │   │   ├── documents/      # Document CRUD via StorageService
│   │   │   ├── files/
│   │   │   ├── gmail/          # Gmail OAuth sync
│   │   │   ├── calendar/       # Google Calendar sync
│   │   │   ├── notes/
│   │   │   ├── activities/
│   │   │   ├── billing/
│   │   │   ├── internal/       # Aria-only API (35+ endpoints)
│   │   │   ├── storage/        # StorageService (NFS + Supabase fallback)
│   │   │   └── database/       # Global DB provider (Drizzle + postgres-js)
│   │   └── CLAUDE.md           # API design rules (DTOs, validation)
│   │
│   └── web/                    # Next.js frontend
│       ├── src/
│       │   ├── app/            # Next.js App Router
│       │   │   ├── page.tsx              # Dashboard
│       │   │   ├── deals/page.tsx
│       │   │   ├── deals/[id]/page.tsx
│       │   │   ├── pipeline/page.tsx
│       │   │   ├── inbox/page.tsx
│       │   │   ├── calendar/page.tsx
│       │   │   ├── chat/page.tsx
│       │   │   ├── proposals/page.tsx
│       │   │   └── settings/page.tsx
│       │   ├── components/
│       │   │   ├── ui/         # Radix UI primitives
│       │   │   ├── Dashboard.tsx
│       │   │   ├── Pipeline.tsx
│       │   │   ├── DealDetail.tsx
│       │   │   ├── Chat.tsx
│       │   │   ├── PartialCollapse.tsx   # Summary card collapse component
│       │   │   └── DocumentViewerModal.tsx
│       │   └── lib/
│       │       ├── constants.ts          # 45+ centralized constants
│       │       ├── types.ts              # All entity types
│       │       ├── query-keys.ts         # React Query key hierarchy
│       │       └── hooks/mutations.ts    # All useMutation hooks
│       └── CLAUDE.md           # Frontend design rules (colors, components, D3)
│
├── packages/
│   ├── aria-crm-client/        # Aria SDK client for CRM integration
│   └── database/               # Shared Drizzle schema (TS-only, webpack bundled)
│       └── src/schema/
│           ├── users.ts
│           ├── auth.ts
│           ├── workspaces.ts
│           ├── companies.ts
│           ├── contacts.ts
│           ├── deals.ts
│           ├── documents.ts    # Metadata-only index
│           ├── activities.ts
│           ├── chat.ts
│           ├── files.ts
│           ├── pitch-decks.ts
│           └── customization-requests.ts
│
└── docs/
    ├── ARCHITECTURE.md          ← this file
    ├── ARCHITECTURE-HYBRID.md   ← storage layer deep-dive
    ├── nfs-storage-architecture.md ← NFS integration details
    └── WIKI-SYNC.md             ← debounced wiki sync system
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

**Roles:** `super_admin | admin | manager | rep | viewer`

### Workspace

| Table | Key Fields |
|---|---|
| workspaces | id, name, slug, settings (JSONB) |

### Core CRM

| Table | Key Fields |
|---|---|
| companies | id, name, domain, industry, website, linkedinUrl, assignedTo, parent_id (self-ref), workspaceId |
| contacts | id, name, email, phone, title — linked to both companies AND deals (many-to-many) |
| deals | id, companyId, productId, tierId, title, **stageId** (FK → pipelineStages), value, probability, closeDate, assignedTo, **amRosterId** (FK → amRoster), **buildAssignedTo**, outreachCategory, clientBrandColor, servicesTags[], isFlagged, flagReason, lastActivityAt, workspaceId |
| products | id, name, slug, description, color, icon |
| tiers | id, name, slug, description, customizationSlots |

**Deal stages:** Workspace-configurable via `pipelineStages` table (FK). Default stages: `lead | discovery | assessment | demo + proposal | follow up | won | lost`

### Documents & Activity

| Table | Key Fields |
|---|---|
| documents | id, deal_id, company_id, author_id, **type**, title, tags, excerpt (500 chars), **storage_path**, version, is_ai_generated, is_pinned |
| activities | id, type, dealId, companyId, actorId, metadata (JSONB), workspaceId |
| files | id, filename, storagePath, dealId, companyId, uploadedBy (binary attachment metadata) |

**Document types:** `context | discovery | transcript_raw | transcript_clean | meeting | proposal | summary | email_thread | company_profile | weekly_digest | general`

> ⚠️ `notes` table has been **replaced by `documents`**. The documents table is metadata-only — all content lives in NFS files referenced by `storage_path`.

### Pipeline & AM Management

| Table | Key Fields |
|---|---|
| pipelineStages | id, slug, label, color, sortOrder, isActive, workspaceId |
| amRoster | id, userId, workspaceId, isActive, assignmentCount, lastAssignedAt |

### AI & Proposals

| Table | Key Fields |
|---|---|
| pitchDecks | id, companyId, productId, tierId, title, content (JSONB), htmlUrl, demoToken |
| customizationRequests | id, companyId, productId, tierId, title, status, requestedBy |

### Billing

| Table | Key Fields |
|---|---|
| dealBilling | id, dealId (unique), billingType (annual\|monthly\|milestone), contractStart, contractEnd, amount, monthlyDerived (auto-calc) |
| billingMilestones | id, billingId, name, amount, percentage (auto-calc), sortOrder, isPaid, paidAt |

### Notifications

| Table | Key Fields |
|---|---|
| notifications | id, userId, type (dormant_deal\|deal_won\|mention), dealId, metadata (JSONB), isRead, workspaceId |

### Audit

| Table | Key Fields |
|---|---|
| auditLogs | id (serial), action (create\|update\|delete\|status_change), auditType, entityType, entityId, source, performedBy, orgId, details (JSONB) |

### Calendar

| Table | Key Fields |
|---|---|
| userCalendarConnections | id, userId (unique), googleEmail, refreshToken (AES-256-GCM encrypted), syncToken, lastSyncedAt, isActive |
| calendarEvents | id, workspaceId, googleEventId, userId, title, description, startAt, endAt, location, attendeeEmails[], dealId, eventType (demo\|discovery_call\|followup\|general), rawJson |

> `userCalendarConnections.refreshToken` is AES-256-GCM encrypted at the application layer. Key lives in Secret Manager. `calendarEvents` is a local mirror — Google Calendar is source of truth. Synced on OAuth connect (30-day window) + Cloud Scheduler every 5 min via syncToken.

### Chat

| Table | Key Fields |
|---|---|
| chatSessions | id, userId, contextType, contextId, title, workspaceId |
| chatMessages | id, sessionId, userId, role, content, actionsTaken, attachments, voiceUrl |

---

## Internal API for Aria

All Aria interactions go through `/api/internal/*`. Never call user-facing routes from Aria.

```
Base URL: https://symph-crm-api-t5wb3mrt7q-as.a.run.app/api/internal
Auth: X-Internal-Secret: {secret from Secret Manager: symph-crm-internal-secret}
Attribution: X-Performed-By: {crmUserId}, X-Performed-By-Name: {displayName}
Default Workspace: 60f84f03-283e-4c1a-8c88-b8330dc71d32
```

| Scope | Endpoints |
|---|---|
| Deals (7) | GET /deals, GET /deals/:id, POST /deals, PUT /deals/:id, PATCH /deals/:id/stage, DELETE /deals/:id, GET /deals/:id/activities |
| Companies (5) | GET /companies, GET /companies/:id, POST /companies, PUT /companies/:id, DELETE /companies/:id |
| Contacts (5) | GET /contacts, GET /contacts/:id, POST /contacts, PUT /contacts/:id, DELETE /contacts/:id |
| Activities (4) | POST /activities, GET /activities?dealId=, GET /activities?companyId=, GET /activities/:id |
| Documents (6) | GET /documents?dealId=, GET /documents/:id, POST /documents, PUT /documents/:id, DELETE /documents/:id, GET /documents/:id/content |
| Users (2) | GET /users, GET /users/:id |
| Pipeline (2) | GET /pipeline/summary, GET /pipeline/stages |
| Audit (1) | GET /audit-logs |
| Health (1) | GET /health |

Full endpoint list: `apps/api/src/internal/internal.controller.ts`

---

## Infrastructure

| Service | URL | Region |
|---|---|---|
| Web (Next.js) | https://crm.symph.co | asia-southeast1 |
| API (NestJS) | https://symph-crm-api-t5wb3mrt7q-as.a.run.app | asia-southeast1 |
| Database | PostgreSQL via Supabase | — |
| NFS Storage | /share/crm/ on aria-vpc Filestore | 10.95.69.154 |
| Binary Storage | Supabase Storage `attachments` bucket | — |

**CI/CD:** Push to `main` → GitHub Actions (WIF) → Cloud Build → parallel deploy of API + Web to Cloud Run.

---

## Key Architectural Decisions

| Decision | Reason |
|---|---|
| NestJS over Next.js API routes | Clear service boundary, DI, modular architecture |
| Drizzle over Prisma | Explicit queries, shared schema package, no migration magic |
| Supabase over self-hosted PostgreSQL | Managed backups, connection pooling, less ops |
| NFS over Supabase Storage for markdown | ~1ms vs ~150ms read latency; Aria reads directly without HTTP; grep-able |
| pnpm monorepo | Shared DB schema between API and web with no duplication |
| React Query v5 | Clean mutations + cache invalidation for CRM data patterns |
| JSONB for activity metadata | Flexible event data without migrations per event type |
| Multi-workspace from day one | SaaS model when Symph sells the product externally |
| Aria SDK for all AI calls | Symph CRM has no direct Anthropic API key — all LLM calls route through Aria |
| Discord + CRM Chat UI as dual input channels | Meets AMs where they are; Discord for quick updates, Chat UI for deep work |

---

## What We Are NOT Using (and Why)

| Technology | Why Not |
|---|---|
| Raw SQL | Drizzle gives same control with full TypeScript types |
| Prisma | Too much migration complexity and magic |
| Redis | Supabase connection pooler handles concurrency; wiki sync uses in-memory debounce |
| Neo4j | PostgreSQL handles graph needs at this scale |
| Pinecone | pgvector (Phase 4) keeps vectors in the same DB |
| Firebase / Firestore | PostgreSQL is better for relational CRM data |
| Direct Anthropic API | All AI routes through Aria SDK — CRM has no standalone Anthropic key |

---

## Phase Roadmap

### Phase 1 — Live ✅
- Core CRM (deals, companies, contacts, pipeline, activities)
- Internal API (35+ endpoints for Aria)
- Chat → AI loop (11 tools, context.md maintenance)
- Gmail sync + Calendar integration
- NFS document storage
- Voice note transcription (Groq Whisper)
- Wiki sync on note save (debounced)
- Proposal builder integration

### Phase 2 — CRM Depth
```sql
tasks (id, title, type, due_at, assigned_to, company_id, deal_id)
custom_field_definitions (id, object_type, name, field_type, options JSONB)
custom_field_values (id, definition_id, object_id, value)
```
Full Gmail OAuth integration. Email threads auto-linked to deals.

### Phase 3 — Knowledge Graph
```sql
note_links (id, source_id, target_type, target_id, link_text)
tags (id, name, slug)
note_tags (note_id, tag_id)
note_versions (id, note_id, body, author_id, created_at)
```
Wikilinks (`[[Acme Corp]]`) resolve to CRM entities. Graph view via D3. FTS via PostgreSQL `tsvector`.

### Phase 4 — AI & Automation
```sql
ALTER TABLE notes ADD COLUMN embedding vector(1536);  -- pgvector
```
Background jobs via `pg-boss` (PostgreSQL-native). Semantic search across all deal docs. Automated follow-up triggers.

### Phase 5 — Scale
Only add when traffic demands it:
- Typesense: if search >500ms consistently
- PostgreSQL read replica: if DB CPU >70%
- Redis + BullMQ: if pg-boss hits throughput limits

---

## Running Locally

```bash
pnpm install

# API env
cp apps/api/.env.example apps/api/.env
# Fill: DATABASE_URL (Supabase), NEXTAUTH_SECRET, GOOGLE_CLIENT_ID/SECRET

# Run everything
pnpm dev
# API: http://localhost:4000
# Web: http://localhost:3000
```

---

*Maintained by Vince Tapdasan. Update when stack decisions change.*
