# Phase 33: Data Table Polish — Research

**Researched:** 2026-02-18
**Domain:** TanStack Table v8, TanStack Router search params, MapLibre list-map sync, filter persistence
**Confidence:** HIGH (codebase fully read, all infrastructure verified)

---

## Summary

Phase 33 builds directly on top of the existing ResultsTable and ResultsFilterPanel at `/resultaten`. The codebase already has TanStack Table v8.21.3 with manual server-side sorting and pagination, a ResultsFilterPanel with four filters (bestemming, pand_status, min_area_m2, score_category), and a bidirectional list-map sync architecture in ResultsLayout (though that component is no longer the primary results view — the standalone `/resultaten` route is now canonical). The key challenge is that several requirements (DT-02 list-map sync, DT-03 multi-select, SCAN-01/02) require significant architectural decisions about where state lives.

The most important insight is that **the `/resultaten` route currently has no access to the MapLibre map instance**. The map lives in `/map` behind a different route. MapContext (from Phase 28) only provides a map ref to components rendered within the MapShell. For DT-02 (bidirectional map-table highlighting), the user must be on `/map` viewing the ResultsLayout overlay OR the routes must share the map instance via persistent layout. The Phase 30 approach was to navigate between `/map` and `/resultaten` — the list-map sync requirement in DT-02 may need to be scoped to the `/map` overlay layout rather than the standalone `/resultaten` route.

For DT-04 (persistent filter state), TanStack Router's search params are the correct mechanism — they encode filter state into the URL, persist through navigation, and are shareable. The existing `resultaten.tsx` uses `useState` for filters, which resets on every navigation. Migrating to `useSearch` / `navigate({ search })` for filter state solves DT-04 cleanly. For DT-03 multi-select, TanStack Table v8 has a built-in `RowSelectionState` feature with `getRowSelectionRowModel()` — no custom implementation needed. Bulk export of selected parcels requires a new backend endpoint since the existing export at `GET /{scan_id}/export` operates on filters only, not a list of parcel IDs.

**Primary recommendation:** Implement DT-04 first (URL search params for filter persistence), then DT-01 (multi-criteria sort via Shift+click), then DT-03 (row selection + bulk export), then DT-05 (grouped filter panel), treating DT-02 (list-map sync) as scoped to the `/map` route's ResultsLayout overlay. SCAN-01 and SCAN-02 polish the ScanProgressOverlay auto-navigation and state labels.

---

## User Constraints

No CONTEXT.md exists — Claude has full discretion on all implementation decisions.

---

## Standard Stack

### Core (already installed — no new packages needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@tanstack/react-table` | 8.21.3 | Row selection, multi-sort | Already in use for ResultsTable |
| `@tanstack/react-router` | 1.158.4 | URL search params for filter persistence | Already handles scan_id routing |
| `maplibre-gl` | 5.17.0 | Feature-state for map highlighting | ParcelScoreLayer already uses setFeatureState |
| `sonner` | 2.0.7 | Toast for bulk action feedback | Already used throughout |
| `lucide-react` | 0.564.0 | Icons for filter panel groups, checkbox indicators | Already used |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `zod` | 4.3.6 | Validate and parse URL search params | Use for validateSearch in route definition |
| `class-variance-authority` | 0.7.1 | Checkbox and bulk action bar variants | Already used in Button primitive |

### No New Dependencies Required

All requirements can be met with installed packages. The existing `openpyxl` backend handles Excel export. No new npm packages or Python packages needed.

**Installation:**
```bash
# No new packages — all requirements met by existing dependencies
```

---

## Architecture Patterns

### Recommended Project Structure

The changes are concentrated in three areas:

