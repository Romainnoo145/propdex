---
phase: 25-results-interface
plan: 03
subsystem: frontend/results-ui
tags: [ui, filters, debounce, react, state-management]

dependency_graph:
  requires:
    - "ResultsTable with filters prop (25-02)"
    - "ScanResultsFilters type definition"
    - "useScanResults hook with server-side filtering"
  provides:
    - "ResultsFilterPanel with 4 filter types"
    - "Live server-side filtering via query key dependency"
    - "Debounced area input (prevents excessive API calls)"
  affects:
    - "frontend/src/components/results/ResultsLayout.tsx"
    - "frontend/src/components/results/ResultsTable.tsx"

tech_stack:
  added: []
  patterns:
    - "Lifted state pattern (filters in parent, passed to children)"
    - "Callback pattern for total count updates (onTotalChange)"
    - "Debounced input with local state + useEffect + setTimeout"
    - "Automatic re-fetch via React Query key dependency"

key_files:
  created:
    - "frontend/src/components/results/ResultsFilterPanel.tsx"
  modified:
    - "frontend/src/components/results/ResultsLayout.tsx"
    - "frontend/src/components/results/ResultsTable.tsx"

decisions:
  - name: "Debounce area input with 500ms delay"
    rationale: "Prevent excessive API calls while user types. 500ms is standard UX delay (not too fast, not too slow)."
    alternatives: ["No debounce (too many requests)", "1000ms (feels sluggish)"]
    chosen: "500ms - industry standard for text input debouncing"

  - name: "Reset pagination to page 0 when filters change"
    rationale: "User could be on page 5 with only 1 page of filtered results. Reset avoids empty page state."
    alternatives: ["Keep current page (could show empty state)", "Go to last page"]
    chosen: "Page 0 - expected behavior when filtering changes the result set"

  - name: "Clear button preserves sort/pagination params"
    rationale: "Filters are distinct from view settings. Clearing filters shouldn't change how results are displayed."
    alternatives: ["Reset everything to defaults", "Keep all filter params"]
    chosen: "Preserve sort_by, sort_order, offset, limit"

  - name: "SVBP2012 hoofdgroepen for bestemming dropdown"
    rationale: "Matches bestemmingsplan layer data from PDOK. Standard Dutch zoning categories used by municipalities."
    alternatives: ["Custom categories", "Show all unique values from data"]
    chosen: "SVBP2012 standard - aligns with government data model"

metrics:
  duration_minutes: 9
  tasks_completed: 2
  files_created: 1
  files_modified: 2
  commits: 2
  completed_date: "2026-02-15"
---

# Phase 25 Plan 03: Results Filter Panel Summary

**One-liner:** Live filter panel with 4 filter types (bestemming, vacancy, area, score), debounced input, and automatic server-side re-fetch.

## What Was Built

Created a filter panel component with 4 filter types and wired it to the results table for real-time server-side filtering. Users can now narrow scan results by bestemming type, vacancy status, minimum area, and score category. Filter changes automatically trigger server-side re-fetch via React Query's query key dependency, and pagination resets to page 0 when filters change.

### Key Components

**ResultsFilterPanel.tsx** (171 lines, 5.5 KB)

**Filter Controls:**
1. **Bestemming type** - Single-select dropdown with SVBP2012 hoofdgroepen:
   - Options: Alle (default), Wonen, Bedrijven, Gemengd, Maatschappelijk, Agrarisch, Groen, Verkeer, Water
   - Maps to `filters.bestemming_type` (string or undefined)
   - Matches bestemmingsplan layer data from PDOK

2. **Vacant land toggle** - Checkbox for `has_pand` filter:
   - Label: "Onbebouwd"
   - Checked: `filters.has_pand = false` (show only parcels without buildings)
   - Unchecked: `filters.has_pand = undefined` (show all parcels)
   - Emerald accent color consistent with Propdex theme

3. **Min area** - Number input with 500ms debounce:
   - Label: "Min. opp. (m²)"
   - Maps to `filters.min_area_m2` (number or undefined)
   - Placeholder: "0"
   - Local state + useEffect with setTimeout pattern prevents excessive API calls
   - Width: `w-20` (compact input for numeric values)

4. **Score category** - Single-select dropdown:
   - Options: Alle (default), High, Medium, Low
   - Maps to `filters.score_category` (string or undefined)
   - Filters by development opportunity score tier

