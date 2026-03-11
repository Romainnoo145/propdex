---
phase: 100-score-v3-0-engine
verified: 2026-03-11T08:30:00Z
status: passed
score: 6/6 must-haves verified
re_verification: false
---

# Phase 100: Score v3.0 Engine Verification Report

**Phase Goal:** Replace compute_opportunity_score() v2.1 with a dual-subscore model: Potentie (8 factoren, 80pt) + Risico (9 factoren, 67pt), each with template-based narratieven
**Verified:** 2026-03-11T08:30:00Z
**Status:** passed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | potentie_score (0-100) computed from 8 weighted factors with correct weights (12+12+12+13+10+8+8+5=80) | VERIFIED | `score_v3_factors.py` implements all 8 factors; runtime test confirms potentie weights sum=80; potentie_score=75.7 for realistic data |
| 2 | risico_score (0-100) computed from 9 weighted factors with correct weights (15+8+8+7+7+6+6+5+5=67) | VERIFIED | `score_v3_factors.py` implements all 9 factors; runtime test confirms risico weights sum=67; risico_score=21.2 for realistic data |
| 3 | overall score = potentie - risico (normalized, can be negative) | VERIFIED | `score_v3.py` line 133: `overall = round(potentie_score - risico_score, 1)`; runtime test shows overall=-47.0 for high-risk parcel |
| 4 | score_breakdown per factor includes all 8 required fields | VERIFIED | `FactorResult` dataclass has waarde, genormaliseerde_score, gewicht, bijdrage, categorie, toelichting_kort, toelichting_lang, data_bronnen; runtime assertion confirms all 17 factors have non-empty narratives and sources |
| 5 | Missing data: neutral default (0.5), critical risk penalty (+10%), weight redistribution >20% missing | VERIFIED | `_apply_missing_data_strategy()` in score_v3.py lines 155-198; runtime test with minimal data shows 11/17 missing factors handled; 59 tests pass including dedicated missing-data tests |
| 6 | Template-based narratieven (no AI calls) -- deterministic, instant text generation | VERIFIED | All 17 factor functions use Python f-strings with conditional branches; no imports of anthropic/AI libraries; grep for "TODO/FIXME/PLACEHOLDER" returns zero matches |

