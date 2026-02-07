# CRM Plus — Project State

## Project Reference

**Core Value:** Address → Property Intelligence Report
Enter any Dutch address and receive within minutes: kadaster data, zoning summary from bestemmingsplannen, monument/heritage status, key restrictions and opportunities.

**Current Focus:** Milestone 1 — Core Intelligence Engine (14 requirements)

---

## Current Position

**Phase:** 2 of 5 (Core Data Pipeline) — COMPLETE
**Plan:** 3 of 3 completed
**Status:** Phase complete

**Progress:** [██████░░░░░░░░░░░░░░] 6/15 plans complete (40%)

**Last Activity:** 2026-02-07 — Completed 02-03-PLAN.md (Property Aggregator & Endpoint)

**Next Action:** Begin Phase 3 planning (Zoning & Monument Intelligence)

---

## Performance Metrics

| Metric | Value |
|--------|-------|
| Total Requirements (M1) | 14 |
| Requirements Completed | 4 (INFRA-01, INFRA-02, DATA-01, DATA-02) |
| Phases Completed | 2/5 |
| Plans Completed | 6/15 (estimated) |
| Days Since Start | 2 |

---

## Accumulated Context

### Key Decisions

| ID | Decision | Phase-Plan | Rationale |
|----|----------|------------|-----------|
| 1 | Multi-tenant from day one | Planning | Architecture supports single-tenant MVP while enabling SaaS expansion (organization_id on all queries) |
| 2 | API-first with AI fallback | Planning | Government APIs for structured data; Claude API for bestemmingsplan PDFs when API insufficient |
| 3 | Async AI processing | Planning | LLM document parsing runs in background jobs (10-30s) to avoid HTTP timeouts |
| 4 | Source-specific cache TTLs | Planning | BAG: 24h, Kadaster: 7d, bestemmingsplan: 90d based on data volatility |
| 5 | Confidence scoring mandatory | Planning | All AI-parsed data shows LOW/MEDIUM/HIGH confidence to prevent €500k+ investment mistakes |
| 6 | Composite indexes with organization_id first | 01-01 | PostgreSQL query planner can efficiently use indexes for tenant-filtered queries |
| 7 | RLS as defense-in-depth | 01-01 | Primary: app filtering; Secondary: RLS catches bugs; Prepares for production app_role enforcement |
| 8 | SQLAlchemy 2.x mapped_column syntax | 01-01 | Modern best practices, better type inference for mypy, cleaner code |
| 9 | CORS_ORIGINS as comma-separated string | 01-01 | Avoids pydantic-settings JSON parsing errors with empty .env values |
| 10 | PyJWT with explicit algorithms | 01-02 | Prevents algorithm confusion attacks; PyJWT is industry standard vs python-jose |
| 11 | pwdlib with Argon2id | 01-02 | Memory-hard hashing resistant to GPU attacks; modern best practice vs bcrypt |
| 12 | Single-use refresh token rotation | 01-02 | Old token revoked on refresh; reuse detection triggers full account revocation |
| 13 | Naive datetimes for PostgreSQL | 01-02 | Database columns are TIMESTAMP WITHOUT TIME ZONE; timezone-aware causes errors |
| 14 | Tenant context middleware | 01-02 | Extract organization_id from JWT once per request; silent failure for public endpoints |
| 15 | JWT-based email verification/reset | 01-03 | No DB storage for verification/reset tokens; self-contained JWT with expiry; simplifies implementation |
| 16 | Password reset always returns 200 | 01-03 | Prevents user enumeration attacks; security best practice |
| 17 | Google OAuth no auto-linking | 01-03 | Email conflict returns 400; prevents account takeover via OAuth for MVP |
| 18 | Rate limiting in-memory for MVP | 01-03 | No Redis dependency for development; can switch to Redis backend later |
| 19 | Email sending graceful fallback | 01-03 | Logs URLs to console in dev; no SMTP server required for local development |
| 20 | FastAPI lifespan for shared resources | 02-01 | Modern pattern replaces startup/shutdown events; ensures proper cleanup |
| 21 | PostgreSQL JSONB cache over Redis | 02-01 | Reduces infrastructure complexity; leverages existing DB; cache survives restarts |
| 22 | Source-specific TTL per cache entry | 02-01 | Allows runtime tuning without code changes; supports different staleness per source |
| 23 | Explicit setuptools package discovery | 02-01 | Prevents build errors from multiple top-level folders (app, sql, alembic) |
| 24 | API clients receive httpx.AsyncClient as parameter | 02-02 | Ensures connection pooling works correctly; clients don't create their own httpx instances |
| 25 | BAG API calls cached individually (not aggregated) | 02-02 | Verblijfsobjecten and panden can be shared across addresses; caching each API call separately enables cross-address reuse |
| 26 | Graceful partial failure handling in address resolver | 02-02 | Returns address even if building lookup fails; better UX than complete failure |
| 27 | Dutch postcode normalized to '1234 AB' format | 02-02 | Consistent canonical format for storage and API calls; accepts both '1234AB' and '1234 AB' as input |
| 28 | Sequential address resolution then parallel fetch | 02-03 | Address must succeed before parallel building/parcel fetch; prevents wasted API calls and provides clear errors |
| 29 | Completeness score as fraction | 02-03 | sections_available / total_sections provides transparency about partial data without failing request |
| 30 | Source attribution with cache metadata | 02-03 | Each API tracked with source, cache timestamp, age; enables frontend to show freshness |
| 31 | B008 ruff ignore for FastAPI Depends | 02-03 | Standard dependency injection pattern; false positive from flake8-bugbear |

