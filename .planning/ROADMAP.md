# CRM Plus — Roadmap

## Milestones

- ACTIVE **v1.1 Production Hardening** — Phases 6-10 (started 2026-02-07)
- SHIPPED **v1.0 Core Intelligence Engine** — Phases 1-5 (shipped 2026-02-07)

## Active

### v1.1 Production Hardening

Stabilize the v1.0 backend with comprehensive test coverage, enforce row-level security properly, and clean up configuration debt — making the codebase production-ready before building the frontend.

#### Phase 6: Security & Configuration
**Goal:** Database connection enforces RLS with app_role and configuration is cleaned up

**Requirements:** SEC-01, CFG-01, CFG-02

**Dependencies:** None (changes foundation for all future testing)

**Plans:** 3 plans

Plans:
- [ ] 06-01-PLAN.md -- Config consolidation, settings hardening, audit logging
- [ ] 06-02-PLAN.md -- Per-organization freshness threshold
- [ ] 06-03-PLAN.md -- RLS enforcement with app_role and fail-closed policies

**Success Criteria:**
1. Database connection uses app_role (not superuser) and RLS policies actively prevent cross-organization data access
2. Single .env file exists only in backend/ with all config loading from that location
3. Organization can configure custom freshness threshold (not hardcoded 24h) and cache respects this value

#### Phase 7: Test Infrastructure & Auth Testing
**Goal:** Auth module has comprehensive test coverage and Phase 1 is formally verified

**Requirements:** TEST-01, TEST-02, DOC-01

**Dependencies:** Phase 6 (tests need RLS-enforced connection)

**Success Criteria:**
1. Auth registration, login, token refresh, and password reset have passing unit tests covering success and error cases
2. Auth integration tests verify full request flows (registration → login → authenticated call → logout) against the database
3. Phase 1 has VERIFICATION.md confirming all original requirements (JWT auth, multi-tenant RLS, email verification, Google OAuth, rate limiting) were met

#### Phase 8: Data Pipeline Testing
**Goal:** API clients and cache manager have comprehensive test coverage

**Requirements:** TEST-03, TEST-04

**Dependencies:** Phase 7 (test infrastructure patterns established)

**Success Criteria:**
1. BAG, PDOK, DSO, and RCE client modules have unit tests with mocked httpx responses covering successful calls, HTTP errors, and malformed data
2. Cache manager integration tests verify JSONB cache read/write, TTL expiration, and invalidation against the database
3. Cache tests confirm organization_id isolation (no cross-tenant cache leaks)

#### Phase 9: Intelligence Testing
**Goal:** Aggregators and AI parsing have comprehensive test coverage with ARQ lifecycle integrated

**Requirements:** TEST-05, TEST-06, TEST-07, INFRA-01

**Dependencies:** Phase 8 (API clients tested)

**Success Criteria:**
1. Zoning and monument aggregators have unit tests covering data transformation, spatial intersection logic, and error handling
2. Aggregator integration tests verify full flows (API call → cache check → aggregation → response schema)
3. AI document parsing module has unit tests for Claude API client and PDF processing with mocked responses
4. ARQ worker pool starts with application startup and shuts down cleanly on application shutdown

#### Phase 10: Report & Multi-Tenant Testing
**Goal:** Report management and PDF export have comprehensive test coverage with verified multi-tenant isolation

**Requirements:** TEST-08, TEST-09, TEST-10

**Dependencies:** Phase 9 (all core modules tested)

**Success Criteria:**
1. Report CRUD operations have integration tests covering save, list, search, and delete against the database
2. PDF export unit tests verify template rendering produces valid HTML and WeasyPrint generates valid PDF output
3. Multi-tenant integration tests confirm cross-organization data leaks are impossible (auth tokens, reports, cache, API calls)
4. All test suites pass with 80%+ coverage of backend modules

---

## Shipped

<details>
<summary>v1.0 Core Intelligence Engine (Phases 1-5) — SHIPPED 2026-02-07</summary>

- [x] Phase 1: Foundation & Authentication (3/3 plans) — JWT auth, multi-tenant RLS, email verification, Google OAuth, rate limiting
- [x] Phase 2: Core Data Pipeline (3/3 plans) — httpx client, JSONB cache, BAG/PDOK APIs, property aggregator
- [x] Phase 3: Zoning & Monument Intelligence (4/4 plans) — DSO zoning, RCE monuments, spatial intersection, PropertyReportResponse
- [x] Phase 4: AI Document Parsing (4/4 plans) — Claude PDF parsing, ARQ worker, job polling, upload fallback
- [x] Phase 5: Report Management (3/3 plans) — Save/list/search, project folders, PDF export, freshness detection

**17 plans, 14 requirements, 8,281 LOC Python**
**Archive:** `.planning/milestones/v1.0-ROADMAP.md`

</details>

---

## Progress

| Phase | Name | Requirements | Plans | Status |
|-------|------|--------------|-------|--------|
| 6 | Security & Configuration | 3 | 3 plans (2 waves) | Planned |
| 7 | Test Infrastructure & Auth Testing | 3 | Pending | Blocked by Phase 6 |
| 8 | Data Pipeline Testing | 2 | Pending | Blocked by Phase 7 |
| 9 | Intelligence Testing | 4 | Pending | Blocked by Phase 8 |
| 10 | Report & Multi-Tenant Testing | 3 | Pending | Blocked by Phase 9 |

**Total:** 15 requirements across 5 phases

---

*Last updated: 2026-02-07 (Phase 6 planned — 3 plans in 2 waves)*
