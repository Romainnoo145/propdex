# Phase 30: View Separation (Results Route) — Research

**Researched:** 2026-02-18
**Domain:** TanStack Router file-based routing, React context cross-route state sharing, scan context persistence
**Confidence:** HIGH — findings are based on direct codebase reading, not external library docs. The implementation questions for this phase are primarily about existing code architecture, not library APIs.

---

## Summary

Phase 30 extracts the results view from `map.tsx` (currently implemented as `ResultsLayout`, a CSS-transform overlay panel) into a standalone `/resultaten` route. The goal is a dedicated full-width table page accessible via the sidebar "Resultaten" icon or a "Toon Lijst" button on the map, with shareable URLs (e.g. `/resultaten?scan_id=123`) and scan context preserved when switching between views.

The **core technical challenge** is that `activeScanId` and `activeGemeente` live as local `useState` inside `MapPage` in `map.tsx`. Moving to a separate route means these values must survive route transitions. The two clean options are: (1) lift state into the `_authenticated.tsx` layout and pass via React Context, or (2) use URL search params as the single source of truth for `scan_id` so the results route can read it directly. Option 2 (URL search params as truth) is strongly preferred: it is idiomatic TanStack Router, satisfies the shareable URLs success criterion, and requires no new Context.

The `ResultsLayout` component (currently used inside `map.tsx`) is a good extraction candidate. Its map-interaction features (fly-to-parcel, parcel selection sync via MapLibre `querySourceFeatures`) only work when the map is visible — these must be gracefully dropped or no-op'd on the standalone route. The table + filter panel functionality works purely off `scan_id` via `useScanResults`, so it is portable with zero changes.

**Primary recommendation:** Create `/resultaten` route with `validateSearch: { scan_id }`, use `scan_id` as the cross-route contract, update `SideRailNav` "Resultaten" to navigate to `/resultaten?scan_id=<active>`, and update `map.tsx` to pass `scan_id` when navigating to results. The existing `ResultsLayout` component should be refactored into a `ResultsPage` that uses `ResultsShell` (the correct shell for non-map routes).

---

## Standard Stack

### Core (already in project — no new installs)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@tanstack/react-router` | 1.158.4 | File-based routing, type-safe search params | Already used everywhere |
| `@tanstack/react-query` | 5.90.20 | `useScanResults` fetches table data by scan_id | Already caches scan results |
| `@tanstack/react-table` | 8.21.3 | `ResultsTable` already implemented | Already in `ResultsTable.tsx` |

**Installation:** None. No new dependencies needed.

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── routes/
│   └── _authenticated/
│       ├── map.tsx              # Existing — remove ResultsLayout, add "Toon Lijst" button
│       └── resultaten.tsx       # NEW — /resultaten route, full-width table
├── components/
│   └── results/
│       ├── ResultsTable.tsx     # Existing — no changes needed (pure scan_id consumer)
│       ├── ResultsFilterPanel.tsx # Existing — no changes needed
│       ├── ParcelDetailModal.tsx  # Existing — no changes needed
│       └── ResultsLayout.tsx    # KEEP — still used as overlay on /map route
│           (or refactor into separate ResultsPage for /resultaten)
└── components/
    └── layout/
        ├── SideRailNav.tsx     # Update Resultaten nav item to go to /resultaten
        └── ResultsShell.tsx    # Existing — use for /resultaten page (solid bg)
```

### Pattern 1: URL Search Params as Cross-Route State Contract

**What:** The `/resultaten` route reads `scan_id` from its own search params. The `/map` route writes `scan_id` to the URL when navigating to results. No shared React state needed.

**When to use:** Any time two routes need to share identity (scan UUID) without parent-level state.

**Example:**
```typescript
// frontend/src/routes/_authenticated/resultaten.tsx
interface ResultatenSearchParams {
  scan_id?: string
}

export const Route = createFileRoute('/_authenticated/resultaten')({
  component: ResultatenPage,
  validateSearch: (search: Record<string, unknown>): ResultatenSearchParams => ({
    scan_id: typeof search.scan_id === 'string' ? search.scan_id : undefined,
  }),
})

