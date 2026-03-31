# Frontend Rules — Next.js Web (`apps/web`)

## Architecture

- **Next.js 15.2** with App Router + Turbopack, **React 19**, **TypeScript 5.7**.
- **Tailwind v4** for styling. No CSS modules, no styled-components.
- **TanStack React Query v5** for server state. Configured in `providers.tsx` with 60s staleTime, no refetch on window focus.
- **Radix UI** primitives wrapped in custom components under `components/ui/`.
- **react-hook-form + Zod** for forms and validation.

## Project Structure

```
apps/web/src/
  app/                    # Next.js App Router pages
    layout.tsx            # Root layout — Providers + CrmShell wrapper
    page.tsx              # Dashboard (default route)
    {feature}/page.tsx    # Feature pages — thin, delegate to components
    {feature}/[id]/page.tsx  # Detail pages with dynamic routes
    providers.tsx         # QueryClientProvider setup
    globals.css           # Global styles + Tailwind
  components/
    ui/                   # Radix UI primitives (button, input, select, card, table, etc.)
    {Feature}.tsx         # Feature components (Dashboard, Pipeline, Deals, DealDetail, etc.)
  lib/
    api.ts               # API client — typed fetch wrapper
    constants.ts          # Types, stage definitions, static data
    design-tokens.ts      # CSS custom properties / design system values
    utils.ts              # Shared utilities
```

## Conventions

### Pages (App Router)
- Pages are **thin route wrappers** — they render a single feature component.
- Pattern: `export default function XPage() { return <X /> }`
- Use `'use client'` only when the page needs hooks (e.g., `useRouter`). If the page just renders a component, it can stay as a server component.
- Dynamic routes: `[id]/page.tsx` — access params via the page props.

### Components
- **Feature components** go in `components/` root (e.g., `Dashboard.tsx`, `Pipeline.tsx`).
- **UI primitives** go in `components/ui/` (e.g., `button.tsx`, `card.tsx`, `table.tsx`).
- All interactive components must have `'use client'` directive at the top.
- Component files are `PascalCase` for features (`Dashboard.tsx`) and `kebab-case` for ui primitives (`button.tsx`).
- Export named components, not default exports (e.g., `export function Dashboard()`).

### Data Fetching — Three-Layer Architecture (MANDATORY)

Data flow is strictly one-directional:

```
Component → Custom Hook → API Client → Backend REST API
```

Each layer has a single responsibility. **No layer skips another.**

#### Layer 1 — API Client (`lib/api.ts`)

- Single source of truth for all backend communication.
- Every backend endpoint is wrapped in a **typed async function**.
- Attaches auth headers to every request; centralizes base URL via env var.
- Parses error responses into a consistent error shape with extracted `message`.
- Returns typed data so consumers get full TypeScript safety.
- Methods are grouped by domain: `api.deals.list()`, `api.deals.create(dto)`, etc.

Rules:
- No TanStack Query imports in this file.
- No React hooks or component logic.
- No caching, retry logic, or toast notifications.
- Every method must have typed params and typed return value.

#### Layer 2 — Custom Hooks (`lib/hooks/` directory)

- Encapsulate all TanStack Query logic and user feedback in dedicated hook files.
- One file per domain: `useDealsQuery.ts`, `useContactsQuery.ts`, etc.
- Each file can export multiple hooks: `useDealsList`, `useDealDetail`, `useCreateDeal`, `useUpdateDeal`.

**Query hooks:**
- Accept filter params that feed into both the query key and the api call.
- Use query key arrays that include all filter dependencies: `['deals', filters]`.

**Mutation hooks:**
- Call the corresponding `api.ts` method in `mutationFn`.
- Invalidate related query keys in `onSuccess` so lists refresh automatically.
- Show `toast.success` on success and `toast.error(err.message)` on failure.
- Accept optional per-call `onSuccess`/`onError` callbacks for component-specific side effects (close dialog, navigate).

Rules:
- No JSX or rendering logic.
- No direct `fetch()` calls — always go through `lib/api.ts`.
- Query keys must be deterministic and include all variables that affect the response.
- **Toast messages belong here, not in components.**

#### Layer 3 — Components

- Import and call custom hooks from `lib/hooks/`.
- Destructure hook returns: `{ data, isLoading, mutate, isPending }`.
- Show loading and error states based on hook status.
- Pass per-call callbacks to mutations when needed (close dialog, reset form).

