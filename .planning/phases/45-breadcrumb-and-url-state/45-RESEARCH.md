# Phase 45: Breadcrumb and URL State - Research

**Researched:** 2026-02-22
**Domain:** Frontend — TanStack Router search params, URL-driven navigation state, breadcrumb component
**Confidence:** HIGH

---

## Summary

Phase 45 completes the drill-down navigation by making it persistent in the URL and adding a proper breadcrumb bar. The core change is moving `selectedGemeenteId` from React `useState` in `ProjectList.tsx` to URL search params on the `/projecten` route. This single change enables all three success criteria: breadcrumb (reads from URL), deep-linking (URL carries state), and browser back/forward (each navigate pushes a history entry).

The implementation has two clean parts. First, add `validateSearch` to `/projecten` with `gemeente_id?: string` — when set, the wijk card view is shown; when absent, the gemeente card view is shown. `ProjectList` reads from `useSearch({ from: '/_authenticated/projecten' })` and calls `navigate({ to: '/projecten', search: { gemeente_id: id } })` to drill in and `navigate({ to: '/projecten', search: {} })` to go back. Second, build a `DrilldownBreadcrumb` component that reads the same URL params and renders the `Projecten > Gemeente Name` (or `Projecten`) path with clickable segments.

Browser back/forward works automatically because TanStack Router's `navigate()` uses `history.pushState` by default (not `replace`). No extra wiring is needed — each drill-down navigation pushes a new entry, so pressing back restores the previous URL state, which restores the previous view.

**Primary recommendation:** Add `validateSearch` to `projecten.tsx` with `gemeente_id?: string`, migrate `selectedGemeenteId` from React state to URL search params, build a `DrilldownBreadcrumb` component that reads those params, use default `navigate()` push (not `replace: true`) for drill-down transitions.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TanStack Router | 1.158.4 | `validateSearch`, `useSearch`, `navigate` | Already the project router; search params are first-class |
| React | 19.2.0 | Component rendering | Project standard |
| Tailwind CSS v4 | 4.1.18 | Breadcrumb layout/styling | Project standard |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `lucide-react` | 0.564.0 | ChevronRight icon for breadcrumb separators | Already in project; use for `/` or `>` separator icons |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| URL search params (`?gemeente_id=...`) | New route `/projecten/$gemeenteId` | New route requires `routeTree.gen.ts` regeneration and loses non-monitoring state on navigation. Search params preserve all other page state (expanded regular project accordion, etc.) |
| `useSearch({ from })` in child component | Props drilling from route component | Props drilling adds coupling; `useSearch` with `from` is the TanStack Router idiomatic pattern for children of a typed route |
| `navigate()` push (default) | `navigate(..., { replace: true })` | `replace: true` would prevent browser back/forward from working across drill-down levels — never use replace for drill-down transitions |

**Installation:** No new packages needed.

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── routes/
│   └── _authenticated/
│       └── projecten.tsx          # MODIFY: add validateSearch for gemeente_id
├── components/
│   └── projects/
│       ├── ProjectList.tsx        # MODIFY: replace selectedGemeenteId state with URL param
│       ├── DrilldownBreadcrumb.tsx # NEW: breadcrumb bar component
│       └── WijkCardGrid.tsx       # MODIFY: remove internal ← Gemeenten button (replaced by breadcrumb)
```

### Pattern 1: Add validateSearch to /projecten Route

**What:** `projecten.tsx` gets a `validateSearch` that types `gemeente_id?: string`. This is the source of truth for which level the user is on.

**Why `gemeente_id` not `selectedGemeenteId`:** URL params use concise keys. `gemeente_id` matches the project ID stored in `ProjectResponse.id` for gemeente-level projects.

**Example:**

```typescript
// Source: frontend/src/routes/_authenticated/projecten.tsx (to modify)
// Pattern verified from: frontend/src/routes/_authenticated/resultaten.tsx (existing)

interface ProjectenSearchParams {
  gemeente_id?: string
}

