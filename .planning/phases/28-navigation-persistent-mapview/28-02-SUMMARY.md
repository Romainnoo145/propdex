---
phase: 28-navigation-persistent-mapview
plan: 02
subsystem: ui
tags: [react, tanstack-router, lucide-react, maplibre-gl, slide-over, navigation]

# Dependency graph
requires:
  - phase: 28-navigation-persistent-mapview
    plan: 01
    provides: MapContext with mapRef/mapReady for parcel click handler
provides:
  - SideRailNav with three-view navigation (Kaart, Resultaten, Projecten) using lucide-react
  - InspectorPanel right-edge slide-over for parcel details without blocking map
  - panel search param on /map route enabling Resultaten nav link to auto-open results
affects:
  - SideRailNav rendering (all authenticated pages with nav)
  - map.tsx (inspector parcel click handler + panel search param)
  - All routes where SideRailNav appears (Dashboard replaced with Kaart/Resultaten/Projecten)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - lucide-react icons replacing custom SVG icon functions
    - Right-edge slide-over without backdrop (map stays interactive)
    - CSS translate-x for slide-in/out animation (translate-x-0 / translate-x-full)
    - MapLibre click handler on 'parcel-score-fill' layer (registered once on mapReady)
    - TanStack Router Link with optional search prop for panel=results param
    - panel search param in validateSearch enables nav → auto-open side effects

key-files:
  created:
    - frontend/src/components/layout/InspectorPanel.tsx
  modified:
    - frontend/src/components/layout/SideRailNav.tsx
    - frontend/src/routes/_authenticated/map.tsx

key-decisions:
  - "Removed Dashboard nav item — replaced with Kaart+Resultaten+Projecten as plan specifies"
  - "Custom SVG icon functions (7 functions) replaced with lucide-react imports"
  - "InspectorPanel registered MapLibre click handler once on mapReady (not per activeScanId) — MapLibre silently ignores clicks on non-existent layers"
  - "ScanResultItem fields adapted: use score (0-100) not opportunity_score, score_category not qualification, bouwjaar/pand_status not recent_permits"
  - "panel search param cleared after opening results to prevent re-trigger on reload"

patterns-established:
  - "Right-edge slide-over without backdrop: absolute right-0 top-0 h-full + translate-x animation"
  - "MapLibre layer click handler registered once on mapReady — layer existence not required at registration time"

# Metrics
duration: 4min
completed: 2026-02-17
---

# Phase 28 Plan 02: SideRailNav Update + InspectorPanel Summary

**Three-view navigation (Kaart/Resultaten/Projecten) with lucide-react icons in SideRailNav, plus InspectorPanel right-edge slide-over that shows parcel details from clicked map features without blocking map interaction**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-02-17T20:45:23Z
- **Completed:** 2026-02-17T20:49:33Z
- **Tasks:** 2
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments

- SideRailNav updated: Dashboard removed, three primary nav items (Kaart, Resultaten, Projecten) added using lucide-react icons (Map, ListOrdered, FolderOpen)
- All 7 custom SVG icon functions replaced with lucide-react (Bell, FileText, Settings, LogOut + primary nav icons)
- Resultaten link navigates to `/map?panel=results` — TanStack Router Link with search prop
- `panel` search param added to map.tsx validateSearch and MapSearchParams interface
- useEffect in map.tsx auto-opens results panel when `panel === 'results'` and activeScanId is set
- InspectorPanel created: right-edge slide-over, no backdrop, map stays interactive underneath
- CSS translate-x animation (translate-x-0 / translate-x-full), 320px width, max-w-[90vw]
- Escape key closes inspector via useEscapeKey hook
- MapLibre click handler registered on `parcel-score-fill` layer once mapReady
- InspectorPanel shows: parcel ID, kadaster code, address, area, bebouwing, bouwjaar, pandstatus, score bar, score_category badge

## Task Commits

Each task was committed atomically:

1. **Task 1: Update SideRailNav with three-view navigation and lucide-react icons** - `efa2701` (feat)
2. **Task 2: Create InspectorPanel and wire parcel click handler** - `9dd0d8b` (feat)

## Files Created/Modified

