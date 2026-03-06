---
phase: 76-rechtspraak-jurisprudentie
plan: "01"
subsystem: backend-government-api
tags: [rechtspraak, jurisprudentie, omgevingsrecht, lxml, rate-limiter, ecli]
dependency_graph:
  requires: []
  provides: [rechtspraak-client, jurisprudence-endpoint]
  affects: [app-startup, jurisprudence-api]
tech_stack:
  added: []
  patterns: [lxml-xxe-safe-parser, api-rate-limiter-singleton, three-state-contract, request.app.state.http_client]
key_files:
  created:
    - backend/app/government_apis/exceptions.py
    - backend/app/api/__init__.py
    - backend/app/api/endpoints/__init__.py
  modified:
    - backend/app/government_apis/rechtspraak.py
    - backend/app/government_apis/rate_limiter.py
    - backend/app/api/endpoints/jurisprudence.py
decisions:
  - "Rewrite rechtspraak.py entirely (not patching) — rated 2-3/10 with stdlib XML, bare semaphore, wrong error signatures"
  - "Use lxml with resolve_entities=False, no_network=True for XXE protection matching sru_bekendmakingen.py pattern"
  - "Hardcode OMGEVINGSRECHT_URI subject filter — search is always scoped to omgevingsrecht per RECHT-01"
  - "Add return=DOC parameter — only fetch entries with available documents, prevents wasted lookups"
  - "ECLI validated via regex before any HTTP request — prevents malformed identifiers reaching upstream"
  - "exceptions.py as re-export shim from base.py — fixes startup blocker without touching existing callers"
metrics:
  duration: "~2min"
  tasks_completed: 2
  files_modified: 6
  completed_date: "2026-03-06"
---

# Phase 76 Plan 01: Rechtspraak Backend Rebuild Summary

Rebuilt Rechtspraak client from 2-3/10 to project standards: lxml XXE-safe parser, APIRateLimiter singleton, correct two-arg GovernmentAPIError signatures, ECLI regex validation, hardcoded omgevingsrecht subject filter, and fixed jurisprudence endpoint using request.app.state.http_client.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create exceptions.py shim and register rechtspraak_limiter | 961de20 | exceptions.py, rate_limiter.py, api/__init__.py, api/endpoints/__init__.py |
| 2 | Rebuild rechtspraak.py and fix jurisprudence endpoint | 8aa191b | rechtspraak.py, jurisprudence.py |

## What Was Built

### exceptions.py re-export shim
Created `backend/app/government_apis/exceptions.py` as a backward-compatibility re-export from `base.py`. This immediately fixes the startup blocker (ImportError on `GovernmentAPIError`, `APITimeoutError`) without touching any existing callers. Single file, 8 lines.

### rechtspraak_limiter singleton
Added `rechtspraak_limiter = APIRateLimiter(max_concurrent=3, max_per_hour=300)` to `rate_limiter.py`. Polite limits appropriate for the public Rechtspraak Open Data endpoint.

### Rebuilt rechtspraak.py
Full rewrite following `sru_bekendmakingen.py` pattern:
- **lxml XXE-safe parser**: `etree.XMLParser(resolve_entities=False, no_network=True, remove_comments=True)` at module level
- **ECLI validation**: `_ECLI_RE = re.compile(r'^ECLI:[A-Z]{2}:[A-Z0-9]{1,7}:\d{4}:[A-Z0-9.]{1,25}$')` with `validate_ecli()` exported
- **Omgevingsrecht filter**: `subject=OMGEVINGSRECHT_URI` hardcoded in search params per RECHT-01
- **return=DOC parameter**: Only results with available documents returned
- **Rate limiting**: `async with rechtspraak_limiter:` wraps all HTTP calls
- **retry_with_backoff**: Used for both search and document fetch
- **Three-state contract**: `dict | None | raise GovernmentAPIError` — no silent error dict returns
- **Two-arg error signatures**: All GovernmentAPIError/APITimeoutError calls use `(source, message)` form
- **Metadata extraction**: `etree.QName(elem.tag).localname` for namespace-agnostic element matching

### Fixed jurisprudence.py endpoint
- Removed broken `from app.api import deps` import
- Uses `from app.auth.dependencies import get_current_active_user` (project standard)
- Uses `request.app.state.http_client` for shared AsyncClient
- ECLI validated at endpoint level before calling client
- Returns 400 on invalid ECLI, 404 on not found, 502 on GovernmentAPIError

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] ruff B904 violations in jurisprudence.py**
- **Found during:** Task 2 verification
- **Issue:** `raise HTTPException(...)` inside `except` blocks missing `from exc` chains
- **Fix:** Added `from exc` to all HTTPException raises inside except handlers
- **Files modified:** backend/app/api/endpoints/jurisprudence.py
- **Commit:** 8aa191b (included in same commit)

## Verification Results

All checks passed:
- `from app.main import app` — App starts without ImportError
- `validate_ecli('ECLI:NL:RVS:2023:1234')` — returns True
- `validate_ecli('bad')` — returns False
- `OMGEVINGSRECHT_URI` — contains 'bestuursrecht_omgevingsrecht'
- `ruff check` — All checks passed on all modified files

## Self-Check: PASSED

Files verified:
- FOUND: backend/app/government_apis/exceptions.py
- FOUND: backend/app/government_apis/rechtspraak.py
- FOUND: backend/app/api/__init__.py
- FOUND: backend/app/api/endpoints/__init__.py
- FOUND: backend/app/api/endpoints/jurisprudence.py

Commits verified:
- FOUND: 961de20 (chore(76-01): create exceptions.py shim and register rechtspraak_limiter)
- FOUND: 8aa191b (feat(76-01): rebuild rechtspraak client and fix jurisprudence endpoint)