export const Route = createFileRoute('/_authenticated/projecten')({
  component: ProjectenPage,
  validateSearch: (search: Record<string, unknown>): ProjectenSearchParams => ({
    gemeente_id: typeof search.gemeente_id === 'string' ? search.gemeente_id : undefined,
  }),
})
```

URL produced: `/projecten` (gemeente view) or `/projecten?gemeente_id=abc-123` (wijk view for that gemeente).

### Pattern 2: Read URL Params in Child Component

**What:** `ProjectList.tsx` reads `gemeente_id` from the URL using `useSearch({ from: '/_authenticated/projecten' })` instead of local `useState`. Navigate to update the URL.

**Why `useSearch({ from })` not `Route.useSearch()`:** `Route.useSearch()` is only available directly in the route file component. `ProjectList` is a separate component — it uses the exported `useSearch` hook with a `from` string to get the same typed result.

**Example:**

```typescript
// Source: Pattern verified from TanStack Router dist/esm/useSearch.d.ts
// In ProjectList.tsx:
import { useSearch, useNavigate } from '@tanstack/react-router'

export default function ProjectList() {
  const { gemeente_id: selectedGemeenteId } = useSearch({
    from: '/_authenticated/projecten',
  })
  const navigate = useNavigate()

  const handleSelectGemeente = (id: string) => {
    void navigate({ to: '/projecten', search: { gemeente_id: id } })
  }

  const handleBack = () => {
    void navigate({ to: '/projecten', search: {} })
  }

  // Rest of component uses selectedGemeenteId (string | undefined)
  // instead of the former useState value
}
```

### Pattern 3: Browser Back/Forward — Default Push Behavior

**What:** TanStack Router `navigate()` uses `history.pushState` by default (no `replace` option). Each drill-down navigation pushes a new history entry. Browser back restores the previous URL, which restores the previous view.

**Verification:** From `node_modules/@tanstack/router-core/dist/esm/link.d.ts` line 55: `replace?: boolean` — defaults to `false` (push). The map route uses `replace: true` explicitly when it wants to clear navigation without adding history entry.

**Critical rule:** NEVER use `replace: true` for drill-down navigation. Use it only when the navigation should not be reachable via back button (e.g. clearing a modal/overlay state).

```typescript
// CORRECT: pushes history entry, back button works
void navigate({ to: '/projecten', search: { gemeente_id: id } })

// CORRECT: pushes history entry, back button works (returns to gemeente view)
void navigate({ to: '/projecten', search: {} })

// WRONG: replaces history, back button skips this step
void navigate({ to: '/projecten', search: { gemeente_id: id }, replace: true })
```

### Pattern 4: DrilldownBreadcrumb Component

**What:** A standalone component that reads the URL search params and renders a breadcrumb trail. Segments before the current level are clickable links; the current level is plain text.

**Structure:** `Projecten > Gemeente Name` when on wijk view, just `Projecten` (or nothing) when on gemeente view. The header `<h1>Projecten</h1>` in `projecten.tsx` can remain or be absorbed into the breadcrumb.

**Where to render:** Inside `ProjectList.tsx` above the monitoring projects section, visible only when `selectedGemeenteId` is set. Alternatively, render it in `ProjectenPage` in `projecten.tsx` to keep it above the content, always visible.

**Recommended placement:** In `ProjectenPage` (route component), above `<ProjectList />` — the route component already renders the `<h1>` header, so the breadcrumb is a natural addition there that does not add coupling to `ProjectList`.

**Example:**

```typescript
// Source: New component — DrilldownBreadcrumb.tsx
// Verified pattern: useSearch({ from }) from TanStack Router useSearch.d.ts

import { useSearch, useNavigate } from '@tanstack/react-router'
import { useProjects } from '@/hooks/useProjects'

