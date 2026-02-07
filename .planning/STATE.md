# CRM Plus — Project State

## Project Reference

**Core Value:** Address → Property Intelligence Report
Enter any Dutch address and receive within minutes: kadaster data, zoning summary from bestemmingsplannen, monument/heritage status, key restrictions and opportunities.

**Current Focus:** Milestone 1 — Core Intelligence Engine (14 requirements)

---

## Current Position

**Phase:** 1 of 5 (Foundation & Authentication)
**Plan:** 01-03 of 3 completed
**Status:** Phase complete

**Progress:** [████░░░░░░░░░░░░░░░░] 1/5 phases complete (20%)

**Last Activity:** 2026-02-07 — Phase 1 verified (7/7 PASSED)

**Next Action:** Begin Phase 2 planning (Address Intelligence)

---

## Performance Metrics

| Metric | Value |
|--------|-------|
| Total Requirements (M1) | 14 |
| Requirements Completed | 2 (INFRA-01, INFRA-02) |
| Phases Completed | 1/5 |
| Plans Completed | 3/15 (estimated) |
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

### Active TODOs

- [x] ~~Start Phase 1: Foundation & Authentication planning~~ (completed 01-01)
- [x] ~~Implement authentication endpoints (01-02)~~ (completed 01-02)
- [x] ~~Implement email verification (01-03)~~ (completed 01-03)
- [ ] Begin Phase 2 planning (Address Intelligence)
- [ ] Verify current PDOK/BAG API endpoints and rate limits during Phase 2 planning
- [ ] Test Claude API with real bestemmingsplan PDFs during Phase 4 planning

### Blockers

(None)

### Recent Wins

- **Phase 1 Complete (2026-02-07):** Full authentication system with email verification, password reset, Google OAuth, and rate limiting
- **01-03 Email Verification (2026-02-07):** JWT-based email verification/reset, Google OAuth, rate limiting on all endpoints
- **01-02 Authentication Endpoints (2026-02-06):** JWT auth with refresh rotation, Argon2id password hashing, tenant context middleware
- **01-01 Backend Foundation (2026-02-06):** FastAPI + async PostgreSQL + multi-tenant models with RLS policies

---

## Session Continuity

**Last Session:** 2026-02-07 — Executed 01-03-PLAN.md
**Stopped At:** Completed Phase 1 (Foundation & Authentication)
**Resume File:** None

**What Was Accomplished:**
- Email verification flow with JWT tokens (48h grace period, no DB storage)
- Password reset flow with JWT tokens (1h expiry, revokes all sessions on reset)
- Google OAuth sign-in with httpx-oauth (authorization URL + callback)
- Rate limiting on all auth endpoints (10/min login, 3/hr register/reset)
- Background email sending with FastMail (graceful dev fallback)
- All verifications passed, 2 atomic commits created

**Context for Next Session:**
- **Phase 1 Complete:** Full authentication system production-ready
- Complete auth flow: email/password, Google OAuth, verification, password recovery
- Multi-tenant isolation enforced via tenant context middleware + RLS
- Rate limiting protects against brute force attacks
- Email infrastructure ready for transactional emails
- **Ready for Phase 2:** Address Intelligence API integration (PDOK/BAG/Kadaster)
- Next: Begin Phase 2 planning and research

---

*Last updated: 2026-02-07T03:30:00Z*