function ResultatenPage() {
  const { scan_id } = Route.useSearch()
  // scan_id is the only thing needed — useScanResults handles the rest
  return (
    <ResultsShell className="max-w-none px-0 py-0">
      {scan_id ? (
        <ResultsTable scanId={scan_id} />
      ) : (
        <EmptyState message="Geen scan geselecteerd" />
      )}
    </ResultsShell>
  )
}
```

### Pattern 2: Navigating from Map to Results with scan_id

**What:** In `map.tsx`, the "Toon Lijst" button (and the `setShowResults(true)` on scan completion) should navigate to `/resultaten?scan_id=<activeScanId>` instead of toggling the overlay.

**Example (in map.tsx):**
```typescript
// Instead of: setShowResults(true)
navigate({ to: '/resultaten', search: { scan_id: activeScanId } })

// "Toon Lijst" button:
<button onClick={() => navigate({ to: '/resultaten', search: { scan_id: activeScanId } })}>
  Toon Lijst
</button>
```

### Pattern 3: SideRailNav "Resultaten" Update

**What:** Currently points to `/map` with `search: { panel: 'results' }`. For Phase 30, it should point to `/resultaten`. But since the user may have no active scan, the nav item should either always go to `/resultaten` (shows empty state gracefully) or only link with `scan_id` when one exists.

**Current code (SideRailNav.tsx lines 49-55):**
```typescript
{
  icon: <ListOrdered size={20} />,
  label: 'Resultaten',
  to: '/map',
  search: { panel: 'results' },
},
```

**Required change:** Update `to` to `'/resultaten'`. The `search` with `scan_id` cannot be done statically in a navItem constant because it requires knowing the active `activeScanId`. Two options:
1. Always navigate to `/resultaten` without `scan_id` (shows empty state when no scan)
2. Make SideRailNav accept a `activeScanId` prop to construct the link dynamically

Option 1 is simpler and avoids prop-drilling. Empty state on `/resultaten` with no scan_id is a graceful degradation.

### Pattern 4: "Toon Kaart" Back-Navigation from Results Route

**What:** The results page needs a "Toon Kaart" button that returns to `/map` with the scan still visible. Since the map keeps its state alive (CSS display toggle), navigating back to `/map` will restore the previous camera position. If `activeScanId` is needed on the map (score layer), the `/map` route needs to know it.

**Options:**
- Navigate to `/map` without params — map resets (no scan overlay). Simple but context is lost.
- Navigate to `/map?scan_id=<scan_id>` — map.tsx reads this on load and restores score layer. More complex: requires map.tsx to handle a `scan_id` search param to re-mount score layer.
- Lift `activeScanId` to `_authenticated.tsx` context — both routes share it.

**Recommendation:** Use URL: Navigate to `/map?resume_scan=<scan_id>`. Map.tsx validates this and restores score layer if the scan is already completed. This satisfies "shareable links" and "scan context persists."

### Pattern 5: ResultsShell for the New Route

**What:** The `/resultaten` page is a non-map route (data content area). Per Phase 29's architecture, non-map routes use `ResultsShell` (solid `bg-grey-950`). However, `ResultsShell` currently applies `max-w-5xl mx-auto px-6 py-8` — the results table needs full width.

**Fix:** `ResultsShell` already accepts a `className` prop. Use:
```tsx
<ResultsShell className="p-0 max-w-none">
  {/* full-width table content */}
