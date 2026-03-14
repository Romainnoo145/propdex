---
phase: 108-score-customization
plan: 01
subsystem: api
tags: [scoring, score-v3, environmental, natura2000, flooding, noise, air-quality, custom-weights]

# Dependency graph
requires:
  - phase: 99-scan-pipeline-enrichment
    provides: natura2000, overstromingsrisico, geluid, luchtkwaliteit cached in scan_results.flags
  - phase: 100-score-v3-0-engine
    provides: score_v3.py engine + score_v3_factors.py with FactorResult pattern

provides:
  - 4 new environmental risk factors (R10-R13) in score_v3_factors.py
  - Discount formula: overall = potentie × (1 - risico_discount), always 0-100
  - custom_weights param for per-org weight overrides in compute_score_v3
  - DEFAULT_WEIGHTS dict exported as single source of truth
  - _RISICO_MAX = 87 (was 67)

affects:
  - 108-02 (re-score job needs new formula and DEFAULT_WEIGHTS)
  - 108-03 (weight presets API needs DEFAULT_WEIGHTS export)
  - 108-04 (frontend score slider uses DEFAULT_WEIGHTS structure)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Discount model replaces subtraction: potentie × (1 - discount) keeps scores in 0-100 range
    - potentie_risico_balance param (default 0.7) controls how much risico discounts potentie
    - Environmental factor missing defaults to 0.3 (not 0.5) because NL baseline is low-risk

key-files:
  created: []
  modified:
    - backend/app/services/score_v3_factors.py
    - backend/app/services/score_v3.py

key-decisions:
  - "Discount model (potentie × (1 - risico_discount)) replaces potentie - risico subtraction to keep scores 0-100"
  - "balance=0.7 means risico can discount potentie by at most 30% × 50% cap = 15% at max risico"
  - "Environmental missing defaults to 0.3 (not 0.5) — NL baseline is quiet/clean for most parcels"
  - "DEFAULT_WEIGHTS exported from score_v3.py as module-level dict — single source of truth"
  - "_apply_custom_weights mutates gewicht + bijdrage but never genormaliseerde_score"
  - "Category thresholds updated: >60=Hoog, >30=Gemiddeld, else=Laag (was >40 / >10 for old subtraction formula)"

patterns-established:
  - "Environmental risk factors use 0.3 neutral missing (not 0.5) — most NL locations are low-risk"
  - "score_natura2000 / score_overstromingsrisico: binary 1.0/0.0 score on boolean flag"
  - "score_geluid: classification enum → score_map (acceptabel=0.0, verhoogd=0.4, hoog=0.7, zeer_hoog=1.0)"
  - "score_luchtkwaliteit: normalize_linear on NO2 (20=clean/0.0, 50=EU limit/1.0)"

requirements-completed: [SC-01, SC-02, SC-03, SC-07]

# Metrics
duration: 3min
completed: 2026-03-14
---

# Phase 108 Plan 01: Score v3.0 Engine Extension Summary

**Score v3.0 extended from 17 to 21 factors with 4 environmental risks (natura2000, flooding, noise, air quality) plus discount formula (potentie x (1-discount), 0-100) and custom_weights support**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-14T05:04:14Z
- **Completed:** 2026-03-14T05:07:19Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Added 4 environmental risk factor functions (R10-R13) to score_v3_factors.py, each reading Phase 99 cached flags
- Replaced subtraction formula with discount model: overall = potentie × (1 - risico_discount), never negative
- Added custom_weights param and _apply_custom_weights helper to compute_score_v3 for per-org overrides
- Exported DEFAULT_WEIGHTS as single source of truth for all 21 factor weights and balance param
- Updated _RISICO_MAX from 67 to 87 and category thresholds for the new 0-100 range

## Task Commits

Each task was committed atomically:

1. **Task 1: Add 4 environmental risk factor functions** - `c3b883e` (feat)
2. **Task 2: Update score_v3.py — formula, constants, custom weights** - `a58a15f` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `backend/app/services/score_v3_factors.py` - Added score_natura2000, score_overstromingsrisico, score_geluid, score_luchtkwaliteit (197 lines added)
- `backend/app/services/score_v3.py` - Updated _RISICO_MAX, formula, imports, DEFAULT_WEIGHTS, _apply_custom_weights (82 lines added, 11 modified)

## Decisions Made
- Discount model chosen over subtraction: keeps overall always 0-100, intuitively interpretable
- balance=0.7 default: at max risico (100), discount = 0.7% × (1-0.7) × 100 = 30% max discount, capped at 50%
- Environmental missing defaults to 0.3 not 0.5 — NL is mostly clean/quiet, 0.5 would penalize unknown parcels unfairly
- Category thresholds raised from (>40/10) to (>60/30) because discount formula produces higher baseline scores

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Pre-existing ruff lint errors in score_v3_factors.py (unused variable `kort_labels`, f-string escape, import sort) — these are out of scope per deviation rules and pre-date this plan.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Score engine ready for Phase 108-02: re-score job to recompute scores for all existing scan_results using new formula
- DEFAULT_WEIGHTS available for Phase 108-03: weight presets API endpoint
- custom_weights param ready for Phase 108-04: frontend weight slider integration

---
*Phase: 108-score-customization*
*Completed: 2026-03-14*