export function DrilldownBreadcrumb() {
  const { gemeente_id } = useSearch({ from: '/_authenticated/projecten' })
  const navigate = useNavigate()
  const { data } = useProjects()

  // Find gemeente name from projects data
  const gemeenteProject = gemeente_id
    ? data?.projects.find((p) => p.id === gemeente_id)
    : null

  if (!gemeente_id) {
    // At top level — no breadcrumb needed (or show just "Projecten" static)
    return null
  }

  return (
    <nav aria-label="Navigatie" className="flex items-center gap-1.5 text-sm mb-6">
      <button
        onClick={() => void navigate({ to: '/projecten', search: {} })}
        className="text-grey-400 hover:text-grey-100 transition-colors"
      >
        Projecten
      </button>
      <span className="text-grey-700">/</span>
      <span className="font-medium text-grey-100">
        {gemeenteProject?.name ?? gemeente_id}
      </span>
    </nav>
  )
}
```

### Pattern 5: Updating WijkCardGrid Back Button

**What:** The existing WijkCardGrid has a simple `← Gemeenten / GemeenteName` back button (lines 71-79 of current file). With URL-based navigation, the breadcrumb component in the route handles back. The `onBack` prop in WijkCardGrid can be simplified or removed.

**Two options:**
1. Keep `onBack` prop (calls `navigate` in parent) — backward compatible, no breaking change to WijkCardGrid interface
2. Remove `onBack` prop, let WijkCardGrid call `navigate` directly — simpler but requires WijkCardGrid to know about routing

**Recommended:** Keep `onBack` prop. The breadcrumb replaces the visual display but `WijkCardGrid` stays decoupled from routing. Remove the internal `← Gemeenten / GemeenteName` div from WijkCardGrid to avoid duplicate navigation elements.

### Anti-Patterns to Avoid

- **React state for navigation level:** `useState<string | null>(null)` for `selectedGemeenteId` must be replaced — it does not persist in URL and breaks browser back button.
- **`replace: true` for drill-down:** Using `replace` prevents back button from working. Only use `replace` for operations that should not be reachable via back (map modal clearing, post-login redirect).
- **New file-based route for gemeente level:** Creating `routes/_authenticated/projecten.$gemeenteId.tsx` triggers TanStack Router plugin route regeneration and loses other page state on back navigation.
- **Duplicate back navigation UI:** Both the breadcrumb and the WijkCardGrid internal button visible simultaneously creates confusion. Remove the internal WijkCardGrid back button when the DrilldownBreadcrumb is in place.
- **Reading `gemeente_id` from `Route.useSearch()` in ProjectList:** `Route` refers to the route's own exported constant — only valid within the same file. Use `useSearch({ from: '/_authenticated/projecten' })` in child components.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| URL state serialization | Custom URL parsing/encoding | TanStack Router `validateSearch` | Already handles JSON parsing, type coercion, invalid param recovery |
| Browser history management | Custom `window.history.pushState` | `navigate()` from `useNavigate` | TanStack Router wraps history API with type safety and route context |
| Breadcrumb data resolution | Custom route-aware context | `useSearch({ from })` + `useProjects()` | Projects data already cached via TanStack Query; no extra fetch needed |
| Active/inactive link styling | Manual class toggling | TanStack Router `Link` component with `activeProps` | Handles active state automatically; use for nav rail, not breadcrumbs (breadcrumbs are navigate calls not links) |

**Key insight:** TanStack Router's `validateSearch` + `useSearch` gives full URL state for free. The "hard parts" of deep-linking (serialization, deserialization, error recovery for invalid params) are handled by the framework.

---

## Common Pitfalls

### Pitfall 1: Using replace: true Instead of push

**What goes wrong:** Breadcrumb back link works but browser back button does not. User navigates Projecten → Gemeente → back via breadcrumb works fine, but the browser's native Back button skips the gemeente level and returns to wherever they were before opening Projecten.

**Why it happens:** Developer adds `replace: true` to avoid "polluting" history. This is correct for modals/overlays but wrong for navigable states.

**How to avoid:** Never use `replace: true` for drill-down navigation. The drill-down levels are real pages the user navigated through. Each level must be a pushState entry.

**Warning signs:** Browser back button skips expected states; browser forward button after using breadcrumb does nothing.

### Pitfall 2: Route.useSearch() in Child Components

**What goes wrong:** TypeScript error "Property 'useSearch' does not exist on type..." OR runtime error because `Route` is undefined in the child component file.

**Why it happens:** `Route.useSearch()` is a method on the route object exported from the route file. It's only callable from within that same file (or from components defined in that file). `ProjectList.tsx` is a separate module — `Route` is not imported there.

**How to avoid:** In child components, use `useSearch({ from: '/_authenticated/projecten' })` from `@tanstack/react-router`. The `from` string must match the route ID exactly (as seen in `routeTree.gen.ts`).

**Warning signs:** Import errors, or `gemeente_id` always being `undefined` when using wrong hook form.

### Pitfall 3: Stale Projects Data in Breadcrumb

**What goes wrong:** Breadcrumb shows `undefined` or the raw `gemeente_id` UUID string instead of the gemeente name. User navigates to a bookmarked URL with `?gemeente_id=abc-123` before projects data loads.

**Why it happens:** `useProjects()` may not have resolved yet when the breadcrumb renders on deep-link load. `data?.projects.find(...)` returns `undefined`.

**How to avoid:** Always show a fallback: `gemeenteProject?.name ?? 'Gemeente'` or show a skeleton breadcrumb while `isLoading`. Do NOT show the raw `gemeente_id` UUID as this is meaningless to users.

**Warning signs:** Breadcrumb flashes `abc-123-def-456` before showing the gemeente name.

### Pitfall 4: Invalid gemeente_id in URL

**What goes wrong:** User manually edits URL to `?gemeente_id=invalid-id`. `ProjectList` finds no matching gemeente project and renders neither gemeente grid nor wijk grid — blank page.

**Why it happens:** `validateSearch` only validates the type (`string | undefined`), not whether the ID actually exists in the user's projects.

**How to avoid:** Add a guard: if `gemeente_id` is set but no matching project is found in the data, fall back to showing the gemeente grid (as if no `gemeente_id` was set). This handles the invalid-ID case gracefully.

```typescript
// Guard in ProjectList.tsx
const gemeente = gemeente_id
  ? monitoringProjects.find((p) => p.id === gemeente_id)
  : null

