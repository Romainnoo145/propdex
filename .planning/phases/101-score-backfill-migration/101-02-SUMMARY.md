---
phase: 101-score-backfill-migration
plan: 02
subsystem: api
tags: [pydantic, fastapi, mvt, postgis, tile-proxy, score-v3]

requires:
  - phase: 100-score-v3-0-engine
    provides: v3.0 scoring engine with potentie/risico split and score_breakdown format
provides:
  - potentie_score and risico_score fields on ParcelAtPointResponse API
  - v3.0 score_breakdown detection in router (at-point + results list)
  - potentie/risico JSONB extraction in MVT tile SQL
  - TILE_SCHEMA_VERSION bumped to 14 for cache invalidation
affects: [frontend-potentie-dashboard, frontend-risico-dashboard, tile-rendering]

tech-stack:
  added: []
  patterns: [v3.0-first detection with v2.1 fallback in score extraction]

key-files:
  created: []
  modified:
    - backend/app/scans/schemas.py
    - backend/app/scans/router.py
    - backend/app/services/tile_proxy.py
    - frontend/src/lib/api.ts

key-decisions:
  - "v3.0 detection uses categorie key presence in first score_breakdown value to distinguish from v2.1"
  - "potentie/risico scores extracted with strict type validation (int/float, not bool)"

patterns-established:
  - "v3.0 score detection: check flags.score_breakdown values for categorie key before falling back to flags.factors"

requirements-completed: [BF-02, BF-03, BF-04]

duration: 2min
completed: 2026-03-11
---

# Phase 101 Plan 02: API & Tile Score Serving Summary

**v3.0 potentie/risico scores served via API endpoints and MVT tiles with v2.1 backwards compatibility**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-11T09:32:23Z
- **Completed:** 2026-03-11T09:34:01Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- ParcelAtPointResponse schema extended with potentie_score and risico_score optional fields (0-100, validated)
- Router score extraction updated in both at-point and results-list endpoints to detect v3.0 format first, fall back to v2.1
- MVT tile proxy SQL includes potentie_score and risico_score from flags JSONB (NULL for v2.1 data)
- TILE_SCHEMA_VERSION bumped from 13 to 14 for browser cache invalidation

## Task Commits

Each task was committed atomically:

1. **Task 1: Add v3.0 score fields to schema and update router extraction** - `8c78884` (feat)
2. **Task 2: Add potentie/risico to tile proxy and bump frontend cache** - `ea56ab4` (feat)

## Files Created/Modified
- `backend/app/scans/schemas.py` - Added potentie_score and risico_score fields to ParcelAtPointResponse
- `backend/app/scans/router.py` - v3.0 score_breakdown detection in at-point builder and results list endpoint
- `backend/app/services/tile_proxy.py` - JSONB extraction for potentie/risico in MVT query
- `frontend/src/lib/api.ts` - TILE_SCHEMA_VERSION bump from 13 to 14

## Decisions Made
- v3.0 format detected by checking if first value in score_breakdown dict has a "categorie" key -- this distinguishes v3.0 factor objects from v2.1 factors dict
- Strict type validation on potentie/risico values (must be int/float, not bool) matching existing score extraction patterns

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- API and tiles ready to serve v3.0 scores once backfill tool (101-01) populates the data
- Frontend already has isScoreV3() detection and v2.1 fallback cards from Phase 100

---
*Phase: 101-score-backfill-migration*
*Completed: 2026-03-11*

## Self-Check: PASSED
