# Symph CRM — Frontend Design Rules

Every component in this project MUST follow these patterns. No exceptions.

## Color Palette

| Token | Value | Usage |
|---|---|---|
| Body bg | `#f8f9fb` | Page/shell background |
| Surface | `bg-white` | Cards, panels, containers |
| Surface hover | `bg-slate-50` | Hover states on list items |
| Input bg | `bg-slate-100` | Search inputs, filter backgrounds |
| Border | `border-black/[.06]` | All card/container/divider borders |
| Border strong | `border-black/[.08]` | Buttons, column containers |
| Primary accent | `#6c63ff` | CTAs, active states, links, price text |
| Primary hover | `#5b52e8` | Hover on primary buttons/links |
| Primary dim | `rgba(108,99,255,0.08)` | Active backgrounds, tag backgrounds |
| Primary border | `rgba(108,99,255,0.12)` or `rgba(108,99,255,0.15)` | Active item borders, user bubble borders |
| Text primary | `text-slate-900` | Headings, names, values |
| Text secondary | `text-slate-600` | Body text, AM names |
| Text tertiary | `text-slate-400` | Dates, captions, placeholders |
| Text faint | `text-slate-300` | Empty states |

## Status Colors

| Status | Text | Background |
|---|---|---|
| Success/Won | `text-[#16a34a]` | `rgba(22,163,74,0.08)` |
| Danger/Lost | `text-[#dc2626]` | `rgba(220,38,38,0.08)` |
| Warning | `text-[#d97706]` | `rgba(217,119,6,0.08)` |
| Info | `text-[#2563eb]` | `rgba(37,99,235,0.08)` |

## Typography

- Body font: Geist Sans (loaded via `next/font/google`)
- Mono font: Geist Mono (for numeric values with `tabular-nums`)
- ALL numbers that represent counts or currency: add `tabular-nums`
- Labels/section titles: `text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-400`
- Card headings: `text-[13px] font-semibold text-slate-900`
- Page-level text: `text-[13px] font-medium text-slate-900`
- Small badges/pills: `text-[10px]` or `text-[11px] font-semibold`

## Card / Container Pattern

```
bg-white border border-black/[.06] rounded-xl shadow-[var(--shadow-card)]
```

- Padding: `px-4 py-3` (compact) or `px-5 py-[18px]` (dashboard cards)
- NO shadcn `Card`/`CardContent` — use plain `<div>` with the classes above
- Sections inside cards separated by `border-t border-black/[.06]` or `divide-y divide-black/[.06]`

## Buttons

### Primary CTA
```
bg-[#6c63ff] hover:bg-[#5b52e8] text-white text-[12px] font-semibold
rounded-lg px-3 py-1.5
transition-colors duration-150 active:scale-[0.98]
```

### Outline / Secondary
```
bg-white border border-black/[.08] text-[12px] font-medium text-slate-700
rounded-lg px-3 py-1.5
hover:bg-slate-50 transition-colors duration-150 active:scale-[0.98]
```

### Pill / Filter chip
```
rounded-full text-[11px] font-semibold px-3 py-1
```
Active: `bg-[#6c63ff] text-white`
Inactive: `bg-slate-100 text-slate-500 hover:bg-slate-200`

## Interactions

- Transitions: `transition-colors duration-150` (always 150ms, never longer)
- Button press: `active:scale-[0.98]`
- NO mount/enter animations (no opacity:0 + fadeIn)
- NO framer-motion
- Hover on cards: `hover:border-[#6c63ff] hover:shadow-[0_0_0_3px_rgba(108,99,255,0.08)]`

## Active / Selected States

- Sidebar active: `bg-[rgba(108,99,255,0.08)] text-[#6c63ff] border-[rgba(108,99,255,0.15)]`
- List item selected: `bg-[rgba(108,99,255,0.06)]`
- Tab/filter active: `bg-[#6c63ff] text-white`

## Badges / Tags

Service tags: `bg-[rgba(108,99,255,0.08)] text-[#6c63ff] rounded-full text-[10px] font-medium px-2 py-0.5`

Category badges:
- Inbound: `bg-[rgba(22,163,74,0.08)] text-[#16a34a]`
- Outbound: `bg-[rgba(108,99,255,0.1)] text-[#6c63ff]`

## Input Fields

- Use shadcn `Input`, `Textarea`, `Select` components (they inherit `--primary: #6c63ff`)
- Custom search inputs: `bg-slate-100 rounded-lg px-3 py-2 text-[12px]`
- Textarea inside custom containers: add `focus-visible:ring-0 focus-visible:border-transparent`
- Placeholder text: `placeholder:text-slate-400`

