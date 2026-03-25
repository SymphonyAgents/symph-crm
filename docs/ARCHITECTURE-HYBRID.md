# Hybrid Storage Architecture — Symph CRM

**The definitive guide to what goes in PostgreSQL, what goes in markdown files, and why.**

---

## The Problem with the Current `notes` Table

```sql
CREATE TABLE public.notes (
  id uuid,
  title text,
  content text NOT NULL DEFAULT '',  -- THIS IS THE PROBLEM
  ...
);
```

This table tries to be two things at once:

1. **A structured metadata index** (who wrote it, when, which deal, tags)
2. **A content store** for free-form text of arbitrary length

It fails at both. Short updates bloat the table with empty rows. Long transcripts bloat queries that touch the table. Search across content requires scanning every row. Versioning doesn't exist. There's no concept of a "living document" that evolves over time.

In an **AI-first CRM where chat is the primary input**, the traditional "notes" concept doesn't make sense. Here's why:

---

## The AI-First Insight: Chat IS the Input, Documents ARE the Output

In a traditional CRM, humans write notes. In Symph CRM:

```
Traditional CRM:
  Human → writes note → saves to DB → reads note later

Symph CRM:
  Human → sends chat message → AI processes → AI writes/updates documents
                                            → AI updates structured DB fields
                                            → AI logs activity
```

The AM doesn't "create a note." The AM talks to the AI. The AI:
1. Stores the raw message in `chat_messages` (already exists in your schema)
2. Extracts structured data → updates `deals`, `contacts`, `companies` columns
3. Maintains running **markdown documents** per deal — the knowledge base
4. Logs activities in `activities` table

The markdown documents are the AI's memory. The AI reads them to answer questions, generate proposals, and suggest follow-ups. They need to be files, not DB rows, because:
- The AI reads them as full context (feed entire file to Claude)
- They evolve continuously (append, rewrite sections, version)
- They can grow large (transcripts: 10K+ words)
- They benefit from file-level operations (diff, grep, version)

---

## Architecture: Three Storage Layers

```
┌─────────────────────────────────────────────────────────┐
│                      Next.js App                         │
│              (Server Actions / API Routes)                │
└────────┬──────────────┬──────────────┬──────────────────┘
         │              │              │
    ┌────▼────┐   ┌─────▼─────┐  ┌────▼──────────────┐
    │ Layer 1 │   │  Layer 2  │  │     Layer 3       │
    │   DB    │   │  Storage  │  │   Attachments     │
    │         │   │  (Markdown)│  │   (Binary files)  │
    └─────────┘   └───────────┘  └───────────────────┘

Layer 1: Supabase PostgreSQL (via Drizzle)
  - Structured data you QUERY: deals, companies, contacts, users
  - Raw chat messages: chat_messages, chat_sessions
  - Document INDEX: documents table (metadata only, NO content)
  - Activity log: activities
  - Auth, products, pipeline config

Layer 2: Supabase Storage — 'content' bucket (Markdown)
  - AI-maintained deal context documents
  - Call transcripts (raw + cleaned)
  - Meeting summaries
  - Proposal drafts (versioned)
  - Company profiles / relationship history
  - Weekly digests

Layer 3: Supabase Storage — 'attachments' bucket (Binary)
  - PDFs, images, docs uploaded by AMs
  - Voice recordings (.m4a, .webm)
  - Screenshots of chats
  - Signed contracts
```

---

## Layer 1: PostgreSQL — What Stays in the DB

### Keep as-is (already correct)
- `users` — auth, roles, profiles
- `accounts`, `sessions`, `verification_tokens` — NextAuth
- `workspaces` — multi-tenant config
- `companies` — structured company data
- `contacts` — structured contact data
- `deals` — pipeline data, stage, value, assignment, flags
- `products`, `tiers` — catalog
- `pipeline_stages` — stage config
- `activities` — event log (short `metadata` jsonb, no long text)
- `files` — attachment metadata (points to Storage)
- `note_attachments` — attachment metadata linked to documents
- `chat_sessions`, `chat_messages` — raw conversation history
- `pitch_decks` — generated deck metadata + structured content (jsonb)
- `am_roster` — assignment rotation
- `customization_requests` — request tracking

