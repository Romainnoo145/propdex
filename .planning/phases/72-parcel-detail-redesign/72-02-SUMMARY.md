---
phase: 72-parcel-detail-redesign
plan: 02
subsystem: ui
tags: [react, typescript, parcel-detail, score-pillars, vacancy, transformatie]

# Dependency graph
requires:
  - phase: 72-parcel-detail-redesign
    provides: Phase 72 plan 01 research context — Optie C decision, three pillar design
provides:
  - ParcelDetailModal with three real data bars (Vrije ruimte, Beschikbaarheid, Transformatiepotentie)
  - deriveTransformatiePotentie() function (40/40/20 bouwjaar/bestemming/area weighted formula)
  - Cleaned InspectorPanel without Bouwruimte Delta section
  - Cleaned ParcelCard without buildability subscore display
affects: [73-parcel-detail-redesign, frontend-score-display]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pillar bars read real data fields (pand_oppervlakte_m2, vacancy_confidence) instead of FAR/TAR-derived abstractions"
    - "HARD:/PROXY: prefix stripping with regex replace before showing vacancy reasons in UI"
    - "deriveTransformatiePotentie: 40pt bouwjaar + 40pt bestemming + 20pt area = 100pt max weighted score"

key-files:
  created: []
  modified:
    - frontend/src/components/results/ParcelDetailModal.tsx
    - frontend/src/components/layout/InspectorPanel.tsx
    - frontend/src/components/results/ParcelCard.tsx

key-decisions:
  - "Vrije ruimte shows 'Footprint onbekend' when has_pand=true but pand_oppervlakte_m2=null (pre-Phase-72 scans), 'Geen pand' when has_pand=false"
  - "Beschikbaarheid uses vacancy_confidence directly (not the deriveVacancyScore fallback chain) — the bar percentage is vacancy_confidence * 100"
  - "deriveVacancyScore kept but no longer drives pillar bar in ParcelDetailModal (only used internally for possible future use)"
  - "Transformatiepotentie score range is 20-100 (never null) because formula always produces a result with fallback defaults"

patterns-established:
  - "Pillar context string: topVacancyReason strips /^(HARD|PROXY):\\s*/i prefix before display"
  - "pandOppervlaktM2 accessed via building_metrics cast to {pand_oppervlakte_m2?: number | null} (same optional-chain pattern as other metrics)"

requirements-completed: [UX-01]

# Metrics
duration: 3min
completed: 2026-03-03
---

# Phase 72 Plan 02: Parcel Detail Redesign — Frontend Pillar Rewrite Summary

**Three real data pillar bars (Vrije ruimte, Beschikbaarheid, Transformatiepotentie) replace abstract FAR/TAR pillars; all dead buildability code removed from ParcelDetailModal, InspectorPanel, and ParcelCard**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-03T06:16:46Z
- **Completed:** 2026-03-03T06:20:06Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Replaced "Bebouwbaarheid" / "Leegstandsrisico" / "Transformatiekans" abstract pillars with "Vrije ruimte" / "Beschikbaarheid" / "Transformatiepotentie" real-data bars in ParcelDetailModal
- Added `deriveTransformatiePotentie()` function using 40/40/20 weighted formula (bouwjaar + bestemming + perceelgrootte), with Dutch context label
- Deleted `formatPlanruimteLabel()`, `deriveBuildabilityScore()`, `deriveTransformationScore()`, the entire Planruimte (FAR/TAR) JSX section, and the `extractScoreSubscores` import from ParcelDetailModal
- Deleted `toMetricNumber()`, `deriveBuildabilityForInspector()`, buildability variable, and Bouwruimte Delta JSX block from InspectorPanel
- Removed `extractScoreSubscores` import, `subscores` variable, and buildability subscore display from ParcelCard
- ScoreDonut preserved unchanged per user decision

## Task Commits

Each task was committed atomically:

1. **Task 1: Rewrite ParcelDetailModal pillar bars with real data** - `3cc1e9c` (feat)
2. **Task 2: Clean up InspectorPanel and ParcelCard dead FAR/TAR code** - `96b194d` (feat)

**Plan metadata:** (to be added after state update commit)

## Files Created/Modified
- `frontend/src/components/results/ParcelDetailModal.tsx` - Three new data-driven pillar bars; FAR/TAR section removed; ScoreDonut kept; 71 insertions, 168 deletions
- `frontend/src/components/layout/InspectorPanel.tsx` - toMetricNumber + deriveBuildabilityForInspector functions removed; Bouwruimte Delta JSX section removed; 124 deletions
- `frontend/src/components/results/ParcelCard.tsx` - extractScoreSubscores import, subscores variable, buildability subscore display removed

## Decisions Made
- "Vrije ruimte" bar value is `null` (shows `--`) for pre-Phase-72 scans where `pand_oppervlakte_m2` is not in `building_metrics`; context text shows "Footprint onbekend" when `has_pand=true`
- "Beschikbaarheid" shows `vacancy_confidence * 100` directly, not the `deriveVacancyScore` fallback chain (which used vacancy_signal as proxy when confidence was null)
- `deriveVacancyScore` kept in file for potential future use, but result is voided via `void vacancyPillar`
- Transformatiepotentie score is always a number (20-100 range), never null, because formula has defaults for all null inputs

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. TypeScript compiled cleanly on first attempt after both tasks.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- ParcelDetailModal now shows real data in all three pillar bars
- Users will see "Footprint onbekend" / null scores for old scan data until parcels are rescanned with Phase 72 backend (which adds pand_oppervlakte_m2)
- Phase 73 or backend work may want to ensure pand_oppervlakte_m2 is populated in building_metrics for existing scan results

---
*Phase: 72-parcel-detail-redesign*
*Completed: 2026-03-03*
