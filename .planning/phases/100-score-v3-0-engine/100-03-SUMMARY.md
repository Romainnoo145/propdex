---
phase: 100-score-v3-0-engine
plan: 03
subsystem: frontend
tags: [scoring, typescript, types, score-v3, dual-subscore, potentie-layer]

# Dependency graph
requires:
  - phase: 100-score-v3-0-engine (plan 02)
    provides: v3.0 score_breakdown in scan_results.flags with categorie, toelichting, data_bronnen per factor
provides:
  - TypeScript interfaces (ScoreFactorV3, ScoreBreakdownV3, ScoresV3) matching backend v3.0 output
  - Score utilities detecting and extracting v3.0 vs v2.1 data (isScoreV3, getScoresV3, getPotentieFactors, getRisicoFactors)
  - PotentieLayer rendering v3.0 factor breakdowns grouped by potentie/risico with toelichting_kort
affects: [93.1-potentie-dashboard, parcel-detail-panel]

# Tech tracking
tech-stack:
  added: []
  patterns: [dual-version-score-rendering, v3-factor-grouping]

key-files:
  created: []
  modified:
    - frontend/src/lib/types/scan.ts
    - frontend/src/lib/score.ts
    - frontend/src/components/map/panels/parcel/layers/PotentieLayer.tsx

key-decisions:
  - "extractScoreSubscores returns null for v3.0 scans (no vacancy/buildability concept in v3.0)"
  - "One-liner picks highest-bijdrage factor toelichting_kort for v3.0, falls back to generateOneLiner for v2.1"
  - "v3.0 factor breakdown displayed as POTENTIE/RISICO grouped sections with bijdrage values"
  - "extractFactors returns null for v3.0 (v2.1 pts badges not applicable), extractFactorsV3 used instead"

patterns-established:
  - "Dual-version rendering: isScoreV3() check gates v3.0 display paths, all v2.1 code preserved as fallback"
  - "Factor grouping: getPotentieFactors/getRisicoFactors filter by categorie field"

requirements-completed: [SCORE-V3-04, SCORE-V3-06]

# Metrics
duration: 3min
completed: 2026-03-11
---

# Phase 100 Plan 03: Frontend Types Summary

**TypeScript types and score utilities for v3.0 dual-subscore model with full v2.1 backward compatibility in PotentieLayer**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-11T07:18:48Z
- **Completed:** 2026-03-11T07:21:25Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Added ScoreFactorV3, ScoreBreakdownV3, ScoresV3 TypeScript interfaces matching backend v3.0 output shape
- Added potentie_score + risico_score optional fields to ScanResultItem for dual-subscore display
- Score utilities (isScoreV3, getScoresV3, getPotentieFactors, getRisicoFactors) detect and extract v3.0 data
- PotentieLayer renders v3.0 factor breakdowns grouped by POTENTIE/RISICO with toelichting_kort and bijdrage values
- deriveVerdict uses dual-score logic (potentie > 60 AND risico < 30 = ZEER KANSRIJK) when v3.0 data available

## Task Commits

Each task was committed atomically:

1. **Task 1: Update ScanResultItem types + score.ts utilities for v3.0** - `8183571` (feat)
2. **Task 2: Update PotentieLayer to read v3.0 factor structure with v2.1 fallback** - `d82127b` (feat)

## Files Created/Modified
- `frontend/src/lib/types/scan.ts` - Added ScoreFactorV3, ScoreBreakdownV3, ScoresV3 interfaces; potentie_score/risico_score fields on ScanResultItem
- `frontend/src/lib/score.ts` - Added isScoreV3, getScoresV3, getPotentieFactors, getRisicoFactors utilities; updated extractScoreFactors for v3.0 bijdrage extraction
- `frontend/src/components/map/panels/parcel/layers/PotentieLayer.tsx` - v3.0 dual-score verdict logic, factor grouping display, toelichting_kort one-liner

## Decisions Made
- extractScoreSubscores returns null for v3.0 scans since vacancy/buildability are not separate concepts in the 17-factor model
- extractFactors returns null for v3.0 scans (v2.1 pts badges not applicable); extractFactorsV3 provides grouped factor data instead
- One-liner uses highest-bijdrage factor's toelichting_kort for v3.0 (backend-generated narrative), falls back to generateOneLiner for v2.1
- v3.0 factor breakdown rendered as color-coded POTENTIE (green) / RISICO (red) grouped sections

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 3 plans of Phase 100 (Score v3.0 Engine) complete
- Frontend types match backend v3.0 output shape
- PotentieLayer handles both v2.1 and v3.0 scans gracefully
- Ready for Phase 93.1 Potentie Dashboard to leverage v3.0 factor display

---
*Phase: 100-score-v3-0-engine*
*Completed: 2026-03-11*