### REPLACE: `notes` → `documents`

The `notes` table should become a **metadata-only index** called `documents`. No `content` column.

```sql
-- DROP the notes table concept. Replace with:

CREATE TABLE public.documents (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id   uuid REFERENCES workspaces(id),

  -- ownership
  deal_id        uuid REFERENCES deals(id) ON DELETE SET NULL,
  company_id     uuid REFERENCES companies(id) ON DELETE SET NULL,
  contact_id     uuid REFERENCES contacts(id) ON DELETE SET NULL,
  author_id      text REFERENCES users(id) NOT NULL,

  -- classification
  type           text NOT NULL CHECK (type IN (
                   'context',           -- AI-maintained running deal context
                   'discovery',         -- discovery call notes
                   'transcript_raw',    -- verbatim call transcript
                   'transcript_clean',  -- AI-cleaned transcript
                   'meeting',           -- multi-person meeting notes
                   'proposal',          -- proposal draft
                   'summary',           -- AI-generated summary
                   'email_thread',      -- archived email thread
                   'company_profile',   -- AI-maintained company brief
                   'weekly_digest',     -- weekly rollup
                   'general'            -- freeform markdown
                 )),

  -- metadata
  title          text NOT NULL,
  tags           text[] DEFAULT '{}',
  excerpt        text,                  -- first 500 chars, for search/preview
  word_count     integer DEFAULT 0,

  -- storage reference
  storage_path   text NOT NULL UNIQUE,  -- 'deals/{deal_id}/context.md'

  -- versioning (for proposals)
  version        integer DEFAULT 1,
  parent_id      uuid REFERENCES documents(id),

  -- flags
  is_ai_generated boolean DEFAULT false,
  is_pinned       boolean DEFAULT false,

  -- timestamps
  created_at     timestamptz DEFAULT now() NOT NULL,
  updated_at     timestamptz DEFAULT now() NOT NULL,
  deleted_at     timestamptz                        -- soft delete
);

-- Indexes for common queries
CREATE INDEX idx_docs_deal      ON documents(deal_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_docs_company   ON documents(company_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_docs_type      ON documents(type) WHERE deleted_at IS NULL;
CREATE INDEX idx_docs_tags      ON documents USING GIN(tags);
CREATE INDEX idx_docs_search    ON documents USING gin(excerpt gin_trgm_ops);
CREATE INDEX idx_docs_created   ON documents(created_at DESC);
```

**The rule is absolute: `documents` table has ZERO long-form content. Every character of content lives in Storage.**

The `excerpt` column (500 chars max) exists only for:
- Search results preview
- List view previews
- `pg_trgm` index for fast ILIKE search

---

## Layer 2: Supabase Storage — Markdown Structure

```
Bucket: content
│
├── deals/{deal_id}/
│   ├── context.md                    # THE KEY FILE — AI-maintained living record
│   ├── discovery/
│   │   ├── call-2026-03-20.md        # individual call notes
│   │   └── call-2026-03-22.md
│   ├── transcripts/
│   │   ├── raw-2026-03-20.md         # verbatim
│   │   └── clean-2026-03-20.md       # AI-cleaned
│   ├── meetings/
│   │   └── 2026-03-21-kickoff.md
│   ├── proposals/
│   │   ├── v1.md
│   │   └── v2.md
│   └── emails/
│       └── thread-{uuid}.md
│
├── companies/{company_id}/
│   ├── profile.md                    # AI-maintained company brief
│   └── history.md                    # relationship timeline
│
└── digests/
    └── 2026-w12.md                   # weekly rollup
```