## Shadows

- Card shadow: `shadow-[var(--shadow-card)]` → `0 1px 2px rgba(17,24,39,0.04), 0 1px 3px rgba(17,24,39,0.06)`
- Focus ring on inputs: `shadow-[0_0_0_3px_rgba(0,0,0,0.05)]` (neutral) or `shadow-[0_0_0_3px_rgba(108,99,255,0.08)]` (accent)

## Layout Rules

- Sidebar width: `w-[216px]`
- Topbar height: `h-[50px]`
- Mobile sidebar: fixed overlay with `translate-x` + `bg-black/20` backdrop
- Full-height views (Pipeline, Inbox, Chat): `h-full flex flex-col overflow-hidden`
- Scrollable views (Dashboard, Reports): natural document flow with padding `p-4 md:px-6 pb-6`
- Max content width for form/text views: `max-w-[1200px]`

## Component Architecture

- All interactive components: `'use client'` at top
- Navigation: Next.js `Link` + `usePathname()` for active detection
- Deal navigation: `router.push('/deals/${id}')` via `onOpenDeal` prop
- Use `cn()` (clsx + tailwind-merge) for conditional classes
- Avoid `<Button>` from shadcn for styled buttons — use plain `<button>` with the patterns above
- Keep shadcn for form primitives: `Input`, `Textarea`, `Select`, `SelectTrigger`, `SelectContent`, `SelectItem`

## NEVER

- Never use native `<select>` or `<input type="...">` for dropdowns — **ALWAYS use shadcn `Select` + `SelectTrigger` + `SelectContent` + `SelectItem`**. This is non-negotiable. Every filter, every dropdown, every form select must be shadcn.
- Never use custom CSS tokens like `text-text-primary`, `bg-surface`, `bg-accent-dim` — use Tailwind slate classes and raw rgba values
- Never use `Card` / `CardContent` from shadcn — use plain divs
- Never add mount animations or framer-motion
- Never use Inter font
- Never use emojis in code

## Dark Mode

This app **fully supports dark mode** via the `.dark` class strategy. All components must work in both light and dark.

- Stage/accent colors use CSS variables (`--stage-{id}`) defined in `globals.css`. Dark mode remaps these to lighter, desaturated values — **never hardcode hex stage colors via inline styles**. Always use `var(--stage-{stageid})` for stage-colored text/backgrounds.
- Use `color-mix(in srgb, var(--stage-{id}) 12%, transparent)` for tinted surface backgrounds on stage badges.
- Primary (`--primary`) in dark mode is a lighter, less saturated blue — designed to read on dark surfaces and still support white text on `bg-primary` buttons.
- Service tags and doc type badges: use `bg-primary/10 text-primary` (Tailwind) — auto-adapts via CSS vars.

---

## Engineering Standards — Data Fetching

### TanStack Query — Non-Negotiable Rules

**1. All fetching via `useQuery`. No `useEffect` + `fetch`.**
```tsx
// ✅ Correct
const { data } = useQuery({ queryKey: queryKeys.companies.all, queryFn: fetchCompanies })

// ❌ Wrong
useEffect(() => { fetch('/api/companies').then(r => r.json()).then(setData) }, [])
```

**2. All mutations via `useMutation`. No manual fetch inside form handlers.**
```tsx
// ✅ Correct — hook owns mutation + invalidation
const { mutate, isPending } = useCreateCompany({
  onSuccess: () => { qc.invalidateQueries({ queryKey: queryKeys.companies.all }); onClose() }
})

// ❌ Wrong — fetch inside component, manual loading state
const [loading, setLoading] = useState(false)
async function handleSubmit() { setLoading(true); await fetch('/api/companies', ...) }
```

**3. Mutation hooks live in `lib/hooks/mutations.ts`. Not in components.**

**4. Query keys must come from `lib/query-keys.ts`. Never hardcode string arrays.**
```tsx
// ✅ queryKeys.deals.all
// ❌ ['deals']
```

**5. Invalidation rules — always invalidate the right scope:**
- After `POST /companies` → `invalidate(queryKeys.companies.all)`
- After `POST /deals` → `invalidate(queryKeys.deals.all)` + `invalidate(queryKeys.companies.detail(companyId).deals)` if that query exists
- After `PUT /deals/:id` → `invalidate(queryKeys.deals.detail(id))` + `invalidate(queryKeys.deals.all)`
- After `PATCH /deals/:id/stage` → same as PUT
- After `DELETE` → `invalidate(parent list)`

