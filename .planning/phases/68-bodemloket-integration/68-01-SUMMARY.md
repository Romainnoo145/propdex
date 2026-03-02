---
phase: 68-bodemloket-integration
plan: "01"
subsystem: api
tags: [arcgis-rest, bodemloket, wbb, spatial-query, epsg-28992, spike]

requires:
  - phase: 67-wkb-classification-engine
    provides: v9.0 backend pattern context (WkbClassificatieSection 3-state, classify_wkb TDD)

provides:
  - SPIKE.md with confirmed BUFFER_M=10 decision and rationale
  - Live ArcGIS REST response example with all field names and values confirmed
  - Confirmed BASE_URL for Bodemloket WBB_locaties layer 0
  - Buffer comparison data (±10m vs ±25m) against real WBB polygon geometry

affects:
  - 68-02 (bodemloket client code — uses BUFFER_M=10 and confirmed field names)
  - 68-03 (frontend BodemSection — uses DISCLAIMER text from SPIKE.md)

tech-stack:
  added: []
  patterns:
    - "Spike-before-implement: run live query with real DB coords, retrieve geometry to find exact centroid, test buffer sizes empirically"
    - "Buffer comparison: use WHERE clause to get WBB polygon geometry in EPSG:28992, compute centroid, test both buffers"

key-files:
  created:
    - .planning/phases/68-bodemloket-integration/SPIKE.md
  modified: []

key-decisions:
  - "BUFFER_M=10 (not 25): ±10m hits the directly-intersecting WBB polygon only; ±25m picks up adjacent contaminated polygon ~25m away — false-positive risk for parcel-level queries"
  - "Spike coordinates changed: RESEARCH.md used approx x=118150,y=583400 for Schiermonnikoog; actual WBB polygon centroid is x=206259,y=610965 — same area, just more precise"
  - "f=geojson returns WGS84 geometry; f=json with outSR=28992 returns correct EPSG:28992 rings — client code must use outFields-only queries or explicitly set outSR"

patterns-established:
  - "Bodemloket spike pattern: national bbox query to find live features -> WHERE query to retrieve geometry -> compute centroid -> test buffer sizes"

requirements-completed: [BODEM-01]

duration: 3min
completed: 2026-03-02
---

# Phase 68 Plan 01: Bodemloket Spike Summary

**Live ArcGIS REST spike against Venlo DB parcel and confirmed WBB polygon — BUFFER_M=10 decided with ±10m returning 1 direct hit vs ±25m returning 2 (includes adjacent parcel)**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-03-02T08:20:27Z
- **Completed:** 2026-03-02T08:23:00Z
- **Tasks:** 1 completed
- **Files created:** 1 (SPIKE.md)

## Accomplishments

- Queried propdex parcel_cache for real Venlo address (Genooyerweg 94, x=208888, y=378594) — confirmed 0 features (clean parcel, normal)
- Found live WBB features via national Netherlands bounding box query — 5 features returned, all from Schiermonnikoog
- Retrieved exact RD geometry of WBB polygon OID 17892511 via outSR=28992 — centroid at x=206259, y=610965
- Ran buffer comparison: ±10m = 1 feature (direct hit), ±25m = 2 features (adjacent parcel included) — **decision: BUFFER_M=10**
- Confirmed all RESEARCH.md field names correct from live response: WBB_DOSSIER_DBK, SIKB_ID, TYPE_CD, VERVOLG_WBB, STATUSVER, STATUS_OORD, ADMINISTRATOR_NM, LOCATIECODE_BEVOEGD_GEZAG, BIS_LOCCODE

## Task Commits

Each task was committed atomically:

1. **Task 1: Run live Bodemloket ArcGIS REST spike** - `1514c44` (feat)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified

- `.planning/phases/68-bodemloket-integration/SPIKE.md` - Live API probe results, buffer decision, confirmed field names, Plan 68-02 constants

## Decisions Made

- **BUFFER_M=10 not 25:** The ±25m buffer from RESEARCH.md was a safe starting recommendation. Live testing showed ±25m returns an adjacent polygon ~25m away, while ±10m returns only the directly-intersecting WBB polygon. For parcel-level lookup in urban environments, ±10m is more precise and avoids false-positive contamination flags from neighboring parcels.
- **Spike coordinates refined:** RESEARCH.md used approximate Schiermonnikoog area coordinates (118150, 583400). The actual WBB polygon centroid (retrieved via WHERE query and outSR=28992) is at (206259, 610965). Same area, more precise.

## Deviations from Plan

None — plan executed exactly as written. Buffer decision followed the plan's decision rule: "If ±25m catches features that ±10m misses → use ±25m" applies in reverse — ±25m catches *extra* features that ±10m correctly excludes.

## Issues Encountered

- RESEARCH.md Schiermonnikoog coordinates (118150, 583400) did not find features at ±2000m, suggesting the coordinates were imprecise. Resolved by running a national bounding box query to find actual feature locations, then retrieving exact polygon centroid via geometry query.
- f=geojson returns WGS84 coordinates even when inSR=28992. Used f=json with outSR=28992 to get actual EPSG:28992 ring coordinates for centroid calculation.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- SPIKE.md complete: Plan 68-02 can implement `bodemloket_arcgis.py` with BUFFER_M=10 and all confirmed field names
- No further live API calls needed for implementation (field names and response format fully confirmed)
- DISCLAIMER text confirmed: "Bodemloket bevat niet alle locaties in Nederland. Afwezigheid van een dossier is geen bodemkwaliteitsverklaring."

---
*Phase: 68-bodemloket-integration*
*Completed: 2026-03-02*
