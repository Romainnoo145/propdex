# Propdex — Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-07)

**Core Value:** Address → Property Intelligence Report
**Current Focus:** v1.1 Production Hardening

---

## Current Position

**Milestone:** v1.1 Production Hardening
**Phase:** Phase 11 - Coverage Gap Closure
**Plan:** 1/4 complete
**Status:** In progress

**Progress:** ████████████████░░░░ 15/15 requirements + 1/6 gap plans

**Next Action:** Continue Phase 11 (plans 02-04)

---

## Performance Metrics

**v1.0 Shipped:** 2026-02-07
- 5 phases, 17 plans, 14 requirements
- 8,281 LOC Python backend
- FastAPI + SQLAlchemy 2.x + PostgreSQL + Claude API

**v1.1 Roadmap:**
- 7 phases, 15 requirements + 2 gap closure phases (tech debt / stabilization)
- Phases 6-12 (continues from v1.0)

---

## Accumulated Context

### Key Decisions

See `.planning/PROJECT.md` Key Decisions table (11 decisions with outcomes).

Full decision log (98 decisions) archived in `.planning/milestones/v1.0-ROADMAP.md`.

**Phase 6 Decisions:**
- **06-01:** Use stdlib logging (not python-json-logger) for audit events to avoid new dependencies
- **06-01:** MIGRATION_DATABASE_URL falls back to DATABASE_URL when empty for dev simplicity
- **06-01:** Delete root .env to eliminate confusion about authoritative config source
- **06-01:** MIN_FRESHNESS_THRESHOLD_HOURS enforces minimum 1 hour to prevent API abuse
- **06-03:** Use SET LOCAL (not SET) to scope session variable to transaction (prevents context leakage)
- **06-03:** NULLIF fail-closed pattern instead of COALESCE fail-open for RLS policies
- **06-03:** FORCE ROW LEVEL SECURITY to enforce on table owner (critical for non-superuser enforcement)
- **06-03:** Separate migration_database_url (superuser) from DATABASE_URL (app_role) for security

**Phase 7 Decisions:**
- **07-01 (TEST-01):** Session-scoped event loop with function-scoped table drop/recreate for test isolation
- **07-01 (TEST-02):** Use httpx AsyncClient (not TestClient) for async FastAPI endpoint testing
- **07-01 (TEST-03):** Automatic test database (propdex_test) creation in conftest.py fixture
- **07-01 (TEST-04):** Disable rate limiting in tests via limiter.enabled=False (not replacement — decorators bind to module-level limiter)
- **07-02 (TEST-05):** Function-scoped test_engine for Python 3.14 compatibility (pytest-asyncio 0.23.8)
- **07-02 (TEST-06):** Manual pg_trgm extension installation in test database
- **07-02 (TEST-07):** Parametrize login error tests to verify enumeration prevention
- **07-02 (TEST-08):** Manual JWT token creation for security edge case testing

**Phase 8 Decisions:**
- **08-01 (TEST-03):** Shared mock helpers in tests/api_mocks.py (MagicMock(spec=httpx.Response) + AsyncMock(spec=httpx.AsyncClient))
- **08-01 (TEST-03):** No new test dependencies — unittest.mock only
- **08-02 (TEST-04):** Direct DB assertions for cache integration tests (not mock-based)
- **08-02 (TEST-04):** Manual fetched_at manipulation for TTL expiration tests

**Phase 9 Decisions:**
- **09-01 (TEST-05):** Test spatial filtering with real shapely Point/Polygon objects (not mocks) for geometry validation
- **09-01 (TEST-05):** Use pytest.mark.parametrize for 8 Dutch dimension field variants to ensure comprehensive mapping coverage
- **09-01 (TEST-05):** Patch internal _fetch_* functions (not external APIs) for monument aggregator unit tests to isolate aggregation logic
- **09-02 (TEST-07):** Use MagicMock (not real anthropic.types.Message) for Claude client tests to reduce SDK coupling
- **09-02 (INFRA-01):** Manual mock injection to app.state for ARQ lifecycle tests (avoids Redis requirement, verifies structure only)
- **09-03 (TEST-06):** Patch get_dso_client function (not instance) for zoning aggregator since it's called inside fetch closure
- **09-03 (TEST-06):** Patch _rce_client.query_by_location with new_callable=AsyncMock for proper async handling in monument tests
- **09-03 (TEST-06):** Real database for cache operations in aggregator integration tests (not mocked) following test_cache_manager.py pattern

**Phase 10 Decisions:**
- **10-01 (TEST-08):** Test data factory `_make_report_data()` generates PropertyReportResponse-compatible dicts with sensible defaults
- **10-01 (TEST-08):** Include both 'straat' and 'straatnaam' keys in address data (service accesses both from raw dict)
- **10-01 (TEST-08):** Direct DB assertions via SQLAlchemy select for CRUD verification (following test_cache_manager.py pattern)
- **10-02 (TEST-09):** Synchronous test functions (def, not async def) for CPU-bound WeasyPrint operations
- **10-02 (TEST-09):** Mock HTML class for fast template validation, real WeasyPrint execution for PDF generation tests
- **10-03 (TEST-10):** 404 (not 403) for cross-org access to prevent resource enumeration attacks
- **10-03 (TEST-10):** Automatic pg_trgm extension installation in conftest.py for SavedReport GIN index

**Phase 11 Decisions:**
- **11-01 (TEST-11):** Mock internal orchestration functions (resolve_address, fetch_zoning_data, fetch_monument_status, get_cached_or_fetch) rather than external httpx clients following Phase 9 pattern
- **11-01 (TEST-11):** Use arq_pool=None for all tests since AI parsing is tested separately in Phase 9
- **11-01 (TEST-11):** Accept database initialization race condition as pre-existing infrastructure issue (affects many test files, not specific to new tests)
- **11-03 (TEST-12):** Mock aggregate_property_data at router level (not aggregator internals) to test HTTP/auth/validation layer
- **11-03 (TEST-12):** Set app.state.http_client and app.state.arq_pool as mocks before tests (router accesses these directly)
- **11-03 (TEST-12):** Follow AsyncClient + JWT pattern from test_auth_flow.py for authenticated requests

### Active TODOs

- [x] v1.1 Production Hardening: ALL 15 REQUIREMENTS COMPLETE
- [x] Phase 6-10: All 13 plans executed
- [ ] Frontend integration (deferred to v2.0)
- [ ] Test Claude API with real bestemmingsplan PDFs (deferred)
- [ ] Production deployment: Create app_role and switch to RLS-enforced credentials

### Blockers

(None)

### Recent Wins

- **11-01 COMPLETE (2026-02-07):** Property aggregator integration tests — 10 tests covering orchestration flow, error handling (404/502), partial failures, coordinate extraction, completeness scoring
- **11-03 COMPLETE (2026-02-08):** Properties router HTTP endpoint tests — 8 tests covering auth, validation, success, error propagation
- **AUDIT COMPLETE (2026-02-08):** v1.1 milestone audited — 15/15 requirements, 12 tech debt items identified
- **GAP PHASES CREATED:** Phases 11-12 added to close coverage (67%→80%) and documentation gaps
- **v1.1 REQUIREMENTS COMPLETE:** All 15 requirements satisfied across 5 phases, 13 plans, 233 tests

---

## Session Continuity

**Last Session:** 2026-02-07 — Completed 11-01-PLAN.md
**Stopped At:** Completed 11-01-PLAN.md
**Resume File:** None

---

*Last updated: 2026-02-07 (Completed 11-01: Property aggregator integration tests)*
