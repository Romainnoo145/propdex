# CRM Plus — Project State

## Project Reference

**Core Value:** Address → Property Intelligence Report
Enter any Dutch address and receive within minutes: kadaster data, zoning summary from bestemmingsplannen, monument/heritage status, key restrictions and opportunities.

**Current Focus:** Milestone 1 — Core Intelligence Engine (14 requirements)

---

## Current Position

**Phase:** 2 of 5 (Core Data Pipeline)
**Plan:** 02-01 of 3 completed
**Status:** In progress

**Progress:** [████░░░░░░░░░░░░░░░░] 4/15 plans complete (27%)

**Last Activity:** 2026-02-07 — Completed 02-01-PLAN.md (HTTP client and cache infrastructure)

**Next Action:** Execute 02-02 (BAG API Client)

---

## Performance Metrics

| Metric | Value |
|--------|-------|
| Total Requirements (M1) | 14 |
| Requirements Completed | 2 (INFRA-01, INFRA-02) |
| Phases Completed | 1/5 |
| Plans Completed | 4/15 (estimated) |
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

### Active TODOs

- [x] ~~Start Phase 1: Foundation & Authentication planning~~ (completed 01-01)
- [x] ~~Implement authentication endpoints (01-02)~~ (completed 01-02)
- [x] ~~Implement email verification (01-03)~~ (completed 01-03)
- [x] ~~Begin Phase 2 planning (Address Intelligence)~~ (completed 02-RESEARCH)
- [x] ~~Implement HTTP client and cache infrastructure (02-01)~~ (completed 02-01)
- [ ] Implement BAG API client (02-02)
- [ ] Implement Kadaster API client (02-03)
- [ ] Test Claude API with real bestemmingsplan PDFs during Phase 4 planning

### Blockers

(None)

### Recent Wins

- **02-01 HTTP Client & Cache (2026-02-07):** Shared httpx AsyncClient with HTTP/2, PostgreSQL JSONB cache with TTL-based invalidation, 3-minute execution
- **Phase 1 Complete (2026-02-07):** Full authentication system with email verification, password reset, Google OAuth, and rate limiting
- **01-03 Email Verification (2026-02-07):** JWT-based email verification/reset, Google OAuth, rate limiting on all endpoints
- **01-02 Authentication Endpoints (2026-02-06):** JWT auth with refresh rotation, Argon2id password hashing, tenant context middleware
- **01-01 Backend Foundation (2026-02-06):** FastAPI + async PostgreSQL + multi-tenant models with RLS policies

---

## Session Continuity

**Last Session:** 2026-02-07 — Executed 02-01-PLAN.md
**Stopped At:** Completed 02-01 (HTTP client and cache infrastructure)
**Resume File:** None

**What Was Accomplished:**
- Shared httpx AsyncClient via FastAPI lifespan (connection pooling, HTTP/2)
- CachedAPIResponse model with JSONB storage and TTL metadata
- Cache manager service with get_cached_or_fetch() and invalidate_cache()
- BAG_API_KEY configuration and CACHE_TTL constants
- Fixed setuptools package discovery error
- All verifications passed, 2 atomic commits created (4f2c5c6, 2208c48)
- Execution time: 3 minutes

**Context for Next Session:**
- **HTTP Infrastructure Ready:** Shared httpx client for all government API calls
- **Cache Layer Ready:** PostgreSQL JSONB cache with source-specific TTLs (bag: 24h, kadaster: 7d, bestemmingsplan: 90d)
- **Multi-tenant Isolation:** Cache queries filtered by organization_id
- **Pattern Established:** FastAPI lifespan for shared resources, direct db.add()/flush()/commit() transactions
- **Next:** Implement BAG API client (02-02) using new infrastructure
- BAG API endpoints researched in 02-RESEARCH.md
- Ready to integrate: address search, nummeraanduiding lookup, pand details

---

*Last updated: 2026-02-07T03:56:46Z*
