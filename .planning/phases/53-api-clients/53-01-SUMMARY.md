---
phase: 53-api-clients
plan: 01
subsystem: api
tags: [ep-online, woz-waardeloket, httpx, rate-limiting, retry-backoff, energy-label, woz]

# Dependency graph
requires:
  - phase: 52-schema-config-foundation
    provides: EnergyLabel, WOZData, WOZWaarde Pydantic schemas; ep_online_limiter singleton; EP_ONLINE_API_KEY config
provides:
  - EPOnlineClient with get_by_vbo_id (three-state contract)
  - WOZWaardeloketClient with get_by_nummeraanduiding_id (three-state contract)
  - retry_with_backoff shared helper in base.py (3 retries, 1s/2s/4s exponential backoff)
  - woz_waardeloket_limiter singleton in rate_limiter.py
affects: [54-bag-rce-clients, 55-report-enrichment, 56-frontend-integration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Three-state contract pattern: return model on success, None on not-found/unconfigured, raise on error
    - retry_with_backoff: shared helper wrapping any async HTTP callable, 429-aware exponential backoff
    - Explicit camelCase-to-snake_case field mapping in _parse_* helpers (never model(**data))
    - MEDIUM/LOW confidence comments on API field names for Phase 53 live validation

key-files:
  created:
    - backend/app/government_apis/ep_online.py
    - backend/app/government_apis/woz_waardeloket.py
  modified:
    - backend/app/government_apis/base.py
    - backend/app/government_apis/rate_limiter.py

key-decisions:
  - "retry_with_backoff returns last response after all retries exhausted (caller's handle_api_response raises APIRateLimitError)"
  - "EP-Online 404 returns EnergyLabel(is_geregistreerd=False) not None — normal for 20-30% of properties (NRG-03)"
  - "WOZ low_confidence=True always set (WOZ-04) — public Waardeloket, not authoritative API"
  - "WOZ unexpected format raises GovernmentAPIError not silent None — monitoring requirement"
  - "EP-Online auth uses Bearer token header (MEDIUM confidence — may need X-Api-Key during Phase 53 live validation)"

patterns-established:
  - "Three-state contract: return model | None (not-found/unconfigured) | raise GovernmentAPIError (error)"
  - "retry_with_backoff wrapper pattern: lambda: client.get(url, headers=...) passed as fn callable"
  - "MEDIUM/LOW confidence field name comments signal Phase 53 live validation checkpoints"
  - "List response handling: EP-Online may return list, take first item"

requirements-completed: [NRG-01, NRG-03, WOZ-01, WOZ-04]

# Metrics
duration: 3min
completed: 2026-02-24
---

# Phase 53 Plan 01: EP-Online V5 and WOZ Waardeloket API Clients

**EP-Online V5 and WOZ Waardeloket REST clients with three-state contracts, shared retry_with_backoff helper, and always-on low_confidence flag for WOZ data**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-24T04:53:26Z
- **Completed:** 2026-02-24T04:56:03Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Created EPOnlineClient with get_by_vbo_id implementing three-state contract (EnergyLabel | EnergyLabel(is_geregistreerd=False) | None when unconfigured | raise)
- Created WOZWaardeloketClient with get_by_nummeraanduiding_id implementing three-state contract (WOZData(low_confidence=True) | None on 404 | raise on unexpected format)
- Added retry_with_backoff shared helper to base.py for 429 exponential backoff (1s, 2s, 4s delays)
- Added woz_waardeloket_limiter singleton to rate_limiter.py (3 concurrent, 500/hour)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create EP-Online V5 client with retry logic** - `6c1b322` (feat)
2. **Task 2: Create WOZ Waardeloket client and rate limiter** - `988f67d` (feat, committed as part of 53-02)

## Files Created/Modified
- `backend/app/government_apis/ep_online.py` - EPOnlineClient with get_by_vbo_id, _parse_energy_label helper, ep_online_client singleton
- `backend/app/government_apis/woz_waardeloket.py` - WOZWaardeloketClient with get_by_nummeraanduiding_id, _parse_woz_data helper, woz_waardeloket_client singleton
- `backend/app/government_apis/base.py` - Added retry_with_backoff async helper, Callable/Awaitable imports
- `backend/app/government_apis/rate_limiter.py` - Added woz_waardeloket_limiter singleton

## Decisions Made
- **retry_with_backoff return behavior**: Returns last response after all retries exhausted. The caller's `handle_api_response` then raises `APIRateLimitError` if it's still 429. Avoids duplicating error-raising logic.
- **EP-Online 404 = EnergyLabel(is_geregistreerd=False)**: Not None, because the client is configured and the property is real — it just has no registered label (expected for 20-30% of properties per NRG-03).
- **WOZ unexpected format raises**: User decision from CONTEXT.md — silent None would hide data quality issues. GovernmentAPIError with status_code=200 for monitoring.
- **EP-Online auth header**: Using Bearer token as default (MEDIUM confidence). Flagged for Phase 53 live validation — may need X-Api-Key header.
- **MEDIUM/LOW confidence comments**: All API field names annotated with confidence level so Phase 53 executor knows which fields to verify against live calls.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

Task 2 files (woz_waardeloket.py, rate_limiter.py update) were committed as part of commit `988f67d` which was labeled `feat(53-02)`. The WOZ client was included alongside the RCE client commit. All required code was delivered correctly.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- EP-Online and WOZ clients ready for Phase 55 report enrichment wiring
- All field names flagged with MEDIUM/LOW confidence — Phase 53 live API validation will correct any mismatches
- woz_waardeloket_limiter and retry_with_backoff available for other clients that need them

---
*Phase: 53-api-clients*
*Completed: 2026-02-24*
