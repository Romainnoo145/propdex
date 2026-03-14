---
phase: 108-score-customization
plan: 02
subsystem: api
tags: [scoring, score-v3, custom-weights, arq, background-job, organization, api]

# Dependency graph
requires:
  - phase: 108-01
    provides: score_v3.py with DEFAULT_WEIGHTS, discount formula, custom_weights param

provides:
  - score_weights JSONB column on Organization model
  - Alembic migration a1b2c3d4e5f6 (ADD COLUMN score_weights JSONB to organizations)
  - ScoreWeightsConfig, SaveScoreWeightsRequest, ScoreWeightsResponse, RescoreJobStatus schemas
  - GET /api/users/org/score-weights endpoint
  - PUT /api/users/org/score-weights endpoint (validates min 3 active per category)
  - GET /api/users/org/score-weights/job/{job_id} endpoint
  - rescore_weights_job ARQ function (batch processing, weights-only re-application)

affects:
  - 108-03 (weight presets API can call same GET/PUT endpoints)
  - 108-04 (frontend weight slider POSTs to PUT /api/users/org/score-weights)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Weights-only re-score: reads genormaliseerde_score from stored breakdown, never calls compute_score_v3()"
    - "Batch processing: 500-row offset pagination prevents loading all 137k scan_results at once"
    - "Dynamic max weight normalization: uses sum of active weights (not fixed _POTENTIE_MAX/_RISICO_MAX)"
    - "ARQ job status via arq.jobs.Job(job_id, pool).status() + result(timeout=0)"

key-files:
  created:
    - backend/app/schemas/score_weights.py
    - backend/app/jobs/rescore_weights.py
    - backend/alembic/versions/a1b2c3d4e5f6_add_score_weights_to_organizations.py
  modified:
    - backend/app/models/organization.py
    - backend/app/users/router.py
    - backend/app/jobs/worker.py

key-decisions:
  - "Dynamic max weight denominator: rescore uses sum of active custom weights (not fixed _POTENTIE_MAX=80/_RISICO_MAX=87) so percentages are always meaningful under custom configs"
  - "Separate _update_breakdown_in_flags helper avoids code duplication between score computation and flags update"
  - "PUT endpoint validates min 3 active factors per category before DB write (cross-field validation at router level)"
  - "Job result polling uses arq.jobs.Job.result(timeout=0) for non-blocking immediate check"

requirements-completed: [SC-04, SC-05, SC-06]

# Metrics
duration: 3min
completed: 2026-03-14
---

# Phase 108 Plan 02: Score Weight Storage, API, and Re-Score Job Summary

**Org-level score weight JSONB storage with GET/PUT API endpoints and background ARQ re-score job that re-applies weights to 137k stored scan_results without re-running factor computations**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-14T05:10:26Z
- **Completed:** 2026-03-14T05:13:52Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Added `score_weights JSONB` column to Organization model with Alembic migration `a1b2c3d4e5f6`
- Created complete Pydantic schema set: ScoreWeightsConfig, SaveScoreWeightsRequest, ScoreWeightsResponse, RescoreJobStatus
- Added 3 new endpoints to `/api/users/` router:
  - GET `/org/score-weights` — returns custom weights or DEFAULT_WEIGHTS with is_custom flag
  - PUT `/org/score-weights` — validates min 3 active factors per category, saves, enqueues rescore job
  - GET `/org/score-weights/job/{job_id}` — polls ARQ job status and returns impact summary
- Created `rescore_weights_job` ARQ function that streams scan_results in 500-row batches, re-applies custom weights to stored genormaliseerde_score without calling compute_score_v3()
- Registered rescore_weights_job in WorkerSettings.functions

## Task Commits

Each task was committed atomically:

1. **Task 1: Organization model, migration, schemas, and API endpoints** - `932cb93` (feat)
2. **Task 2: Background re-score job (weights-only re-application)** - `f38c463` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `backend/app/models/organization.py` — Added score_weights JSONB column
- `backend/alembic/versions/a1b2c3d4e5f6_add_score_weights_to_organizations.py` — Migration (ADD COLUMN)
- `backend/app/schemas/score_weights.py` — 4 Pydantic models for weight API
- `backend/app/users/router.py` — 3 new endpoints + imports
- `backend/app/jobs/rescore_weights.py` — rescore_weights_job + _rescore_from_breakdown helper
- `backend/app/jobs/worker.py` — Registered rescore_weights_job in WorkerSettings

## Decisions Made

- Dynamic max weight denominator: rescore uses sum of active custom weights (not fixed _POTENTIE_MAX=80) so percentage is always meaningful when factors are disabled
- Minimum 3 active factors per category enforced at PUT endpoint level (cross-field check impossible in field_validator)
- Job result polling uses `job.result(timeout=0)` for non-blocking check (same pattern as ARQ docs)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] B904 raise-without-from in exception handler**
- **Found during:** Task 1 ruff check
- **Issue:** `raise HTTPException` inside `except Exception:` block without `from e` (ruff B904)
- **Fix:** Added `from e` to the re-raise in `get_rescore_job_status`
- **Files modified:** `backend/app/users/router.py`
- **Commit:** Included in `932cb93`

## Issues Encountered

None beyond the B904 lint fix above.

## User Setup Required

Run Alembic migration to add score_weights column:
```bash
cd backend && alembic upgrade head
```

## Next Phase Readiness

- Endpoints ready for Phase 108-03: weight presets API (GET presets list, POST apply preset)
- rescore_weights_job ready: will be triggered by preset application too
- DEFAULT_WEIGHTS structure already used as fallback — presets just write different values to score_weights JSONB

## Self-Check: PASSED

All created files confirmed on disk. Both task commits verified in git history.

---
*Phase: 108-score-customization*
*Completed: 2026-03-14*