**6. `staleTime` strategy:**
- Default: 60s (configured in Providers.tsx) — good for most list data
- Long-lived reference data (products, tiers): `staleTime: Infinity` in the query options
- Real-time data (activities, notifications): `staleTime: 0`

**7. Optimistic updates for fast UX (stage transitions, toggles):**
```tsx
onMutate: async (newStage) => {
  await qc.cancelQueries({ queryKey: queryKeys.deals.all })
  const prev = qc.getQueryData(queryKeys.deals.all)
  qc.setQueryData(queryKeys.deals.all, (old) => old?.map(d => d.id === dealId ? { ...d, stage: newStage } : d))
  return { prev }
},
onError: (_, __, ctx) => qc.setQueryData(queryKeys.deals.all, ctx?.prev),
onSettled: () => qc.invalidateQueries({ queryKey: queryKeys.deals.all }),
```

### Query Key Hierarchy

All keys defined in `src/lib/query-keys.ts`:
```
companies.all              → ['companies']
companies.detail(id)       → ['companies', id]
companies.search(q)        → ['companies', 'search', q]
companies.deals(id)        → ['companies', id, 'deals']
companies.contacts(id)     → ['companies', id, 'contacts']
deals.all                  → ['deals']
deals.filtered(params)     → ['deals', { ...params }]
deals.detail(id)           → ['deals', id]
pipeline.summary           → ['pipeline', 'summary']
products.all               → ['products']
tiers.all                  → ['tiers']
contacts.byCompany(id)     → ['contacts', 'company', id]
documents.byDeal(id)       → ['documents', 'deal', id]
documents.proposals        → ['documents', 'proposals']
```

---

## D3 Visualization Standards

### Architecture

- D3 handles simulation, zoom, drag, and DOM mutations via `useRef` + `useEffect`
- React does NOT re-render on simulation ticks — D3 owns the SVG DOM
- All D3 components must be `'use client'` with explicit cleanup in `useEffect` return
- Dynamic import (`ssr: false`) for any component that imports `d3`

### Force Simulation Rules

```typescript
// Standard simulation config
const sim = d3.forceSimulation<GraphNode>(nodes)
  .force('link', d3.forceLink(links).id(d => d.id).distance(120).strength(0.6))
  .force('charge', d3.forceManyBody().strength(-400))
  .force('center', d3.forceCenter(0, 0))
  .force('collide', d3.forceCollide().radius(d => d.r + 14).strength(0.8))
  .alphaDecay(0.015)
```

- `alphaDecay`: 0.015 (slower cooldown, smoother settling)
- `forceCollide`: always include to prevent node overlap
- Company nodes get stronger charge repulsion than deal/resource nodes
- Link distance scales by relationship type (company→deal: 120, deal→resource: 80)

### Performance

- Stop simulation on cleanup: `return () => { sim.stop() }`
- Use `d3.select(ref.current)` not `d3.select('#id')` — refs prevent stale DOM
- Clear previous render: `svg.selectAll('*').remove()` at start of effect
- Zoom: `d3.zoom().scaleExtent([0.15, 4])` — always set bounds
- Node count > 200: reduce `alphaDecay` and use `simulation.tick(50)` to pre-compute positions

### Visual Standards

- Dark canvas: `bg-[#0f1117]` with dot grid overlay
- Node colors: deterministic from name (hash → palette index)
- Stage colors: match `STAGE_COLOR` map used across all components
- Company nodes: `r=26`, glow ring, initials text, label below
- Deal nodes: `r=10`, stage-colored fill
- Resource nodes: `r=6`, muted color, doc-type icon
- Links: `stroke-opacity: 0.2`, colored by target node
- Tooltip: dark panel (`bg-[#1a1d27]`), appears on hover, follows mouse

### Node Type Hierarchy

```
Company (circle, r=26)
  └── Deal (folder icon or circle, r=10)
        └── Resource (small circle, r=6) — context.md, transcripts, proposals
```

### Drag Behavior

```typescript
const drag = d3.drag<SVGGElement, GraphNode>()
  .on('start', (event, d) => {
    if (!event.active) sim.alphaTarget(0.3).restart()
    d.fx = d.x; d.fy = d.y
  })
  .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y })
  .on('end', (event, d) => {
    if (!event.active) sim.alphaTarget(0)
    d.fx = null; d.fy = null
  })
```

