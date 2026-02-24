---
phase: 53-api-clients
plan: 03
subsystem: testing
tags: [pytest, unit-tests, ep-online, woz, rce, json-ld, httpx, government-apis]

# Dependency graph
requires:
  - phase: 53-01
    provides: EPOnlineClient, WOZWaardeloketClient implementations
  - phase: 53-02
    provides: RCELinkedDataClient implementation with JSON-LD parsing

provides:
  - EP-Online client unit tests (7 cases: configured/unconfigured/404/500/list/empty-list)
  - WOZ Waardeloket client unit tests (6 cases: success/low-confidence/404/unexpected-format/500/sort)
  - RCE Linked Data client unit tests (9 cases: full-fetch/namespace-parsing/uri-label/not-found/500/graceful-degrade/register-url/bouwperiode/empty-graph)

affects: [53-04, 53-05, phase-54]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "URL-dispatch mock helper (_make_http_client_with_url_dispatch) for multi-step async fetch clients"
    - "MagicMock with json.return_value=[] for empty list responses (api_mocks.py uses 'or {}' coercion)"
    - "Rate limiter disable fixture: set limiter.enabled=False, restore after yield"

key-files:
  created:
    - backend/tests/unit/test_ep_online.py
    - backend/tests/unit/test_woz_waardeloket.py
    - backend/tests/unit/test_rce_linked_data.py
  modified: []

key-decisions:
  - "MagicMock with explicit json.return_value=[] bypasses api_mocks.py 'json_data or {}' coercion for empty-list test"
  - "URL-dispatch mock pattern chosen over side_effect list for RCE multi-step tests — cleaner URL-based routing"
  - "test_parses_jsonld_namespace_keys is a behavioral test (omschrijving proves CHN extraction worked) not just a parsing test"

patterns-established:
  - "URL-dispatch mock helper: create AsyncMock.get with side_effect that routes by URL substring — use for any multi-step HTTP clients"
  - "Empty collection mock: MagicMock(spec=httpx.Response) with json.return_value=[] when api_mocks make_mock_response would coerce"

requirements-completed: [NRG-01, NRG-03, WOZ-01, WOZ-04, RCE-01, RCE-03, RCE-04]

# Metrics
duration: 15min
completed: 2026-02-24
---

# Phase 53 Plan 03: API Client Unit Tests Summary

**22 unit tests across EP-Online, WOZ Waardeloket, and RCE Linked Data clients verifying three-state contract, field mapping, JSON-LD namespace parsing, and graceful degradation**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-02-24T05:10:00Z
- **Completed:** 2026-02-24T05:25:00Z
- **Tasks:** 2/2
- **Files modified:** 3 created

## Accomplishments

- 7 EP-Online tests: configured/unconfigured guard, 404->not-registered (NRG-03), 500->error, list/empty-list parse
- 6 WOZ tests: success, low_confidence=True always (WOZ-04), 404->None, unexpected format->error, 500->error, most-recent sorting
- 9 RCE tests: full three-step fetch, JSON-LD namespace URI key parsing, URI-to-label resolution, not-found->None, 500->error, dereference graceful degradation, register URL construction, bouwperiode extraction, empty graph->None

## Task Commits

Each task was committed atomically:

1. **Task 1: EP-Online and WOZ client unit tests** - `fc0a280` (feat)
2. **Task 2: RCE Linked Data client unit tests** - `40342cf` (feat)

## Files Created/Modified

- `backend/tests/unit/test_ep_online.py` - 7 tests for EPOnlineClient, covering all three-state branches
- `backend/tests/unit/test_woz_waardeloket.py` - 6 tests for WOZWaardeloketClient including WOZ-04 low_confidence verification
- `backend/tests/unit/test_rce_linked_data.py` - 9 tests for RCELinkedDataClient, URL-dispatch mock for multi-step fetch

## Decisions Made

- **URL-dispatch mock pattern** for RCE tests: `_make_http_client_with_url_dispatch` routes `client.get()` calls by URL substring — cleaner than `side_effect` list (positional-only), handles arbitrary call order
- **Empty list mock workaround**: `api_mocks.make_mock_response` uses `json_data or {}` which coerces `[]` to `{}`. Used raw `MagicMock(spec=httpx.Response)` with `json.return_value=[]` for the empty list test case
- **Behavioral namespace test**: `test_parses_jsonld_namespace_keys` proves CHN extraction via observable side effect (omschrijving present) rather than inspecting internal state

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Empty list response mock coercion in api_mocks.py**
- **Found during:** Task 1 (EP-Online tests)
- **Issue:** `make_mock_response(200, json_data=[])` returns `{}` due to `json_data or {}` in api_mocks.py — empty list test returned wrong result
- **Fix:** Used direct `MagicMock(spec=httpx.Response)` with explicit `json.return_value = []` for the empty-list test case only; did not modify shared `api_mocks.py`
- **Files modified:** backend/tests/unit/test_ep_online.py
- **Verification:** `test_parse_handles_empty_list_response` now passes and asserts `is_geregistreerd=False`
- **Committed in:** fc0a280 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - test correctness bug)
**Impact on plan:** Minor — empty list edge case required custom mock instead of shared helper. No scope creep.

## Issues Encountered

- `ruff check` caught unused `patch` import in `test_rce_linked_data.py` — removed before commit. Zero ruff errors on all three files.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All three client unit tests complete — EP-Online, WOZ, and RCE all verified with 22 passing tests
- Phase 53 Wave 2 complete; ready for Phase 54 integration (wiring clients into report enrichment pipeline)
- Rate limiter disable pattern and URL-dispatch mock helper established for future client test files

## Self-Check: PASSED

- FOUND: backend/tests/unit/test_ep_online.py
- FOUND: backend/tests/unit/test_woz_waardeloket.py
- FOUND: backend/tests/unit/test_rce_linked_data.py
- FOUND: commit fc0a280 (Task 1)
- FOUND: commit 40342cf (Task 2)

---
*Phase: 53-api-clients*
*Completed: 2026-02-24*