```
frontend/src/
├── routes/_authenticated/
│   └── resultaten.tsx          # Add URL search params for filters (DT-04)
├── components/results/
│   ├── ResultsTable.tsx        # Add row selection, multi-sort, hover events (DT-01, DT-03, DT-02)
│   ├── ResultsFilterPanel.tsx  # Reorganize into category groups (DT-05)
│   └── BulkActionBar.tsx       # NEW: selection count + bulk action buttons (DT-03)
├── components/map/
│   └── ScanProgressOverlay.tsx # Add "Naar resultaten" CTA on complete (SCAN-01, SCAN-02)
└── lib/types/
    └── scan.ts                 # Add parcel_ids field to export types

backend/app/scans/
├── router.py                   # New POST /{scan_id}/export/selection endpoint (DT-03)
└── service.py                  # New list_scan_results_by_ids() (DT-03)
```

### Pattern 1: URL Search Params for Filter Persistence (DT-04)

**What:** Encode filter state into TanStack Router search params so filters survive navigation.

**When to use:** Any filter state that should persist across route transitions.

**Current state:** `resultaten.tsx` uses `useState<ScanResultsFilters>({})` — resets on unmount.

**Solution:** Extend `validateSearch` to include all filter fields, and use `navigate({ search: { ...current, ...filterChange } })` on filter change.

```typescript
// Source: TanStack Router validateSearch pattern (existing in resultaten.tsx)

interface ResultatenSearchParams {
  scan_id?: string
  // Add filter fields:
  bestemming_type?: string
  pand_status?: string
  min_area_m2?: number
  score_category?: string
  sort_by?: string
  sort_order?: 'asc' | 'desc'
  page?: number
}

export const Route = createFileRoute('/_authenticated/resultaten')({
  component: ResultatenPage,
  validateSearch: (search: Record<string, unknown>): ResultatenSearchParams => ({
    scan_id: typeof search.scan_id === 'string' ? search.scan_id : undefined,
    bestemming_type: typeof search.bestemming_type === 'string' ? search.bestemming_type : undefined,
    pand_status: typeof search.pand_status === 'string' ? search.pand_status : undefined,
    min_area_m2: typeof search.min_area_m2 === 'number' ? search.min_area_m2 : undefined,
    score_category: typeof search.score_category === 'string' ? search.score_category : undefined,
    sort_by: typeof search.sort_by === 'string' ? search.sort_by : undefined,
    sort_order: search.sort_order === 'asc' || search.sort_order === 'desc' ? search.sort_order : undefined,
    page: typeof search.page === 'number' ? search.page : undefined,
  }),
})

function ResultatenPage() {
  const search = Route.useSearch()
  const navigate = useNavigate()

  // Derive filters from URL search params
  const filters: ScanResultsFilters = {
    bestemming_type: search.bestemming_type,
    pand_status: search.pand_status,
    min_area_m2: search.min_area_m2,
    score_category: search.score_category,
    sort_by: search.sort_by,
    sort_order: search.sort_order,
    offset: (search.page ?? 0) * 50,
    limit: 50,
  }

  const handleFilterChange = (newFilters: ScanResultsFilters) => {
    navigate({
      to: '/resultaten',
      search: (prev) => ({
        ...prev,
        bestemming_type: newFilters.bestemming_type,
        pand_status: newFilters.pand_status,
        min_area_m2: newFilters.min_area_m2,
        score_category: newFilters.score_category,
        page: 0,  // Reset page on filter change
      }),
    })
  }
}
```

**Key insight:** `navigate({ search: prev => ({...prev, ...newFields}) })` merges search params, preserving `scan_id`.

### Pattern 2: TanStack Table Row Selection (DT-03)

**What:** Built-in `RowSelectionState` with checkbox column. No custom implementation.

**When to use:** Any multi-select table feature.

**Current state:** ResultsTable has no row selection. Checkbox column must be added as first column.

