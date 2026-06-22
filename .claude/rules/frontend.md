# Frontend Rules — Next.js Web (`apps/web`)

## Architecture

- **Next.js 15.5** with App Router + Turbopack, **React 19**, **TypeScript 5.7**.
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
    constants.ts          # Feature constants and frontend-only static data
    design-tokens.ts      # CSS custom properties / design system values
    utils.ts              # Shared utilities
```

## Conventions

### Brand Identity Reference
- Before making frontend UI changes, read `docs/frontend-visual-reference.md` and use it as the repo-owned visual source of truth for Symph CRM.
- Follow its Attio-density, Linear-restraint direction: compact rows, restrained borders, neutral surfaces, mono accents, and minimal decorative styling.
- Card/container surfaces use `rounded-md` unless the revamp reference or a component primitive requires a different token.
- Keep mock UI states visually identical to the real component state they represent.

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

### Modals / Dialogs
- Before creating or changing any modal, reference `CreateDealModal.tsx` and `CreateBrandModal.tsx` as the baseline for overlay, centered layout, close button, footer button layout, animation, spacing, and dark mode.
- Default modal motion is simple centered fade/zoom (`animate-in zoom-in-95 fade-in-0 duration-200`). Do not use slide-in motion unless the UI is explicitly a slide-over or drawer.
- Modal footer actions use the Create Deal/Create Brand pattern: two equal-width `h-9 rounded-lg` buttons, secondary cancel on the left and primary gradient submit on the right.

### Conditional Styling — `cn()` Utility (MANDATORY)

Every component with conditional className logic MUST use the `cn()` utility from `@/lib/utils`. No exceptions.

```tsx
// CORRECT — always use cn()
import { cn } from '@/lib/utils'
<div className={cn('base-classes', isActive && 'active-class', variant === 'primary' ? 'bg-primary' : 'bg-slate-100')} />

// WRONG — template literals
<div className={`base-classes ${isActive ? 'active-class' : ''}`} />

// WRONG — string concatenation
<div className={'base-classes ' + (isActive ? 'active-class' : '')} />

