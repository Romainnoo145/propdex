---
phase: 75-cbs-wijkstatistieken
plan: 01
subsystem: ui
tags: [cbs, react, typescript, pydantic, wijkstatistieken]

requires:
  - phase: 74-3dbag
    provides: ScanListItem pattern and neighborhood_metrics JSONB already on AreaScan model

provides:
  - CbsNeighborhoodCard component displaying WOZ, stedelijkheid badge, inwoners, koop/huur ratio
  - CbsNeighborhoodMetrics and CbsStedelijkheid TypeScript interfaces
  - neighborhood_metrics field wired through ScanListItem schema and projects router
  - ResultsTable updated to use new typed CbsNeighborhoodMetrics structure

affects:
  - 75-02 (CBS client fix — data will populate these display fields after re-scan)
  - ResultsTable neighborhood_metrics header display

tech-stack:
  added: []
  patterns:
    - "CbsNeighborhoodCard returns null when all key metrics are null — no broken empty card"
    - "Typed CbsNeighborhoodMetrics interface replaces Record<string,any> for neighborhood_metrics"
    - "ScanSummarySection extracts latestScan branch to fragment to append CBS card after section"

key-files:
  created:
    - frontend/src/components/projects/CbsNeighborhoodCard.tsx
  modified:
    - frontend/src/lib/types/scan.ts
    - frontend/src/components/projects/WijkDetailView.tsx
    - backend/app/scans/schemas.py
    - backend/app/projects/router.py
    - frontend/src/components/results/ResultsTable.tsx

key-decisions:
  - "CbsNeighborhoodMetrics uses nested data structure (data.gemiddelde_woz_waarde) matching CBS v4 client output — not flat v3 shape"
  - "Card returns null when ALL key metrics (WOZ, klasse, inwoners) are null — handles existing scans with null neighborhood_metrics gracefully"
  - "WijkDetailView ScanSummarySection refactored: latestScan branch extracted to early-return fragment so CBS card appends after scan section"

patterns-established:
  - "CBS metric formatting: WOZ stored in thousands, display as Math.round(value * 1000).toLocaleString('nl-NL')"
  - "Stedelijkheid klasse 1-2 = amber badge variants, klasse 3-5 = grey variants"

requirements-completed:
  - CBS-01

duration: 5min
completed: 2026-03-06
---

# Phase 75 Plan 01: CBS Wijkstatistieken Display Summary

**CbsNeighborhoodCard component with WOZ, stedelijkheid badge, and demographics wired from ScanListItem backend through to WijkDetailView**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-06T16:22:23Z
- **Completed:** 2026-03-06T16:27:20Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- Created `CbsNeighborhoodCard.tsx` with WOZ display, color-coded stedelijkheid badge (klasse 1-5), inwoners count, koop/huur ratio bar, and adressendichtheid
- Added `CbsNeighborhoodMetrics` and `CbsStedelijkheid` TypeScript interfaces; narrowed `ScanResultsResponse.neighborhood_metrics` from `Record<string,any>`
- Wired `neighborhood_metrics` through `ScanListItem` Pydantic schema and `list_project_scans` router endpoint so CBS data flows to the frontend
- Card renders null when no data, handles partial nulls gracefully — no broken empty state

## Task Commits

Each task was committed atomically:

1. **Task 1: Add neighborhood_metrics to ScanListItem schema + router + TypeScript interface** - `c0d1205` (feat)
2. **Task 2: Create CbsNeighborhoodCard and mount in WijkDetailView** - `f187a47` (feat)

## Files Created/Modified

- `frontend/src/components/projects/CbsNeighborhoodCard.tsx` — CBS metrics card component (new)
- `frontend/src/lib/types/scan.ts` — Added CbsStedelijkheid, CbsNeighborhoodMetrics interfaces; updated ScanResultsResponse and ScanListItem
- `frontend/src/components/projects/WijkDetailView.tsx` — Mounted CbsNeighborhoodCard in ScanSummarySection latestScan branch
- `backend/app/scans/schemas.py` — Added neighborhood_metrics field to ScanListItem Pydantic schema
- `backend/app/projects/router.py` — Wired neighborhood_metrics=scan.neighborhood_metrics in scan list serialization
- `frontend/src/components/results/ResultsTable.tsx` — Updated to use new nested CbsNeighborhoodMetrics structure

## Decisions Made

- Used nested `data.gemiddelde_woz_waarde` structure matching the CBS v4 client output (Plan 75-02), not the flat v3 shape
- Card returns null when all three key metrics are null (WOZ + klasse + inwoners), ensuring no broken empty card when CBS fetch failed
- Refactored ScanSummarySection to extract latestScan path as early-return fragment — cleanest mounting pattern

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] ResultsTable.tsx used stale flat CBS v3 property names**
- **Found during:** Task 2 (npm run check)
- **Issue:** ResultsTable accessed `neighborhood_metrics.gemiddelde_woz`, `neighborhood_metrics.meest_voorkomende_bouwperiode`, and `neighborhood_metrics.stedelijkheid` (top-level) — all invalid against the new typed interface
- **Fix:** Updated both mobile and desktop branches to use `neighborhood_metrics.data.gemiddelde_woz_waarde` and `neighborhood_metrics.data.stedelijkheid.omschrijving`
- **Files modified:** `frontend/src/components/results/ResultsTable.tsx`
- **Committed in:** f187a47 (Task 2 commit)

**2. [Rule 1 - Bug] useJurisprudence.ts had wrong import path for useAuth**
- **Found during:** Task 2 (npm run check)
- **Issue:** `import { useAuth } from '@/hooks/useAuth'` — file doesn't exist at that path
- **Fix:** Changed to `import { useAuth } from '@/lib/auth/useAuth'`
- **Files modified:** `frontend/src/hooks/useJurisprudence.ts`
- **Committed in:** f187a47 (Task 2 commit)

**3. [Rule 1 - Bug] Unused XIcon functions and unused wijkNaam param causing lint errors**
- **Found during:** Task 2 (npm run check)
- **Issue:** ProjectCreateModal/ProjectEditModal had dead `XIcon` functions; JurisprudenceSection had unused `wijkNaam` param
- **Fix:** Removed XIcon functions; prefixed wijkNaam with `_wijkNaam`
- **Files modified:** `ProjectCreateModal.tsx`, `ProjectEditModal.tsx`, `JurisprudenceSection.tsx`
- **Committed in:** f187a47 (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (3x Rule 1 - Bug)
**Impact on plan:** All auto-fixes were pre-existing issues unmasked by the new typed interface. No scope creep. `npm run check` now passes with 0 errors.

## Issues Encountered

None — plan executed cleanly. Existing scans will show null neighborhood_metrics (CBS v3 client broken); the card renders null in that case. Data will populate after Plan 75-02 fixes the CBS client and re-scans run.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- CBS display layer complete — WijkDetailView will show CBS data as soon as neighborhood_metrics is non-null
- Plan 75-02 (CBS client fix to v4 OData API) will make data available for new scans
- ResultsTable header badges also use the new typed structure and will display correctly

---
*Phase: 75-cbs-wijkstatistieken*
*Completed: 2026-03-06*
