# Symph CRM Frontend Visual Reference

This is the repo-owned visual reference for generated and human-authored frontend work in `apps/web`.

The original visual direction is: Attio density with Linear restraint. Use this file as the accessible source of truth for Aria, CI, and future agents. If a richer HTML reference is added later, link it from here instead of using a local machine path.

## Direction

- Compact, information-dense CRM surfaces.
- Restrained borders and neutral surfaces.
- Mono accents only where they improve scannability.
- Minimal decorative styling.
- Mock states must visually match the real component state they represent.

## Shape and spacing

- Default card, container, modal, dropdown, and popover radius: `rounded-md`.
- Default stacked-card and grid section gap: `gap-3`.
- Buttons, pills, badges, and avatars may use their component-specific radius.

## Typography

Use the project font-size scale from `apps/web/src/app/globals.css` and `.claude/rules/frontend.md`. Avoid arbitrary `text-[Npx]` values.

## Interaction tone

- Prefer simple fade/zoom modal motion.
- Avoid slide motion unless the UI is explicitly a slide-over or drawer.
- Keep loading, empty, and mock states visually consistent with real production states.
