---
phase: 82-ruling-cache-ecli-mapping
plan: 02
subsystem: api
tags: [rechtspraak, arq, court-filtering, ecli, ruling-cache, background-job]

# Dependency graph
requires:
  - phase: 82-ruling-cache-ecli-mapping
    provides: "ECLI registry (get_court_codes_for_gemeente, extract_court_code) and RulingCache model"
provides:
  - "RechtspraakClient.search_by_court() with client-side ECLI prefix filtering and date range support"
  - "ruling_ingestion_job ARQ function for batch ruling cache population"
  - "GET /rulings/{gemeente_naam} endpoint with 7-day TTL auto-refresh"
affects: [83-geo-contextualization-feed, 84-ai-analysis-doorlooptijd, 85-explorer-ui]

# Tech tracking
tech-stack:
  added: []
  patterns: [client-side-ecli-filtering, arq-dedup-job, cache-ttl-auto-refresh]

key-files:
  created:
    - backend/app/jobs/ruling_ingestion.py
  modified:
    - backend/app/government_apis/rechtspraak.py
    - backend/app/jobs/worker.py
    - backend/app/api/endpoints/jurisprudence.py

key-decisions:
  - "Client-side ECLI prefix filtering over API creator param (confirmed 0 results when combined with subject)"
  - "Semaphore(5) concurrency for batch document fetching to avoid overwhelming Rechtspraak API"
  - "ARQ job dedup via _job_id=ruling_ingest:{gemeente} to prevent duplicate ingestion"

patterns-established:
  - "Client-side filtering pattern: fetch broadly, filter by ECLI court code prefix"
  - "Cache-TTL auto-refresh: return stale data immediately, enqueue background refresh"
  - "Shared XML parser: _parse_search_results reused across search methods"

requirements-completed: [PIPE-03, PIPE-04, PIPE-05, PIPE-06]

# Metrics
duration: 3min
completed: 2026-03-07
---

# Phase 82 Plan 02: Ruling Ingestion Pipeline Summary

**RechtspraakClient court-code search with ARQ ingestion job and cached rulings endpoint serving stale-while-revalidate responses**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-07T14:12:51Z
- **Completed:** 2026-03-07T14:15:36Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Extended RechtspraakClient with search_by_court() using client-side ECLI prefix filtering and date range support
- Extracted XML parsing into shared _parse_search_results method (eliminates code duplication)
- Created ruling_ingestion_job ARQ function with Semaphore(5) batch document fetching
- Added GET /rulings/{gemeente_naam} endpoint with 7-day TTL cache and automatic background re-ingestion

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend RechtspraakClient with court-code search and date range filtering** - `359131d` (feat)
2. **Task 2: ARQ ruling ingestion job + endpoint wiring** - `5a29d20` (feat)

## Files Created/Modified
- `backend/app/government_apis/rechtspraak.py` - Added search_by_court(), _parse_search_results(), ecli_registry import
- `backend/app/jobs/ruling_ingestion.py` - New ARQ job for batch ruling cache population
- `backend/app/jobs/worker.py` - Registered ruling_ingestion_job in WorkerSettings
- `backend/app/api/endpoints/jurisprudence.py` - Added GET /rulings/{gemeente_naam} with TTL cache and auto-refresh

## Decisions Made
- Used list-of-tuples for httpx params to support duplicate `date` keys for range filtering
- Semaphore(5) concurrency limit for batch document fetching (balances speed vs API politeness)
- ARQ job dedup key `ruling_ingest:{gemeente}` prevents redundant concurrent ingestion
- Endpoint returns stale data immediately while background refresh runs (stale-while-revalidate pattern)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Ruling ingestion pipeline complete, ready for Phase 83 geo-contextualization
- search_by_court() available for future geo-scoped searches
- ruling_cache populated automatically on first gemeente view
- Frontend can poll /rulings/{gemeente_naam} for cached rulings with ingestion_status

---
*Phase: 82-ruling-cache-ecli-mapping*
*Completed: 2026-03-07*