// If gemeente_id was set but not found, render gemeente grid (fallback)
const activeGemeente = gemeente ?? null
```

### Pitfall 5: Header Duplication When Adding Breadcrumb

**What goes wrong:** The `projecten.tsx` route currently renders `<h1>Projecten</h1>`. Adding a `DrilldownBreadcrumb` that also says "Projecten" at the top creates visual redundancy.

**Why it happens:** The breadcrumb and the existing heading serve the same purpose at the top level.

**How to avoid:** When `gemeente_id` is set (wijk view active), hide or replace the `<h1>Projecten</h1>` with the breadcrumb. When at top level, show only the `<h1>`. The breadcrumb component can return `null` at top level, leaving the original heading untouched — this is the recommended approach (minimum change, no header at wijk level is a design choice to confirm).

**Alternative:** Replace the heading with the breadcrumb entirely. At top level, breadcrumb shows just "Projecten" (styled same as h1). At wijk level, shows "Projecten > Gemeente Name". This requires restyling the breadcrumb component to match the existing h1 visual weight.

### Pitfall 6: WijkCardGrid onBack Prop Confusion After URL Migration

**What goes wrong:** After migrating to URL-based navigation, `WijkCardGrid` still receives `onBack` from `ProjectList`, which calls `navigate({ to: '/projecten', search: {} })`. But the DrilldownBreadcrumb ALSO navigates back on click. Two different UI elements handle back navigation — confusing.

**How to avoid:** Remove the `← Gemeenten / GemeenteName` div from inside `WijkCardGrid` (lines 71-79 of current WijkCardGrid.tsx). The `onBack` prop can remain as a hidden escape hatch (e.g. for keyboard navigation or a11y), but the visible back affordance is only the DrilldownBreadcrumb.

---

## Code Examples

Verified patterns from official TanStack Router package and existing codebase:

### validateSearch Pattern (from resultaten.tsx — existing working example)

```typescript
// Source: frontend/src/routes/_authenticated/resultaten.tsx (existing)
export const Route = createFileRoute('/_authenticated/resultaten')({
  component: ResultatenPage,
  validateSearch: (search: Record<string, unknown>): ResultatenSearchParams => ({
    scan_id: typeof search.scan_id === 'string' ? search.scan_id : undefined,
    // ... other params
  }),
})
```

Apply same pattern to projecten.tsx:

```typescript
// Source: Pattern from resultaten.tsx, applied to projecten.tsx
interface ProjectenSearchParams {
  gemeente_id?: string
}

