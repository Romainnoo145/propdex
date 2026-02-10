---
phase: 19-government-api-clients
plan: 01
subsystem: government-api-infrastructure
tags: [rate-limiting, dependencies, config, async, foundation]

dependency_graph:
  requires:
    - asyncio.Semaphore
    - aiolimiter.AsyncLimiter
  provides:
    - APIRateLimiter class
    - bag_wfs_limiter instance
    - sru_limiter instance
    - brk_limiter instance
    - BRK mTLS config fields
  affects:
    - future BAG WFS client (19-02)
    - future SRU client (19-03)
    - future BRK client (19-04)

tech_stack:
  added:
    - lxml>=5.3.0 (SRU XML parsing with XXE protection)
    - aiolimiter>=1.2.0 (async token bucket rate limiting)
  patterns:
    - Async context manager for rate limiter acquire/release
    - Dual-layer rate limiting (semaphore + token bucket)
    - Module-level singleton instances per API
    - Test bypass via enabled flag

key_files:
  created:
    - backend/app/government_apis/rate_limiter.py: APIRateLimiter class with module-level instances for BAG WFS/SRU/BRK
  modified:
    - backend/pyproject.toml: Added lxml and aiolimiter dependencies
    - backend/app/core/config.py: Added BRK_API_KEY and three PKIOverheid mTLS config fields

decisions:
  - Use dual-layer rate limiting (semaphore for concurrency, token bucket for time-based)
  - Conservative BRK limits (2 concurrent, 200/hour) as it's a paid API
  - All BRK config fields default to empty string (optional until production)
  - Rate limiter enabled flag allows tests to bypass delays

metrics:
  duration_seconds: 105
  tasks_completed: 2
  commits: 2
  files_created: 1
  files_modified: 2
  lines_added: 108
  completed_date: 2026-02-10
---

# Phase 19 Plan 01: Rate Limiter & Dependencies Summary

**One-liner:** Async rate limiter with dual-layer control (semaphore + token bucket), three module-level instances (BAG WFS/SRU/BRK), plus lxml and aiolimiter dependencies and BRK mTLS config fields.

## What Was Built

Created the foundational infrastructure needed by all Phase 19 government API clients:

1. **Per-API rate limiting module** (`rate_limiter.py`):
   - `APIRateLimiter` class combining `asyncio.Semaphore` (concurrency control) and `aiolimiter.AsyncLimiter` (time-based token bucket)
   - Async context manager pattern for clean acquire/release semantics
   - Three module-level singleton instances with appropriate limits per API:
     - `bag_wfs_limiter`: 5 concurrent, 1000/hour (PDOK is public, generous)
     - `sru_limiter`: 3 concurrent, 500/hour (SRU is less tolerant)
     - `brk_limiter`: 2 concurrent, 200/hour (BRK is paid, conservative)
   - `enabled` flag for test bypass (skip acquire/release when disabled)

2. **New dependencies** (pyproject.toml):
   - `lxml>=5.3.0` for SRU XML parsing with XXE protection
   - `aiolimiter>=1.2.0` for async token bucket rate limiting

3. **BRK configuration settings** (config.py):
   - `BRK_API_KEY` for Kadaster BRK Bevragen API authentication
   - `BRK_CLIENT_CERT_PATH`, `BRK_CLIENT_KEY_PATH`, `BRK_CA_BUNDLE_PATH` for PKIOverheid mTLS
   - All fields default to empty string (optional until production deployment)

## Architecture Decisions

**Dual-layer rate limiting:** Combined semaphore (limits concurrent requests in flight) with token bucket (limits requests per hour). This protects both against overwhelming the API server and hitting daily quota limits.

**Conservative BRK limits:** Set at 2 concurrent and 200/hour because BRK is a paid API requiring PKIOverheid mTLS certificates. Can be increased later if needed.

**Module-level singletons:** Each API gets its own rate limiter instance to ensure isolation (BAG WFS traffic doesn't affect BRK quota, etc.).

**Test bypass flag:** Rate limiter has `enabled` attribute to allow fast tests without rate limiting delays. When `enabled=False`, `__aenter__` and `__aexit__` are no-ops.

## Implementation Notes

**Pattern followed:** Async context manager using `__aenter__` and `__aexit__`. Acquire order is semaphore first, then token bucket. Release only needs to release semaphore (token bucket releases automatically).

**Type hints:** Full type hints on all parameters and return types per codebase standards.

**Logging:** Module uses `logging.getLogger(__name__)` pattern for future logging statements.

**Config pattern:** BRK config fields follow existing Settings pattern using `Field(default="", description="...")`.

## Verification Results

All verification passed:

- `pip install -e ".[dev]"` resolved new dependencies without errors
- `python -c "from app.government_apis.rate_limiter import APIRateLimiter, bag_wfs_limiter, sru_limiter, brk_limiter"` imported cleanly
- `ruff check app/government_apis/ app/core/config.py` passed with no errors
- lxml version 6.0.1 and aiolimiter version 1.2.1 installed
- BRK_API_KEY field exists with empty string default

## Deviations from Plan

None - plan executed exactly as written.

## Task Breakdown

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Add lxml, aiolimiter deps + BRK config | fac7ee0 | pyproject.toml, config.py |
| 2 | Create per-API rate limiter module | 858d20a | rate_limiter.py |

## Next Steps

This plan provides the foundation for Phase 19 Wave 1. Next plans can now:
- Import `bag_wfs_limiter` / `sru_limiter` / `brk_limiter` for rate-limited API calls
- Use `lxml` for SRU XML parsing
- Reference `settings.BRK_API_KEY` and mTLS config fields in BRK client

Wave 1 dependencies are complete. Ready for 19-02 (BAG WFS client).

## Self-Check: PASSED

**Created files exist:**
- FOUND: backend/app/government_apis/rate_limiter.py

**Commits exist:**
- FOUND: fac7ee0
- FOUND: 858d20a

**Modified files contain expected content:**
- pyproject.toml contains "lxml>=5.3.0" and "aiolimiter>=1.2.0"
- config.py contains BRK_API_KEY, BRK_CLIENT_CERT_PATH, BRK_CLIENT_KEY_PATH, BRK_CA_BUNDLE_PATH
- rate_limiter.py contains APIRateLimiter class and three module-level instances
