---
phase: 85-explorer-ui
plan: 01
subsystem: api
tags: [sqlalchemy, jsonb, gin-index, faceted-search, alembic, arq]

# Dependency graph
requires:
  - phase: 84-ai-analysis-doorlooptijd
    provides: "Per-ruling AI analysis (ai_analysis, vergunningstype, doorlooptijd_dagen on RulingCache)"
provides:
  - "rechtsgronden JSONB column with GIN index on ruling_cache"
  - "GET /api/jurisprudence/explorer with cross-faceted counts and pagination"
  - "Extended AI prompt with 5 rechtsgronden taxonomy"
  - "rechtsgrond_backfill_job for existing analyzed rulings"
affects: [85-02-explorer-frontend, 86-trend-statistics]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Cross-faceted counts via exclude_dimension pattern"
    - "JSONB array containment operator @> for rechtsgrond filtering"
    - "jsonb_array_elements_text for unnesting JSONB arrays in GROUP BY"
    - "Lightweight backfill job with separate prompt (avoids full re-analysis)"

key-files:
  created:
    - "backend/alembic/versions/c7e2f1a3b9d5_add_rechtsgronden_to_ruling_cache.py"
  modified:
    - "backend/app/models/ruling_cache.py"
    - "backend/app/ai/prompts.py"
    - "backend/app/ai/schemas.py"
    - "backend/app/jobs/jurisprudence_analysis.py"
    - "backend/app/jobs/worker.py"
    - "backend/app/api/endpoints/jurisprudence.py"

key-decisions:
  - "Cross-faceted counts via build_where_clauses(exclude_dimension) helper -- each facet dimension excludes its own filter"
  - "Lightweight rechtsgrond-only backfill prompt instead of full re-analysis for existing rulings"
  - "JSONB @> containment for rechtsgrond filtering, jsonb_array_elements_text for facet grouping"
  - "Rechtbank niveau derived via CASE/ILIKE from instantie column (no new column)"

patterns-established:
  - "Cross-faceted search: _build_explorer_filters with exclude_dimension param"
  - "Backfill job pattern: lightweight prompt targeting specific field without full re-analysis"

requirements-completed: [EXPL-02, EXPL-03, EXPL-04]

# Metrics
duration: 4min
completed: 2026-03-09
---

# Phase 85 Plan 01: Explorer Backend Summary

**Rechtsgronden JSONB classification + faceted explorer endpoint with cross-filter counts and offset pagination**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-09T02:37:01Z
- **Completed:** 2026-03-09T02:41:26Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Added rechtsgronden JSONB column with GIN index to ruling_cache, extending AI prompt with 5 juridische gronden taxonomy
- Built GET /api/jurisprudence/explorer with cross-faceted counts for 5 filter dimensions (gemeente, vergunningstype, uitkomst, rechtsgrond, rechtbank_niveau)
- Created rechtsgrond_backfill_job for classifying existing analyzed rulings without full re-analysis

## Task Commits

Each task was committed atomically:

1. **Task 1: Rechtsgronden migration + AI classifier extension** - `e7b37c8` (feat)
2. **Task 2: Explorer endpoint with faceted counts and pagination** - `2dcae76` (feat)

## Files Created/Modified
- `backend/app/models/ruling_cache.py` - Added rechtsgronden JSONB column
- `backend/alembic/versions/c7e2f1a3b9d5_add_rechtsgronden_to_ruling_cache.py` - Migration with GIN index
- `backend/app/ai/prompts.py` - Extended V2 prompt + added RECHTSGROND_CLASSIFICATIE_PROMPT
- `backend/app/ai/schemas.py` - Added rechtsgronden field to RulingAnalysis
- `backend/app/jobs/jurisprudence_analysis.py` - Store rechtsgronden in analysis job + backfill job
- `backend/app/jobs/worker.py` - Registered rechtsgrond_backfill_job
- `backend/app/api/endpoints/jurisprudence.py` - Explorer endpoint with cross-faceted filtering

## Decisions Made
- Cross-faceted counts via `_build_explorer_filters(exclude_dimension=...)` helper -- each facet dimension excludes its own filter for accurate counts
- Lightweight rechtsgrond-only backfill prompt instead of full re-analysis for existing rulings (cost-effective)
- JSONB `@>` containment operator for rechtsgrond filtering, `jsonb_array_elements_text` for facet grouping
- Rechtbank niveau derived via CASE/ILIKE from instantie column -- no new column needed

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Explorer backend complete, ready for frontend explorer page (85-02)
- Backfill job can be triggered manually or added to cron schedule
- All 5 facet dimensions operational for frontend integration

## Self-Check: PASSED

All files exist, all commits verified.

---
*Phase: 85-explorer-ui*
*Completed: 2026-03-09*
