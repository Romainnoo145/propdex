---
phase: 55-aggregator-integration
plan: 01
subsystem: api
tags: [rce, monument, cache, enrichment, aggregator]

requires:
  - phase: 54-brk-wiring-no-cache
    provides: "BRK ownership wiring pattern — same fetch-after-parallel-gather structure"
  - phase: 53-api-clients-live-validation
    provides: "rce_linked_data client with get_detail_by_monument_number, RCEMonumentDetail schema"
provides:
  - "Two-step monument enrichment: PDOK spatial -> RCE Linked Data detail in monument_aggregator"
  - "RCE detail fetched and cached (source=rce_detail, 30-day TTL) for every rijksmonument detection"
  - "MonumentStatus.rce_detail populated with redengevende_omschrijving, functie, bouwperiode, bouwstijl"
affects: [56-frontend-property-report, monument display, property report API]

tech-stack:
  added: []
  patterns:
    - "Two-step enrichment: run parallel source fetch -> check consensus -> conditional single-source enrichment"
    - "_fetch_rce_detail inner async closure wraps Pydantic-returning client with .model_dump() for get_cached_or_fetch compatibility"
    - "GovernmentAPIError + Exception double catch for graceful degradation with logger.warning"

key-files:
  created: []
  modified:
    - backend/app/services/monument_aggregator.py

key-decisions:
  - "No extra rate limiter wrapper in aggregator — rce_detail_limiter already applied inside rce_linked_data_client.get_detail_by_monument_number()"
  - "monument_nummer converted to str() before RCE client call — client expects string not int/float"
  - "cache source 'rce_detail' (not 'rce') to match CACHE_TTL key and 30-day TTL"
  - "Enrichment only triggers for consensus_status == 'rijksmonument' — avoids unnecessary API calls"

patterns-established:
  - "Post-parallel enrichment: enrichment step runs after asyncio.gather, not inside it"
  - "Inner async def closure for cache-manager-compatible fetch_fn wrapping Pydantic objects"

requirements-completed: [AGG-04]

duration: 5min
completed: 2026-02-24
---

# Phase 55 Plan 01: Aggregator Integration Summary

**Two-step rijksmonument enrichment wired into monument_aggregator: PDOK spatial detection -> RCE Linked Data detail auto-fetched and cached with 30-day TTL via rce_detail_limiter-aware client**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-24T06:30:00Z
- **Completed:** 2026-02-24T06:35:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Wired `rce_linked_data_client.get_detail_by_monument_number()` into `fetch_monument_status()` after parallel source gather
- RCE detail cached with `source="rce_detail"` and key `rce_detail:monument:{nummer}` (30-day TTL matches CACHE_TTL config)
- Graceful degradation: `GovernmentAPIError` and generic `Exception` caught separately with `logger.warning`
- `rce_detail=rce_detail` passed to `MonumentStatus` constructor (field already defined in schema)
- File stays at 296 lines (under 300-line limit)

## Task Commits

1. **Task 1: Add RCE detail two-step enrichment to fetch_monument_status** - `5fc9a06` (feat)

**Plan metadata:** _(to follow)_

## Files Created/Modified

- `backend/app/services/monument_aggregator.py` - Added logging import, rce_linked_data_client/RCEMonumentDetail/GovernmentAPIError imports, two-step enrichment block, rce_detail kwarg in MonumentStatus constructor

## Decisions Made

- No extra rate limiter wrapper: `rce_detail_limiter` is already applied inside `RCELinkedDataClient.get_detail_by_monument_number()` via `async with rce_detail_limiter` — adding another wrapper would cause double rate limiting
- Enrichment triggers only for `consensus_status == "rijksmonument"` — avoids RCE Linked Data calls for non-monuments and gemeentelijk monuments
- `monument_nummer` converted to `str()` before passing to RCE client (client signature expects str, PDOK may return numeric)
- Cache source `"rce_detail"` not `"rce"` to use the correct 30-day TTL entry in CACHE_TTL

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None — pre-existing mypy warnings in monument_aggregator.py (unparameterized `dict` type hints and `append` type narrowing) were present before this change and are not introduced by this plan.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Monument aggregator now returns `MonumentStatus.rce_detail` populated for all rijksmonumenten
- Phase 56 frontend property report can display `redengevende_omschrijving`, `oorspronkelijke_functie`, `bouwjaar_van/tot`, `bouwstijl`, `architect`, and `monument_register_url`
- Cache wired correctly — repeated report views served from DB cache within 30-day TTL

---
*Phase: 55-aggregator-integration*
*Completed: 2026-02-24*