export const Route = createFileRoute('/_authenticated/projecten')({
  component: ProjectenPage,
  validateSearch: (search: Record<string, unknown>): ProjectenSearchParams => ({
    gemeente_id: typeof search.gemeente_id === 'string' ? search.gemeente_id : undefined,
  }),
})
```

### navigate with Search Updater (from resultaten.tsx — existing working example)

```typescript
// Source: frontend/src/routes/_authenticated/resultaten.tsx lines 79-92 (existing)
// Updater function form — preserves other search params
void navigate({
  to: '/resultaten',
  search: (prev) => ({
    ...prev,
    bestemming_type: newFilters.bestemming_type,
  }),
})

// Direct form — replaces all search params (used for drill-down)
void navigate({ to: '/projecten', search: { gemeente_id: id } })
void navigate({ to: '/projecten', search: {} })
```

### navigate with replace: true (from map.tsx — existing example of when to use replace)

```typescript
// Source: frontend/src/routes/_authenticated/map.tsx lines 223, 244, 257
// replace: true only when operation should NOT be reachable via back button:
navigate({ to: '/map', search: {}, replace: true })

// DO NOT use replace: true for drill-down navigation in projecten
```

### useSearch with from (verified from TanStack Router dist/esm/useSearch.d.ts)

```typescript
// Source: @tanstack/react-router useSearch.d.ts
// Use in ProjectList.tsx (child component, not the route file):
import { useSearch, useNavigate } from '@tanstack/react-router'

const { gemeente_id } = useSearch({ from: '/_authenticated/projecten' })
// gemeente_id is typed as string | undefined based on validateSearch return type
```

### Breadcrumb Navigation Structure

```typescript
// New component: DrilldownBreadcrumb.tsx
// Pattern: button-based navigation (not Link) for breadcrumb back segments
// Consistent with existing WijkCardGrid internal back button pattern

<nav aria-label="Navigatie" className="flex items-center gap-1.5 text-sm">
  {/* Clickable segment — navigates to that level */}
  <button
    onClick={() => void navigate({ to: '/projecten', search: {} })}
    className="text-grey-400 hover:text-grey-100 transition-colors"
  >
    Projecten
  </button>
  {/* Separator */}
  <span className="text-grey-700" aria-hidden="true">/</span>
  {/* Current level — not clickable */}
  <span className="font-medium text-grey-100">
    {gemeenteProject?.name ?? 'Gemeente'}
  </span>
</nav>
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Phase 44: `useState<string | null>` for `selectedGemeenteId` | Phase 45: URL search param `?gemeente_id=...` | Phase 45 | Browser back/forward works; URL is shareable/bookmarkable |
| Phase 44: Inline `← Gemeenten / GemeenteName` in WijkCardGrid | Phase 45: `DrilldownBreadcrumb` component reads URL, renders path | Phase 45 | Single source of truth; consistent across all drill-down levels |
| TanStack Router `validateSearch` as plain function | TanStack Router also supports Zod/Standard Schema validators | Current (v1.158.4) | Both patterns work; project uses plain function pattern — stick with it for consistency |

**Current (v1.158.4) TanStack Router search param API:**
- `validateSearch`: Plain function `(search: Record<string, unknown>) => TSearchParams` — used throughout this project
- `Route.useSearch()`: Only within route file
- `useSearch({ from: '/path' })`: In child components, with type inference from the route's `validateSearch` return type
- `navigate({ ..., replace?: boolean })`: Default is `false` (push); `replace: true` replaces current history entry

---

## Open Questions

1. **Should the breadcrumb replace or augment the `<h1>Projecten</h1>` heading?**
   - What we know: The route currently renders `<h1>Projecten</h1>` inside `ProjectenPage`. The breadcrumb at top level would just say "Projecten" — same information.
   - What's unclear: Whether the `<h1>` should be removed when breadcrumb is shown, or whether both should coexist (heading always, breadcrumb below it when drilling down).
   - Recommendation: Return `null` from `DrilldownBreadcrumb` at top level — heading stays. At wijk level, show the breadcrumb and suppress or visually diminish the heading. Simplest approach: render heading only when `gemeente_id` is absent, render breadcrumb only when `gemeente_id` is present. One or the other is always shown.

