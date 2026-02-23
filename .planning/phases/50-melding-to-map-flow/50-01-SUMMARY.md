---
phase: 50-melding-to-map-flow
plan: 01
subsystem: ui
tags: [react, typescript, tanstack-router, meldingen, notifications, parcel, map]

# Dependency graph
requires:
  - phase: 48-parcel-matching
    provides: matched_parcel_id field on ChangeRecord backend response (geocode + ST_Contains verified)
  - phase: 49-read-tracking
    provides: meldingen.tsx and ChangeTimeline.tsx updated with server-backed read state
provides:
  - ChangeRecord TypeScript type with matched_parcel_id field
  - meldingen.tsx parcel-ID-based Bekijk op kaart and Genereer rapport buttons
  - ChangeTimeline.tsx consistent parcel-ID-based navigation in wijk/gemeente detail view
affects: [map-flow, report-generation, melding-navigation]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "matched_parcel_id preference: check matched_parcel_id first, fall back to matched_parcels[] list or address-based navigation"
    - "Parcel-ID map navigation: ?parcel_id= URL param triggers amber marker flyTo in map.tsx"

key-files:
  created: []
  modified:
    - frontend/src/lib/types/monitoring.ts
    - frontend/src/routes/_authenticated/meldingen.tsx
    - frontend/src/components/notifications/ChangeTimeline.tsx

key-decisions:
  - "matched_parcel_id preferred over matched_parcels[] for Genereer rapport — single verified parcel, not ambiguous list"
  - "matched_parcel_id preferred over address-based navigation — parcel_id param triggers amber flyTo marker; address-based does not"
  - "Graceful fallback preserved — null matched_parcel_id degrades to address-based/matched_parcels behavior"

patterns-established:
  - "matched_parcel_id gating pattern: {change.matched_parcel_id ? (primary path) : (fallback path) : null}"

# Metrics
duration: 2min
completed: 2026-02-23
---

# Phase 50 Plan 01: Melding-to-Map Flow Summary

**matched_parcel_id wired through frontend: one click from melding flies to geometrically verified parcel on map with amber popup, single Genereer rapport button uses Phase 48 ST_Contains match**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-23T04:13:46Z
- **Completed:** 2026-02-23T04:16:00Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments
- `ChangeRecord` TypeScript type now includes `matched_parcel_id?: string | null` matching backend `ChangeRecordResponse` field order
- `meldingen.tsx` "Bekijk op kaart" now navigates via `?parcel_id=` when `matched_parcel_id` available (triggers amber marker + flyTo in map.tsx), falls back to address-based
- `meldingen.tsx` "Genereer rapport" now uses single verified parcel ID instead of iterating `matched_parcels[]` list
- `ChangeTimeline.tsx` receives identical updates for consistent behaviour in wijk/gemeente detail view timeline

## Task Commits

Each task was committed atomically:

1. **Task 1: Add matched_parcel_id to ChangeRecord type** - `b7e5868` (feat)
2. **Task 2: Update meldingen.tsx for parcel-ID navigation and report generation** - `270ecfa` (feat)
3. **Task 3: Update ChangeTimeline.tsx for consistent parcel-ID navigation** - `5b36fac` (feat)

## Files Created/Modified
- `frontend/src/lib/types/monitoring.ts` — Added `matched_parcel_id?: string | null` to `ChangeRecord` interface after `postcode`
- `frontend/src/routes/_authenticated/meldingen.tsx` — "Bekijk op kaart" and "Genereer rapport" prefer `matched_parcel_id` over fallbacks
- `frontend/src/components/notifications/ChangeTimeline.tsx` — Same navigation upgrades adapted to local `canNav`/`handleGenerateReport` variable names

## Decisions Made
- `matched_parcel_id` preferred over `matched_parcels[]` for "Genereer rapport" — the Phase 48 geocode+ST_Contains match is the geometrically verified single parcel; showing a list when a verified ID exists would be confusing
- `matched_parcel_id` preferred for "Bekijk op kaart" because `?parcel_id=` URL param triggers the amber marker flyTo flow in map.tsx, while address-based navigation only pans to the area without an amber popup
- Graceful fallback preserved in both components — `null` matched_parcel_id degrades to existing address/matched_parcels behaviour (no regressions for older records)

## Deviations from Plan

None — plan executed exactly as written. Variable names (`canNav`, `hasParcels`, `handleGenerateReport`) confirmed by reading files before editing, as instructed.

## Issues Encountered

None. `npm run check` passed with 0 errors after each task (143 pre-existing warnings unchanged throughout).

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Full three-click intelligence workflow complete: melding list → amber map marker → report generation using verified parcel
- Phase 50 Plan 02 (if any) can build on this foundation
- Backend centroid endpoint, from-parcel report generation, and map.tsx amber marker flow were already complete before Phase 50

## Self-Check: PASSED

- FOUND: frontend/src/lib/types/monitoring.ts
- FOUND: frontend/src/routes/_authenticated/meldingen.tsx
- FOUND: frontend/src/components/notifications/ChangeTimeline.tsx
- FOUND: .planning/phases/50-melding-to-map-flow/50-01-SUMMARY.md
- FOUND commit b7e5868 (Task 1)
- FOUND commit 270ecfa (Task 2)
- FOUND commit 5b36fac (Task 3)

---
*Phase: 50-melding-to-map-flow*
*Completed: 2026-02-23*