Rules:
- **Never import from `lib/api.ts` directly.**
- **Never write `useQuery` or `useMutation` inline in the component.**
- **Never define query keys in components.**
- **Never call `toast` for mutation results — the hook owns that feedback.**
- Keep data transformation minimal — push complex transforms into the hook or a utility.

#### Adding a New Feature — Checklist

When adding a new domain (e.g., "invoices"):

1. **Backend:** create the REST endpoints.
2. **API Client:** add an `invoices` namespace to the `api` object in `lib/api.ts` with typed methods.
3. **Types:** add the `Invoice` type to the shared types file.
4. **Hooks:** create `lib/hooks/useInvoicesQuery.ts` with query and mutation hooks, including toast notifications for all mutations.
5. **Components:** build UI that consumes only the hooks from step 4.

### Styling
- **Tailwind only** — no inline `style={}` unless truly dynamic (e.g., colors from data).
- Card pattern: `bg-white border border-black/[.06] rounded-[10px] px-5 py-[18px] shadow-[var(--shadow-card)]`.
- Use design tokens from `lib/design-tokens.ts` and CSS variables for consistent theming.
- Responsive: mobile-first. Use `md:` and `lg:` breakpoints. Grid layouts: `grid grid-cols-1 lg:grid-cols-[2fr_1fr]`.
- Fonts: Geist (sans) and Geist Mono (mono), loaded via `next/font/google` in root layout.

### Types
- Define all shared types in `lib/constants.ts` (co-located with constants that use them).
- Use Drizzle's inferred types from `@symph-crm/database` when available for API response typing.
- Avoid `any`. Use `unknown` + type narrowing for dynamic data.

### Forms
- Use `react-hook-form` with Zod schemas for validation.
- Zod schemas live next to the component that uses them, or in a shared `lib/schemas/` directory if reused.
- Show validation errors inline below the field.

### Naming
- Route folders: `kebab-case` (e.g., `pipeline/`, `deals/`).
- Feature components: `PascalCase.tsx` (e.g., `DealDetail.tsx`).
- UI components: `kebab-case.tsx` (e.g., `button.tsx`, `select.tsx`).
- Hooks: `use{Feature}.ts` (e.g., `useDeals.ts`, `usePipeline.ts`).
- Types/interfaces: `PascalCase` (e.g., `Deal`, `Stage`, `NoteEntry`).

## What NOT to Do

- Do NOT create API routes in `apps/web/src/app/api/`. All data goes through the NestJS backend at `apps/api`.
- Do NOT use `fetch()` directly — always use `lib/api.ts` wrapper for consistency and error handling.
- Do NOT use CSS modules, styled-components, or Emotion. Tailwind only.
- Do NOT put business logic in page files — pages are route wrappers only.
- Do NOT use default exports for components (only pages use default exports, as required by Next.js).
- Do NOT install new UI component libraries (Material UI, Chakra, etc.). Extend the existing Radix-based `components/ui/` system.
- Do NOT use `useEffect` for data fetching — use React Query.
- Do NOT hardcode API URLs — use the `api` client which reads `NEXT_PUBLIC_API_URL`.
- Do NOT commit `.env` or `.env.local` files.

## Dark / Light Mode (MANDATORY)

- **Every color change must account for both light and dark mode.** No exceptions.
- Use Tailwind `dark:` variants: `text-slate-900 dark:text-white`, `bg-white dark:bg-[#1e1e21]`, etc.
- When using `inline style` for dynamic colors (e.g., colors from data), the light-mode inline style must always be paired with a `dark:` Tailwind variant on the same element or a CSS variable that resolves in both themes.
- Never add a color in light mode only and leave dark mode broken. Always check and update both.
- The dark mode toggle is always active — all UI must render correctly in both modes at all times.

## Pipeline Stage Constraint (MANDATORY)

- **Kanban drag is forward-only. Once a deal is advanced to a stage, it cannot be dragged back.**
- Enforce via `STAGE_ORDER` index: if `targetOrder < currentOrder`, block the drop silently (no toast, no error — no-op).
- `closed_won` and `closed_lost` are at the same order level (both terminal) — moves between them are allowed.
- This constraint applies to all drag-drop and any programmatic stage update in the pipeline.