```typescript
// Source: TanStack Table v8 built-in row selection (verified in node_modules)

import {
  RowSelectionState,
  getRowSelectionRowModel,
} from '@tanstack/react-table'

// In ResultsTable component:
const [rowSelection, setRowSelection] = useState<RowSelectionState>({})

// Add checkbox column as first column:
const columns = [
  columnHelper.display({
    id: 'select',
    header: ({ table }) => (
      <input
        type="checkbox"
        checked={table.getIsAllPageRowsSelected()}
        onChange={table.getToggleAllPageRowsSelectedHandler()}
        className="rounded border-grey-700 bg-grey-900 text-amber-accent"
      />
    ),
    cell: ({ row }) => (
      <input
        type="checkbox"
        checked={row.getIsSelected()}
        onChange={row.getToggleSelectedHandler()}
        onClick={(e) => e.stopPropagation()} // Prevent row click when checking
        className="rounded border-grey-700 bg-grey-900 text-amber-accent"
      />
    ),
  }),
  // ...existing columns
]

// In useReactTable config:
const table = useReactTable({
  // ...existing options
  enableRowSelection: true,
  state: {
    // ...existing state
    rowSelection,
  },
  onRowSelectionChange: setRowSelection,
  getRowSelectionRowModel: getRowSelectionRowModel(),
})

// Get selected parcel IDs:
const selectedParcelIds = Object.keys(rowSelection)
  .filter(k => rowSelection[k])
  .map(k => table.getRowModel().rows[Number(k)]?.original.parcel_id)
  .filter(Boolean)
```

**Critical note:** Row selection is keyed by row index (default) or by `getRowId`. Since results paginate, selection should reset on page change OR use `getRowId={() => row.original.parcel_id}` to persist IDs across re-renders. For bulk export, using parcel_id as row ID is simpler.

### Pattern 3: Multi-Criteria Sorting via Shift+Click (DT-01)

**What:** TanStack Table's built-in `enableMultiSort` option — no extra code.

**When to use:** Tables with server-side pagination where sort is manual.

**Current state:** ResultsTable has `manualSorting: true` but only sends single sort to API.

**Challenge:** Backend `list_results` endpoint accepts only one `sort_by` + `sort_order`. For multi-sort, either:
1. Send only primary sort to backend (simplest — does not require backend change)
2. Extend backend to accept comma-separated sort fields (more work, better UX)

**Recommendation:** Phase 33 scope — implement UI-side Shift+click multi-sort UI using TanStack Table's built-in feature, but **only send primary sort to backend** (first entry in SortingState array). This delivers the visual multi-sort indicator without backend changes. Backend multi-sort can be a future enhancement.

```typescript
const table = useReactTable({
  // ...existing
  enableMultiSort: true,
  isMultiSortEvent: (e) => (e as MouseEvent).shiftKey, // Shift+click for multi-sort
  maxMultiSortColCount: 3,
  // API only sends primary sort (first in array):
  // sort_by: sorting[0]?.id, sort_order: sorting[0]?.desc ? 'desc' : 'asc'
})
```

### Pattern 4: List-Map Hover Sync (DT-02)

**What:** Hovering a table row calls `setFeatureState({ hover: true })` on the MapLibre layer. Hovering a map parcel emits an event that highlights the table row.

**When to use:** Only achievable when table and map share the same React tree AND a map instance is accessible.

**Critical constraint:** The standalone `/resultaten` route renders inside `ResultsShell`, which is NOT inside `MapShell`. The MapContext provider in `_authenticated.tsx` provides a shared map ref, but the map is only mounted when the MapView component is rendered (inside `/map`). When the user navigates to `/resultaten`, the map is NOT rendered.

**Confirmed architecture from `_authenticated.tsx`:**

```typescript
// The map is inside MapShell, which is only rendered on /map route
// ResultsShell routes (/resultaten, /projecten) have no map
```

**Two options for DT-02:**

**Option A (Recommended):** Implement DT-02 in `ResultsLayout.tsx` (the overlay panel inside `/map`). This component already has `mapRef` passed as prop and already implements `setupParcelScoreClickHandler` for map→table sync. Adding table→map hover (calling `setFeatureState({ hover: true })`) just requires passing a hover callback from ResultsLayout to ResultsTable. This is architecturally correct — list-map sync only makes sense when both are visible simultaneously.

