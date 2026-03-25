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

### Data Fetching
- Use the `api` client from `lib/api.ts` for all backend calls:
  ```ts
  import { api } from '@/lib/api'
  api.get<Deal[]>('/deals')
  api.post<Deal>('/deals', body)
  api.put<Deal>(`/deals/${id}`, body)
  api.delete(`/deals/${id}`)
  ```
- Wrap in React Query hooks per feature:
  ```ts
  const { data, isLoading } = useQuery({
    queryKey: ['deals'],
    queryFn: () => api.get<Deal[]>('/deals'),
  })
  ```
- Mutations must invalidate relevant queries on success:
  ```ts
  const mutation = useMutation({
    mutationFn: (data) => api.post('/deals', data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['deals'] }),
  })
  ```
- Query keys follow `[resource]` or `[resource, id]` pattern.

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
