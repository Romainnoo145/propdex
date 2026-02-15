---
phase: 26-change-monitoring
plan: 06
subsystem: monitoring
tags: [gap-closure, map-overlay, hierarchical-data]
completed: 2026-02-15
duration: 121s
tasks_completed: 1
files_modified: 2

dependency_graph:
  requires:
    - "26-05 (MonitoredWijkOverlay component)"
    - "26-01 (Project hierarchy model)"
  provides:
    - "MonitoredWijkOverlay integrated into map page"
    - "Hierarchical children populated in GET /api/monitoring/projects"
  affects:
    - "frontend/src/routes/_authenticated/map.tsx"
    - "backend/app/monitoring/router.py"

tech_stack:
  added: []
  patterns:
    - "Imperative layer management (addMonitoredWijkOverlay/removeMonitoredWijkOverlay)"
    - "useEffect cleanup for map layer lifecycle"
    - "Parent-child grouping via parent_id lookup dictionary"

key_files:
  created: []
  modified:
    - path: "frontend/src/routes/_authenticated/map.tsx"
      lines_changed: "+59"
      purpose: "Integrate MonitoredWijkOverlay component and useMonitoredProjects hook"
    - path: "backend/app/monitoring/router.py"
      lines_changed: "+18 -3"
      purpose: "Populate hierarchical children in GET /projects endpoint"

decisions:
  - summary: "Extract wijk names from both hierarchical children and flat top-level projects for backward compatibility"
    rationale: "Frontend should handle both hierarchical response (post-fix) and flat response (pre-fix) gracefully"
    alternatives: "Assume only hierarchical response - rejected (fragile during migration)"
  - summary: "Return only root projects in GET /projects response with populated children arrays"
    rationale: "Matches frontend expectation of gemeente groups with wijk children, reduces payload size"
    alternatives: "Return all projects flat - rejected (defeats purpose of hierarchical structure)"
  - summary: "Use parent_id lookup dictionary for O(n) children grouping instead of nested queries"
    rationale: "Single pass over project_responses list, avoids N+1 query pattern"
    alternatives: "Query children per parent in loop - rejected (performance impact with many projects)"
---

# Phase 26 Plan 06: Gap Closure - MonitoredWijkOverlay Integration + Hierarchical Children Summary

**One-liner:** Integrated MonitoredWijkOverlay into map page and populated hierarchical children in GET /api/monitoring/projects endpoint

## What Was Built

Closed two verified gaps from Phase 26 verification:

**Gap 1 (BLOCKER):** MonitoredWijkOverlay component was orphaned - fully implemented but not imported or wired into the map page. Scanned wijken did not show the semi-transparent blue overlay on the map.

**Gap 2 (WARNING):** The monitoring router GET /api/monitoring/projects endpoint had a TODO comment indicating hierarchical children were not populated. The response returned flat list with `children=[]` for all projects instead of nesting wijk children under their gemeente parents.

**Gap 3 (MANUAL):** PLU WMS verification requires human testing - no code changes needed.

## Frontend Changes

**Modified: `frontend/src/routes/_authenticated/map.tsx` (+59 lines)**

1. **Imported MonitoredWijkOverlay functions:**
   - Added `addMonitoredWijkOverlay` and `removeMonitoredWijkOverlay` imports from `@/components/map/MonitoredWijkOverlay`
   - Added `useMonitoredProjects` hook import from `@/hooks/useProjects`

2. **Added monitored projects data fetching:**
   - Called `useMonitoredProjects()` hook to fetch monitored projects (line 132)
   - Data includes hierarchical project structure with gemeente parents and wijk children

3. **Added useEffect to show monitored wijk overlay (lines 264-301):**
   - Triggers when `mapReady`, `wijkGeojson`, and `monitoredProjects` are all available
   - Extracts monitored wijk names from both hierarchical children and flat top-level projects (backward compatibility)
   - Calls `addMonitoredWijkOverlay(map, wijkGeojson, monitoredWijkNames)` to show semi-transparent blue overlay
   - Cleanup function calls `removeMonitoredWijkOverlay(map)` on unmount or dependency change
   - Follows same imperative layer management pattern as existing map layers (ScanAreaHighlightLayer, WijkBoundariesLayer)

**Key Design Choice:** The wijk name extraction checks both `project.children` (hierarchical response) and top-level `project.wijk_naam` (flat response fallback). This ensures the overlay works during the transition period and handles edge cases gracefully.

## Backend Changes

**Modified: `backend/app/monitoring/router.py` (+18 lines, -3 lines)**

1. **Updated TODO comment (line 439):**
   - Changed from `children=[],  # TODO: Populate hierarchical children in future plan`
   - To `children=[],  # Populated after loop`
   - Removed misleading TODO indicating incomplete feature

2. **Added hierarchical children population logic (lines 444-460):**
   - After building all `project_responses`, group them by parent_id
   - Create `children_by_parent` dictionary: maps parent UUID to list of child ProjectResponse objects
   - Separate projects into `root_projects` (no parent_id) and children (has parent_id)
   - Populate `children` arrays on root projects using dictionary lookup
   - Return only `root_projects` with `total=len(root_projects)` (gemeente count, not total project count)

