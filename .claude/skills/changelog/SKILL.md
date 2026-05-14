---
name: changelog
description: Convert recent git commits into user-friendly "What's new" changelog entries for the Symph CRM `change_logs` table. Strips technical jargon, conventional-commit prefixes, and engineering details — produces short, plain-language one-liners aimed at end users (sales reps, account managers, admins). Filters out noise commits (chore/docs/refactor with no user impact). Inserts results as `draft` entries; admin reviews via /audit-logs → Change log tab → publish. Use when the user says "/changelog", "draft a changelog", "what's new since last release", or after pushing a batch of work.
---

# /changelog — git commits → player-facing changelog entries

## Audience and tone

The output is shown to **end users** (sales reps, AMs, admins) inside a "What's new" dialog. They don't care that you migrated to a new schema or refactored a hook — they care **what changed for them and why**.

Tone reference (good):
> "Added a fix for an endless world loading issue that has been reported by players."
> "Pipeline cards now show the product logo instead of the generic 'Internal Products' label."
> "Recordings now upload faster and transcribe automatically when the call ends."

Tone reference (bad — never do this):
> "Refactored DealCard to render product icon via useGetInternalProducts catalogIconById Map."
> "Patched img-src directive in next.config.ts to whitelist *.supabase.co."
> "Bumped @tanstack/react-query to v5 and replaced legacy callbacks."

## Workflow

### 1. Determine the commit range

Use the Supabase MCP (`mcp__supabase__execute_sql`) on project `juiwzbfvuvrtjizedtio`:

```sql
SELECT git_sha, released_at
FROM change_logs
WHERE status = 'published' AND git_sha IS NOT NULL
ORDER BY released_at DESC
LIMIT 1;
```

- If a row exists → use `git_sha` as the cursor. Pull commits with `git log <cursor>..HEAD`.
- If no row exists → default to the last 20 commits: `git log -20`.

### 2. Pull commits

Run via Bash from the repo root:

```bash
git log <cursor>..HEAD --pretty=format:'%H|||%s|||%b<<<END>>>' --name-only
```

Parse each entry: SHA, subject, body, files changed.

### 3. Filter noise

A commit is **noise** (skip it) when ALL of these are true:
- The conventional-commit type is one of: `chore`, `docs`, `style`, `refactor`, `test`, `ci`, `build`, `perf` (perf gets reclassified — see below).
- No files touched are user-visible. User-visible directories:
  - `apps/web/src/components/`
  - `apps/web/src/app/`
  - `apps/api/src/<feature>/controller.ts`
  - `apps/api/src/<feature>/service.ts`
  - `packages/database/src/schema/`

Always include (no matter the scope):
- `feat`, `feat!`, `fix`, `fix!`
- Anything with `BREAKING CHANGE:` in the body
- Anything whose scope is a customer-facing surface name (`catalog`, `proposals`, `pipeline`, `deals`, `billing`, `recordings`, `calendar`, `wiki`, `chat`, `dashboard`, `auth-nav`)

Edge cases:
- `perf` with measurable UX impact ("page loads faster", "less lag") → include as `improvement`
- Pure dependency bumps → skip unless security-critical
- Reverts → include with prefix "Reverted: …" — users care if something disappeared

Report at the end: N commits scanned, M kept, K filtered (with one-line rationale per skipped commit).

### 4. Group when sensible

If several commits in the range touch the same surface and tell one story, merge them into a single entry. Example:

```
73ec779 fix(catalog): allow Supabase storage in CSP
7a7824b fix(catalog): invalidate internal-products cache on icon upload
```

→ One entry: "Catalog logos now appear correctly and update instantly after upload."
Set `git_sha` = newest, `git_range_start` = oldest.

Don't over-group — each user-visible change deserves its own bullet when distinct.

### 5. Rewrite each kept commit

Process for every commit (or merged group):