### The `context.md` File — The Living Record

This is the most important file per deal. The AI maintains it. It looks like this:

```markdown
# Mlhuillier — Asys Digital Platform

**Stage:** Demo + Proposal | **Value:** ₱2.5M | **AM:** Gee
**Last Updated:** 2026-03-22 by AI

## Current Status
Proposal sent to Sir Ricky. Board review scheduled for Mar 24.
Waiting on board approval. Sir Ricky requested timeline breakdown per phase.

## Key Requirements
- Mobile-first loyalty platform replacing legacy Oracle system
- Real-time rewards tracking
- API integration with existing POS and payment systems
- 3-month build estimate (Next.js + Firebase stack)

## Stakeholders
- **Sir Ricky** — primary contact, IT budget holder, loved demo (9/10)
- **IT Head** — attended discovery call, technical evaluator

## Deal History
- Feb 14: Lead captured (inbound inquiry)
- Feb 14: Discovery call with Sir Ricky + IT Head
- Feb 16: Post-discovery email, credential deck requested
- Feb 18: Internal assessment with Raven + Ian (strong fit)
- Feb 22: Demo walkthrough with Aria prototype (9/10)
- Feb 22: Proposal + pricing sent
- Mar 21: Sir Ricky confirmed board date: Mar 24

## Open Items
- [ ] Send timeline breakdown per phase (Sir Ricky requested)
- [ ] Update pricing sheet before board review
- [ ] Prepare for board Q&A

## Risk Signals
- Two competing vendors presenting at the same board meeting
- Decision expected end of March — tight window

## Product Fit
- The Agency: HIGH (full platform build)
- Consulting: HIGH (modernization advisory)
```

The AI updates this file whenever:
- A chat message adds new information about the deal
- A call transcript is processed
- A deal stage changes
- A follow-up is sent or received

This file IS the deal's brain. When a user asks "what's the status of the Mlhuillier deal?", the AI reads this file — not the DB, not the chat history. One file, full context.

---

## The Chat → Document Pipeline

```
AM sends chat message
        │
        ▼
┌──────────────────┐
│  chat_messages    │ ← raw input stored in DB
│  (PostgreSQL)     │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│   AI Processing   │
│   (Claude API)    │
└──┬──┬──┬──┬──────┘
   │  │  │  │
   │  │  │  └──► Update deal fields (DB)
   │  │  │       deals.stage, deals.value, deals.last_activity_at
   │  │  │
   │  │  └─────► Log activity (DB)
   │  │          activities { type: 'note_added', metadata: {...} }
   │  │
   │  └────────► Update context.md (Storage)
   │              Append new info to deal's living record
   │
   └───────────► Respond to AM (chat)
                  Confirmation, suggestions, follow-up draft
```

### Example Flow

**AM in chat:** "Just had a call with Sir Ricky. Board meeting moved to next week. He also wants the timeline breakdown per phase included in the updated proposal."

**AI does:**

1. **DB — chat_messages:** Store raw message

2. **DB — deals:** `UPDATE deals SET last_activity_at = now() WHERE id = ?`

3. **DB — activities:** Insert `{ type: 'note_added', metadata: { summary: 'Board meeting rescheduled, timeline breakdown requested' } }`

4. **Storage — context.md:** Append to Current Status:
   ```
   - Mar 25: Board meeting postponed to next week (Sir Ricky).
     Timeline breakdown per phase requested for updated proposal.
   ```
   Update Open Items:
   ```
   - [ ] Update proposal with timeline breakdown per phase
   ```

5. **DB — documents:** Update the `context.md` document row:
   `updated_at = now()`, `excerpt = first 500 chars of file`

6. **Chat response:** "Got it. Board meeting pushed to next week. I've added the timeline breakdown request to the open items. Want me to draft the updated proposal section now?"

---

## What Happens to Voice Messages

