---
phase: 09-intelligence-testing
plan: 03
subsystem: testing
tags: [pytest, integration-tests, aggregators, cache, database, mocking]

# Dependency graph
requires:
  - phase: 09-01
    provides: Aggregator unit tests establishing test patterns for zoning/monument services
  - phase: 08-02
    provides: Cache manager integration tests with real DB patterns
provides:
  - Zoning aggregator integration tests with full pipeline (DSO API mock → cache → aggregation → schema)
  - Monument aggregator integration tests with RCE API mocking and multi-source aggregation
  - Verified cache storage and retrieval through real database operations
  - 9 integration tests covering full aggregator workflows with cache optimization
affects: [09-intelligence-testing, future-aggregator-development]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Patch DSO client at module function level (get_dso_client) for zoning aggregator"
    - "Patch RCE client instance methods directly (_rce_client.query_by_location) for monument aggregator"
    - "Use AsyncMock with new_callable parameter for async method patching"
    - "Direct DB assertions on CachedAPIResponse table to verify cache storage"

key-files:
  created:
    - backend/tests/integration/test_zoning_integration.py
    - backend/tests/integration/test_monument_integration.py
  modified: []

key-decisions:
  - "Patch get_dso_client function (not instance) since zoning aggregator calls it inside fetch closure"
  - "Patch _rce_client.query_by_location method directly with new_callable=AsyncMock for proper async handling"
  - "Follow test_cache_manager.py pattern: org_id fixture with direct Organization creation, flush, commit"
  - "Use AsyncMock(spec=httpx.AsyncClient) for client parameter even though mocked APIs don't use it"

patterns-established:
  - "Integration tests for aggregators: mock only external API clients, use real DB for cache operations"
  - "Cache verification: direct DB select on CachedAPIResponse with organization_id and source filters"
  - "Cache hit tests: track mock call_count before/after second call to verify optimization"
  - "Error handling tests: mock API exceptions, assert graceful degradation with error in source result"

# Metrics
duration: 4min
completed: 2026-02-07
---

# Phase 09 Plan 03: Aggregator Integration Tests Summary

**9 integration tests verify full zoning and monument aggregator pipelines with mocked APIs and real database cache operations**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-07T15:32:39Z
- **Completed:** 2026-02-07T15:36:42Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Zoning aggregator integration tests: 5 tests covering cache miss → API fetch → storage, cache hit optimization, force refresh, empty plans, and data gap tracking
- Monument aggregator integration tests: 4 tests covering RCE monument found/not found, cache hit optimization, and API error graceful degradation
- All tests use real database (test_db fixture) with direct DB assertions on CachedAPIResponse table to verify cache storage
- 200 total tests passing (191 previous + 9 new from this plan)

## Task Commits

Each task was committed atomically:

1. **Task 1: Zoning aggregator integration tests** - `77a6fe8` (test)
2. **Task 2: Monument aggregator integration tests** - `7db99df` (test)

## Files Created/Modified
- `backend/tests/integration/test_zoning_integration.py` - 5 tests for zoning aggregator full flow with DSO API mocking and real DB cache verification
- `backend/tests/integration/test_monument_integration.py` - 4 tests for monument aggregator full flow with RCE API mocking and multi-source aggregation

## Decisions Made

**1. Patch get_dso_client function for zoning tests**
- Zoning aggregator calls `get_dso_client()` inside the `_fetch()` closure passed to cache manager
- Must patch `app.services.zoning_aggregator.get_dso_client` to return mock DSO client
- Mock DSO client has AsyncMock methods: find_plans_at_location, get_bestemmingsvlakken, get_maatvoeringen, get_bouwvlakken

**2. Patch RCE client instance method for monument tests**
- Monument aggregator calls `_rce_client.query_by_location` directly
- Patch `app.government_apis.rce_monuments._rce_client.query_by_location` with `new_callable=AsyncMock`
- Using `new_callable=AsyncMock` ensures proper async handling (avoiding "coroutine not awaited" errors)

**3. Real database for cache operations**
- Follow test_cache_manager.py pattern: use test_db fixture for real DB operations
- Direct DB assertions verify CachedAPIResponse entries exist with correct organization_id and source
- This validates full integration: aggregator → cache_manager → database storage → retrieval

**4. Cache hit optimization verification**
- Track mock call counts before/after second call to same location
- Verify API called only once when cache hit occurs
- Validates cache_manager TTL and freshness logic through aggregator layer

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed monument test mock patching**
- **Found during:** Task 2 (Monument integration tests)
- **Issue:** Initial patch of `_rce_client` as MagicMock with AsyncMock attribute caused "coroutine object has no attribute 'get'" error
- **Fix:** Changed to patch `_rce_client.query_by_location` directly with `new_callable=AsyncMock`
- **Files modified:** backend/tests/integration/test_monument_integration.py
- **Verification:** All 4 monument tests pass with proper async handling
- **Committed in:** 7db99df (Task 2 commit includes fix)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Fix necessary for tests to run correctly. No scope creep - standard debugging of async mock setup.

## Issues Encountered

**Mock patching for async closures:** Learned that when aggregator functions call API clients inside closures passed to cache_manager, the patch location matters:
- Zoning: patch the factory function (`get_dso_client`) that's called inside the closure
- Monument: patch the instance method (`_rce_client.query_by_location`) called inside the closure
- Both require careful attention to where the call originates (module-level import vs instance call)

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**TEST-06 requirement satisfied:** Aggregator integration tests complete with full pipeline verification.

**Phase 9 status:** 3/3 plans complete (TEST-05, TEST-06, TEST-07, INFRA-01 all satisfied)

**Ready for:** Phase completion and v1.1 milestone review

**200 total tests passing:**
- 20 auth unit tests
- 31 auth integration tests
- 63 API client unit tests
- 20 cache manager integration tests
- 42 aggregator unit tests (zoning + monument)
- 12 Claude AI parsing unit tests
- 3 ARQ lifecycle integration tests
- 9 aggregator integration tests (zoning + monument) ← NEW

---
*Phase: 09-intelligence-testing*
*Completed: 2026-02-07*

## Self-Check: PASSED

All files and commits verified:
- ✓ backend/tests/integration/test_zoning_integration.py
- ✓ backend/tests/integration/test_monument_integration.py
- ✓ 77a6fe8 (zoning tests)
- ✓ 7db99df (monument tests)
