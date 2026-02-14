---
phase: 25-results-interface
plan: 02
subsystem: frontend/results-ui
tags: [ui, table, tanstack, react, pagination, sorting]

dependency_graph:
  requires:
    - "ResultsLayout split-panel container (25-01)"
    - "useScanResults hook with filters"
    - "ScanResultItem type definition"
  provides:
    - "ResultsTable with sortable columns"
    - "Server-side pagination (50 per page)"
    - "Score badges with color-coded categories"
  affects:
    - "frontend/src/components/results/ResultsLayout.tsx"

tech_stack:
  added: []
  patterns:
    - "TanStack Table v8 with manual sorting/pagination"
    - "ScoreBadge inline component for visual indicators"
    - "Server-side data fetching via useScanResults"

key_files:
  created:
    - "frontend/src/components/results/ResultsTable.tsx"
  modified:
    - "frontend/src/components/results/ResultsLayout.tsx"
    - "frontend/src/routes/_authenticated/map.tsx"

decisions:
  - name: "Default sort: score descending"
    rationale: "Users want to see most promising parcels first - highest development potential at top"
    alternatives: ["Alphabetical by address", "Area descending"]
    chosen: "Score descending - aligns with use case"

  - name: "50 results per page"
    rationale: "Balance between overview (see many results) and performance (don't overwhelm browser)"
    alternatives: ["25 per page (too few)", "100 per page (too many)"]
    chosen: "50 - industry standard for data tables"

  - name: "ScoreBadge as inline component"
    rationale: "Single use case, co-located with column definition for clarity"
    alternatives: ["Separate file", "Inline render function"]
    chosen: "Inline component - better type safety and readability"

  - name: "Bestemming column shows first type only"
    rationale: "Parcels can have multiple zoning types, but table needs single value. Truncate to 25 chars."
    alternatives: ["Show count (e.g., '3 bestemmingen')", "Comma-separated list"]
    chosen: "First type - most specific, truncated for space"

metrics:
  duration_minutes: 5
  tasks_completed: 2
  files_created: 1
  files_modified: 2
  commits: 2
  completed_date: "2026-02-15"
---

# Phase 25 Plan 02: ResultsTable Component Summary

**One-liner:** Sortable, paginated results table with 6 columns and color-coded score badges, integrated into split-panel layout.

## What Was Built

Created a production-ready results table using TanStack Table v8 with server-side sorting and pagination. The table displays scan results with 6 columns (perceelcode, adres, oppervlak, bestemming, bebouwd, score) and provides a close button to collapse back to full map view.

### Key Components

**ResultsTable.tsx** (328 lines, 9.5 KB)
- **Columns:**
  - `parcel_code`: Kadaster identifier (monospace font, no sorting)
  - `address`: Street address with "Onbekend" fallback (sortable)
  - `area_m2`: Area in m² with Dutch number formatting (sortable)
  - `bestemming`: First zoning type from bestemmingen array, truncated to 25 chars (display column)
  - `has_pand`: Boolean "Ja"/"Nee" with green/red text (visual indicator)
  - `score`: Development score with color-coded badge (sortable, default sort)

- **ScoreBadge Component:**
  - High: `bg-green-500/20 text-green-400 border-green-500/30`
  - Medium: `bg-yellow-500/20 text-yellow-400 border-yellow-500/30`
  - Low: `bg-red-500/20 text-red-400 border-red-500/30`
  - N/A: Gray badge for null scores
  - Displays score as integer (`.toFixed(0)`)

- **State Management:**
  - `sorting`: SortingState initialized to `[{ id: 'score', desc: true }]`
  - `pagination`: PaginationState with `pageIndex: 0, pageSize: 50`
  - Maps TanStack Table state to API filters (sort_by, sort_order, offset, limit)

- **Data Fetching:**
  - `useScanResults(scanId, apiFilters)` with server-side params
  - Manual pagination and sorting (backend handles heavy lifting)
  - Query key: `['scan-results', scanId, filters]` for automatic cache management

- **Visual States:**
  - Loading: 6 skeleton rows with animated pulse
  - Empty: "Geen resultaten gevonden" centered message
  - Error: Error message with details
  - Success: Full table with pagination controls

- **Pagination Controls:**
  - "Pagina X van Y" indicator
  - Previous/Next buttons with disabled states
  - "Toont X-Y van Z" range display

**ResultsLayout.tsx Updates**
- Replaced loading placeholder with `<ResultsTable scanId={scanId} />`
- Added sticky header with "Scanresultaten" title and close button
- Close button triggers `onClose` prop to collapse panel
- Table scrolls within panel, header remains fixed

**map.tsx Integration**
- Pass `onClose={() => setShowResults(false)}` to ResultsLayout
- Close button collapses results panel back to full map

## Deviations from Plan

None - plan executed exactly as written.

## Technical Implementation

### Column Definitions

