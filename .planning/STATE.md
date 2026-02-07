# CRM Plus — Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-07)

**Core Value:** Address → Property Intelligence Report
**Current Focus:** v1.1 Production Hardening

---

## Current Position

**Milestone:** v1.1 Production Hardening
**Phase:** Phase 9 - Intelligence Testing
**Plan:** 1/3 complete
**Status:** In progress

**Progress:** █████████░░░░░░░░░░░ 60% (9/15 requirements)

**Next Action:** Execute 09-02-PLAN.md (Claude AI parsing tests)

---

## Performance Metrics

**v1.0 Shipped:** 2026-02-07
- 5 phases, 17 plans, 14 requirements
- 8,281 LOC Python backend
- FastAPI + SQLAlchemy 2.x + PostgreSQL + Claude API

**v1.1 Roadmap:**
- 5 phases, 15 requirements (tech debt / stabilization)
- Phases 6-10 (continues from v1.0)

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
- **07-01 (TEST-03):** Automatic test database (crmplus_test) creation in conftest.py fixture
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

### Active TODOs

- [x] Plan 06-01: Configuration Hardening (COMPLETE)
- [x] Plan 06-02: Configurable Freshness Threshold (COMPLETE)
- [x] Plan 06-03: RLS Enforcement (COMPLETE)
- [x] Phase 6 COMPLETE
- [x] Plan 07-01: Test Infrastructure Setup (COMPLETE)
- [x] Plan 07-02: Auth Integration Tests (COMPLETE)
- [x] Phase 7 COMPLETE - Ready for Phase 8
- [x] Plan 08-01: API Client Unit Tests (COMPLETE)
- [x] Plan 08-02: Cache Manager Integration Tests (COMPLETE)
- [x] Phase 8 COMPLETE - Ready for Phase 9
- [x] Plan 09-01: Aggregator Unit Tests (COMPLETE)
- [ ] Plan 09-02: Claude AI Parsing Tests (IN PROGRESS)
- [ ] Plan 09-03: Aggregator Integration Tests (PENDING)
- [ ] Frontend integration (deferred to v2.0)
- [ ] Test Claude API with real bestemmingsplan PDFs (integration testing in Phase 9)
- [ ] Production deployment: Create app_role and switch to RLS-enforced credentials

### Blockers

(None)

### Recent Wins

- **Plan 09-01 COMPLETE (2026-02-07):** Aggregator unit tests — 42 new tests (28 zoning + 14 monument), spatial filtering, Dutch field variants, multi-source consensus
- **PHASE 8 COMPLETE (2026-02-07):** Data Pipeline Testing — 83 new tests (63 API client unit + 20 cache integration), 134 total tests passing
- **Plan 08-02 COMPLETE (2026-02-07):** Cache manager integration tests — 20 tests: CRUD, TTL expiration, force refresh, invalidation, 3 multi-tenant isolation tests
- **Plan 08-01 COMPLETE (2026-02-07):** API client unit tests — 63 tests across 5 clients (BAG, PDOK Locatieserver, PDOK Cadastral, DSO, RCE) with shared mock helpers
- **PHASE 7 COMPLETE (2026-02-07):** Test Infrastructure & Auth Testing — 51 total tests (20 unit + 31 integration), pytest async support, full auth lifecycle coverage
- **Plan 07-01 COMPLETE (2026-02-07):** Test infrastructure with 20 passing auth unit tests, Phase 1 verification document
- **Plan 06-03 COMPLETE (2026-02-07):** RLS enforcement — fail-closed policies on all 7 tenant tables, SET LOCAL context, app_role separation

---

## Session Continuity

**Last Session:** 2026-02-07 — Plan 09-01 execution complete
**Stopped At:** Completed 09-01-PLAN.md (Aggregator Unit Tests)
**Resume File:** None

---

*Last updated: 2026-02-07 (Plan 09-01 complete — TEST-05 requirement satisfied, 42 new tests, 176 total tests passing)*
