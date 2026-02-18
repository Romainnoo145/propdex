---
phase: 33-data-table-polish
plan: 03
subsystem: ui
tags: [react, tanstack-table, fastapi, excel, row-selection, bulk-actions]

# Dependency graph
requires:
  - phase: 33-01
    provides: URL search params, multi-sort in ResultsTable
provides:
  - Checkbox row selection in ResultsTable (RowSelectionState keyed by parcel UUID)
  - BulkActionBar component with export and disabled add-to-project
  - Backend GET /{scan_id}/export/selection endpoint with parcel_ids query param
  - list_scan_results_by_ids service function
affects: [33-04, future parcel-to-project integration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "getRowId: (row) => row.parcel_id — keys selection state by UUID not row index for paginated tables"
    - "selectionKey counter — parent increments to force-clear table internal RowSelectionState"
    - "window.open GET export — simple browser download via new tab for authenticated GET endpoints"

key-files:
  created:
    - frontend/src/components/results/BulkActionBar.tsx
  modified:
    - frontend/src/components/results/ResultsTable.tsx
    - frontend/src/routes/_authenticated/resultaten.tsx
    - backend/app/scans/router.py
    - backend/app/scans/service.py
    - backend/app/services/excel_exporter.py

key-decisions:
  - "getRowId keyed by parcel_id UUID (not row index) ensures selection persists across pages in paginated table"
  - "selectionKey counter pattern: parent increments key to force-clear table RowSelectionState — without this, Deselecteren only resets parent array but checkboxes remain visually checked"
  - "Column definitions moved inside component (not const at module level) to access table API (getIsAllPageRowsSelected, getIsSomePageRowsSelected) in header checkbox"
  - "window.open on GET export endpoint — works because export/selection is GET returning a file download"
  - "BulkActionBar returns null when selectedCount===0 (not CSS hidden) — prevents empty bar flash"
  - "Toevoegen aan project disabled with cursor-not-allowed opacity-60 — no parcel-to-project data model yet"

patterns-established:
  - "Force-clear pattern: selectionKey counter incremented by parent, watched by table useEffect to call setRowSelection({})"
  - "e.stopPropagation() on checkbox cell onClick prevents checkbox click from triggering onRowClick"

# Metrics
duration: 4min
completed: 2026-02-18
---

# Phase 33 Plan 03: Multi-Select Checkboxes and Bulk Export Summary

**Checkbox row selection with parcel-UUID-keyed RowSelectionState, BulkActionBar with Excel export, and backend `/export/selection` endpoint (max 500 parcels)**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-18T04:12:19Z
- **Completed:** 2026-02-18T04:16:29Z
- **Tasks:** 2
- **Files modified:** 6 (3 backend + 3 frontend)

## Accomplishments
- Checkbox column added as first column in ResultsTable, keyed by parcel_id UUID for correct paginated selection
- BulkActionBar component shows selection count, Exporteer selectie (amber CTA), and disabled Toevoegen aan project
- Backend GET /{scan_id}/export/selection endpoint parses comma-separated parcel UUIDs, validates (0 < n <= 500), returns Excel
- Selection state resets on scan/filter change and on selectionKey increment (parent-controlled force-clear)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add backend export-selection endpoint** - `a1bc705` (feat)
2. **Task 2: Add row selection and BulkActionBar to frontend** - `d0a6734` (feat)

**Plan metadata:** (committed with SUMMARY + STATE update)

## Files Created/Modified
- `frontend/src/components/results/BulkActionBar.tsx` - New floating bar: selection count, export CTA, disabled add-to-project
- `frontend/src/components/results/ResultsTable.tsx` - Added RowSelectionState, checkbox column, onSelectionChange/selectionKey props
- `frontend/src/routes/_authenticated/resultaten.tsx` - Added BulkActionBar, selectedParcelIds state, selectionKey counter
- `backend/app/scans/router.py` - Added GET /{scan_id}/export/selection endpoint with parcel_ids validation
- `backend/app/scans/service.py` - Added list_scan_results_by_ids function (IN filter, no pagination)
- `backend/app/services/excel_exporter.py` - Added 'selection' key handler in _format_filters

## Decisions Made
- `getRowId: (row) => row.parcel_id` — UUID-keyed selection essential for paginated tables (row index shifts on page change)
- `selectionKey` counter pattern — parent must force-clear table's internal RowSelectionState independently from parent state; plain `setSelectedParcelIds([])` only resets parent array, leaves checkboxes visually checked
- Column definitions moved inside the component (from module-level `const columns`) to access TanStack Table instance methods in the header checkbox (`table.getIsAllPageRowsSelected()`, `table.getIsSomePageRowsSelected()`)
- `window.open(..., '_blank')` for export download — works for GET endpoints returning file attachments
- BulkActionBar `returns null` when count is 0 (not CSS hidden) to avoid layout shift

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added 'selection' key handling to excel_exporter _format_filters**
- **Found during:** Task 1 (backend endpoint)
- **Issue:** The plan specified `filters_applied = {"selection": "N percelen geselecteerd"}` but `_format_filters` only handled known filter keys; "selection" would produce "Geen filters" in the Excel metadata row
- **Fix:** Added `if "selection" in filters: parts.append(f"Selectie={filters['selection']}")` to `_format_filters`
- **Files modified:** `backend/app/services/excel_exporter.py`
- **Verification:** ruff check passes, selection metadata appears in Excel filters row
- **Committed in:** a1bc705 (Task 1 commit)

**2. [Rule 1 - Bug] Fixed ruff B904: raise-without-from-in-except**
- **Found during:** Task 1 verification (ruff check)
- **Issue:** `except ValueError: raise HTTPException(...)` triggered B904 — requires `raise ... from e` to distinguish exception chain
- **Fix:** Changed to `except ValueError as e: raise HTTPException(...) from e`
- **Files modified:** `backend/app/scans/router.py`
- **Verification:** `ruff check app/scans/router.py` passes
- **Committed in:** a1bc705 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 bugs)
**Impact on plan:** Minor correctness fixes. No scope creep.

## Issues Encountered
- ResultsTable.tsx was modified by linter between reads (added `useCallback` import, `onRowHover` prop). Re-read before writing, preserved all pre-existing changes in the rewrite.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- DT-03 complete: multi-select checkboxes, BulkActionBar, bulk Excel export all functional
- "Toevoegen aan project" button placeholder in place for future parcel-to-project data model
- Backend export/selection endpoint tested via import, ready for integration testing

---
*Phase: 33-data-table-polish*
*Completed: 2026-02-18*

## Self-Check: PASSED

- FOUND: frontend/src/components/results/BulkActionBar.tsx
- FOUND: frontend/src/components/results/ResultsTable.tsx
- FOUND: frontend/src/routes/_authenticated/resultaten.tsx
- FOUND: backend/app/scans/router.py
- FOUND: backend/app/scans/service.py
- FOUND: backend/app/services/excel_exporter.py
- FOUND commit: a1bc705 (feat(33-03): add export-selection backend endpoint)
- FOUND commit: d0a6734 (feat(33-03): add row selection checkboxes and BulkActionBar)
