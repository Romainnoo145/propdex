---
phase: 06-wijkpolicy-schema-woonvisie-scoring-upgrade
plan: 03
subsystem: scoring
tags: [woonvisie, wijkpolicy, score-v3, unicodedata, pydantic, factor-scoring]

# Dependency graph
requires:
  - phase: 06-wijkpolicy-schema-woonvisie-scoring-upgrade (Plan 02)
    provides: WijkPolicy Pydantic model + wijk_policies/algemeen_citaat fields on WoonvisiePayload
  - phase: 06-wijkpolicy-schema-woonvisie-scoring-upgrade (Plan 01)
    provides: 9 red unit tests (5 wijk-differentiation + 4 fallback)
provides:
  - Per-wijk differentiating score_woonvisie_match (Blerick scores > Venlo-Centrum for nieuwbouw_wonen)
  - _normalize_wijk helper for PDOK/BAG casing + Unicode hyphen normalisation
  - _PRIORITEIT_SCORE_DELTA constant (groei=+3.0, herstructurering=+1.5, neutraal=0.0, krimp=-2.5)
  - _PROJECTTYPE_SEGMENT_MAP promoted to module scope (reusable by future factors)
  - FactorResult.waarde dict contract for UI consumption (matched_wijk, matched_policy, prioritized_segment, algemeen_citaat)
affects: [phase-07-factor-pinning, phase-08-venlo-e2e-smoke, plan-06-04-integration]

# Tech tracking
tech-stack:
  added: [unicodedata (stdlib) — NFKD diacritic stripping + hyphen normalisation]
  patterns:
    - "Longest-normalised-name-wins substring match for deterministic ordering over LLM list-order"
    - "Bidirectional substring match (`pn in parcel_norm or parcel_norm in pn`) tolerates either side being shorter"
    - "Confidence-pull preserved across match + fallback branches: raw × conf + 5.0 × (1-conf)"
    - "Deprecated WoonvisiePayload fields retained for cache-roundtrip but read-path skips them entirely"

key-files:
  created: []
  modified:
    - backend/app/services/score_v3_factors.py (+119/-75)

key-decisions:
  - "WijkPolicy imported under TYPE_CHECKING only — `from __future__ import annotations` makes the runtime type annotation lazy, so the runtime import cost stays unchanged"
  - "Longest-normalised-name wins: Blerick-Noord beats Blerick even when Blerick appears first in Claude's output — deterministic regardless of LLM list ordering"
  - "Segment bonus/penalty is asymmetric: +2.0 on overlap, -1.0 penalty only when wijk has segmenten but no overlap; no penalty when gewenste_segmenten is empty"
  - "Fallback branch still emits matched_policy=None + missing=False — factor IS weighed, just at neutraal 5.0 pulled; only payload=None produces missing=True"
  - "No logging added — minimum-diff per CONTEXT §Claude's Discretion; defer to M050 if ops needs it"

patterns-established:
  - "Wijk-match normalisation: NFKD → strip combining marks → casefold → soft-hyphen strip → U+2010/U+2011 → ASCII hyphen (reusable for any PDOK/BAG vs woonvisie-PDF text comparison)"
  - "Module-level factor helpers: promote function-local constants to module scope when ≥2 functions or tests reference them; mypy + grep acceptance-criteria then stays stable"

requirements-completed: [SCORE-04]

# Metrics
duration: 5m
completed: 2026-04-24
---

# Phase 6 Plan 03: Per-Wijk Differentiating Woonvisie Scoring Summary

**Rewrite of `score_woonvisie_match` to consume WijkPolicy objects — Blerick (groei) now scores 0.92, Venlo-Centrum (neutraal) 0.27 for `nieuwbouw_wonen`; all 9 Plan 06-01 red tests flip green.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-04-24T21:46:57Z
- **Completed:** 2026-04-24T21:51:43Z
- **Tasks:** 1 (single-task plan — TDD GREEN)
- **Files modified:** 1

## Accomplishments
- 9/9 Phase-6 unit tests GREEN (5 wijk-differentiation + 4 fallback paths)
- `_normalize_wijk` helper handles NFKD + casefold + U+00AD/U+2010/U+2011 hyphen variants
- `_PRIORITEIT_SCORE_DELTA` module constant locks groei=+3.0, herstructurering=+1.5, neutraal=0.0, krimp=-2.5
- `_PROJECTTYPE_SEGMENT_MAP` promoted from function-local to module scope (values unchanged per CONTEXT §6)
- FactorResult.waarde migrated from legacy string (`payload.prioritized_segment`) to dict with `{matched_wijk, matched_policy, prioritized_segment, algemeen_citaat}`
- Score formula now 3-stage: prioriteit base (5.0 ± delta) → segment overlap (+2.0 / -1.0) → confidence-pull toward 5.0 → clamp → /10
- Caller at `score_v3.py:422` needs zero edits (signature preserved)
- Deprecated `WoonvisiePayload` fields (growth_wijken, shrink_wijken, herstructureringswijken, excluded_project_types) no longer read — retained on model only for cache-roundtrip back-compat

