# Symph CRM — Product Requirements Document

**Version:** 3.0
**Status:** Active
**Last Updated:** 2026-03-25
**Product Owner:** Gee Quidet (CRSO)
**Tech Lead:** Vince Tapdasan

---

## 1. Executive Summary

Symph CRM is a sales pipeline management platform built for Symph's internal sales team. It replaces fragmented tools (HubSpot, spreadsheets, Viber threads) with a single connected system covering lead capture, deal tracking, proposal generation, and account manager coordination.

**Core principle:**
> "Everything in one place and connected. Intuitive enough to know this deal is moving forward — without manually updating a CRM after every meeting."

The platform is built to grow from internal tooling into a sellable SaaS product for other agencies and B2B teams.

---

## 2. Problem Statement

Symph's sales team operates across disconnected tools:

- Deal context lives in Viber threads, not a shared system
- No single view of pipeline health across all AMs
- Proposals are built manually per deal with no templates or versioning
- Handoffs between sales and build team are verbal, losing context
- No way to surface which products are selling, which are stalling, or why

Symph CRM unifies all of this into one system.

---

## 3. Target Users

### Vince — Dev Lead / Sales
Manages both dev and sales correspondence. Needs to track deals, draft proposals, coordinate AMs, and hand off context to the build team post-close.

### Gee — Chief Revenue & Solutions Officer
Owns revenue targets. Needs pipeline visibility, AM performance, and deal risk signals at a glance.

### Mary / Nick / Lyra — Account Managers
Run deals day-to-day. Need quick note logging, follow-up reminders, and proposal generation without switching tools.

### Kate / Chatla / Kee — Supporting AMs
Receive deal assignments, need onboarding context on new accounts, and clear next-step guidance per deal.

---

## 4. Goals & Success Metrics

### Product Goals
1. Give every AM a single system for all deal activity — no parallel tools
2. Surface deal risk before deals go cold (dormancy flags, follow-up automation)
3. Auto-generate proposals from deal context — reduce manual doc work
4. Enable clean post-close handoffs to the build team via auto-generated PRDs
5. Track product performance across deals to inform product roadmap

### KPIs

| Metric | Target | Timeframe |
|---|---|---|
| Daily active usage | 80% of AMs | 60 days post-launch |
| Notes logged per deal | 3+ | 60 days |
| Proposals generated in-CRM | 90% of deals | 90 days |
| Deals going cold undetected | 0 (flagged before 3 days) | 30 days |
| Handoff time (sales to build) | Under 30 min | 90 days |

---

## 5. Current State — Built (as of 2026-03-25)

### Phase 1 Complete

| Feature | Status |
|---|---|
| Authentication (email/password + Google OAuth) | Live |
| Role-based access control (super_admin, admin, manager, rep, viewer) | Live |
| User management (invite, assign roles) | Live |
| Multi-workspace architecture | Live |
| Company records (profile, contacts, deals, activity timeline) | Live |
| Contact management per company | Live |
| Deal pipeline Kanban with drag-and-drop (7 stages) | Live |
| Deal detail page (edit, notes, activities) | Live |
| Notes (Markdown, linked to deals/companies/contacts, pinnable, tagged) | Live |
| File attachments on notes | Live |
| Activity/audit log (19+ event types, JSONB metadata) | Live |
| Product catalog (7 Symph products x 3 tiers) | Live |
| Dashboard KPIs (pipeline value, active deals, win rate, avg deal size) | Live |
| AM roster per workspace (assignment tracking) | Live |
| Custom pipeline stages per workspace | Live |
| AI pitch deck generator (Claude API) | Live |
| Demo site generator (shareable /demo/[token] pages) | Live |
| CSV import with duplicate detection | Live |
| Chat interface (mock AI, foundation for Claude integration) | Live |
| Mobile responsive layout | Live |
| VPS deployment | Live |

### Tech Stack (Locked)

| Layer | Choice |
|---|---|
| Frontend | Next.js 15.2 + React 19 + TypeScript + Tailwind v4 |
| Backend | NestJS 11 (port 4000) |
| Database | PostgreSQL via Supabase + Drizzle ORM v0.39 |
| Auth | NextAuth.js + Google OAuth |
| Data Fetching | TanStack React Query v5 |
| UI Components | Radix UI + custom component library |
| Monorepo | pnpm workspaces (apps/api, apps/web, packages/database) |
| AI | Anthropic Claude API |
| Hosting | VPS |

---

## 6. Feature Roadmap

### Priority Tiers
- **P0** — Must ship for the product to make sense
- **P1** — Significantly increases value, ship in first major iteration post-Phase 1
- **P2** — Desirable, deferrable to Phase 3+

---

### Phase 2 — CRM Depth

| Feature | Description | Priority | Status |
|---|---|---|---|
| Task & Activity Management | Tasks, calls, meetings logged against any CRM object. Due dates, reminders. | P0 | Not built |
| Pipeline Analytics | Win/loss reporting, stage conversion rates, rep performance dashboards | P0 | Not built |
| Dormancy Flags | 1 day unreplied = flag. 3 days dormant = AM alert. Auto-drafted follow-up suggestions. | P0 | Not built |
| Email Integration (Gmail) | OAuth two-way sync, email tracking, auto-logged to deal records | P0 | Not built |
| Proposal Auto-Versioning | Track proposal changes per deal, show diffs between versions | P1 | Not built |
| Custom Properties | User-defined fields on any object (text, number, date, select) | P1 | Not built |
| Meeting Scheduler | Shareable booking links, Google Calendar sync | P1 | Not built |
| Note Versioning | Full edit history per note, restore to prior state | P1 | Not built |