```
AM sends voice message
        │
        ▼
┌──────────────────┐
│  Upload .m4a to   │
│  attachments/     │ ← binary in Storage
│  bucket           │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Transcription    │
│  (Whisper / etc)  │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Save transcript  │
│  as .md file in   │ ← markdown in Storage
│  content/ bucket  │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  AI Processing    │ ← same pipeline as chat messages
│  (extract, update │
│   context.md)     │
└──────────────────┘
```

Voice ≠ a special case. Voice → transcript → same pipeline as text. The transcript `.md` file is a document. The `.m4a` is an attachment. Both have rows in their respective tables pointing to Storage.

---

## What Happens to File Uploads (PDFs, Screenshots, Docs)

```
AM uploads file (PDF, screenshot, etc.)
        │
        ▼
┌──────────────────┐
│  Upload to        │
│  attachments/     │ ← binary in Storage
│  bucket           │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  files table (DB) │ ← metadata row: filename, path, deal_id, mime_type
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  AI extracts text │ ← OCR for images, parse for PDFs
│  if applicable    │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Append extracted │
│  info to          │ ← update context.md with key facts
│  context.md       │
└──────────────────┘
```

The file itself stays in the `attachments` bucket. The useful information from the file gets extracted and added to `context.md`. The AI doesn't re-read the PDF every time someone asks about the deal — it reads `context.md`, which already has the relevant facts.

---

## Do We Need the `notes` Table? NO.

Delete it. Replace with `documents`.

Here's the mapping:

| Old Concept | New Concept | Where it lives |
|---|---|---|
| Short note ("called Sir Ricky") | Chat message | `chat_messages` table |
| Long note (meeting writeup) | Markdown document | Storage + `documents` index |
| Call transcript | Markdown document | Storage + `documents` index |
| AI summary | Markdown document (is_ai_generated=true) | Storage + `documents` index |
| Proposal draft | Markdown document (type=proposal) | Storage + `documents` index |
| Quick update | Chat message → AI updates context.md | `chat_messages` + Storage |
| Pinned note | Pinned document | `documents.is_pinned` + Storage |
| File attachment | Binary file | `files` table + `attachments` bucket |

The `notes` table was a leftover from traditional CRM thinking. In an AI-first system:
- **Short input → chat_messages** (DB)
- **Long content → documents** (Storage, indexed in DB)
- **Binary files → files** (Storage, indexed in DB)

Three clean layers. No overlap.

---

## Search Strategy

### Phase 1: Metadata search (now)
```sql
-- Search document titles and tags
SELECT * FROM documents
WHERE (title ILIKE '%board%' OR '%board%' = ANY(tags))
  AND deal_id = ?
  AND deleted_at IS NULL;
```

### Phase 2: Excerpt search (soon)
```sql
-- pg_trgm on excerpts
SELECT * FROM documents
WHERE excerpt % 'board approval timeline'
ORDER BY similarity(excerpt, 'board approval timeline') DESC;
```

### Phase 3: Full-content search (later)
- Edge function triggered on document save
- Extracts keywords, entities, summaries
- Stores in a `document_search` table with tsvector
- OR: dedicated search service (Meilisearch) if volume demands

### AI-Powered Search (always available)
User asks in chat: "What did Sir Ricky say about the timeline?"
→ AI reads `context.md` for that deal
→ Answers from the living record
→ No traditional search needed for most queries

---

## Edge Cases

### 1. Context.md Grows Too Large
**Risk:** After 6 months, a deal's context.md is 50K words. Too big for Claude's context window.

**Fix:**
- AI periodically "compacts" old sections into a summary
- Archive old sections to `context-archive-{date}.md`
- Active `context.md` stays under 8K words (target)
- AI reads archive only when explicitly asked about old events

### 2. Concurrent Chat Messages Updating Same Context.md
**Risk:** Two AMs chat about the same deal simultaneously. Both trigger context.md updates. Race condition.