</ResultsShell>
```
Or wrap the table directly without inner container — `ResultsShell` just provides `w-full h-full overflow-y-auto bg-grey-950`.

### Anti-Patterns to Avoid

- **Do not lift `activeScanId` to `_authenticated.tsx` context** unless the URL approach fails. Contexts in layout components add invisible coupling and make deep-links impossible. URL search params are always serializable and shareable.
- **Do not remove `ResultsLayout` from `map.tsx` until the new route is working.** The overlay on the map route may still be useful for the "quick preview" pattern or can be kept as the in-map view with a "Toon Lijst" button as an upgrade path.
- **Do not use the `panel=results` search param pattern** that Phase 28 introduced. Phase 30 replaces that pattern with a real route.
- **Do not make the `/resultaten` route depend on the map being mounted.** The map ↔ table parcel selection sync (fly-to, `querySourceFeatures`) only works when MapLibre is live. On the standalone results route, `mapRef` will be available via `useMapContext()` (it's in the parent layout) but the map is CSS-hidden. The `querySourceFeatures` call for fly-to will fail silently when the score layer is not rendered. This is acceptable behavior — just guard with `mapRef.current?.getSource('parcel-scores')` before calling.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| URL search param validation | Custom parser | TanStack Router `validateSearch` | Type-safe, already used in map.tsx and rapport.$id.tsx |
| Cross-route scan state | Redux/Zustand store | URL params (`scan_id`) | Already serializable, shareable, zero deps |
| Full-width table layout | Custom CSS grid | `ResultsShell` with `className` override | Already has the correct bg and overflow |
| Empty state for no scan | Custom component | Reuse `ResultsTable` null guard | Table already handles `scanId === null` (query disabled) |

---

## Common Pitfalls

### Pitfall 1: MapLibre `querySourceFeatures` on Hidden Map

**What goes wrong:** The `/resultaten` route calls `useMapContext()` to get `mapRef`. But the map is `display:none` when on the results route. Calling `map.querySourceFeatures('parcel-scores', ...)` on a hidden map either returns empty results or throws if the source was never added.

**Why it happens:** `ResultsLayout.tsx` currently calls `mapRef.current?.querySourceFeatures(...)` for fly-to on table row click. This code will be reused or adapted in the standalone results page.

**How to avoid:** Guard all MapLibre interaction code with: `if (!mapRef.current?.getSource('parcel-scores')) return`. On the standalone results route, this guard will short-circuit silently — fly-to simply won't happen (acceptable: user is on results view, not map view).

**Warning signs:** Empty `features.length` always being 0 on the standalone route even for valid `scan_id`.

### Pitfall 2: `isActive` Highlight on SideRailNav for Two-Route Mapping

**What goes wrong:** `SideRailNav` uses `matchRoute({ to: item.to })` to determine active state. Currently "Kaart" is active when on `/map`. After Phase 30, "Resultaten" should be active when on `/resultaten`. This is straightforward — `matchRoute({ to: '/resultaten' })` will work once the route exists.

**Why it happens:** The current "Resultaten" nav item has `to: '/map'`, making both "Kaart" and "Resultaten" show as active when on `/map`.

**How to avoid:** After Phase 30, "Resultaten" nav item has `to: '/resultaten'` — `matchRoute` will correctly differentiate.

### Pitfall 3: TanStack Router File-Based Route Registration

**What goes wrong:** Creating `resultaten.tsx` in `_authenticated/` does NOT automatically register the route — you must also run `npm run check` (or the vite dev server) to regenerate `routeTree.gen.ts`. If `routeTree.gen.ts` is stale, the route won't exist and navigating to it will 404.

**Why it happens:** TanStack Router's `@tanstack/router-plugin` auto-generates `routeTree.gen.ts` from the file structure during the Vite build/dev process.

**How to avoid:** After creating `resultaten.tsx`, run `npm run check` (or restart dev server) to trigger route tree regeneration. Verify the route appears in `routeTree.gen.ts` before testing navigation.

### Pitfall 4: ResultsShell Inner Container Max Width Conflict

**What goes wrong:** `ResultsShell` wraps content in `<div className="max-w-5xl mx-auto px-6 py-8">`. The results table needs full width (`w-full`) to use available space. If the inner container is applied, the table is unnecessarily constrained to 64rem.

**Why it happens:** `ResultsShell` was designed for text-heavy routes (instellingen, projecten) with centered narrow content. Results table is a data grid that benefits from full width.

**How to avoid:** Two options:
1. Pass `className` override: `<ResultsShell className="p-0 max-w-none">` — but `ResultsShell` applies `max-w-5xl` on the inner `<div>`, not the outer. The `className` is applied to the outer div, not the inner container. **This won't work without modifying `ResultsShell`.**
2. Don't use `ResultsShell`'s inner container — use only its outer div properties (`w-full h-full overflow-y-auto bg-grey-950`) and put the table directly, or create a `ResultsShellFull` variant, or modify `ResultsShell` to accept `noContainer` prop.

**Actual fix:** The simplest correct approach is to NOT use `ResultsShell` for the results table page. Instead, replicate the outer div directly: `<div className="w-full h-full overflow-y-auto bg-grey-950">`. This is clean and avoids modifying `ResultsShell` whose inner container serves other routes correctly.

### Pitfall 5: Scan Score Layer Not Restored on "Toon Kaart" Navigation

**What goes wrong:** User is on `/resultaten?scan_id=abc123`. They click "Toon Kaart" → navigates to `/map`. The map is now visible, but the score layer was added by `addParcelScoreLayer()` in `map.tsx` only when `scanStatus.data.status === 'completed'`. If the user navigated away AFTER the scan completed, the score layer IS still on the map (MapLibre state persists). So this pitfall may not apply — **the score layer persists on the hidden map**.

**Why it's fine:** The MapLibre instance is never unmounted. The score layer added before navigating to `/resultaten` is still present when navigating back to `/map`. No restoration needed.

**What to check:** Does `activeScanId` in `map.tsx` survive the navigation to `/resultaten` and back? **Yes** — it's React local state in `MapPage`, which is NOT unmounted (the `<Outlet />` component is what changes, not `MapPage` itself, because MapPage renders as the `/map` route outlet content). BUT WAIT — when the user navigates to `/resultaten`, `MapPage` IS unmounted (it's the route component). `activeScanId` will be `null` when returning to `/map`.

**Real fix:** When navigating back from `/resultaten` to `/map`, pass `scan_id` in the URL so `map.tsx` can restore its state: `navigate({ to: '/map', search: { scan_id } })`. Then `map.tsx` needs a new search param `scan_id` in `MapSearchParams` and a restoration effect.

Alternatively: accept that `activeScanId` resets to `null` when returning. The score layer IS still on the map (MapLibre state), but `activeScanId` in React is null. The score layer is orphaned (visible but uncontrolled). This is a UX issue (can't trigger a new scan because `activeScanId` guard thinks none is running). **This is a real problem to solve.**

**Recommended solution:** Pass `scan_id` in URL when navigating back, and add a `scan_id` search param to `MapSearchParams` that restores `activeScanId` on mount via a `useEffect`. This is idiomatic and solves the orphaned score layer.

---

## Code Examples

### New Route: `/resultaten`

```typescript
// Source: codebase pattern from projecten.tsx + map.tsx
// frontend/src/routes/_authenticated/resultaten.tsx

