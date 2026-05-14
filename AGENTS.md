# Project Codex Instructions

## Claude Rules Hook

Before doing implementation, review, debugging, or architecture work, inspect `.claude/rules/` and read only the rule files that match the user's task.

Task-to-rule mapping:

- Frontend, UI, React, Next.js, Tailwind, components, pages, client state, forms, browser behavior, or `apps/web` work: read `.claude/rules/frontend.md`.
- Backend, API, NestJS, database, Drizzle, schema, migrations, services, controllers, or `apps/api` / `packages/database` work: read `.claude/rules/backend.md`.
- Full-stack work: read both frontend and backend rules.

If `.claude/rules/` does not exist, or if no rule file matches the task, say so immediately before proceeding. Do not invent rules or infer nonexistent rule content.

If a relevant rule file exists but cannot be read, stop and report the read failure. Do not proceed using guessed rules.

These project rules supplement the global instructions. If they conflict with higher-priority system, developer, or security instructions, follow the higher-priority instruction and call out the conflict when it affects the task.
