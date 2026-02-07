---
phase: 06-security-configuration
plan: 02
subsystem: configuration
tags: [configuration, data-freshness, sqlalchemy, alembic, postgresql]

# Dependency graph
requires:
  - phase: 06-security-configuration
    provides: MIN_FRESHNESS_THRESHOLD_HOURS in settings (Plan 06-01)
provides:
  - Per-organization configurable freshness threshold with system minimum enforcement
  - Organization.freshness_threshold_hours column (default 24h)
  - Updated freshness detection using org-specific thresholds
affects: [07-auth-authorization, 09-validation, api-endpoints]

# Tech tracking
tech-stack:
  added: []
  patterns: [Per-org configuration with system-enforced minimums]

key-files:
  created:
    - backend/alembic/versions/6a29dfcdd7e2_add_freshness_threshold_hours_to_.py
  modified:
    - backend/app/models/organization.py
    - backend/app/reports/freshness.py

key-decisions:
  - "Default freshness threshold to 24 hours for zero-behavior-change migration"
  - "Use max(org.threshold, settings.MIN_FRESHNESS_THRESHOLD_HOURS) to enforce system minimum"
  - "Single global threshold per org (not per data source)"
  - "Integer type in hours (sufficient granularity)"

patterns-established:
  - "Per-org configuration pattern: store in Organization model, enforce minimum in application code"
  - "SQLAlchemy 2.x: Mapped[type] + mapped_column() with server_default"

# Metrics
duration: 2min
completed: 2026-02-07
---

# Phase 6 Plan 02: Configurable Freshness Threshold Summary

**Per-organization data freshness thresholds with system-enforced minimum to prevent API abuse (BAG, PDOK, DSO, RCE)**

## Performance

- **Duration:** 2 minutes
- **Started:** 2026-02-07T13:12:20Z
- **Completed:** 2026-02-07T13:14:28Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments
- Organization model has freshness_threshold_hours column with default 24h
- Freshness detection uses per-org threshold with max(org.threshold, settings.MIN_FRESHNESS_THRESHOLD_HOURS) enforcement
- Removed hardcoded 24-hour threshold from freshness.py
- Alembic migration applied successfully

## Task Commits

Each task was committed atomically:

1. **Task 1: Add freshness_threshold_hours to Organization model** - `85f3255` (feat)
2. **Task 2: Update freshness detection to use per-org threshold** - `04cd784` (feat)
3. **Task 3: Create Alembic migration for freshness_threshold_hours** - `a6aab76` (feat)

## Files Created/Modified
- `backend/app/models/organization.py` - Added freshness_threshold_hours: Mapped[int] column with server_default=24
- `backend/app/reports/freshness.py` - Updated check_report_freshness() to query Organization for threshold and enforce minimum
- `backend/alembic/versions/6a29dfcdd7e2_add_freshness_threshold_hours_to_.py` - Migration adds freshness_threshold_hours column (Integer, NOT NULL, default 24)

## Decisions Made

1. **Default to 24 hours:** Existing organizations get 24h threshold (matches previous hardcoded behavior, zero-change migration)
2. **Enforce minimum in app code:** Use max(org.threshold, settings.MIN_FRESHNESS_THRESHOLD_HOURS) to prevent API abuse
3. **Single global threshold per org:** Not per-data-source (simpler configuration, sufficient for initial requirements)
4. **Integer type in hours:** Hour granularity is sufficient for freshness checks

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**Ready for Phase 6 remaining plans (06-03 through 06-07):**
- Organizations now have configurable freshness thresholds
- System minimum enforced to prevent external API abuse
- Default behavior unchanged (24h) for existing data

**No blockers:**
- All verifications passed
- Database migration applied successfully
- Imports working correctly

---
*Phase: 06-security-configuration*
*Completed: 2026-02-07*

## Self-Check: PASSED

All created files exist:
- backend/alembic/versions/6a29dfcdd7e2_add_freshness_threshold_hours_to_.py

All commits verified:
- 85f3255
- 04cd784
- a6aab76
