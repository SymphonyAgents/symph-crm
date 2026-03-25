# Symph CRM — Roadmap

**Last Updated:** 2026-03-25

---

## Phase Overview

| Phase | Focus | Status |
|---|---|---|
| Phase 1 | Foundation — Auth, Pipeline, Notes, AI Pitch Deck | Complete |
| Phase 2 | CRM Depth — Tasks, Analytics, Email, Dormancy Flags | Next |
| Phase 3 | Knowledge Graph — Wikilinks, Graph View, Global Search | Planned |
| Phase 4 | AI & Automation — Enrichment, Summaries, PRD Generation | Planned |
| Phase 5 | Integrations & Scale — Slack, Zoom, API, Mobile | Planned |

---

## Phase 1 — Foundation (Complete)

All items shipped and live at `crm.dev.apps.symph.co`.

- [x] Authentication — email/password + Google OAuth (NextAuth v5)
- [x] RBAC — super_admin, admin, manager, rep, viewer
- [x] User management — invite, assign roles
- [x] Multi-workspace architecture
- [x] Company records — full profile, contacts, deals, activity timeline
- [x] Contact management per company
- [x] Deal pipeline — Kanban drag-and-drop, 7 stages
- [x] Deal detail — edit form, notes tab, activity feed
- [x] Notes — Markdown, linked to deals/companies/contacts, pinnable, tags
- [x] File attachments on notes
- [x] Activity/audit log — 19+ event types with JSONB metadata
- [x] Product catalog — 7 Symph products x 3 tiers
- [x] Dashboard KPIs — pipeline value, active deals, win rate, avg deal size
- [x] AM roster per workspace — assignment tracking
- [x] Custom pipeline stages per workspace
- [x] AI pitch deck generator (Claude API)
- [x] Demo site generator (shareable /demo/[token])
- [x] CSV import with duplicate detection
- [x] Chat interface (mock AI, foundation for Phase 4)
- [x] Mobile responsive layout
- [x] VPS deployment

---

## Phase 2 — CRM Depth

**Priority: Ship these before Phase 3.**

### TASK-P2-001 — Dormancy Flags + Follow-up Automation
- Flag any deal unreplied for 1 day
- Alert assigned AM when deal dormant for 3 days
- After 3 unanswered cycles, escalate to manager
- Auto-draft follow-up message (email or Viber-ready copy)

### TASK-P2-002 — Task & Activity Management
- Tasks (call, email, meeting, to-do) on any CRM object
- Due dates + reminder alerts
- AM task view — see all open tasks per rep

### TASK-P2-003 — Pipeline Analytics
- Win/loss rate by stage
- Stage conversion rates
- Average time in stage
- Rep performance dashboard (deals closed, pipeline value, win rate)
- AM leaderboard

### TASK-P2-004 — Gmail Integration
- OAuth two-way email sync
- Auto-link email threads to deal records
- Email open/click tracking
- Draft follow-ups from within CRM deal view

### TASK-P2-005 — Proposal Auto-Versioning
- Track proposal edits per deal (v1, v2, v3...)
- Auto-generate diff summary between versions
- Require loss reason if deal closes after price negotiation

### TASK-P2-006 — Note Versioning
- Full edit history per note
- Restore to any prior version

### TASK-P2-007 — Custom Properties
- User-defined fields on companies, contacts, deals
- Field types: text, number, date, select (dropdown)
- Filterable in pipeline and deal list views

### TASK-P2-008 — Meeting Scheduler
- Shareable booking links per AM
- Google Calendar sync
- Embed link in email templates

---

## Phase 3 — Knowledge Graph

### TASK-P3-001 — Bidirectional Note Linking
- `[[wikilink]]` syntax in Markdown notes
- Auto-resolves to CRM objects (notes, deals, companies, contacts) by name
- Backlinks panel on every deal/company/contact record

### TASK-P3-002 — Tags System
- Inline `#tag` syntax in notes
- Tag filter views across all notes
- Tag cloud on dashboard

### TASK-P3-003 — Global Search (⌘K)
- Single command palette querying notes, deals, companies, contacts
- Results ranked by relevance
- Filter by object type, date, author

### TASK-P3-004 — Graph View
- Force-directed visualization of all connected objects
- Nodes: notes, deals, companies, contacts
- Filter by type, tag, deal stage
- Click node to open record

### TASK-P3-005 — Note Templates
- User-defined templates (Discovery Call, Objection Log, Meeting Recap, Proposal Summary)
- Insert via `/` command in note editor

### TASK-P3-006 — Daily Notes
- Auto-generated per rep each day
- Auto-linked to that day's deals, tasks, and meetings

---

## Phase 4 — AI & Automation

### TASK-P4-001 — AI Lead Enrichment
- On lead capture: auto-research company (size, industry, funding, tech stack)
- Surface risk signals (layoffs, legal issues) and opportunity indicators (hiring, growth)
- Product fit scoring across catalog

### TASK-P4-002 — AI Meeting Summaries
- Transcription from call recording (upload or Zoom link)
- Auto-extract requirements, pain points, action items
- Link summary to deal record

### TASK-P4-003 — PRD Generation Post-Close
- On Closed Won: auto-generate build-ready PRD from discovery notes
- AM reviews requirements/AC/priorities before sending to build team
- Discord notification to build team on PRD send

### TASK-P4-004 — Smart Note Suggestions
- As rep types, surface related records and similar past deals
- Semantic search via pgvector embeddings

### TASK-P4-005 — Sequence Automation
- Multi-step outreach sequences (email, task, call)
- Branch logic on reply/no reply
- Via pg-boss background jobs (no Redis)

### TASK-P4-006 — Knowledge Handoff
- When deal changes owner: auto-generate deal dossier
- Includes all discovery notes, contacts, decision makers, objections, history

### TASK-P4-007 — Competitive Intelligence Hub
- Shared team knowledge base for competitor notes and battle cards
- Linked to deals where used
- Surfaces relevant cards during active deals

---

## Phase 5 — Integrations & Scale

### TASK-P5-001 — Slack Integration
- Deal update notifications to Slack channel
- `/crm` slash commands for quick deal updates

### TASK-P5-002 — Zoom / Google Meet
- Meeting scheduler integration
- Auto-push AI summary to deal after meeting

### TASK-P5-003 — Zapier / Make
- Native webhook triggers for deal events
- No-code automation support

### TASK-P5-004 — REST API
- Full public API with OAuth 2.0
- Enables external integrations and white-label use

### TASK-P5-005 — HubSpot Migration Tool
- One-click import: contacts, companies, deals, notes
- Duplicate detection + field mapping UI

### TASK-P5-006 — Mobile App
- iOS/Android native or PWA
- Home screen widget for quick note capture
- Voice note → transcript → deal log

---

## Open Questions

| # | Question | Owner | Status |
|---|---|---|---|
| 1 | Graph DB: stay on Postgres graph layer long-term vs. move to Neo4j? | Vince | Assumed Postgres — revisit at 500K+ nodes |
| 2 | AI summaries: build in-house (Anthropic) vs. partner with Fireflies.ai? | Gee | Open |
| 3 | Pricing model for external SaaS: seat-based vs. workspace-based? | Gee | Open |
| 4 | Mobile: PWA acceptable at Phase 5 or native required? | Vince | Open |
| 5 | Email sync priority: ship analytics first, then Gmail? | Gee | Assumed yes |
| 6 | Kate — confirm on AM roster | Gee | Open |

---

*Maintained by Vince Tapdasan. Update after every sprint or product decision.*