import { createFileRoute, useNavigate } from '@tanstack/react-router'
import ResultsTable from '@/components/results/ResultsTable'
import ResultsFilterPanel from '@/components/results/ResultsFilterPanel'
import { ParcelDetailModal } from '@/components/results/ParcelDetailModal'
import { useState } from 'react'
import type { ScanResultsFilters, ScanResultItem } from '@/lib/types/scan'

interface ResultatenSearchParams {
  scan_id?: string
}

export const Route = createFileRoute('/_authenticated/resultaten')({
  component: ResultatenPage,
  validateSearch: (search: Record<string, unknown>): ResultatenSearchParams => ({
    scan_id: typeof search.scan_id === 'string' ? search.scan_id : undefined,
  }),
})

function ResultatenPage() {
  const navigate = useNavigate()
  const { scan_id } = Route.useSearch()
  const [filters, setFilters] = useState<ScanResultsFilters>({})
  const [total, setTotal] = useState(0)
  const [modalParcel, setModalParcel] = useState<ScanResultItem | null>(null)

  return (
    <div className="w-full h-full flex flex-col bg-grey-950">
      {/* Header */}
      <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between shrink-0">
        <h1 className="text-lg font-semibold text-grey-100">Scanresultaten</h1>
        <button
          onClick={() => navigate({ to: '/map', search: scan_id ? { scan_id } : {} })}
          className="px-3 py-1.5 text-sm text-grey-300 hover:text-white transition-colors"
        >
          Toon Kaart
        </button>
      </div>

      {scan_id ? (
        <>
          <ResultsFilterPanel filters={filters} onChange={setFilters} total={total} />
          <div className="flex-1 overflow-hidden">
            <ResultsTable
              scanId={scan_id}
              filters={filters}
              onRowDoubleClick={(parcel) => setModalParcel(parcel)}
              onTotalChange={setTotal}
            />
          </div>
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center text-grey-500">
          <p>Selecteer een scan op de kaart om resultaten te bekijken</p>
        </div>
      )}

      <ParcelDetailModal
        parcel={modalParcel}
        isOpen={!!modalParcel}
        onClose={() => setModalParcel(null)}
      />
    </div>
  )
}
```

### Updated SideRailNav Resultaten Item

```typescript
// Source: codebase — SideRailNav.tsx lines 43-60
// Change: to '/resultaten' (no search needed — scan_id linkage handled from map.tsx)
{
  icon: <ListOrdered size={20} />,
  label: 'Resultaten',
  to: '/resultaten',
  // No search — results page shows empty state if no scan
},
```

### Map.tsx: Navigate to Results Instead of Toggle Overlay

```typescript
// Source: codebase — map.tsx scan completion handler (lines 248-260)
// Change: setShowResults(true) → navigate to /resultaten?scan_id=...