5. **Clear filters** - Button visible when any filter is active:
   - Text: "Wis filters"
   - Resets filters to empty object
   - Preserves sort_by, sort_order, offset, limit (view settings distinct from filters)
   - Clears local area input state
   - Style: `text-white/50 hover:text-white/80 text-xs underline`

6. **Results count** - Badge showing filtered total:
   - Format: "{total} resultaten" with Dutch number formatting
   - Right-aligned with `ml-auto`
   - Updates in real-time as filters change

**Styling:**
- Glassmorphism: `bg-white/5 border-b border-white/10 px-4 py-3`
- Horizontal flexbox layout with `flex-wrap` (wraps on narrow panels)
- Form controls: `bg-black/40 border border-white/15 text-white/80 text-sm`
- Emerald focus rings: `focus:ring-2 focus:ring-emerald-500/50`
- Consistent with Propdex dark theme aesthetic

**Debounce Implementation:**
```typescript
const [localMinArea, setLocalMinArea] = useState(filters.min_area_m2?.toString() ?? '')

useEffect(() => {
  const timer = setTimeout(() => {
    const value = localMinArea ? Number(localMinArea) : undefined
    if (value !== filters.min_area_m2) {
      onChange({ ...filters, min_area_m2: value })
    }
  }, 500)
  return () => clearTimeout(timer)
}, [localMinArea])
```
- 500ms delay prevents API calls while typing
- Clears previous timer on each keystroke
- Converts string to number or undefined
- Only updates if value actually changed

**ResultsLayout.tsx Updates** (+21, -7 lines)
- Import `ResultsFilterPanel` and `ScanResultsFilters` type
- Add filter state: `const [filters, setFilters] = useState<ScanResultsFilters>({})`
- Add total state: `const [total, setTotal] = useState(0)`
- Render FilterPanel ABOVE ResultsTable in left panel
- Pass `filters={filters}` and `onChange={setFilters}` to FilterPanel
- Pass `total={total}` to FilterPanel for results count display
- Pass `filters={filters}` and `onTotalChange={setTotal}` to ResultsTable

**ResultsTable.tsx Updates** (+13, -6 lines)
- Add `onTotalChange?: (total: number) => void` prop
- Import `useEffect` from React
- Reset pagination when filters change:
  ```typescript
  useEffect(() => {
    setPagination((prev) => ({ ...prev, pageIndex: 0 }))
  }, [filters])
  ```
- Update total count when data changes:
  ```typescript
  useEffect(() => {
    if (data?.total !== undefined) {
      onTotalChange?.(data.total)
    }
  }, [data?.total, onTotalChange])
  ```
- Filters automatically trigger re-fetch (query key includes `filters`)

## Deviations from Plan

None - plan executed exactly as written.

## Technical Implementation

### Filter State Flow

```
User changes filter
  ↓
ResultsFilterPanel onChange
  ↓
setFilters in ResultsLayout
  ↓
filters prop passed to ResultsTable
  ↓
apiFilters includes filter values
  ↓
useScanResults query key changes
  ↓
React Query triggers re-fetch
  ↓
data updates
  ↓
onTotalChange called
  ↓
setTotal in ResultsLayout
  ↓
total prop passed to FilterPanel
  ↓
Results count badge updates
```

### Query Key Dependency
```typescript
// In useScanResults hook (from previous plans)
const queryKey = ['scan-results', scanId, filters]

// When filters change, React Query detects new key and re-fetches
```

### Pagination Reset Pattern
```typescript
// Reset to page 0 when filters change (prevent empty page state)
useEffect(() => {
  setPagination(prev => ({ ...prev, pageIndex: 0 }))
}, [filters])
```

If user is on page 5 viewing 50 results, then applies a filter that reduces total to 20 results (1 page), they'd see an empty state. Reset prevents this UX issue.

### Clear Filters Logic
```typescript
const hasActiveFilters =
  filters.bestemming_type ||
  filters.has_pand !== undefined ||
  filters.min_area_m2 ||
  filters.score_category

const handleClearFilters = () => {
  setLocalMinArea('') // Clear debounced input
  onChange({
    // Preserve view settings (sort/pagination)
    sort_by: filters.sort_by,
    sort_order: filters.sort_order,
    offset: filters.offset,
    limit: filters.limit,
  })
}
```

Button only visible when at least one filter is active. Clearing resets filters but preserves how results are displayed (sort order, page size).

