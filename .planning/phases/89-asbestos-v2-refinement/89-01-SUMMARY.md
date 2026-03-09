---
phase: 89-asbestos-v2-refinement
plan: 01
subsystem: api
tags: [asbest, nen-2991, gebruiksdoel, risk-assessment, bag]

requires:
  - phase: 67-risk-intelligence
    provides: "Original bouwjaar-based asbest_indicator.py and AsbestIndicator schema"
provides:
  - "Gebruiksdoel-aware assess_asbest_risk() with additive-only uplift"
  - "AsbestIndicator.gebruiksdoel_factor field (backend + frontend)"
  - "18 unit tests covering all uplift scenarios"
affects: [fysiek-risico-profiel, property-aggregator]

tech-stack:
  added: []
  patterns: ["additive-only risk uplift with severity ordering dict"]

key-files:
  created: []
  modified:
    - backend/app/services/asbest_indicator.py
    - backend/app/schemas/property.py
    - backend/tests/unit/test_asbest_indicator.py
    - frontend/src/lib/types/property.ts

key-decisions:
  - "Gebruiksdoel uplift is additive only -- never reduces below bouwjaar baseline"
  - "onbekend baseline is never uplifted (no false precision)"
  - "Case-insensitive matching for BAG gebruiksdoel values"

patterns-established:
  - "Risk severity ordering: _RISK_SEVERITY dict for comparing risk levels"
  - "Additive-only uplift pattern: max(baseline, uplift_target) using severity dict"

requirements-completed: [ASBT-01, ASBT-02]

duration: 2min
completed: 2026-03-10
---

# Phase 89 Plan 01: Asbestos V2 Refinement Summary

**BAG gebruiksdoel-aware asbestos risk with additive-only uplift for industrial/educational buildings**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-09T17:47:02Z
- **Completed:** 2026-03-09T17:49:15Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- assess_asbest_risk() now considers BAG gebruiksdoel alongside bouwjaar
- Industrial (industriefunctie) and educational (onderwijsfunctie) buildings get risk uplift to at least middel
- Risk NEVER drops below bouwjaar baseline (ASBT-02 guaranteed)
- 18 unit tests pass (8 existing + 10 new) covering all uplift scenarios

## Task Commits

Each task was committed atomically:

1. **Task 1: Add gebruiksdoel_factor to schema and uplift logic** - `b948348` (feat)
2. **Task 2: Add comprehensive tests for gebruiksdoel uplift** - `d3fd70d` (test)

## Files Created/Modified
- `backend/app/services/asbest_indicator.py` - Refactored with _ELEVATED_GEBRUIKSDOEL set, _RISK_SEVERITY dict, additive uplift logic
- `backend/app/schemas/property.py` - Added gebruiksdoel_factor field to AsbestIndicator
- `backend/tests/unit/test_asbest_indicator.py` - 10 new tests for gebruiksdoel uplift scenarios
- `frontend/src/lib/types/property.ts` - Added gebruiksdoel_factor to AsbestIndicator interface

## Decisions Made
- Gebruiksdoel uplift is additive only -- baseline risk from bouwjaar is the floor
- onbekend baseline is never uplifted to avoid false precision
- Case-insensitive matching since BAG returns mixed-case gebruiksdoel values
- Uplift target is "middel" (not "hoog") -- gebruiksdoel alone doesn't warrant hoog

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Gebruiksdoel-aware asbestos risk ready for use in fysiek_risico_profiel aggregation
- No further phases planned for v14.0 (phase 89 is final)

---
*Phase: 89-asbestos-v2-refinement*
*Completed: 2026-03-10*