### Active TODOs

- [x] ~~Start Phase 1: Foundation & Authentication planning~~ (completed 01-01)
- [x] ~~Implement authentication endpoints (01-02)~~ (completed 01-02)
- [x] ~~Implement email verification (01-03)~~ (completed 01-03)
- [x] ~~Begin Phase 2 planning (Address Intelligence)~~ (completed 02-RESEARCH)
- [x] ~~Implement HTTP client and cache infrastructure (02-01)~~ (completed 02-01)
- [x] ~~Implement BAG API client (02-02)~~ (completed 02-02)
- [x] ~~Implement property aggregator and endpoints (02-03)~~ (completed 02-03)
- [ ] Begin Phase 3 planning (Zoning & Monument Intelligence)
- [ ] Test Claude API with real bestemmingsplan PDFs during Phase 4 planning

### Blockers

(None)

### Recent Wins

- **Phase 2 Complete (2026-02-07):** Full property data pipeline with parallel API fetching, completeness scoring, and authenticated endpoints
- **02-03 Property Aggregator (2026-02-07):** Property lookup endpoint with asyncio.gather parallel fetch, completeness scoring, 3-minute execution
- **02-02 Government API Clients (2026-02-07):** BAG and PDOK clients with Dutch postcode validation, hierarchical address resolution, per-call caching, 2-minute execution
- **02-01 HTTP Client & Cache (2026-02-07):** Shared httpx AsyncClient with HTTP/2, PostgreSQL JSONB cache with TTL-based invalidation, 3-minute execution
- **Phase 1 Complete (2026-02-07):** Full authentication system with email verification, password reset, Google OAuth, and rate limiting

---

## Session Continuity

**Last Session:** 2026-02-07 — Executed 02-03-PLAN.md
**Stopped At:** Completed 02-03 (Property Aggregator & Endpoint) — Phase 2 complete
**Resume File:** None

**What Was Accomplished:**
- PDOK Cadastral OGC API client for parcel lookup by bbox/point coordinates
- Property aggregator with asyncio.gather for parallel building + cadastral fetch
- PropertyLookupResponse schema with completeness score and source attribution
- DataSourceInfo for cache metadata tracking per API source
- POST /api/properties/lookup endpoint (authenticated, rate-limited 30/min)
- GET /api/properties/suggest endpoint for address autocomplete (60/min)
- Graceful partial failure handling with error collection
- All verifications passed, 2 atomic commits created (826dd5a, 769913a)
- Execution time: 3 minutes

**Context for Next Session:**
- **Phase 2 Complete:** Full property data pipeline operational
- **Parallel Fetching Pattern:** asyncio.gather(return_exceptions=True) for partial failure tolerance
- **Completeness Scoring:** Transparent about partial data (address/building/parcels)
- **Source Attribution:** Each API tracked with cache freshness metadata
- **Coordinates Available:** Building geometry provides coordinates for spatial lookups
- **Cadastral IDs Available:** Parcel IDs ready for ownership/monument queries
- **Next:** Plan Phase 3 (Zoning & Monument Intelligence)
- Will leverage existing coordinates for bestemmingsplan spatial queries
- Cache infrastructure ready for PDF document storage
- Error collection pattern ready for AI confidence scores

---

*Last updated: 2026-02-07T04:26:52Z*