## Task Commits

1. **Task 1: Rewrite score_woonvisie_match + _normalize_wijk + _PRIORITEIT_SCORE_DELTA** — `f61d8492` (feat)

_Single-task plan; no TDD split because Plan 06-01 already produced the RED tests. This plan is the GREEN phase._

## Files Created/Modified
- `backend/app/services/score_v3_factors.py` — +119/-75: added `import unicodedata`, added `WijkPolicy` to TYPE_CHECKING import, added module-level `_normalize_wijk` + `_PRIORITEIT_SCORE_DELTA` + `_PROJECTTYPE_SEGMENT_MAP` (promoted), rewrote `score_woonvisie_match` body (80 lines → ~120 lines with clearer branches)

## Decisions Made
- **TYPE_CHECKING import for WijkPolicy** — `from __future__ import annotations` makes `matched: WijkPolicy | None = None` lazy; no runtime import cost. Satisfies acceptance-criteria grep.
- **Longest-name wins** — deterministic over LLM list-order. Alternative (first-match wins) would let Claude's output ordering silently alter Blerick-Noord vs Blerick scoring.
- **Asymmetric segment scoring** — no penalty when wijk's `gewenste_segmenten=[]` (genuinely unknown). Penalty only when wijk expresses a preference that our projecttype contradicts.
- **Neutraal fallback keeps `missing=False`** — factor is scored (at 0.5 pulled) when payload exists but no wijk-match; `missing=True` reserved for `payload=None` (pre-existing semantic, preserved).
- **Caller unchanged** — verified: `score_woonvisie_match(` in `score_v3.py` keeps the same signature `(payload, wijk_naam=..., project_type=...)` per CONTEXT §Integration Points.

## Deviations from Plan

None — plan executed exactly as written. All action steps (1-5) performed; all 14 acceptance-criteria grep assertions pass; all 9 tests go from RED → GREEN; ruff + mypy unchanged vs baseline (see Deferred Issues).

## Issues Encountered
None — the rewrite matched Plan 06-03's reference implementation byte-for-byte.

## Deferred Issues

See [`deferred-items.md`](./deferred-items.md):
1. **23 pre-existing mypy `[type-arg]` errors** on bare `dict` annotations in 19 factor functions — verified pre-existent on `git stash` baseline. Out of Phase 6 scope.
2. **9 pre-existing unit test failures** in `test_agent_service.py`, `test_agent_tools.py`, `test_claude_client.py`, `test_post_migration_model_contracts.py` — verified pre-existent on `git stash` baseline. None touch scoring or woonvisie.

## Verification

```bash
cd backend && pytest tests/unit/test_score_woonvisie_match_wijk_differentiation.py tests/unit/test_score_woonvisie_match_fallback.py -v
# 9 passed in 0.05s

cd backend && ruff check app/services/
# All checks passed!

cd backend && mypy app/services/score_v3_factors.py
# 23 errors (all pre-existing, verified via `git stash && mypy`)
```

## Next Phase Readiness

**Plan 06-04 unblocked:** integration test `test_woonvisie_match.py` (the 6 tests reserved for Plan 06-04) now has a correct scorer + schema to point at. Full-chain cascade enrichment → extraction → scoring → FactorResult shape → UI contract is ready for end-to-end verification.

**Plan 06-05 (if any) / Phase 7 unblocked:** `WoonvisiePopup` in Phase 3 can consume `FactorResult.waarde["matched_policy"]["citaat"]` + `matched_policy["pagina"]` directly — no additional backend shape-conversion needed.

## Self-Check: PASSED

- File `backend/app/services/score_v3_factors.py` exists: FOUND
- Commit `f61d8492` exists: FOUND (`git log --oneline | grep f61d8492`)
- 9/9 Phase-6 unit tests pass: VERIFIED
- 14 acceptance-criteria greps: ALL PASS
- Caller unchanged: VERIFIED (`score_v3.py:422`)

---
*Phase: 06-wijkpolicy-schema-woonvisie-scoring-upgrade*
*Completed: 2026-04-24*