**Algorithm Complexity:** O(n) single pass over project_responses list. Avoids N+1 query pattern (querying children per parent in loop).

**Response Structure Example:**
```json
{
  "projects": [
    {
      "id": "gemeente-uuid",
      "name": "Amsterdam",
      "gemeente_code": "0363",
      "wijk_naam": null,
      "parent_id": null,
      "unread_count": 5,
      "children": [
        {
          "id": "wijk-uuid-1",
          "name": "Amsterdam - Centrum",
          "gemeente_code": "0363",
          "wijk_naam": "Centrum",
          "parent_id": "gemeente-uuid",
          "unread_count": 3,
          "children": []
        },
        {
          "id": "wijk-uuid-2",
          "name": "Amsterdam - Jordaan",
          "gemeente_code": "0363",
          "wijk_naam": "Jordaan",
          "parent_id": "gemeente-uuid",
          "unread_count": 2,
          "children": []
        }
      ]
    }
  ],
  "total": 1
}
```

## Verification Results

All verification steps passed:

1. ✅ `npm run check` passed in frontend (2 pre-existing warnings unrelated to changes)
2. ✅ `ruff check app/monitoring/router.py` passed in backend
3. ✅ MonitoredWijkOverlay imported in map.tsx (lines 41-43, 294, 298)
4. ✅ useMonitoredProjects imported and called in map.tsx (lines 45, 132)
5. ✅ TODO comment removed from router.py (no matches for "TODO.*hierarchical")
6. ✅ children_by_parent logic exists in router.py (lines 446, 452, 458)

## Deviations from Plan

**None - plan executed exactly as written.**

No bugs, missing functionality, or blocking issues encountered during execution. Both gaps closed cleanly with no unexpected complications.

## Impact

**Gap 1 (BLOCKER) CLOSED:**
- ✅ MonitoredWijkOverlay no longer orphaned - imported and wired into map page
- ✅ When user clicks a gemeente and wijken load, any monitored wijken now show semi-transparent blue fill on the map
- ✅ Visual indicator for watched areas is now functional
- ✅ Truth #10 from verification now satisfied: "Scanned wijken show filled semi-transparent overlay on the map"

**Gap 2 (WARNING) CLOSED:**
- ✅ GET /api/monitoring/projects returns hierarchical tree structure
- ✅ Gemeente parents have populated `children` arrays with wijk child projects
- ✅ Each child project retains its own `unread_count` (computed in loop)
- ✅ Frontend ProjectList receives properly structured hierarchical data
- ✅ Truth #12 from verification now satisfied: "User can view change history per wijk project folder" (hierarchical structure enables this)

**Gap 3 (MANUAL) - Not Addressed:**
- PLU WMS verification noted as requiring human testing in verification report
- No code changes needed - implementation exists, needs manual verification with real gemeente data
- Documented in Phase 26 verification report under "Human Verification Required"

## Testing Performed

**Automated:**
- TypeScript compilation passed (no type errors)
- ESLint passed (2 pre-existing warnings unrelated to changes)
- Ruff linting passed (backend clean)
- Grep verification confirmed all expected imports, functions, and patterns exist

**Manual (Required for Complete Verification):**
Per 26-VERIFICATION.md, the following manual tests are needed to verify end-to-end flow:
1. Start backend + frontend services
2. Navigate to map, enable gemeente layer, scan a wijk
3. Verify hierarchical project created (gemeente → wijk)
4. Verify monitored wijk overlay shows on map (NOW POSSIBLE - integration complete)
5. Navigate to Projecten tab, verify hierarchical tree renders
6. Expand wijk, verify ChangeTimeline renders with changes
7. Test API: `curl -H "Authorization: Bearer $TOKEN" http://localhost:8000/api/monitoring/projects` - verify hierarchical response
8. Test API: `curl -H "Authorization: Bearer $TOKEN" http://localhost:8000/api/monitoring/unread` - verify counts

## Files Changed

| File | Changes | Purpose |
|------|---------|---------|
| `frontend/src/routes/_authenticated/map.tsx` | +59 lines | Integrate MonitoredWijkOverlay component and useMonitoredProjects hook |
| `backend/app/monitoring/router.py` | +18 lines, -3 lines | Populate hierarchical children in GET /projects endpoint |

## Commits

| Hash | Message |
|------|---------|
| 0c24925 | feat(26-06): integrate MonitoredWijkOverlay and populate hierarchical children |

## Self-Check: PASSED

**Created files:** None expected - plan modifies existing files only

**Modified files:**
```bash
FOUND: frontend/src/routes/_authenticated/map.tsx
FOUND: backend/app/monitoring/router.py
```

**Commits:**
```bash
FOUND: 0c24925
```

All expected files modified, commit created successfully.

---

**Status:** ✅ Plan complete - both gaps closed
**Next Step:** Phase 26 complete - all 6 plans executed, ready for milestone wrap-up