2. **Should the breadcrumb segment separator be `/` or `>`?**
   - What we know: WijkCardGrid currently uses `/ ` as separator. NAV-04 requirement uses `>` in the spec text ("Projecten > Gemeente Name > Wijk Name").
   - What's unclear: Whether this is a hard requirement or just illustrative.
   - Recommendation: Use `/` separator — consistent with existing WijkCardGrid visual style. The requirement text uses `>` to describe the hierarchy, not to specify the separator character.

3. **What happens when browser back is pressed from within the wijk card view, but the user opened the URL directly (no prior history)?**
   - What we know: Browser back at the start of history does nothing. TanStack Router does not handle this specially.
   - What's unclear: Whether to show a "back" affordance when there is no browser history to go back to.
   - Recommendation: The breadcrumb's "Projecten" segment always links back to `?gemeente_id=` (empty), regardless of browser history. This always works. The browser back button is supplementary.

4. **Does WijkCardGrid's `onBack` prop become dead code?**
   - What we know: With URL navigation, `onBack` will call `navigate({ to: '/projecten', search: {} })` which is the same as what the breadcrumb does. The WijkCardGrid internal back button UI should be removed to avoid duplicate navigation.
   - Recommendation: Keep `onBack` prop signature (non-breaking), remove the internal JSX for the back button from WijkCardGrid, and pass `handleBack` from ProjectList. The prop stays in the interface but the visual is removed from WijkCardGrid — the breadcrumb in ProjectenPage handles it.

---

## Sources

### Primary (HIGH confidence)

- Codebase: `frontend/src/routes/_authenticated/projecten.tsx` — confirmed NO `validateSearch` currently; route accepts no search params
- Codebase: `frontend/src/routes/_authenticated/resultaten.tsx` — confirmed `validateSearch` pattern with optional string params; `Route.useSearch()` in route component; `navigate` with search updater
- Codebase: `frontend/src/routes/_authenticated/map.tsx` lines 223, 244, 257 — confirmed `navigate({ ..., replace: true })` used for clearing-without-history; contrast with drill-down use case
- Codebase: `frontend/src/components/projects/ProjectList.tsx` — confirmed `selectedGemeenteId` is currently `useState<string | null>(null)` — the value to migrate to URL
- Codebase: `frontend/src/components/projects/WijkCardGrid.tsx` lines 71-79 — confirmed existing internal back button (the one to replace with DrilldownBreadcrumb)
- Package: `frontend/node_modules/@tanstack/react-router/dist/esm/useSearch.d.ts` — confirmed `useSearch({ from: '...' })` signature with typed return from `validateSearch`
- Package: `frontend/node_modules/@tanstack/router-core/dist/esm/link.d.ts` line 55 — confirmed `replace?: boolean` defaults to `false` (push) in `NavigateOptions`
- Package: `frontend/node_modules/@tanstack/react-router/dist/esm/index.d.ts` — confirmed `useSearch` and `getRouteApi` are both exported

### Secondary (MEDIUM confidence)

- WebSearch: TanStack Router v1 docs summary — `navigate()` uses `history.pushState` by default; `replace: true` uses `history.replaceState` — consistent with `link.d.ts` type definition
- WebSearch: TanStack Router `useSearch` hook — `from` parameter specifies which route's search schema to use for type inference; confirmed matches installed type signature

### Tertiary (LOW confidence)

- WebSearch: Breadcrumb patterns with TanStack Router — community uses `useMatches` for route-hierarchy breadcrumbs; NOT applicable here since our breadcrumb is for in-page UI state levels, not actual route nesting

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — All libraries pre-existing; no new dependencies
- validateSearch pattern: HIGH — Identical to resultaten.tsx which is already production; verified against package types
- useSearch({ from }) in child component: HIGH — Verified against installed package type definition
- navigate push vs replace behavior: HIGH — Verified against installed package type (replace?: boolean, defaults false) AND existing map.tsx usage of replace:true confirming it's explicit opt-in
- DrilldownBreadcrumb design: MEDIUM — Extrapolated from existing WijkCardGrid back button pattern; exact styling is implementation decision

**Research date:** 2026-02-22
**Valid until:** 2026-03-22 (TanStack Router API stable at v1.158.4; project dependency versions frozen)
