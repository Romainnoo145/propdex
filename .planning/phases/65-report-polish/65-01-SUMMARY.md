---
phase: 65-report-polish
plan: 01
subsystem: ui
tags: [react, typescript, reports, maps, esri]

# Dependency graph
requires:
  - phase: 64-map-visualization
    provides: map_data.center_wgs84 coordinates on PropertyReportResponse
provides:
  - ReportHeader component with satellite thumbnail, kadaster perceel ID, 6-card metric grid
  - SatelliteThumbnail component with buildStaticMapUrl ESRI helper
  - Report sections ordered by developer relevance (Bestemmingsplan first)
  - Consistent empty states (non-italic "Geen [X] beschikbaar")
affects: [65-02, 65-03]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "ESRI World Imagery static export URL: ArcGIS REST MapServer/export endpoint, no API key required"
    - "Satellite thumbnail: center_wgs84 [lng, lat] -> latDelta/lngDelta bbox -> png32"
    - "Header extraction: ReportHeader receives full data prop and derives all display values internally"

key-files:
  created:
    - frontend/src/components/reports/ReportHeader.tsx
    - frontend/src/components/reports/SatelliteThumbnail.tsx
  modified:
    - frontend/src/components/reports/ReportDetailPage.tsx

key-decisions:
  - "Section order locked: Bestemmingsplan, Kadaster, BRK, Gebouw, WOZ, Energielabel, Buildability, Wkb, Permits, Market, AI"
  - "SignalBanner and monument alert commented out (not removed) with note: replaced by ActieVereistSection Plan 65-03"
  - "ReportHeader takes full data prop rather than individual field props — reduces coupling, easier to extend"
  - "Satellite thumbnail uses ESRI World Imagery (free, no API key) at deltaKm=0.3 for ~300m coverage at NL latitudes"
  - "6-card metric grid with sm:grid-cols-3 lg:grid-cols-6 responsive breakpoints, adds Bestemming + WOZ-waarde"

patterns-established:
  - "buildStaticMapUrl(center, deltaKm): pure function, returns null on invalid input, easy to test"
  - "Icon components duplicated across ReportHeader/ReportDetailPage by design — avoids cross-file icon coupling"

requirements-completed: [RPT-01]

# Metrics
duration: 6min
completed: 2026-03-02
---

# Phase 65 Plan 01: Report Layout Polish Summary

**Report sections reordered by developer relevance, header extracted with satellite thumbnail (ESRI) + kadaster perceel ID + 6-card metric grid including Bestemming and WOZ-waarde**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-03-02T03:11:06Z
- **Completed:** 2026-03-02T03:16:56Z
- **Tasks:** 2
- **Files modified:** 3 (modified) + 2 (created)

## Accomplishments

- Sections reordered: Bestemmingsplan first, then Kadaster, BRK, Gebouw, WOZ, Energielabel, Buildability, Wkb, Permits, Market, AI
- All empty state text standardized — removed `italic` class from all `text-sm italic text-grey-600` instances
- New `SatelliteThumbnail.tsx`: `buildStaticMapUrl` helper builds ESRI World Imagery bbox URL from `center_wgs84`
- New `ReportHeader.tsx`: address + kadaster perceel ID + status badges + satellite thumbnail + 6 metric cards + completeness bar
- Inline header block (~120 lines) replaced in ReportDetailPage with `<ReportHeader>` import

## Task Commits

Each task was committed atomically:

1. **Task 1: Reorder sections + standardize empty states** - `51637be` (feat)
2. **Task 2: Extract ReportHeader + SatelliteThumbnail components** - `784d20f` (feat)

## Files Created/Modified

- `frontend/src/components/reports/SatelliteThumbnail.tsx` - ESRI static map helper + component (~55 lines)
- `frontend/src/components/reports/ReportHeader.tsx` - Extracted report header with all display elements (~290 lines)
- `frontend/src/components/reports/ReportDetailPage.tsx` - Uses ReportHeader, reordered sections, cleaned up extracted code

## Decisions Made

- Kept `STATUS_EXPLANATIONS`, `getStatusInfo`, `formatArea`, `formatCurrency`, `dateFmtFull` in `ReportDetailPage.tsx` as shared utilities for Plan 65-03 (ActieVereistSection)
- SignalBanner and monument alert commented out (not deleted) per plan spec — will be replaced by ActieVereistSection in Plan 65-03
- ESRI World Imagery chosen: free, no API key, sufficient resolution for demo context (~300m bbox)
- Added `eslint-disable-next-line` on SignalBanner definition since it is intentionally kept for Plan 65-03

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- ESLint `no-unused-vars` flagged: `monuments` destructuring (now unused after comment-out), `SignalBanner` function (intentionally kept for Plan 65-03). Fixed by removing `monuments` from destructuring and adding eslint-disable comment on SignalBanner.

## User Setup Required

None - no external service configuration required. ESRI World Imagery is a public endpoint.

## Next Phase Readiness

- Plan 65-02 (PDF export) ready: ReportHeader is a clean extraction point for print CSS
- Plan 65-03 (ActieVereistSection) ready: `STATUS_EXPLANATIONS` and `getStatusInfo` remain in ReportDetailPage, `SignalBanner` commented with note, monument alert commented with note
- Satellite thumbnail renders if `data.map_data.center_wgs84` is populated (all Venlo parcels have this from Phase 64)

## Self-Check: PASSED

- SatelliteThumbnail.tsx: FOUND
- ReportHeader.tsx: FOUND
- ReportDetailPage.tsx: FOUND
- Commit 51637be: FOUND
- Commit 784d20f: FOUND

---
*Phase: 65-report-polish*
*Completed: 2026-03-02*
