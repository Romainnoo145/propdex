# Project Milestones: Propdex

## v1.1 Production Hardening (Shipped: 2026-02-08)

**Delivered:** Comprehensive test suite (275 tests), row-level security enforcement, and configuration cleanup — making the v1.0 backend production-ready with verified multi-tenant isolation at every layer.

**Phases completed:** 6-12 (19 plans total)

**Key accomplishments:**
- 275-test automated suite covering all 5 backend modules (104 unit + 171 integration), 74% overall coverage with all core business logic >80%
- Row-level security enforcement with fail-closed NULLIF policies on all 7 tenant tables, app_role deployment ready
- Multi-tenant isolation verified at 4 layers (HTTP, service, cache, database) with 11 dedicated tests
- Configuration cleanup: single .env, per-org freshness thresholds, production .env.example
- 4 complete E2E flows tested: address-to-report, report-to-PDF, auth lifecycle, multi-tenant isolation
- Formal verification of all 7 phases with evidence-based VERIFICATION.md documents

**Stats:**
- 123 files created/modified
- 15,947 lines of Python (7,060 in tests)
- 7 phases, 19 plans, 71 commits
- 2 days from v1.0 to v1.1

**Git range:** `9933395` (docs: start milestone v1.1) → `ce97eac` (docs(12): complete phase documentation)

**What's next:** v2.0 Frontend — SvelteKit dashboard with address lookup, interactive maps, and report management UI

---

## v1.0 Core Intelligence Engine (Shipped: 2026-02-07)

**Delivered:** Backend API for instant Dutch property intelligence — enter any address, get kadaster data, zoning rules, monument status, and AI-parsed bestemmingsplan data in one parallel request.

**Phases completed:** 1-5 (17 plans total)

**Key accomplishments:**
- Multi-tenant authentication with JWT refresh rotation, Argon2id, email verification, Google OAuth, and rate limiting
- Dutch government API integration (PDOK, BAG, DSO, RCE) with parallel fetching via asyncio.gather
- Intelligent PostgreSQL JSONB caching with source-specific TTLs, force refresh, and freshness detection
- AI bestemmingsplan parsing via Claude API with confidence scoring, async ARQ worker, and progress polling
- Report management with save/list/search, project folders, professional PDF export via WeasyPrint
- Complete property intelligence pipeline: address resolution → parallel data aggregation → report generation

**Stats:**
- 139 files created/modified
- 8,281 lines of Python
- 5 phases, 17 plans, 79 commits
- 1 day from start to ship

**Git range:** `af14fd7` (docs: initialize project) → `c1a702e` (docs: complete Report Management phase)

**What's next:** v1.1 Production Hardening (tests, RLS, config cleanup)

---
