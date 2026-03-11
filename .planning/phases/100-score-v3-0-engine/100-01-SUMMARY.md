---
phase: 100-score-v3-0-engine
plan: 01
subsystem: scoring
tags: [scoring, dual-subscore, potentie, risico, normalization, narratives]

# Dependency graph
requires:
  - phase: 99-scan-pipeline-enrichment
    provides: Pre-cached enrichment data in scan_results.flags (bodem, funderingsrisico, energielabel, etc.)
provides:
  - compute_score_v3() pure function with 17-factor dual-subscore model
  - ScoreV3Result and FactorResult dataclasses
  - Template-based Dutch narratives per factor (toelichting_kort + toelichting_lang)
  - Missing data strategy (neutral, critical penalty, weight redistribution)
affects: [100-02 pipeline-integration, 100-03 frontend-types, 93.1 potentie-dashboard]

# Tech tracking
tech-stack:
  added: []
  patterns: [dual-subscore-model, factor-result-pattern, missing-data-strategy, template-narratives]

key-files:
  created:
    - backend/app/services/score_v3.py
    - backend/app/services/score_v3_factors.py
    - backend/tests/test_score_v3.py
  modified: []

key-decisions:
  - "Split into score_v3.py (engine + dataclasses) and score_v3_factors.py (17 factor functions) to stay within line limits"
  - "Factors file is 847 lines due to 17 functions with Dutch narrative templates each — further splitting would fragment without benefit"
  - "Asbest industrial detection checks raw bestemming types directly (not via _best_bestemming_type helper) to catch bedrijventerrein"

patterns-established:
  - "FactorResult pattern: each factor returns waarde, genormaliseerde_score, gewicht, bijdrage, categorie, toelichting_kort/lang, data_bronnen, missing"
  - "Missing data: non-critical gets 0.5 neutral, critical risk gets 0.6 (+10% penalty), >20% missing triggers weight redistribution"
  - "Normalization trio: normalize_log (continuous), normalize_linear (ranges), normalize_binary (yes/no)"

requirements-completed: [SCORE-V3-01, SCORE-V3-02, SCORE-V3-03, SCORE-V3-05]

# Metrics
duration: 7min
completed: 2026-03-11
---

# Phase 100 Plan 01: Score v3.0 Engine Summary

**17-factor dual-subscore scoring engine (Potentie 8 + Risico 9) with normalized 0-100 scores, missing data strategy, and template-based Dutch narratives per factor**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-11T07:02:26Z
- **Completed:** 2026-03-11T07:09:41Z
- **Tasks:** 2
- **Files created:** 3

## Accomplishments
- Complete Score v3.0 engine: `compute_score_v3()` pure function accepting parcel_data dict + neighborhood_metrics dict
- 8 potentie factors (vrije_grond, optoppotentie, bestemming, leegstand, funda_frictie, perceelgrootte, demografie, vergunning_succeskans) with weights totaling 80
- 9 risico factors (funderingsrisico, asbest, bodemverontreiniging, monument, bestemmingswijziging, constructieve_staat, juridisch_klimaat, criminaliteit, max_hoogte_bereikt) with weights totaling 67
- Missing data strategy: neutral default (0.5), critical risk penalty (+10%), and weight redistribution when >20% factors missing per category
- Template-based Dutch narratives per factor (toelichting_kort, toelichting_lang, data_bronnen)
- 59 passing unit tests covering all factors, normalization, missing data, overall scores, narratives, and edge cases

## Task Commits

Each task was committed atomically:

1. **Task 1: Score v3.0 data model + 17 factor scoring functions + normalization** - `495dbfb` (feat)
2. **Task 2: Comprehensive unit tests for Score v3.0** - `20097b7` (test)

## Files Created/Modified
- `backend/app/services/score_v3.py` - Main engine: FactorResult + ScoreV3Result dataclasses, compute_score_v3(), missing data strategy (198 lines)
- `backend/app/services/score_v3_factors.py` - 17 factor scoring functions with normalization helpers and Dutch narrative templates (847 lines)
- `backend/tests/test_score_v3.py` - 59 unit tests covering all factors, normalization, missing data, overall scores, narratives (447 lines)

## Decisions Made
- Split factor functions into separate `score_v3_factors.py` module to keep main engine file under 300 lines
- Asbest industrial detection checks raw bestemming type strings directly rather than using `_best_bestemming_type` helper, because that helper only knows residential priority types
- Juridisch klimaat factors score neutral when data unavailable (268/286 rulings still unanalyzed)
- Optoppotentie and max_hoogte_bereikt handle PLU WMS 0% bouwlagen coverage gracefully via missing flag

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Asbest industrial detection missed "bedrijventerrein"**
- **Found during:** Task 2 (test_asbest_pre1994_industrial)
- **Issue:** `_best_bestemming_type()` returns "onbekend" for non-residential types, so `score_asbest` couldn't detect industrial buildings
- **Fix:** Changed asbest to iterate raw bestemming types directly, checking for "bedrijf", "bedrijven", "industri"
- **Files modified:** backend/app/services/score_v3_factors.py
- **Verification:** test_asbest_pre1994_industrial passes
- **Committed in:** 20097b7 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Minor fix necessary for correct industrial building detection. No scope creep.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Score v3.0 engine ready for pipeline integration (Plan 100-02)
- `compute_score_v3()` accepts dict inputs matching scan_results.flags shape
- `neighborhood_metrics` parameter accepts CBS wijk data from area_scans
- v2.1 `parcel_scoring.py` untouched for backward compatibility

---
*Phase: 100-score-v3-0-engine*
*Completed: 2026-03-11*