1. **Strip** the conventional-commit prefix and scope. `fix(catalog): X` → `X`.
2. **Identify the user value**: ask "what does the user see / not see / now have that they didn't before?" If you can't answer in one sentence without saying "we", skip the commit — it's probably internal.
3. **Draft a title** (under 60 chars, no period). Plain English, no scope prefix. Sentence case.
4. **Draft a description** (one sentence, under 25 words). Continues the title — together they form a single readable thought. Past tense for fixes, present tense for ongoing capability.
5. **No internals**: no React/Drizzle/TanStack/Postgres/Supabase/iframe/sandbox/CSP/header names. No commit SHAs in the body. No PR numbers.

Title + description join cleanly when rendered. Final output reads as a single sentence:

> **Product logos in the deal pipeline.** Deals tied to a product now show the product's logo on the kanban card instead of a generic pill.

### 6. Choose category

Map the conventional-commit type to `change_logs.category`:
- `feat` → `feature`
- `fix` → `fix`
- `perf`, `refactor` (when user-visible) → `improvement`
- breaking change marker → `breaking`
- anything else you decide to include → `chore`

### 7. Preview, then insert

Show the user a preview of all proposed drafts in a single table:

| # | Category | Title | Description | Commits |
|---|----------|-------|-------------|---------|
| 1 | feature | … | … | 432afb2 |
| 2 | fix | … | … | 7a7824b…73ec779 |

Ask: "Insert all as drafts? (y/edit/cancel)".
- `y` → insert via Supabase MCP, one INSERT per row.
- `edit` → ask which row to revise.
- `cancel` → exit, nothing written.

### 8. Insert as drafts (never auto-publish)

For each approved entry, run via `mcp__supabase__execute_sql`:

```sql
INSERT INTO change_logs (title, description, category, status, git_sha, git_range_start)
VALUES (
  '<title>',
  '<description>',
  '<category>',
  'draft',           -- never 'published' — admin decides via /audit-logs
  '<newest sha>',
  <NULL or '<oldest sha>'>
);
```

### 9. Report

Final report to the user:
- Drafted: <count>
- Filtered: <count> (collapsible list with one-line rationale)
- Next: open `/audit-logs?tab=changelog` to review, edit, and flip status to `published`. The "What's new" dialog will then pop for everyone with an older `changelog_acked_at`.

## Hard rules

- **Never** auto-publish. Every output is `status = 'draft'`. The admin flips the switch.
- **Never** include the engineer's name, the team, or "we just shipped" framing. Users don't care who built it.
- **Never** describe the implementation. "Used a new caching strategy" is the implementation; "Pages load faster now" is the user value.
- **Never** include URLs, file paths, or function names in the description.
- **Never** invent user impact. If a commit's user-facing benefit is unclear, skip it rather than make something up.
- **Always** set `git_sha` (and `git_range_start` when grouping).
- **Always** preview before inserting. The admin has final say.

## Examples

### Example 1 — one commit, one entry

Commit:
```
432afb2 feat(proposals): rebuild as workspace index + dedicated detail page
```

Skill output:
```
Title:       Proposals just got a fresh layout
Description: Find every proposal in your workspace in one place. Click any card to open it full-screen with a single tap.
Category:    feature
git_sha:     432afb2
```

### Example 2 — two commits grouped

Commits:
```
73ec779 fix(catalog): allow Supabase storage in CSP + use product icon in kanban
7a7824b fix(catalog): invalidate internal-products cache on icon upload
```

Skill output:
```
Title:           Product logos show up properly across the app
Description:     Logos uploaded in Catalog appear instantly on the row, and pipeline cards now display the product's logo instead of a plain text pill.
Category:        improvement
git_sha:         73ec779
git_range_start: 7a7824b
```

### Example 3 — filtered out

Commit:
```
4db0709 chore: bump next.js to 15.5.18 (CVE security patch May 2026)
```

Rationale (for the filter report): "Dependency bump — no user-facing change."
Action: skipped.

### Example 4 — security patch that IS user-facing

Commit:
```
abc1234 fix(auth): close session-fixation hole in password reset flow
```

Skill output:
```
Title:       Password reset is now more secure
Description: We tightened the password reset flow to prevent session-fixation attacks. No action needed — you're already protected.
Category:    fix
git_sha:     abc1234
```