**Score:** 6/6 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/app/services/score_v3.py` | Score v3.0 engine with dataclasses + normalization | VERIFIED | 199 lines; exports `compute_score_v3`, `ScoreV3Result`, `FactorResult`; imports and calls all 17 factors |
| `backend/app/services/score_v3_factors.py` | 17 factor functions with normalization helpers | VERIFIED | 847 lines; 8 potentie + 9 risico factors; 3 normalization helpers (log, linear, binary); Dutch narrative templates per factor |
| `backend/tests/test_score_v3.py` | Comprehensive unit tests | VERIFIED | 722 lines; 59 tests all passing; covers individual factors, normalization, missing data, overall scores, narratives, edge cases |
| `backend/app/jobs/area_scan.py` | Pipeline integration with Phase 6 scoring | VERIFIED | Imports `compute_score_v3`; Phase 6 after all enrichment; writes scores/score_breakdown/score_model_version/category to flags; score column = overall clamped 0-100 |
| `backend/app/services/parcel_scoring.py` | v2.1 deprecated, insights functions retained | VERIFIED | Deprecation notice on `compute_opportunity_score()`; `derive_opportunity_insights` + `compute_vacancy_confidence` still used in pipeline; `compute_opportunity_score` no longer imported in area_scan.py |
| `frontend/src/lib/types/scan.ts` | ScoreFactorV3, ScoreBreakdownV3, ScoresV3 types + potentie_score/risico_score on ScanResultItem | VERIFIED | Lines 228-254: all 3 interfaces defined; lines 282-284: optional potentie_score/risico_score on ScanResultItem |
| `frontend/src/lib/score.ts` | Score utilities for v3.0 detection + extraction | VERIFIED | 106 lines; exports `isScoreV3`, `getScoresV3`, `getPotentieFactors`, `getRisicoFactors`, `extractScoreFactors` (dual-version), `extractScoreSubscores` (null for v3.0) |
| `frontend/src/components/map/panels/parcel/layers/PotentieLayer.tsx` | v3.0 factor display with v2.1 fallback | VERIFIED | 567 lines; imports `isScoreV3`, `getPotentieFactors`, `getRisicoFactors`; `deriveVerdict` uses dual-score logic; `extractFactorsV3` groups by potentie/risico; v3.0 factor breakdown rendered lines 513-563; v2.1 fallback preserved |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `area_scan.py` | `score_v3.py` | `from app.services.score_v3 import compute_score_v3` | WIRED | Line 45 import; line 938 call with parcel_data + nbhd_metrics |
| `area_scan.py` | `scan_results.flags` | flags assembly with v3.0 score data | WIRED | Lines 944-954: flags["scores"], flags["score_breakdown"], flags["score_model_version"] |
| `score_v3.py` | `score_v3_factors.py` | imports all 17 factor functions | WIRED | Lines 75-93: imports all 17 `score_*` functions |
| `score.ts` | `types/scan.ts` | reads ScoreFactorV3/ScoreBreakdownV3/ScoresV3 | WIRED | Line 1: `import type { ScoreFactorV3, ScoreBreakdownV3, ScoresV3 }` |
| `PotentieLayer.tsx` | `score.ts` | uses isScoreV3, getPotentieFactors, getRisicoFactors | WIRED | Line 5: imports; lines 322-323, 343, 350-354: active usage for rendering |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| SCORE-V3-01 | 100-01 | potentie_score from 8 weighted factors | SATISFIED | 8 factors implemented with correct weights totaling 80; runtime verified |
| SCORE-V3-02 | 100-01 | risico_score from 9 weighted factors | SATISFIED | 9 factors implemented with correct weights totaling 67; runtime verified |
| SCORE-V3-03 | 100-01, 100-02 | overall = potentie - risico, stored in scan_results.score clamped 0-100 | SATISFIED | `overall = potentie_score - risico_score`; area_scan.py clamps to 0-100 for tile proxy |
| SCORE-V3-04 | 100-02, 100-03 | score_breakdown includes all 8 fields per factor | SATISFIED | FactorResult dataclass has all fields; TypeScript ScoreFactorV3 mirrors them |
| SCORE-V3-05 | 100-01 | Missing data: neutral, penalty, redistribution | SATISFIED | `_apply_missing_data_strategy()` implements all 3 strategies; 59 tests pass including missing-data scenarios |
| SCORE-V3-06 | 100-03 | Template-based narratieven (no AI calls) | SATISFIED | f-string templates in all 17 functions; no AI imports; PotentieLayer renders toelichting_kort |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (none found) | - | - | - | - |

No TODO/FIXME/PLACEHOLDER markers found in score_v3.py or score_v3_factors.py. No empty implementations. No console.log-only handlers. Weight sums have minor floating-point rounding (80.0001 / 67.0002 after redistribution) -- this is expected from weight redistribution arithmetic and does not affect scoring accuracy.

### Human Verification Required

### 1. Visual Rendering of v3.0 Factor Breakdown

**Test:** Open a parcel detail panel for a parcel scanned after v3.0 deployment
**Expected:** POTENTIE section (green) shows 8 factors with toelichting_kort and bijdrage values; RISICO section (red) shows 9 factors; verdict uses dual-score logic
**Why human:** Requires running scan with v3.0 pipeline and viewing in browser; no v3.0 scan data exists yet in database

### 2. v2.1 Backward Compatibility

**Test:** Open a parcel detail panel for a parcel from an existing (pre-v3.0) scan
**Expected:** PotentieLayer renders with v2.1 factor badges (pts) and generateOneLiner -- no v3.0 factor breakdown section shown
**Why human:** Requires browser rendering with existing scan data

### 3. Tile Proxy Compatibility

**Test:** Load the map with score-colored tiles after a v3.0 scan completes
**Expected:** Tiles colored by score (amber-to-green gradient) same as before; `score` column contains 0-100 values; `category` field in flags reads correctly
**Why human:** Requires running a full scan and observing tile rendering

### Gaps Summary

No gaps found. All 6 success criteria verified through code inspection and runtime testing:

1. **Backend engine** (score_v3.py + score_v3_factors.py): 17-factor dual-subscore model with correct weights, normalization, missing data strategy, and template-based Dutch narratives. 59 tests pass.
2. **Pipeline integration** (area_scan.py): Score v3.0 runs as Phase 6 after all enrichment; flags contain scores, score_breakdown, score_model_version; scan_results.score = clamped overall for tile proxy.
3. **Frontend types** (scan.ts, score.ts, PotentieLayer.tsx): TypeScript interfaces match backend output; score utilities detect v3.0 vs v2.1; PotentieLayer renders grouped factor breakdown with v2.1 fallback. TypeScript compiles clean.

---

_Verified: 2026-03-11T08:30:00Z_
_Verifier: Claude (gsd-verifier)_