// WRONG — ternary without cn()
<div className={isActive ? 'classA' : 'classB'} />
```

Rules:
- Import `cn` from `@/lib/utils` in every component that has conditional classes.
- Static className strings (`className="..."`) are fine without `cn()`.
- `cn()` merges Tailwind classes correctly and handles falsy values.

### Font Size Scale (MANDATORY)

No arbitrary `text-[Npx]` values. Use only these classes:

| Class | Size | Use Case |
|-------|------|----------|
| `text-atom` | 10px | Labels, uppercase section headers, tiny badges |
| `text-xxs` | 11px | Table column headers, pill badges, secondary info |
| `text-xs` | 12px | Body text, buttons, form inputs, tab labels |
| `text-ssm` | 13px | Card headings, modal descriptions, nav items |
| `text-sm` | 14px | Modal titles, input labels, prominent body text |
| `text-sbase` | 15px | Sub-headings, slide-over titles |
| `text-base` | 16px | Page titles |

Custom classes (`text-atom`, `text-xxs`, `text-ssm`, `text-sbase`) are defined in `globals.css` under `@theme inline` and registered in `tailwind-merge` via `lib/utils.ts`.

### Design Tokens — Border Radius & Spacing (MANDATORY)

- **Default border radius for all cards, containers, modals, dropdowns, popovers:** `rounded-md`. No `rounded-xl` or `rounded-lg` on card/container surfaces.
- **Gap between card sections:** `gap-3`. All pages that stack cards vertically or in grids use `gap-3` between card elements.
- Buttons, inputs, badges, pills, avatars may use their own radius (`rounded-lg`, `rounded-full`, etc.).

### Data Fetching — Three-Layer Architecture (MANDATORY)

Data flow is strictly one-directional:

```
Component → Domain Hook → API Client → Backend REST API
```

Each layer has one responsibility. **No layer skips another.** New frontend code must follow the domain hook structure below.

#### Layer 1 — API Client (`lib/api.ts`)

- Owns the low-level backend transport boundary.
- Attaches auth headers to every request and centralizes the backend URL.
- Parses error responses into a consistent error shape with extracted `message`.
- Exposes typed `api.get`, `api.post`, `api.put`, `api.patch`, `api.delete`, and `api.upload` helpers.
- Existing domain namespaces such as `api.leads.*` may remain. Do not force new namespaces unless the domain already uses that style or the change needs one.

Rules:
- No TanStack Query imports in this file.
- No React hooks or component logic.
- No caching, retry logic, invalidation, or toast notifications.
- Keep request and response types in `lib/types.ts` unless a type is private to `api.ts`.

#### Layer 2 — Domain Hooks (`lib/hooks/queries/` and `lib/hooks/mutations/`)

Domain hooks own server state, cache keys, default invalidation, and mutation feedback.

**Query hooks:**
- Place query hooks in `apps/web/src/lib/hooks/queries/{domain}-queries.ts`.
- Export every query hook through `apps/web/src/lib/hooks/queries.ts`.
- Use query keys from `apps/web/src/lib/query-keys.ts` only.
- Include every variable that affects the response in the query key.
- For `useQueries`, export query option helpers from the same domain query file, such as `getBillingByDealQueryOptions`.

**Mutation hooks:**
- Place mutation hooks in `apps/web/src/lib/hooks/mutations/{domain}-mutations.ts`.
- Export every mutation hook through `apps/web/src/lib/hooks/mutations.ts`.
- Call the API client in `mutationFn`.
- Own default cache invalidation in `onSuccess` for data the mutation changes.
- Own default success and error toasts for user-triggered mutations.
- Accept optional per-call `onSuccess`, `onError`, and `onSettled` callbacks for UI-only side effects.
- Spread caller `options` before hook-owned `onSuccess` when the hook must guarantee default invalidation.

**Shared flow hooks:**
- Put reusable UI/server orchestration in `apps/web/src/lib/hooks/use-{flow}.ts`.
- Use this for multi-step flows shared by components, such as Circleback upload polling.
- Flow hooks may compose query and mutation hooks but must not render JSX.

Rules:
- No JSX or rendering logic in hooks.
- No direct `fetch()` calls. Use `lib/api.ts`.
- Query keys must be deterministic.
- Toast messages for mutation results belong in mutation hooks, not components.
- Do not duplicate hook-owned invalidation in components.

#### Layer 3 — Components

Components own local UI flow only.

Allowed component responsibilities:
- Render UI and local state.
- Close modals, reset forms, focus inputs, and navigate after mutations.
- Handle optimistic cache writes and rollback when the UI owns the interaction.
- Show loading and error states from hook results.
- Pass per-call callbacks for local flow only.

Rules:
- **Never import `api` from `lib/api.ts` directly in components without an explicit documented exception.**
- **Never write `useQuery` or `useMutation` inline in components.** Use a domain hook or query option helper.
- **Never define query keys in components except for optimistic cache reads/writes tied to UI-owned flows.**
- **Never duplicate invalidation already owned by hooks.**
- **Never call `toast` for standard mutation success/error.** Hooks own that feedback.
- Keep data transformation minimal. Move complex transforms to hooks, payload helpers, or utilities.

#### Invalidation Ownership Rules

- Mutation hooks own default invalidation for their domain.
- Components keep invalidation only when the hook cannot know the UI context.
- Example: `useCreateDeal` owns `queryKeys.deals.all`; `CreateDealModal` may still invalidate `queryKeys.companies.deals(brandId)` because only the modal knows the source brand context.
- Stage transitions are an allowed exception. The UI may own invalidation when it owns optimistic multi-step stage movement and stage-specific toast text.
- Imperative signed URL/download flows may use mutation hooks even when the backend call is read-like because the user action triggers a browser side effect.

#### Payload Shaping Rules

- Do not build large create/update DTOs inline inside components.
- Put reusable payload shaping in `apps/web/src/lib/payloads/{domain}-payload.ts`.
- Payload helpers must be pure functions.
- Components may collect form state, then call a payload helper before invoking a mutation hook.

#### Adding a New Frontend Domain — Checklist

When adding a new domain, such as `invoices`:

1. Add or reuse response and request types in `apps/web/src/lib/types.ts`.
2. Add deterministic query keys in `apps/web/src/lib/query-keys.ts`.
3. Add query hooks in `apps/web/src/lib/hooks/queries/{domain}-queries.ts`.
4. Add mutation hooks in `apps/web/src/lib/hooks/mutations/{domain}-mutations.ts`.
5. Export hooks through `apps/web/src/lib/hooks/queries.ts` and `apps/web/src/lib/hooks/mutations.ts`.
6. Add payload helpers in `apps/web/src/lib/payloads/{domain}-payload.ts` when form DTO shaping is non-trivial.
7. Build components that consume only hooks, query option helpers, payload helpers, constants, and types.
8. Run `pnpm --filter @symph-crm/web exec tsc --noEmit` and `pnpm --filter @symph-crm/web build` after code changes.

#### Current Direct API Exceptions

These component-level `api` imports are known legacy exceptions and should not be copied:
- `Chat.tsx`
- `app/(auth)/onboarding/page.tsx`

When touching either file, prefer migrating the direct API calls into domain hooks instead of adding new direct calls.

### Styling
- **Tailwind only** — no inline `style={}` unless truly dynamic (e.g., colors from data).
- Card pattern: `bg-white border border-black/[.06] rounded-[10px] px-5 py-[18px] shadow-[var(--shadow-card)]`.
- Use design tokens from `lib/design-tokens.ts` and CSS variables for consistent theming.
- Responsive: mobile-first. Use `md:` and `lg:` breakpoints. Grid layouts: `grid grid-cols-1 lg:grid-cols-[2fr_1fr]`.
- Fonts: Geist (sans) and Geist Mono (mono), loaded via `next/font/google` in root layout.

### Shared Contracts, Enums & Types
- Before adding any enum, status union, role value, route constant, cookie name, or cross-app string literal, check `packages/shared/src/` first.
- Put reusable frontend/backend enums and constants in `packages/shared`, then import from `@symph-crm/shared` in both apps.
- Do not duplicate role/status/token/cookie literals in components, hooks, or API clients. Use shared enums such as `CrmUserRole`, `CrmUserStatus`, `CrmAuthTokenType`, `CrmAuthCookieName`, and `HttpMethod`.
- Keep frontend-only display constants in `lib/constants.ts`; move values to `packages/shared` when the backend also consumes them.

### Types
- Define frontend-only types near the feature or in `lib/constants.ts` when they are not shared with the backend.
- Use shared contracts from `@symph-crm/shared` and Drizzle's inferred types from `@symph-crm/database` when available for API response typing.
- Avoid `any`. Use `unknown` + type narrowing for dynamic data.

### Forms
- Use `react-hook-form` with Zod schemas for validation.
- Zod schemas live next to the component that uses them, or in a shared `lib/schemas/` directory if reused.
- Show validation errors inline below the field.

### Naming
- Route folders: `kebab-case` (e.g., `pipeline/`, `deals/`).
- Feature components: `PascalCase.tsx` (e.g., `DealDetail.tsx`).
- UI components: `kebab-case.tsx` (e.g., `button.tsx`, `select.tsx`).
- Query hook files: `{domain}-queries.ts` under `lib/hooks/queries/` (e.g., `deal-queries.ts`, `billing-queries.ts`).
- Mutation hook files: `{domain}-mutations.ts` under `lib/hooks/mutations/` (e.g., `deal-mutations.ts`, `billing-mutations.ts`).
- Shared flow hooks: `use-{flow}.ts` under `lib/hooks/` (e.g., `use-circleback-processing.ts`).
- Types/interfaces: `PascalCase` (e.g., `Deal`, `Stage`, `NoteEntry`).

## What NOT to Do

- Do NOT create API routes in `apps/web/src/app/api/`. All data goes through the NestJS backend at `apps/api`.
- Do NOT use `fetch()` directly — always use `lib/api.ts` wrapper for consistency and error handling.
- Do NOT use CSS modules, styled-components, or Emotion. Tailwind only.
- Do NOT put business logic in page files — pages are route wrappers only.
- Do NOT use default exports for components (only pages use default exports, as required by Next.js).
- Do NOT install new UI component libraries (Material UI, Chakra, etc.). Extend the existing Radix-based `components/ui/` system.
- Do NOT use `useEffect` for data fetching — use React Query.
- Do NOT hardcode API URLs. Use hooks backed by the `api` client and `BACKEND_API_URL` where an imperative browser URL is required.
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
