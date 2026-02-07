# CRM Plus — Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-07)

**Core Value:** Address → Property Intelligence Report
**Current Focus:** v1.1 Production Hardening

---

## Current Position

**Milestone:** v1.1 Production Hardening
**Phase:** Phase 7 - Test Infrastructure & Auth Testing
**Plan:** 2/2 complete — Phase 7 DONE
**Status:** Phase complete, verified ✓

**Progress:** ████░░░░░░░░░░░░░░░░ 33% (5/15 requirements)

**Next Action:** `/gsd:plan-phase 8`

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
- **07-01 (TEST-04):** Disable rate limiting in tests (override with 9999/minute limiter)
- **07-02 (TEST-05):** Function-scoped test_engine for Python 3.14 compatibility (pytest-asyncio 0.23.8)
- **07-02 (TEST-06):** Manual pg_trgm extension installation in test database
- **07-02 (TEST-07):** Parametrize login error tests to verify enumeration prevention
- **07-02 (TEST-08):** Manual JWT token creation for security edge case testing

### Active TODOs

- [x] Plan 06-01: Configuration Hardening (COMPLETE)
- [x] Plan 06-02: Configurable Freshness Threshold (COMPLETE)
- [x] Plan 06-03: RLS Enforcement (COMPLETE)
- [x] Phase 6 COMPLETE
- [x] Plan 07-01: Test Infrastructure Setup (COMPLETE)
- [x] Plan 07-02: Auth Integration Tests (COMPLETE)
- [x] Phase 7 COMPLETE - Ready for Phase 8
- [ ] Frontend integration (deferred to v2.0)
- [ ] Test Claude API with real bestemmingsplan PDFs (integration testing in Phase 9)
- [ ] Production deployment: Create app_role and switch to RLS-enforced credentials

### Blockers

(None)

### Recent Wins

- **Plan 07-02 COMPLETE (2026-02-07):** Auth integration tests — 31 tests (13 happy-path + 18 error/security), 63% auth coverage
- **PHASE 7 COMPLETE (2026-02-07):** Test Infrastructure & Auth Testing — 51 total tests (20 unit + 31 integration), pytest async support, full auth lifecycle coverage
- **Plan 07-01 COMPLETE (2026-02-07):** Test infrastructure with 20 passing auth unit tests, Phase 1 verification document
- **Plan 06-03 COMPLETE (2026-02-07):** RLS enforcement — fail-closed policies on all 7 tenant tables, SET LOCAL context, app_role separation
- **PHASE 6 COMPLETE (2026-02-07):** Security & Configuration — 3 plans (config hardening, configurable freshness, RLS enforcement)

---

## Session Continuity

**Last Session:** 2026-02-07 — Phase 7 execution complete
**Stopped At:** Completed 07-02-PLAN.md
**Resume File:** None

---

*Last updated: 2026-02-07 (Phase 7 complete — 2/2 plans, TEST-01 + TEST-02 requirements satisfied, 51 tests passing)*