// On scan completion (replace setShowResults(true)):
navigate({ to: '/resultaten', search: { scan_id: activeScanId } })

// "Toon Lijst" button (new UI element in MapShell):
<button
  onClick={() => navigate({ to: '/resultaten', search: { scan_id: activeScanId } })}
  disabled={!activeScanId}
  className="..."
>
  Toon Lijst
</button>
```

### Map.tsx: Restore Scan Context on Return

```typescript
// Source: codebase pattern from map.tsx reportId handling (lines 157-180)
// New search param: scan_id for restoration

interface MapSearchParams {
  postcode?: string
  huisnummer?: number
  reportId?: string
  panel?: 'results'
  scan_id?: string  // NEW: restore scan context from results route
}

// validateSearch addition:
scan_id: typeof search.scan_id === 'string' ? search.scan_id : undefined,

// Restoration effect (similar to reportId effect):
const { scan_id: urlScanId } = Route.useSearch()
useEffect(() => {
  if (!urlScanId || activeScanId) return  // Already have a scan, don't override
  setActiveScanId(urlScanId)
  navigate({ to: '/map', search: {}, replace: true })  // Clear from URL
}, [urlScanId, activeScanId, navigate])
```

---

## Scope Boundaries

### What Phase 30 IS (based on NAV-04 + success criteria)

- New `/resultaten` route with `scan_id` search param
- `scan_id` as cross-route contract (URL-based)
- "Toon Lijst" button on map navigates to `/resultaten?scan_id=...`
- "Toon Kaart" button on results navigates back to `/map`
- SideRailNav "Resultaten" item points to `/resultaten`
- Scan context (scan_id) preserved in URL for shareable links

### What Phase 30 is NOT

- Removing `ResultsLayout` from `map.tsx` — the overlay may remain as the in-map view (or be removed as cleanup, planner decides)
- Extracting scan pipeline from `map.tsx` — still in map.tsx
- Bidirectional parcel highlight sync (map ↔ table) on the standalone results route — this only works when map is visible
- Moving `activeGemeente` state out of `map.tsx` — only `activeScanId` needs to be shared

### Decision: Keep or Remove ResultsLayout from map.tsx?

Two valid approaches:

**Option A (Keep overlay):** `/map` keeps `ResultsLayout` as a side-panel overlay. "Toon Lijst" navigates to `/resultaten`. Two ways to see results: overlay (quick) and full page. Overlap is intentional UX.

**Option B (Remove overlay):** Remove `ResultsLayout` from `/map`. The only way to see results is via `/resultaten`. "Toon Lijst" is the sole entry point. Simpler, no duplication.

The success criteria say "full-width table" and "dedicated page" — suggesting Option B. But the overlay provides unique value (side-by-side with map). The planner should decide; either is implementable. Option B is cleaner for this phase.

---

## Open Questions

1. **Should ResultsLayout stay on /map after Phase 30?**
   - What we know: Success criteria say "full-width table in dedicated page" — implies moving, not duplicating
   - What's unclear: Is the overlay kept as a "quick preview" or is it removed?
   - Recommendation: Remove from /map in Phase 30. If needed later, re-add as separate phase.

2. **Bidirectional parcel selection (table row → map highlight) on standalone route**
   - What we know: `ResultsLayout.tsx` uses `mapRef.current.querySourceFeatures()` for fly-to. This fails when map is hidden.
   - What's unclear: Is fly-to-parcel from table row click a P0 feature for standalone route?
   - Recommendation: Treat as out-of-scope for Phase 30. The map is not visible on the results page — fly-to makes no sense. Parcel selection can highlight in table only.

3. **"Toon Kaart" should it preserve the exact map camera state?**
   - What we know: Map state (camera, layers) always persists via CSS display toggle. Score layer will still be on map.
   - What's unclear: Does `activeScanId` need to be restored in `map.tsx` for the scan guard to work properly?
   - Recommendation: Yes. Pass `scan_id` back to `/map` in URL so `map.tsx` can restore `activeScanId`. Otherwise user can't trigger a new scan (guard thinks scan is running since score layer is visible but `activeScanId` is null).

---

## Current State Analysis

### What exists and can be reused directly

| Component | Status | Reuse |
|-----------|--------|-------|
| `ResultsTable.tsx` | 366 lines, complete | Use as-is — pure `scanId` consumer |
| `ResultsFilterPanel.tsx` | 174 lines, complete | Use as-is |
| `ParcelDetailModal.tsx` | Exists, complete | Use as-is |
| `ResultsShell.tsx` | 24 lines | Use the outer shell, bypass inner container |
| `useScanResults` hook | Complete | The table uses this — no change |

### What must be created

| Artifact | Size Estimate | Notes |
|----------|---------------|-------|
| `routes/_authenticated/resultaten.tsx` | ~80-100 lines | New route, wires existing components |

### What must be modified

| File | Change | Effort |
|------|--------|--------|
| `SideRailNav.tsx` | Change "Resultaten" nav item `to` from `/map` to `/resultaten` | 1 line |
| `routes/_authenticated/map.tsx` | Replace `setShowResults(true)` with navigation; add "Toon Lijst" button; add `scan_id` search param; add restoration effect | ~30 lines |
| `components/results/ResultsLayout.tsx` | Either keep (Option A) or remove from map.tsx (Option B); no internal changes needed | 0-1 lines |

### The map.tsx monolith consideration

`map.tsx` is 954 lines. Phase 30 does NOT require extracting the scan pipeline — that is a separate concern. Only the navigation behavior changes:
- `setShowResults(true)` → `navigate({ to: '/resultaten', search: { scan_id: activeScanId } })`
- `showResults` state variable can be removed
- `ResultsLayout` JSX block can be removed (if Option B)

This reduces `map.tsx` by approximately 50-80 lines. The file stays well over 300 lines (project limit), but Phase 30 is not a refactor phase.

---

## Sources

### Primary (HIGH confidence)

- Direct reading of `frontend/src/routes/_authenticated.tsx` — persistent MapView architecture confirmed
- Direct reading of `frontend/src/routes/_authenticated/map.tsx` (954 lines) — `activeScanId`, `showResults`, `ResultsLayout` usage confirmed
- Direct reading of `frontend/src/components/results/ResultsLayout.tsx` — MapLibre dependency (`mapRef`) confirmed
- Direct reading of `frontend/src/components/layout/SideRailNav.tsx` — current "Resultaten" nav item (`to: '/map', search: { panel: 'results' }`) confirmed
- Direct reading of `frontend/src/components/layout/ResultsShell.tsx` — inner `max-w-5xl` container confirmed
- Direct reading of `.planning/phases/28-navigation-persistent-mapview/28-VERIFICATION.md` — CSS display toggle pattern verified
- Direct reading of `.planning/phases/29-silver-map-theme-layout-shells/29-VERIFICATION.md` — layout shell adoption verified
- Direct reading of `frontend/src/lib/types/scan.ts` — `ScanResultItem`, `ScanResultsFilters` types
- Direct reading of `frontend/src/hooks/useScans.ts` — `useScanResults(scanId, filters)` API confirmed

---

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — no new libraries needed, existing stack confirmed from package.json
- Architecture: HIGH — based on direct code reading, patterns from existing routes
- Pitfalls: HIGH — identified from direct analysis of the actual code that will change

**Research date:** 2026-02-18
**Valid until:** Until any changes to `_authenticated.tsx`, `map.tsx`, or `ResultsLayout.tsx` — this research is code-specific, not library-specific.
