---
phase: 74-3dbag-building-data
plan: "01"
subsystem: backend/government_apis
tags: [3dbag, api-client, rate-limiter, unit-tests, building-height, bouwlagen]
dependency_graph:
  requires: []
  provides: [BAG3DClient, bag_3d_client, bag_3d_limiter, BAG_3D settings]
  affects: [future-74-02-aggregator-integration]
tech_stack:
  added: []
  patterns: [OGC-API-Features-pagination, HTTP-Basic-Auth-optional, sanity-bounds-validation]
key_files:
  created:
    - backend/app/government_apis/bag_3d.py
    - backend/tests/unit/test_bag_3d.py
  modified:
    - backend/app/government_apis/rate_limiter.py
    - backend/app/core/config.py
decisions:
  - "Lambda closure B023 fix: use default arg `lambda kw=kwargs: client.get(...)` to bind loop variable"
  - "Auth optional: skip auth kwarg entirely when both BAG_3D_USERNAME and BAG_3D_PASSWORD are empty strings"
  - "Pagination sentinel: stop when len(features) < _PAGE_SIZE (1000), not when features == []"
metrics:
  duration: "~3 minutes"
  completed: "2026-03-03"
  tasks: 2
  files_created: 2
  files_modified: 2
---

# Phase 74 Plan 01: 3D BAG API Client Summary

**One-liner:** OGC API Features client for TU Delft 3D BAG with bbox pagination, HTTP Basic Auth, sanity bounds on height (1.5-200m) and bouwlagen (1-100), and 7 GREEN unit tests.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | BAG3DClient + rate limiter + config entries | 3653cc7 | bag_3d.py, rate_limiter.py, config.py |
| 2 | Unit tests for BAG3DClient | 65e3176 | tests/unit/test_bag_3d.py |

## What Was Built

### bag_3d.py — BAG3DClient

OGC API Features client for the TU Delft 3D BAG dataset. Key behaviors:

- `get_panden_in_bbox(minx, miny, maxx, maxy, client)` — bbox query in EPSG:28992
- Returns `dict[str, dict]` keyed by BAG pand identificatie (e.g. "NL.IMBAG.Pand....")
- Each value: `{"actual_bouwhoogte": float | None, "actual_bouwlagen": int | None}`
- Height computed as `b3_h_dak_50p - b3_h_maaiveld`, rounded to 1 decimal
- Sanity bounds: height 1.5-200m, bouwlagen 1-100 (out-of-bounds -> None)
- Pagination: while loop with offset, stops when `len(features) < 1000`
- HTTP Basic Auth: optional (skipped if both credentials empty — supports unauthenticated dev access)
- Rate limited via `bag_3d_limiter` (max_concurrent=2, max_per_hour=200)
- Module-level singleton: `bag_3d_client = BAG3DClient()`

### rate_limiter.py — bag_3d_limiter

Added `bag_3d_limiter = APIRateLimiter(max_concurrent=2, max_per_hour=200)` — conservative limits for authenticated TU Delft API.

### config.py — Settings + CACHE_TTL

- `BAG_3D_USERNAME: str = ""` (register at 3dbag.nl)
- `BAG_3D_PASSWORD: str = ""` (register at 3dbag.nl)
- `CACHE_TTL["bag_3d"] = 604800` (7 days — 3D BAG updated quarterly)

### Unit Tests — 7 GREEN

1. `test_single_page_response` — 3 features parsed with correct pand IDs, heights, floor counts
2. `test_pagination` — 1000+500 features across 2 pages, all 1500 in result dict
3. `test_height_sanity_bounds` — <1.5m and >200m return None; 12.5m and 1.5m pass through
4. `test_bouwlagen_sanity_bounds` — 0 and 101 return None; 3.6 rounds to 4; 1 passes through
5. `test_missing_maaiveld_yields_none` — dak present but no maaiveld -> bouwhoogte is None
6. `test_401_raises_government_api_error` — 401 raises GovernmentAPIError with auth message
7. `test_empty_bbox_returns_empty_dict` — empty FeatureCollection returns `{}`

## Decisions Made

1. **Lambda closure fix (B023):** ruff flagged `lambda: client.get(BASE_URL, **kwargs)` inside while loop as B023 (function does not bind loop variable). Fixed with default arg: `lambda kw=kwargs: client.get(BASE_URL, **kw)`. This is the correct pattern — avoids late binding.

2. **Auth optional:** When both `BAG_3D_USERNAME` and `BAG_3D_PASSWORD` are empty strings, the `auth` kwarg is omitted entirely from the `client.get()` call. This allows unauthenticated local testing before credentials are obtained.

3. **Pagination sentinel:** Stop condition is `len(features) < _PAGE_SIZE` (1000). If exactly 1000 features are returned, we assume there may be more and fetch the next page. This matches OGC API Features conventions.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed lambda loop variable closure (B023)**
- **Found during:** Task 1 ruff check
- **Issue:** `lambda: client.get(BASE_URL, **kwargs)` inside while loop — kwargs is a loop variable, ruff B023 flagged it
- **Fix:** Changed to `lambda kw=kwargs: client.get(BASE_URL, **kw)` to bind the value at lambda creation time
- **Files modified:** backend/app/government_apis/bag_3d.py
- **Commit:** 3653cc7 (included in Task 1 commit)

**2. [Rule 2 - Auto-fix] Fixed import ordering in test file**
- **Found during:** Task 2 ruff check
- **Issue:** Import block unsorted (I001) — `from __future__ import annotations` mixed with stdlib/third-party/local imports
- **Fix:** `ruff check --fix` auto-sorted imports
- **Files modified:** backend/tests/unit/test_bag_3d.py
- **Commit:** 65e3176 (included in Task 2 commit)

## Self-Check: PASSED

All files found:
- FOUND: backend/app/government_apis/bag_3d.py
- FOUND: backend/tests/unit/test_bag_3d.py
- FOUND: .planning/phases/74-3dbag-building-data/74-01-SUMMARY.md

All commits found:
- FOUND: 3653cc7 (feat(74-01): BAG3DClient + rate limiter + config entries)
- FOUND: 65e3176 (test(74-01): 7 unit tests for BAG3DClient)