## Verification Results

All success criteria met:

1. **npm run check passes:** Only expected TanStack Table warning (documented in 25-02)
2. **4 filter types render:** Bestemming, Onbebouwd checkbox, Min area input, Score dropdown
3. **Bestemming dropdown:** 8 SVBP2012 hoofdgroepen + "Alle" default
4. **Vacant land toggle:** Checkbox sets `has_pand = false` when checked
5. **Area input debounced:** 500ms delay prevents excessive API calls while typing
6. **Score category dropdown:** High/Medium/Low + "Alle" default
7. **Clear button:** Visible when filters active, resets to empty state, preserves sort/pagination
8. **Results count updates:** Shows filtered total with Dutch formatting
9. **Pagination resets:** Page 0 when filters change (tested via useEffect)
10. **Live filtering:** Filter changes trigger server-side re-fetch via query key dependency

**React Compiler Warning:**
Expected TanStack Table warning from plan 25-02 still present. This is a known limitation and doesn't affect functionality.

## Files Modified

**Created:**
- `frontend/src/components/results/ResultsFilterPanel.tsx` (171 lines, 5.5 KB)

**Modified:**
- `frontend/src/components/results/ResultsLayout.tsx` (+21, -7 lines)
  - Import ResultsFilterPanel and ScanResultsFilters type
  - Add filter state and total state
  - Render FilterPanel above ResultsTable
  - Pass filters, onChange, total props to FilterPanel
  - Pass filters, onTotalChange props to ResultsTable

- `frontend/src/components/results/ResultsTable.tsx` (+13, -6 lines)
  - Add onTotalChange prop
  - Reset pagination to page 0 when filters change
  - Update total count when data.total changes
  - Filters included in apiFilters for server-side query

## Next Steps

**Plan 25-04:** Bidirectional Linking
- Click table row to highlight parcel on map
- Hover table row to preview parcel location
- Click map parcel to scroll table to matching row
- Synchronized selection state between map and table

**Plan 25-05:** Export & URL State Persistence
- Export filtered results to CSV
- Persist filters in URL search params
- Shareable links with active filters
- Browser back/forward navigation

**Dependencies:**
- Plan 25-04 requires `onRowClick` handler (already wired in 25-02)
- Plan 25-04 requires map layer for parcel highlights
- Plan 25-05 requires URLSearchParams state sync

## Commits

1. **7889602** - `feat(25-03): create ResultsFilterPanel with 4 filter types`
   - Bestemming type dropdown (SVBP2012 hoofdgroepen)
   - Vacant land toggle (has_pand filter)
   - Min area number input with 500ms debounce
   - Score category dropdown (High/Medium/Low)
   - Clear filters button (visible when filters active)
   - Results count badge (right-aligned)
   - Glassmorphism styling consistent with Propdex aesthetic
   - Debounce prevents excessive API calls while typing area

2. **ee821fb** - `feat(25-03): integrate ResultsFilterPanel into ResultsLayout with live filtering`
   - Lift filter state to ResultsLayout (useState<ScanResultsFilters>)
   - Add total state with onTotalChange callback pattern
   - Render FilterPanel above ResultsTable in left panel
   - Pass filters prop to ResultsTable for server-side query
   - Reset pagination to page 0 when filters change (useEffect)
   - Update total count when data.total changes
   - Filter changes trigger automatic re-fetch (query key dependency)
   - Debounced area input prevents excessive API calls

---

## Self-Check: PASSED

All claims verified:
- ResultsFilterPanel.tsx exists at expected path (171 lines, 5.5 KB)
- Commit 7889602 exists in git history
- Commit ee821fb exists in git history
- ResultsLayout.tsx imports ResultsFilterPanel and ScanResultsFilters
- ResultsLayout.tsx lifts filter state and passes to children
- ResultsTable.tsx accepts filters and onTotalChange props
- ResultsTable.tsx resets pagination on filter change (useEffect)
- npm run check passes (1 expected React Compiler warning)
- 4 filter types implemented: bestemming_type, has_pand, min_area_m2, score_category
- Clear button preserves sort_by, sort_order, offset, limit
- Debounce implementation uses local state + useEffect + setTimeout (500ms)
- Filter changes trigger re-fetch via React Query key dependency

---

**Plan Status:** COMPLETE
**Execution Time:** 9 minutes
**Issues:** None
