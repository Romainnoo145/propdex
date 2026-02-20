---
phase: 41-bug-fixes-hardening
plan: 01
subsystem: testing
tags: [jwt, auth, cookies, httponly, pytest, httpx]

# Dependency graph
requires:
  - phase: 14
    provides: "CookieTokenResponse — refresh_token in httpOnly cookie, not JSON body"
provides:
  - "Auth integration tests aligned with Phase 14 cookie-based refresh token flow"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "_extract_refresh_cookie() helper to parse Set-Cookie header in tests"
    - "Explicit cookies={} parameter on requests that need refresh_token"

key-files:
  created: []
  modified:
    - backend/tests/integration/test_auth_flow.py

key-decisions:
  - "Read refresh_token from Set-Cookie header via _extract_refresh_cookie() helper — not from JSON body"
  - "Send refresh_token explicitly via cookies={} parameter — not as JSON body"

patterns-established:
  - "Cookie extraction pattern: parse Set-Cookie header manually for httpOnly cookies in httpx tests"

# Metrics
duration: 5min
completed: 2026-02-20
---

# Phase 41 Plan 01: Auth Integration Test Cookie Fix Summary

**Auth integration tests rewritten to use httpOnly cookie flow matching CookieTokenResponse schema — all 13 tests pass**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-20T00:00:00Z
- **Completed:** 2026-02-20T00:05:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- All 13 auth integration tests now pass against the Phase 14 cookie-based auth flow
- Removed all `data["refresh_token"]` and `json={"refresh_token": ...}` patterns from tests
- Added `_extract_refresh_cookie()` helper to parse Set-Cookie headers from httpx responses
- Refresh and logout requests now send refresh_token via `cookies={}` parameter
- Verified ruff lint is clean (removed unused `datetime`/`timedelta` imports)

## Task Commits

Each task was committed atomically:

1. **Task 1: Update auth integration tests to use cookie-based refresh flow** - `4788975` (fix)

**Plan metadata:** (to be committed with SUMMARY.md and STATE.md)

## Files Created/Modified

- `backend/tests/integration/test_auth_flow.py` - Updated all tests to use cookie-based refresh token flow

## Decisions Made

- Read refresh_token from Set-Cookie header via `_extract_refresh_cookie()` helper rather than from JSON body — CookieTokenResponse only contains `access_token` and `token_type`
- Send refresh_token explicitly via `cookies={"refresh_token": value}` parameter to bypass httpx path-matching for the cookie jar (cookie has `path=/api/auth` but test endpoint is `/auth/refresh`)

## Deviations from Plan

None - plan executed exactly as written. One small deviation was also fixed: the `datetime` and `timedelta` imports from the original tests were now unused after removing date-related test logic, so they were removed to satisfy ruff lint (Rule 2 - minor cleanup).

## Issues Encountered

None - the cookie extraction approach worked first time. The httpx `cookies={}` parameter correctly injects cookies on requests even though the test client uses ASGITransport.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Auth integration tests are now correct and passing
- Ready to continue with Phase 41 Plan 02 (ARQ worker duplicate scan results fix)

---
*Phase: 41-bug-fixes-hardening*
*Completed: 2026-02-20*