---

### Phase 3 — Knowledge Graph

| Feature | Description | Priority | Status |
|---|---|---|---|
| Bidirectional Note Linking | `[[wikilink]]` syntax linking notes to any CRM object. Backlinks panel on every record. | P0 | Not built |
| Tags | Inline `#tags` on notes. Filter across the system. | P0 | Not built |
| Global Search | Single `⌘K` search across notes, deals, companies, contacts. Ranked results. | P0 | Not built |
| Graph View | Force-directed visualization of all connected objects. Filter by type, tag, stage. | P1 | Not built |
| Note Templates | User-defined templates (Discovery Call, Objection Log, Meeting Recap). `/` insert. | P1 | Not built |
| Daily Notes | Auto-generated daily note per rep linked to that day's deals and tasks. | P1 | Not built |

---

### Phase 4 — AI & Automation

| Feature | Description | Priority | Status |
|---|---|---|---|
| AI Enrichment | Auto-research leads (company size, industry, risk signals, product fit scoring) | P0 | Not built |
| AI Meeting Summaries | Auto-summary from call transcript, extracts action items, links to deal | P1 | Not built |
| Smart Note Suggestions | As rep types, surfaces related records and past similar deals | P1 | Not built |
| PRD Generation Post-Close | Auto-generates build-ready PRD from discovery notes on Closed Won | P0 | Not built |
| Sequence Automation | Multi-step automated outreach with email/task/call steps | P1 | Not built |
| Competitive Intelligence Hub | Shared team knowledge base of competitor notes and battle cards | P2 | Not built |
| Knowledge Handoff | Auto-generated deal dossier when deal changes owner | P1 | Not built |

---

### Phase 5 — Integrations & Scale

| Integration | Description | Priority | Status |
|---|---|---|---|
| Slack | Deal update notifications, `/crm` slash commands | P1 | Not built |
| Zoom / Google Meet | Meeting scheduler + AI summary push post-meeting | P1 | Not built |
| Zapier / Make | No-code automation webhooks | P1 | Not built |
| REST API | Public API with OAuth 2.0 | P1 | Not built |
| HubSpot Migration | One-click import from HubSpot | P1 | Not built |
| Mobile App (iOS/Android) | Native or PWA | P2 | Not built |

---

## 7. Deal Structure

### Brand → Deal Hierarchy
One client brand can have multiple deals:
- ML → ML ASYS Deal, ML KP Deal
- Symph → Internal tooling deal, SaaS licensing deal

### Pipeline Stages
`Lead → Discovery → Assessment → Proposal & Demo → Follow-up → Closed Won / Closed Lost`

### Deal Info (Standard Fields)
- Outreach category: Inbound / Outbound
- Date captured
- Client brand
- Deal name
- Point of contact (client side)
- Deal size: Fixed / Monthly / Annual
- Industry (auto-fill from enrichment)
- Services tagged: Agency (Consulting, Staff Aug, Reseller) or Internal Products
- Assigned AM
- Latest update

---

## 8. AM Roster

Auto-rotating assignment pool per workspace:
- Mary
- Lyra
- Kee
- Vince
- Chatla
- Kate

---

## 9. Flagging Rules

- Any deal unreplied for **1 day** → flag in deal view
- Any deal dormant for **3 days** → alert to assigned AM
- After 3 unanswered follow-up cycles → escalate to sales manager

---

## 10. Post-Close Flows

### Closed Won
- Full context locked as permanent record
- AI auto-generates PRD from discovery notes
- AM reviews before handoff to build team
- Upsell/cross-sell suggestions surfaced from similar deals

### Closed Lost
- Loss reason required (Price / Competitor / Timing / No Budget / Out of Scope / Unresponsive / Other)
- Re-engagement date can be set — deal reactivates on that date, pre-loaded with history

---

## 11. UX Principles

- **3-tap maximum** for common actions (log note, move deal stage, assign AM)
- **No mandatory fields at capture** — save with minimal data, complete later
- **Mobile-first** — one-handed use, voice notes, quick capture
- **Progressive disclosure** — essentials visible by default, depth on demand
- **AI outputs are always editable** before sending — drafts, not finals
- **Every update is attributable** — who changed what, when

---

## 12. Non-Functional Requirements

### Performance
- Deal list load: under 300ms
- Search results: under 200ms
- Graph queries (Phase 3): under 500ms for networks up to 100K nodes

### Security
- TLS in transit, AES-256 at rest
- Role-based access with field-level support
- Audit log for all data access and modification
- No secrets committed to git — environment variables only

### Reliability
- 99.9% uptime target
- Daily automated DB backups with point-in-time recovery
- Graceful degradation — AI features fail silently, core CRM stays operational

---

## 13. Out of Scope (Current)

- Marketing automation / campaign management
- Customer support ticketing
- Native invoicing or CPQ
- On-premise deployment
- Real-time WebSockets (React Query polling is sufficient)
- Voice transcription (Phase 4+)

---

## 14. Competitor Landscape

| Product | CRM Strength | Notes Gap | What We Fill |
|---|---|---|---|
| HubSpot CRM | High | Notes are appendages, no graph | Connected knowledge + pipeline in one |
| Salesforce | High | Rigid, zero knowledge layer | Flexible, built for agencies |
| Notion CRM | Medium | Not purpose-built for sales | Real pipeline + automation |
| Attio | High | No knowledge graph | Graph view + AI enrichment |

---

*Maintained by Vince Tapdasan. Update after every significant product decision.*
