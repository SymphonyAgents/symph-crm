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

## Modal / Overlay Performance

For any new modal, dialog, select menu, popover, dropdown, command palette, or overlay in `apps/web`, use the existing shadcn/Radix primitives in `apps/web/src/components/ui/` as the default foundation.

New modal animations must use the shared lightweight pattern: `data-state` or `animate-in` fade/zoom, `duration-150 ease-out` on open, and around `duration-100 ease-in` on close. Avoid custom slide motion unless the UI is explicitly a drawer or slide-over.

Do not add `backdrop-blur-*`, `shadow-2xl`, or large custom overlay shadows to modal backdrops/content. These caused low-FPS modal transitions in this project. Use a plain translucent backdrop (`bg-black/45` or the existing `DialogOverlay`) and `shadow-lg` unless there is a specific measured reason to do otherwise.

Before creating or changing a modal, compare against `CreateDealModal.tsx`, `CreateBrandModal.tsx`, and `components/ui/dialog.tsx` so spacing, close behavior, dark mode, and transition timing stay consistent.

## Commit Workflow

When the user asks for a commit, reference the `source-command-commit` skill before committing and use it as the commit workflow checklist.

If `source-command-commit` conflicts with higher-priority system, developer, security, or explicit project instructions, follow the higher-priority instruction and call out the conflict before committing.