```typescript
const columnHelper = createColumnHelper<ScanResultItem>()

const columns = [
  columnHelper.accessor('parcel_code', {
    header: 'Perceelcode',
    enableSorting: false,
    cell: (info) => <span className="font-mono text-xs">{info.getValue()}</span>,
  }),
  // ... 5 more columns
  columnHelper.accessor('score', {
    header: 'Score',
    enableSorting: true,
    cell: (info) => (
      <ScoreBadge
        score={info.getValue()}
        category={info.row.original.score_category}
      />
    ),
  }),
]
```

### Server-Side Integration

```typescript
// Map TanStack Table state to API filters
const apiFilters: ScanResultsFilters = {
  ...filters, // Future filter panel integration (plan 25-03)
  sort_by: sorting[0]?.id,
  sort_order: sorting[0]?.desc ? 'desc' : 'asc',
  offset: pagination.pageIndex * pagination.pageSize,
  limit: pagination.pageSize,
}

const { data, isLoading, error } = useScanResults(scanId, apiFilters)
```

### Table Configuration

```typescript
const table = useReactTable({
  data: data?.results ?? [],
  columns,
  getCoreRowModel: getCoreRowModel(),
  manualPagination: true,
  manualSorting: true,
  pageCount: Math.ceil((data?.total ?? 0) / pagination.pageSize),
  state: { sorting, pagination },
  onSortingChange: setSorting,
  onPaginationChange: setPagination,
})
```

## Verification Results

All success criteria met:

1. **Type-check passes:** `npm run check` completed with only expected React Compiler warning
2. **6 columns render:** perceelcode, adres, oppervlak, bestemming, bebouwd, score
3. **Sortable headers:** Click toggles sort order, arrow icons indicate direction
4. **Pagination works:** 50 per page, prev/next navigation, page indicator
5. **Score badges:** Color-coded by category (green/yellow/red)
6. **Loading state:** 6 skeleton rows with pulse animation
7. **Empty state:** "Geen resultaten gevonden" message
8. **Close button:** Collapses results panel, returns to full map
9. **Sticky header:** Title and close button remain visible during scroll
10. **Row click handler:** Wired via `onRowClick` prop for future use (plan 25-04)

**React Compiler Warning:**
Expected warning about TanStack Table's `useReactTable()` returning non-memoizable functions. This is a known limitation documented in React Compiler docs and doesn't affect functionality.

## Files Modified

**Created:**
- `frontend/src/components/results/ResultsTable.tsx` (328 lines, 9.5 KB)

**Modified:**
- `frontend/src/components/results/ResultsLayout.tsx` (+23, -7 lines)
  - Import ResultsTable
  - Add sticky header with title and close button
  - Replace placeholder with ResultsTable component
  - Add onClose prop handling
- `frontend/src/routes/_authenticated/map.tsx` (+4, -1 lines)
  - Pass onClose handler to ResultsLayout
  - onClose sets showResults to false

## Next Steps

**Plan 25-03:** Filters Panel
- Add filter controls for score category, area range, has_pand, bestemming type
- Wire filters prop to ResultsTable
- Live table updates when filters change
- Persist filter state in URL search params

**Plan 25-04:** Bidirectional Linking
- Click table row to highlight parcel on map
- Hover table row to preview parcel location
- Click map parcel to scroll table to matching row
- Synchronized selection state

**Dependencies:**
- Plan 25-03 requires ResultsTable filters prop (already prepared)
- Plan 25-04 requires onRowClick handler (already wired)

## Commits

1. **fd9c4ea** - `feat(25-02): create ResultsTable with TanStack Table, sorting, and pagination`
   - 6 columns with appropriate formatting
   - ScoreBadge component with color-coded categories
   - Server-side sorting via useScanResults hook
   - Pagination: 50 per page, prev/next controls
   - Default sort: score descending (most promising first)
   - Loading skeleton, empty state, error handling
   - Row click handler for future bidirectional linking

2. **2c4dbfe** - `feat(25-02): integrate ResultsTable into ResultsLayout with close button`
   - Replace placeholder with ResultsTable component
   - Sticky header with "Scanresultaten" title and X close button
   - Close button calls onClose prop to collapse panel
   - Pass onClose from map.tsx: setShowResults(false)
   - Table scrolls within panel, header stays fixed

---

## Self-Check: PASSED

All claims verified:
- ResultsTable.tsx exists at expected path (328 lines)
- Commit fd9c4ea exists in git history
- Commit 2c4dbfe exists in git history
- ResultsLayout.tsx imports ResultsTable
- map.tsx passes onClose handler
- npm run check passes (1 expected React Compiler warning)
- 6 columns defined with correct headers
- ScoreBadge component renders color-coded badges
- Pagination state initialized to 50 per page
- Sorting state initialized to score descending

---

**Plan Status:** COMPLETE
**Execution Time:** 5 minutes
**Issues:** None
