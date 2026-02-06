# CRM Plus — Project State

## Project Reference

**Core Value:** Address → Property Intelligence Report
Enter any Dutch address and receive within minutes: kadaster data, zoning summary from bestemmingsplannen, monument/heritage status, key restrictions and opportunities.

**Current Focus:** Milestone 1 — Core Intelligence Engine (14 requirements)

---

## Current Position

**Phase:** 1 of 5 (Foundation & Authentication)
**Plan:** 01-02 of 3 completed
**Status:** In progress

**Progress:** [████░░░░░░░░░░░░░░░░] 1/5 phases complete (20%)

**Last Activity:** 2026-02-06 — Completed 01-02-PLAN.md (Authentication Endpoints)

**Next Action:** Execute 01-03 (Email Verification)

---

## Performance Metrics

| Metric | Value |
|--------|-------|
| Total Requirements (M1) | 14 |
| Requirements Completed | 0 |
| Phases Completed | 0/5 |
| Plans Completed | 2/15 (estimated) |
| Days Since Start | 1 |

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

### Active TODOs

- [x] ~~Start Phase 1: Foundation & Authentication planning~~ (completed 01-01)
- [x] ~~Implement authentication endpoints (01-02)~~ (completed 01-02)
- [ ] Implement email verification (01-03)
- [ ] Verify current PDOK/BAG API endpoints and rate limits during Phase 2 planning
- [ ] Test Claude API with real bestemmingsplan PDFs during Phase 4 planning

### Blockers

(None)

### Recent Wins

- **01-02 Authentication Endpoints (2026-02-06):** JWT auth with refresh rotation, Argon2id password hashing, tenant context middleware
- **01-01 Backend Foundation (2026-02-06):** FastAPI + async PostgreSQL + multi-tenant models with RLS policies
- Roadmap created with 100% requirement coverage (14/14)
- Research completed with stack recommendations (FastAPI + PostgreSQL + PostGIS + Claude API)

---

## Session Continuity

**Last Session:** 2026-02-06 — Executed 01-02-PLAN.md
**Stopped At:** Completed plan 01-02 (Authentication Endpoints)
**Resume File:** None

**What Was Accomplished:**
- JWT authentication with PyJWT (access + refresh token pair with rotation)
- Password hashing with pwdlib/Argon2id
- Auth endpoints: register, login, refresh, logout, me
- Tenant context middleware extracts organization_id from JWT
- Pydantic schemas for auth API
- FastAPI auth dependencies (get_current_user, get_current_active_user)
- All verifications passed, 2 atomic commits created

**Context for Next Session:**
- Full authentication system functional and tested
- Users can register (creates org + user), login, refresh tokens, logout
- Refresh token rotation with theft detection works
- 48-hour email verification grace period implemented
- Ready for email verification system (01-03)
- Next: Implement email sending with fastapi-mail and verification flow

---

*Last updated: 2026-02-06T18:48:13Z*