**Option B (Complex):** Make the map persistent across routes by lifting MapView out of `/map` into the `_authenticated` layout. This is a larger architectural change (Phase 30's decision was to separate routes). Defer to future phase.

**Recommendation:** Implement DT-02 as an enhancement to `ResultsLayout.tsx` (the `/map` overlay view), not the standalone `/resultaten` route. The success criterion "hovering table row highlights parcel on map" is satisfied when viewed in the overlay layout.

```typescript
// In ResultsTable.tsx — add hover callbacks
interface ResultsTableProps {
  // ...existing
  onRowHover?: (parcelId: string | null) => void
}

// In ResultsLayout.tsx — handle hover
<ResultsTable
  onRowHover={(parcelId) => {
    if (!mapRef.current) return
    // Clear previous hover
    if (prevHoveredId) {
      map.setFeatureState(
        { source: 'parcel-scores', sourceLayer: 'parcel_scores', id: prevHoveredId },
        { hover: false }
      )
    }
    if (parcelId) {
      // Find feature ID from parcel_id
      const features = map.querySourceFeatures('parcel-scores', {
        sourceLayer: 'parcel_scores',
        filter: ['==', ['get', 'parcel_id'], parcelId],
      })
      if (features[0]?.id !== undefined) {
        map.setFeatureState(
          { source: 'parcel-scores', sourceLayer: 'parcel_scores', id: features[0].id },
          { hover: true }
        )
      }
    }
  }}
/>
```

### Pattern 5: Advanced Filter Panel with Category Groups (DT-05)

**What:** Restructure ResultsFilterPanel from a horizontal filter bar into a grouped panel with collapsible category sections (Locatie, Oppervlak, Bestemming, Score).

**Current state:** Four flat filters in a `flex-wrap` horizontal bar.

**Implementation:** Convert to a collapsible panel using `useState` for open/closed sections. No new library needed.

```typescript
// Category groups structure:
const FILTER_GROUPS = [
  {
    id: 'location',
    label: 'Locatie',
    filters: [], // Phase 33 scope: no location filters yet — placeholder
  },
  {
    id: 'area',
    label: 'Oppervlak',
    filters: ['min_area_m2', 'max_area_m2'],
  },
  {
    id: 'zoning',
    label: 'Bestemming',
    filters: ['bestemming_type', 'pand_status'],
  },
  {
    id: 'score',
    label: 'Score',
    filters: ['score_category'],
  },
]
```

**Note:** The existing ScanResultsFilters type already has `max_area_m2` (currently unused in UI). Phase 33 can expose it in the advanced panel.

### Pattern 6: Scan-to-Results Flow (SCAN-01, SCAN-02)

**What:** Auto-navigate to `/resultaten` after scan completes (already partially implemented), plus clear state labels during scan.

**Current state in `map.tsx`:**
- Line 252: `navigate({ to: '/resultaten', search: { scan_id: activeScanId! } })` — already navigates on completion.
- Problem: This navigation happens in the scan polling effect. If `ScanProgressOverlay` is displayed and the scan completes, navigation happens automatically but the overlay shows "completed" state briefly without a CTA button to go to results.

**SCAN-01 (minimal-click flow):** The scan already auto-navigates. The improvement is to add a "Bekijk resultaten" button in the completed state of ScanProgressOverlay, before auto-nav fires, so users who notice the overlay can click proactively.

**SCAN-02 (clear state indication):** The ScanProgressOverlay already shows a 3-step stepper with `current_phase` labels. Improvement: show the current phase label more prominently. Add a "4th state" label for the `wijk click → scan_id received → polling starts` gap (currently shows "Scan starten..." which is correct but could be clearer).

```typescript
// In ScanProgressOverlay — add CTA on completion:
{isCompleted && (
  <button
    onClick={onViewResults}
    className="mt-3 w-full py-1.5 px-3 text-xs font-medium text-grey-950 bg-amber-accent hover:bg-amber-accent-hover rounded transition-colors"
  >
    Bekijk resultaten
  </button>
)}

// ScanProgressOverlay gets new prop:
interface ScanProgressOverlayProps {
  // ...existing
  onViewResults?: () => void
}
```

### Anti-Patterns to Avoid

- **Lifting MapView to persistent layout for list-map sync:** Too large a refactor for Phase 33 scope. Keep DT-02 in ResultsLayout overlay only.
- **Custom checkbox component from scratch:** Use HTML `<input type="checkbox">` with Tailwind styling — the project has no Radix or Headless UI. The existing `Input.tsx` primitive is for text inputs only.
- **Row selection state in URL params:** Row selection is ephemeral (UI-only, not persisted). Keep it in `useState`. Only filter state goes in URL params.
- **Backend multi-sort without frontend need proven:** Only send primary sort to backend. Adding multi-sort backend complexity is premature.
- **Re-implementing `getRowSelectionRowModel`:** This is built into TanStack Table v8. Never write custom selection logic.
- **Using `navigate` without `search: prev => ({...prev})` spread:** Without spreading, navigating with new filter params erases `scan_id`. Always use the function form.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Row selection state | Custom checked Set | `RowSelectionState` + `getRowSelectionRowModel()` | TanStack Table handles select-all, page-select, indeterminate state |
| Multi-sort UI | Custom sort indicators | `enableMultiSort: true` + `isMultiSortEvent` | Built-in, handles Shift+click detection and sort removal |
| URL filter encoding | Manual `URLSearchParams` | TanStack Router `validateSearch` + `navigate({ search })` | Type-safe, handles back/forward, coerces types |
| Map feature hover | Custom pub/sub | MapLibre `setFeatureState()` directly | Already used in ParcelScoreLayer for selection; same API for hover |
| Export file generation | Browser-side Excel | Existing `GET /{scan_id}/export` endpoint + new selection endpoint | openpyxl already handles formatting, styling, column sizing |

**Key insight:** TanStack Table v8 has all multi-select infrastructure built-in — the only code to write is the checkbox column definition and connecting `rowSelection` state.

---

## Common Pitfalls

### Pitfall 1: Row Selection Keyed by Index, Not ID

**What goes wrong:** TanStack Table's default `getRowId` uses row index. When user navigates to page 2, row 0 on page 2 is a different parcel than row 0 on page 1. The selection state `{ "0": true }` is ambiguous.

**Why it happens:** The default `getRowId` is `(row, index) => String(index)` — fine for non-paginated tables, wrong for paginated.

**How to avoid:** Set `getRowId: (row) => row.parcel_id` in `useReactTable`. This makes selection state keyed by parcel UUID, survives page navigation, and makes it trivial to extract selected parcel IDs for bulk export.

**Warning signs:** Selecting row on page 1, going to page 2, and seeing unexpected checkmarks.

### Pitfall 2: Filter Changes Erase scan_id from URL

**What goes wrong:** Calling `navigate({ to: '/resultaten', search: { bestemming_type: 'Wonen' } })` replaces ALL search params, erasing `scan_id`.

**Why it happens:** TanStack Router's `navigate({ search: {...} })` with an object literal replaces search params entirely.

**How to avoid:** Always use the functional form: `navigate({ search: prev => ({ ...prev, bestemming_type: 'Wonen' }) })`. The `prev` callback receives current search params and merges.

**Warning signs:** After applying a filter, table shows "Geen scan geselecteerd" EmptyState because `scan_id` is undefined.

### Pitfall 3: Map Feature State by parcel_id String vs Feature ID Integer

**What goes wrong:** `setFeatureState()` requires the MVT numeric feature ID (assigned by MapLibre from the tile), not the `parcel_id` string UUID. Querying by `parcel_id` string gives back features, but you must use `features[0].id` (integer) for `setFeatureState`.

**Why it happens:** MVT feature IDs are integers derived from tile coordinates. MapLibre's feature state is keyed by this integer ID, not by property values.

**How to avoid:** Use `map.querySourceFeatures()` to find features by `parcel_id` property, then extract `feature.id` (the integer) for `setFeatureState`. This is the exact pattern already used in `ResultsLayout.tsx` line 70 (`setParcelScoreSelection(map, features[0].id ?? null, ...)`).

**Warning signs:** `setFeatureState` call with `id: parcelId` (UUID string) does nothing visually.

### Pitfall 4: Bulk Export Without Backend Endpoint for Selected Parcel IDs

**What goes wrong:** The existing `GET /{scan_id}/export` filters by bestemming/score/area but cannot filter by an explicit list of parcel UUIDs. Sending selected IDs requires a new endpoint or request body.

**Why it happens:** REST GET endpoints can't have a request body (technically possible but bad practice). A list of 50+ UUIDs in query params is unwieldy.

**How to avoid:** Add `POST /{scan_id}/export/selection` that accepts `{ parcel_ids: string[] }` in the request body. The service layer uses `WHERE parcel_id IN (...)`. Alternatively, use a query param `parcel_ids` as comma-separated string for simplicity.

**Recommendation:** Use `GET /{scan_id}/export?parcel_ids=uuid1,uuid2,...` as a comma-separated query param. This avoids adding a POST route for what is semantically a GET (downloading a file). Comma-separated UUIDs in query params are fine for up to ~100 selections.

**Warning signs:** Frontend trying to stream a POST response as a file download — browser can't `window.open()` a POST.

### Pitfall 5: Debounce Area Filter Breaks URL-Param Approach

**What goes wrong:** The current `ResultsFilterPanel` has a debounced area input using local `useState`. If filters move to URL params, the debounce must still work (don't update URL on every keystroke).

**Why it happens:** URL updates trigger re-renders of the entire route, which is heavier than a local state change. Debouncing prevents excessive navigation calls.

**How to avoid:** Keep a local `useState` for the area input text value, debounce the URL update (500ms), then call `navigate({ search: prev => ({...prev, min_area_m2: value}) })`. Same pattern as current implementation, just calling navigate instead of `onChange`.

### Pitfall 6: ScanProgressOverlay Auto-Nav Race with View-Results Button

**What goes wrong:** ScanProgressOverlay shows "Scan voltooid" state, user clicks "Bekijk resultaten" button, but the `useEffect` in `map.tsx` also triggers `navigate()` 1 render later — double navigation.

**Why it happens:** The polling effect in `map.tsx` calls `navigate` when `scanStatus.data.status === 'completed'`. If a button also calls `navigate`, both fire.

**How to avoid:** Add a `navigatedRef = useRef(false)` guard. The effect and button both set `navigatedRef.current = true` before calling navigate, and the other checks the flag. Or simpler: pass `onViewResults` prop to ScanProgressOverlay that calls the same navigation logic, and have the effect call the same function — deduplicate by making navigation idempotent (TanStack Router won't re-navigate to same URL).

---

## Code Examples

Verified patterns from the existing codebase:

### Row Selection Column Definition

```typescript
// Pattern: select column first, uses HTML checkbox (no Radix/Headless UI)
columnHelper.display({
  id: 'select',
  size: 40,
  enableSorting: false,
  header: ({ table }) => (
    <input
      type="checkbox"
      checked={table.getIsAllPageRowsSelected()}
      ref={(el) => {
        if (el) el.indeterminate = table.getIsSomePageRowsSelected()
      }}
      onChange={table.getToggleAllPageRowsSelectedHandler()}
      className="w-4 h-4 rounded border-grey-700 bg-grey-900 accent-amber-accent cursor-pointer"
    />
  ),
  cell: ({ row }) => (
    <input
      type="checkbox"
      checked={row.getIsSelected()}
      onChange={row.getToggleSelectedHandler()}
      onClick={(e) => e.stopPropagation()}
      className="w-4 h-4 rounded border-grey-700 bg-grey-900 accent-amber-accent cursor-pointer"
    />
  ),
})
```

### URL Filter Navigation (merging, not replacing)

```typescript
// CORRECT: functional search update
const handleFilterChange = (key: string, value: string | number | undefined) => {
  navigate({
    to: '/resultaten',
    search: (prev) => ({
      ...prev,
      [key]: value,
      page: 0,  // reset page when filter changes
    }),
  })
}
```

### Table Row Hover for Map Sync (in ResultsLayout context)

```typescript
// In ResultsTable row render:
<tr
  onMouseEnter={() => onRowHover?.(row.original.parcel_id)}
  onMouseLeave={() => onRowHover?.(null)}
  onClick={() => onRowClick?.(row.original.parcel_id)}
  // ...existing classes
/>
```

### Bulk Export — Frontend Trigger

```typescript
// Export selected parcels via GET with comma-separated IDs
const handleBulkExport = (parcelIds: string[]) => {
  const params = new URLSearchParams({
    parcel_ids: parcelIds.join(','),
  })
  window.open(
    `/api/scans/${scanId}/export/selection?${params.toString()}`,
    '_blank'
  )
}
```

### ScanProgressOverlay — Completed State CTA

```typescript
// In ScanProgressOverlay, after existing completed state icon:
{isCompleted && onViewResults && (
  <button
    onClick={onViewResults}
    className="mt-3 w-full py-1.5 px-3 text-xs font-medium text-grey-950 bg-amber-accent hover:bg-amber-accent-hover rounded transition-colors"
  >
    Bekijk resultaten
  </button>
)}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Custom selection logic | TanStack Table `RowSelectionState` | TanStack Table v7+ | No hand-rolled checkbox trees |
| `useState` for filter persistence | TanStack Router search params | Phase 30 introduced Router v1 | URL-driven state, shareable, back-button friendly |
| Manual Shift+click sort detection | `enableMultiSort` + `isMultiSortEvent` | TanStack Table v7+ | No DOM event handling needed |
| Feature-state hover on click only | Feature-state on `mousemove` AND click | MapLibre GL v2+ | ParcelScoreLayer already implements both |

**Deprecated/outdated:**
- `getSortedRowModel` from client-side sorting: Not applicable — project uses `manualSorting: true` throughout. Client-side sorting would require loading all data.
- `getFilteredRowModel` from client-side filtering: Not applicable — all filtering is server-side via API params.

---

## Open Questions

1. **DT-02 Scope: overlay vs standalone route**
   - What we know: MapContext provides a shared map ref, but map is only mounted on `/map`. `/resultaten` has no map instance.
   - What's unclear: Whether the success criteria require bidirectional sync on `/resultaten` (impossible without map) or if "list-map sync" means the overlay on `/map` (already partially implemented in ResultsLayout).
   - Recommendation: Interpret DT-02 as the `/map` overlay layout. Implement `onRowHover` callback in ResultsTable and wire in ResultsLayout.tsx. Document this scope decision in PLAN.md.

2. **DT-03 Bulk "Add to Project" — backend model**
   - What we know: Projects in the backend contain reports (`assignReportToProject` is report-based). There is no parcel-to-project direct relationship.
   - What's unclear: "Add to Project" for parcels would require either (a) generating a report per parcel, or (b) storing parcel IDs in a project. Neither exists in the backend.
   - Recommendation: Scope DT-03 bulk actions to **Export only** for Phase 33. "Add to Project" is a more complex data model change. Show it as a disabled "Coming soon" button in the BulkActionBar to satisfy the UI requirement without backend work.

3. **DT-01 Server-side multi-sort**
   - What we know: Backend accepts single `sort_by` + `sort_order`. TanStack Table can hold multi-sort state.
   - What's unclear: Whether users actually need true secondary sort on server, or if visual indicator is sufficient.
   - Recommendation: Phase 33 — send only primary sort to server. The multi-sort UI (Shift+click, multiple sort indicators in headers) is delivered; secondary sort is applied in display only if client has all data (it doesn't — server-paginated). Make this a known limitation in PLAN.md.

---

## Requirement-to-Implementation Mapping

| Requirement | Implementation | Components Changed | Backend Change? |
|-------------|---------------|--------------------|-----------------|
| DT-01 Multi-criteria sort | `enableMultiSort`, primary sort → server | ResultsTable.tsx | No |
| DT-02 List-map sync | `onRowHover` → `setFeatureState`, map→table via mousemove | ResultsTable.tsx, ResultsLayout.tsx | No |
| DT-03 Multi-select + bulk export | `RowSelectionState`, BulkActionBar, GET export with parcel_ids | ResultsTable.tsx, BulkActionBar.tsx (new), router.py | Yes — new GET export/selection endpoint |
| DT-04 Persistent filters | URL search params in validateSearch + navigate | resultaten.tsx, ResultsFilterPanel.tsx | No |
| DT-05 Advanced filter panel | Category group sections, max_area_m2 exposed | ResultsFilterPanel.tsx | No |
| SCAN-01 Auto-navigate on complete | Already implemented; add "Bekijk resultaten" CTA | ScanProgressOverlay.tsx, map.tsx | No |
| SCAN-02 Clear scan state | Phase label in completed stepper, wijk name in progress | ScanProgressOverlay.tsx | No |

---

## Sources

### Primary (HIGH confidence — code directly read)
- `/frontend/src/components/results/ResultsTable.tsx` — TanStack Table v8 config, SortingState, PaginationState, manualSorting
- `/frontend/src/components/results/ResultsFilterPanel.tsx` — existing 4 filters, debounce pattern
- `/frontend/src/routes/_authenticated/resultaten.tsx` — current URL state (scan_id only), useState for filters
- `/frontend/src/components/results/ResultsLayout.tsx` — list-map sync architecture, setupParcelScoreClickHandler, setParcelScoreSelection
- `/frontend/src/components/map/ParcelScoreLayer.tsx` — setFeatureState hover/selection pattern
- `/frontend/src/routes/_authenticated/map.tsx` — scan flow, navigate on complete, ScanProgressOverlay usage
- `/frontend/src/components/map/ScanProgressOverlay.tsx` — 3-step stepper, completed/running/failed states
- `/frontend/src/lib/MapContext.tsx` — map ref provider scope
- `/frontend/src/lib/types/scan.ts` — ScanResultsFilters, ScanResultItem types
- `/backend/app/scans/router.py` — export endpoint, results endpoint, filter params
- `/frontend/package.json` — all installed package versions

### Secondary (HIGH confidence — installed package source)
- `node_modules/@tanstack/table-core/build/lib/features/RowSelection.js` — `RowSelectionState`, `enableRowSelection`, `getToggleAllRowsSelectedHandler`, `getIsSelected` confirmed present
- `node_modules/@tanstack/table-core/build/lib/features/RowSorting.js` — `enableMultiSort`, `isMultiSortEvent`, `maxMultiSortColCount` confirmed present in v8.21.3

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified from package.json and node_modules
- Architecture: HIGH — all components and patterns read from source; no assumptions
- Pitfalls: HIGH — derived from actual code patterns and known library behaviors (verified in source)
- DT-02 scope decision: MEDIUM — depends on interpretation of "list-map sync" requirement, flagged as open question

**Research date:** 2026-02-18
**Valid until:** 2026-03-20 (stable library versions, 30-day validity)
