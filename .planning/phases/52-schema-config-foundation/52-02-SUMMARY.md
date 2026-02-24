---
phase: 52-schema-config-foundation
plan: 02
subsystem: api
tags: [config, rate-limiter, cache-ttl, ep-online, rce, woz, pydantic-settings]

# Dependency graph
requires:
  - phase: 52-01
    provides: EnergyLabel, WOZData, BRKOwnership schema models established
provides:
  - CACHE_TTL dict entries for ep_online (2592000s), rce_detail (2592000s), woz (31536000s)
  - EP_ONLINE_API_KEY setting in Settings class with empty string default
  - ep_online_limiter singleton (max_concurrent=3, max_per_hour=500)
  - rce_detail_limiter singleton (max_concurrent=3, max_per_hour=300)
affects:
  - phase-53 (EP-Online API client imports ep_online_limiter, EP_ONLINE_API_KEY)
  - phase-53 (RCE detail API client imports rce_detail_limiter)
  - caching layer (get_cached_or_fetch uses CACHE_TTL dict lookup)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "CACHE_TTL dict lookup: keys follow API source name (ep_online, rce_detail, woz)"
    - "BRK intentionally absent from CACHE_TTL (Kadaster Tier 3 terms prohibit caching)"
    - "Rate limiter singletons: module-level instantiation with comment describing the API"

key-files:
  created: []
  modified:
    - backend/app/core/config.py
    - backend/app/government_apis/rate_limiter.py

key-decisions:
  - "BRK intentionally absent from CACHE_TTL — Kadaster Tier 3 terms prohibit caching BRK data"
  - "EP_ONLINE_API_KEY empty string default follows BAG_API_KEY/DSO_API_KEY pattern — feature degrades gracefully when unconfigured"
  - "ep_online_limiter limits (3/500) match conservative key-gated API usage; rce_detail_limiter (3/300) is slightly more conservative for public API politeness"

patterns-established:
  - "Cache TTL keys: use API source name string matching the source parameter in get_cached_or_fetch"
  - "Rate limiter singletons: comment + APIRateLimiter instantiation at module level"

# Metrics
duration: 2min
completed: 2026-02-24
---

# Phase 52 Plan 02: Schema & Config Foundation — Config & Rate Limiters Summary

**Cache TTL entries for ep_online/rce_detail/woz, EP_ONLINE_API_KEY setting, and ep_online/rce_detail rate limiter singletons added to backend infrastructure**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-24T03:20:59Z
- **Completed:** 2026-02-24T03:22:55Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Added 3 new CACHE_TTL entries (ep_online: 30d, rce_detail: 30d, woz: 365d) with BRK intentionally absent
- Added EP_ONLINE_API_KEY to Settings class following empty-string-default pattern for graceful degradation
- Added ep_online_limiter and rce_detail_limiter singletons in rate_limiter.py for Phase 53 API clients to import

## Task Commits

Each task was committed atomically:

1. **Task 1: Add cache TTL entries and EP_ONLINE_API_KEY setting** - `6bc8387` (feat)
2. **Task 2: Add EP-Online and RCE detail rate limiter singletons** - `50de906` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `backend/app/core/config.py` - Added ep_online/rce_detail/woz to CACHE_TTL dict; added EP_ONLINE_API_KEY field after DSO_API_KEY in Settings class
- `backend/app/government_apis/rate_limiter.py` - Added ep_online_limiter (3/500) and rce_detail_limiter (3/300) module-level singletons

## Decisions Made

- BRK intentionally absent from CACHE_TTL — Kadaster Tier 3 API terms prohibit caching BRK data at the application layer
- EP_ONLINE_API_KEY uses empty string default, consistent with BAG_API_KEY and DSO_API_KEY — feature degrades gracefully when not configured
- ep_online rate limit set at max_concurrent=3, max_per_hour=500 (conservative for key-gated RVO API)
- rce_detail rate limit set at max_concurrent=3, max_per_hour=300 (slightly lower for polite public API usage)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

One pre-existing test failure (`test_refresh_token_reuse_detection`) was observed during the test suite run — confirmed pre-existing by reverting to prior commit and reproducing the failure. Not caused by changes in this plan.

## User Setup Required

None - no external service configuration required at this stage. EP_ONLINE_API_KEY can be added to `.env` when the EP-Online API client is wired up in Phase 53.

## Next Phase Readiness

- Phase 53 (API clients) can now import `ep_online_limiter` and `rce_detail_limiter` directly
- Phase 53 can import `settings.EP_ONLINE_API_KEY` for the EP-Online client
- Caching layer will correctly cache EP-Online responses for 30 days and WOZ for 365 days

---
*Phase: 52-schema-config-foundation*
*Completed: 2026-02-24*
