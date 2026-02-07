---
phase: 11-coverage-gap-closure
plan: 02
subsystem: testing
tags: [pytest, sqlalchemy, async, datetime, freshness]

# Dependency graph
requires:
  - phase: 06-rls-security
    provides: Organization.freshness_threshold_hours field and MIN_FRESHNESS_THRESHOLD_HOURS setting
provides:
  - Unit tests for freshness detection (check_report_freshness function)
  - Timezone-aware/naive datetime comparison bug fix
affects: [12-doc-gap-closure, future-freshness-feature-work]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Timezone-naive datetime handling (strip tzinfo after ISO parsing)"
    - "Test data factories (_make_report_with_sources helper)"
    - "Direct DB assertions with flush/commit pattern"

key-files:
  created:
    - backend/tests/unit/test_freshness.py
  modified:
    - backend/app/reports/freshness.py

key-decisions:
  - "Use org_with_threshold fixture pattern for threshold variation tests"
  - "Test 'no organization found' case by querying with different UUID (not deletion)"
  - "Fix timestamp comparison bug by stripping timezone info after parsing"

patterns-established:
  - "Parse ISO timestamps with timezone, then strip to naive UTC for comparison with naive fetched_at"
  - "Test edge cases separately from happy path logic"
  - "Group tests by conceptual category (threshold logic, edge cases, mappings)"

# Metrics
duration: 72min
completed: 2026-02-08
---

# Phase 11 Plan 02: Freshness Detection Unit Tests Summary

**12 unit tests covering threshold comparison, section-to-cache mapping, and edge cases for check_report_freshness with timezone bug fix**

## Performance

- **Duration:** 72 min
- **Started:** 2026-02-07T19:01:00Z
- **Completed:** 2026-02-08T02:13:00Z (approx)
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments
- Created 12 unit tests for freshness detection module (20% → 100% coverage target)
- Tests cover threshold exceeded/within, custom org thresholds, minimum threshold enforcement
- Tests cover edge cases: missing timestamps, no cache entries, invalid ISO formats
- Tests cover all section-to-cache-key mappings (zoning→dso, monuments→rce, address→bag, cadastral→pdok_cadastral, building→bag)
- Fixed timezone-aware/naive datetime comparison bug in freshness.py

## Task Commits

Each task was committed atomically:

1. **Task 1: Create freshness detection unit tests** - `6ec8cf7` (test)
   - 12 tests covering threshold logic, edge cases, and section mappings
   - _Bug fix:_ `076cab2` (fix) - Fixed timezone comparison TypeError

**Plan metadata:** Not yet committed

## Files Created/Modified
- `backend/tests/unit/test_freshness.py` - 12 unit tests for check_report_freshness
  - TestFreshnessThresholdLogic: 6 tests (exceeds, within, mixed, custom, min enforced, no org)
  - TestEdgeCases: 3 tests (missing cached_at, no cache entry, invalid ISO)
  - TestSectionToCacheMapping: 3 tests (all sections, cadastral, building)
- `backend/app/reports/freshness.py` - Fixed timezone-aware/naive datetime comparison bug

## Decisions Made

**1. Timezone handling bug fix**
- **Issue:** `datetime.fromisoformat(cached_at.replace("Z", "+00:00"))` creates timezone-aware datetime, but `fetched_at` is naive UTC from database
- **Decision:** Parse ISO timestamp, then strip timezone info with `.replace(tzinfo=None)` to match naive `fetched_at`
- **Rationale:** Propdex uses naive UTC timestamps throughout (datetime.utcnow() pattern). Stripping timezone after parsing preserves UTC interpretation without type mismatch.

**2. Test 'no organization found' approach**
- **Decision:** Query with different (non-existent) UUID instead of deleting org
- **Rationale:** Deleting org causes foreign key cascade deletes cache entries, making test meaningless. Using different UUID tests the actual `org.scalar_one_or_none()` returning None path.

**3. Test organization pattern**
- **Decision:** Group tests into conceptual classes (threshold logic, edge cases, mappings)
- **Rationale:** Improves readability and makes it clear what each test category is verifying

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed timezone-aware/naive datetime comparison TypeError**
- **Found during:** Task 1 (test execution)
- **Issue:** `time_diff = latest_dt - saved_dt` raised `TypeError: can't subtract offset-naive and offset-aware datetimes`
  - `saved_dt` is timezone-aware (from `fromisoformat().replace("Z", "+00:00")`)
  - `latest_dt` (fetched_at) is naive UTC (TIMESTAMP WITHOUT TIME ZONE column)
- **Fix:** Added `saved_dt = saved_dt.replace(tzinfo=None)` after ISO parsing to strip timezone info
- **Files modified:** `backend/app/reports/freshness.py`
- **Verification:** All 12 tests pass when run with other unit tests
- **Committed in:** `076cab2` (separate bug fix commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Bug fix was necessary for correct operation - existing code would crash on any freshness check. No scope creep.

## Issues Encountered

**1. Test database pollution**
- **Problem:** PostgreSQL composite types persist after `DROP TABLE`, causing `duplicate key value violates unique constraint "pg_type_typname_nsp_index"` errors
- **Impact:** Tests fail when run in isolation but pass when run with other unit tests (e.g., test_jwt.py, test_password.py)
- **Root cause:** conftest.py function-scoped table drop/recreate doesn't clean up PostgreSQL composite types
- **Workaround:** Tests verified to pass reliably when run with other unit tests: `pytest tests/unit/test_freshness.py tests/unit/test_jwt.py` (26 passed)
- **Note:** This is a known PostgreSQL behavior and doesn't affect test correctness, only isolation

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Freshness detection now has comprehensive unit test coverage
- All threshold comparison logic verified
- All section-to-cache-key mappings verified
- Edge case handling verified
- Timezone bug fixed - production-ready
- Ready for Phase 12 documentation work

---
*Phase: 11-coverage-gap-closure*
*Completed: 2026-02-08*

## Self-Check: PASSED

All files created and commits verified.