- `frontend/src/components/layout/InspectorPanel.tsx` — Right-edge slide-over parcel details panel with Escape/X close, design tokens
- `frontend/src/components/layout/SideRailNav.tsx` — Three-view nav with lucide-react icons, custom SVG functions removed
- `frontend/src/routes/_authenticated/map.tsx` — panel search param, auto-open results effect, InspectorPanel state + click handler + JSX

## Decisions Made

- Dashboard removed from navigation (requirements specify Kaart, Resultaten, Projecten only)
- Custom SVG icons replaced with lucide-react (Map, ListOrdered, FolderOpen, Bell, FileText, Settings, LogOut)
- InspectorPanel click handler registered once on mapReady rather than per activeScanId — MapLibre silently ignores clicks on non-existent layers, avoiding re-registration complexity
- ScanResultItem fields in InspectorPanel adapted to actual type: `score` (0-100 int), `score_category` (string), `bouwjaar`, `pand_status` — plan referenced non-existent fields

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] ScanResultItem field mismatch — plan referenced non-existent fields**
- **Found during:** Task 2 (Create InspectorPanel)
- **Issue:** Plan's InspectorPanel code used `opportunity_score`, `qualification`, `bestemming`, `recent_permits` — none of these exist on `ScanResultItem` in `frontend/src/lib/types/scan.ts`
- **Fix:** Checked actual type definition; used real fields: `score` (0-100), `score_category`, `bouwjaar`, `pand_status`, `parcel_code`. Score bar uses `Math.round(parcel.score)` directly (already 0-100 range)
- **Files modified:** `frontend/src/components/layout/InspectorPanel.tsx`
- **Impact:** Correct data displayed, no TypeScript errors

**2. [Rule 1 - Bug] ParcelScoreLayer uses 'parcel-score-fill' not 'parcel-scores-fill'**
- **Found during:** Task 2 (wire parcel click handler)
- **Issue:** Plan specified layer ID `'parcel-scores-fill'` but `ParcelScoreLayer.tsx` defines `FILL_LAYER_ID = 'parcel-score-fill'` (no trailing 's')
- **Fix:** Used correct layer ID `'parcel-score-fill'` in map.tsx click handler
- **Files modified:** `frontend/src/routes/_authenticated/map.tsx`
- **Impact:** Click handler correctly targets the actual layer

**3. [Rule 2 - Enhancement] InspectorPanel click handler registered once on mapReady (not per activeScanId)**
- **Found during:** Task 2 (implementation review)
- **Issue:** Plan specified `[mapReady, mapRef, activeScanId]` as dependencies, but since MapLibre silently ignores clicks on non-existent layers, re-registering per activeScanId adds unnecessary complexity and would cause handler to be deregistered/re-registered on every scan start
- **Fix:** Used `[mapReady]` dependency only — handler registered once when map is ready, works correctly for all future layer additions
- **Files modified:** `frontend/src/routes/_authenticated/map.tsx`
- **Impact:** Cleaner implementation, handler persists across scan lifecycle

---

**Total deviations:** 3 auto-fixed (2 bugs, 1 enhancement)
**Impact on plan:** All fixes required for correctness. No scope creep.

## Issues Encountered

None beyond the three auto-fixed issues above.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Three-view navigation is operational (Kaart/Resultaten/Projecten in sidebar)
- InspectorPanel ready for enhancement (e.g., add action buttons, enrichment data in Phase 30+)
- panel search param pattern established for future deep-link use
- Phase 28 plan 03 can proceed

---

## Self-Check: PASSED

All created/modified files exist:
- FOUND: `frontend/src/components/layout/InspectorPanel.tsx`
- FOUND: `frontend/src/components/layout/SideRailNav.tsx`
- FOUND: `frontend/src/routes/_authenticated/map.tsx`

All commits exist:
- FOUND: `efa2701` feat(28-02): update SideRailNav to three-view nav with lucide-react icons
- FOUND: `9dd0d8b` feat(28-02): create InspectorPanel slide-over and wire parcel click handler

TypeScript: PASSED (0 errors)
ESLint: PASSED (0 errors, 68 warnings — 2 new pre-existing style warnings)

---
*Phase: 28-navigation-persistent-mapview*
*Completed: 2026-02-17*