**Fix:**
- Queue document updates per deal_id (Supabase Edge Function + pg_advisory_lock or simple queue table)
- Each update reads current file → applies change → writes back
- Alternatively: append-only log file per deal, AI consolidates periodically

### 3. AI Writes Wrong Information to Context.md
**Risk:** AI misinterprets a chat message and writes incorrect facts.

**Fix:**
- Every context.md update stores the source chat_message_id in git-style metadata
- User can say "that's wrong, the budget is 3M not 2.5M" → AI corrects
- Version history via Supabase Storage versioning (if enabled) or backup copies
- `activities` log tracks every document modification with before/after

### 4. Deal Deletion
**Risk:** Deal is deleted. What happens to its documents and storage files?

**Fix:**
- Soft delete on deals: `deleted_at` timestamp
- Documents: `ON DELETE SET NULL` on `deal_id` — metadata preserved, files untouched
- Hard purge: admin action that deletes Storage files + document rows
- 30-day grace period before hard purge is available

### 5. Offline / Mobile
**Risk:** AM on mobile with bad connection can't fetch from Storage.

**Fix:**
- Chat still works (short messages stored in DB)
- `documents.excerpt` provides previews without Storage fetch
- AI can answer from the excerpt + deal DB fields as fallback
- Full document loads are lazy — only when AM explicitly opens one

### 6. Storage Costs
**Risk:** Transcripts and proposals pile up.

**Fix:**
- Track `word_count` per document, dashboard shows total usage
- Auto-archive: documents on closed-lost deals older than 6 months → compressed
- Supabase Pro: 100GB Storage included — more than enough for text
- Binary attachments are the real cost driver, not markdown files

### 7. Migration from Current `notes` Table
**Steps:**
1. Create `documents` table (new schema above)
2. Create Storage bucket `content`
3. For each row in `notes`:
   - Write `content` to Storage at `deals/{deal_id}/general-{id}.md`
   - Insert `documents` row with `storage_path`, `excerpt = left(content, 500)`
4. Verify row count matches
5. Update all API endpoints
6. Drop `notes` table
7. Update Drizzle schema

### 8. What If Supabase Storage Goes Down?
**Fix:**
- `documents.excerpt` still serves previews from DB
- Chat history still in DB — recent context available
- AI can function in degraded mode using DB-only data
- Storage outages are rare and short (Supabase SLA)
- Daily backup: pg_dump for DB + Storage bucket replication

---

## Final Schema Map

```
PostgreSQL (Drizzle)                Supabase Storage
──────────────────                  ─────────────────
users                               content/
accounts                              deals/{id}/
sessions                                context.md        ← THE living record
workspaces                              discovery/*.md
companies                               transcripts/*.md
contacts                                proposals/*.md
deals                                   meetings/*.md
products                                emails/*.md
tiers                                 companies/{id}/
pipeline_stages                         profile.md
activities                              history.md
am_roster                             digests/
chat_sessions                           {year}-w{week}.md
chat_messages
documents ──────────────────────────► points to files above
files ──────────────────────────────► attachments/
note_attachments                        {deal_id}/*.pdf,png,m4a
pitch_decks
customization_requests

DELETED:
  notes (replaced by documents + Storage)
```

---

## Summary

| Question | Answer |
|---|---|
| Do we need the `notes` table? | No. Replace with `documents` (metadata-only index). |
| Where does content live? | Supabase Storage, always. Zero content in PostgreSQL. |
| Where does short input go? | `chat_messages` in DB. AI processes and routes to documents. |
| What is context.md? | AI-maintained living record per deal. The deal's brain. |
| How does search work? | Metadata/excerpt search in DB. AI-powered search via context.md. |
| How does versioning work? | Proposals: `version` + `parent_id` in documents table. Context: append-only with periodic compaction. |

Three layers, zero overlap, AI-native from the ground up.