### Zoom

- Initial transform: center graph with `translate(W/2, H/2).scale(0.85)`
- Hide tooltip on zoom: `setTooltip(null)` in zoom handler
- Always set `scaleExtent` to prevent infinite zoom

### NEVER

- Never use `document.getElementById` — use `useRef`
- Never animate D3 via React state — D3 owns tick updates
- Never render SVG elements via JSX in a force graph — D3 manages enter/update/exit
- Never forget cleanup — `sim.stop()` in useEffect return
- Never use `d3-transition` for force graphs — simulation handles movement

---

## Sidebar Navigation Rules

- **Settings lives at the bottom** as a standalone item — NOT grouped under "Main", "Tools", or any section
- Settings is a system-level feature; grouping it with operational features violates UX hierarchy
- All future sidebar updates must respect this placement without exception
- Sidebar width: `w-[216px]` — do not change

---

## Calendar Page Rules

- **Full-height viewport flush** — calendar must extend to full viewport height, not contained in a card
- Default view: **week view**
- Event ownership indicator: owned events = solid fill, other events = outline/stroke style
- Both owned and other variants must work in dark mode
- "Now" time indicator line shows current time on the day grid
- Always maintain mobile responsiveness

---

## Inbox Thread View Rules

- Strip ALL email cruft: no footers, no signatures, no quoted-reply sections (`>>>` markers), no metadata headers
- Render only the actual message bodies in a clean chat-like display
- Use a formatter utility that extracts messages from email threads before rendering
- Reply box and ComposeWindow must rely on backend-owned CRM auth cookies; do not send caller-controlled user identity headers

---

## PartialCollapse Component

Used for collapsible AI-generated summary content in deal detail cards.

```
Default state: clip content to ~88px (4-5 visible lines)
  - overflow: hidden with fixed max-height
  - gradient overlay fades from card bg to transparent
  - gradient covers bottom 40px of clipped content

Expanded state: full content visible
  - 300ms ease-in-out max-height transition
  - gradient fades out on expand, reappears on collapse

Toggle button:
  - Only renders when content height > 88px (measured via useLayoutEffect)
  - Text: "Show more" / "Show less"
  - No toggle if content fits within 88px

Dark mode:
  - Gradient must use dark variant — muted gradients render poorly in dark
  - Use CSS mask-image as alternative to gradient overlay (avoids theme color-matching issues)
```

Component path: `src/components/PartialCollapse.tsx`

```tsx
// Pattern: useLayoutEffect for content height measurement
const containerRef = useRef<HTMLDivElement>(null)
const [isOverflowing, setIsOverflowing] = useState(false)
const [isExpanded, setIsExpanded] = useState(false)

useLayoutEffect(() => {
  if (containerRef.current) {
    setIsOverflowing(containerRef.current.scrollHeight > 88)
  }
}, [children])
```

---

## DocumentViewerModal

- Typography reference: **Warp IDE rendered markdown** — heading sizes, bullet fills, blockquote formatting, code block styling, line spacing
- Color scheme: MUST follow app dark/light mode toggle — **never force dark theme on markdown rendering**
- Keyboard: ESC must dismiss the modal (use existing ESC-dismiss utility in codebase, do not build new handler)
- Focus trap: Ctrl+A inside modal must select modal content only, not the full page

---

## React Query v5 — Polling Pattern

For polling until data exists (e.g. AI-generated summaries):

```tsx
// CORRECT — callback receives Query object, not raw data
useQuery({
  queryKey: queryKeys.deals.summary(dealId),
  queryFn: fetchSummary,
  refetchInterval: (query) => query.state.data ? false : 5000,
})

// WRONG — causes temporal dead zone error
refetchInterval: (data) => data ? false : 5000,
```

Show a spinner during polling wait. Show "No content to summarize" empty state when source data (e.g. notes) doesn't exist yet — do not trigger generation on empty input.

---

## Stage Colors

Stage colors use CSS variables defined in `globals.css`. **Never hardcode hex stage colors inline.**

```tsx
// CORRECT
style={{ color: `var(--stage-${stageId})` }}
className="text-[color:var(--stage-lead)]"

// For tinted backgrounds
style={{ background: `color-mix(in srgb, var(--stage-${stageId}) 12%, transparent)` }}

// WRONG — hardcoded hex breaks dark mode remapping
style={{ color: '#6c63ff' }}
```

Dark mode remaps stage variables to lighter, desaturated values — always use the CSS vars.
