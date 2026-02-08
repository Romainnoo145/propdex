# Propdex — Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-08)

**Core Value:** Address -> Property Intelligence Report
**Current Focus:** v2.0 Frontend

---

## Current Position

**Milestone:** v2.0 Frontend
**Phase:** 14 — Authentication & Security
**Plan:** 5 of 5
**Status:** Complete (human-verified)

**Last activity:** 2026-02-08 — Phase 14 complete, human-verified auth flow

**Progress:** ████████░░░░░░░░░░░░ 8/15 plans (53%)

---

## Performance Metrics

**v1.1 Shipped:** 2026-02-08
- 7 phases, 19 plans, 15 requirements
- 275 tests, 15,947 LOC Python

**v1.0 Shipped:** 2026-02-07
- 5 phases, 17 plans, 14 requirements
- 8,281 LOC Python

---

## Accumulated Context

### Key Decisions

See `.planning/PROJECT.md` Key Decisions table.

**Recent decisions (Phase 14):**
- httpOnly cookies for refresh tokens: Prevents XSS attacks
- secure=False in development: Allows HTTP on localhost
- path=/api/auth for cookies: Limits scope to auth endpoints
- TanStack Router file-based routing: Type-safe with auto-generated route tree
- RouterContext pattern: Inject auth state into router for beforeLoad guards
- _authenticated layout route: DRY protected route pattern
- cookieDomainRewrite in Vite proxy: Enables httpOnly cookies in dev
- /api/auth proxy rewrite: Frontend calls /api/auth, proxy rewrites to /auth for backend
- In-memory access token: React state only, never localStorage
- Demo login button: Development-only bypass for testing UI

**Phase 13 decisions:**
- React 19, Tailwind v4, ESLint 9, TypeScript strict
- Z-index CSS scale, CSS variables for brand colors
- useRef for MapLibre, map.remove() cleanup
- ESRI World Imagery satellite, CartoDB Positron kaart
- Glassmorphism UI controls

### Active TODOs

- [ ] Frontend integration (this milestone)
- [ ] Fix backend register endpoint 500 error (discovered during Phase 14 verification)
- [ ] Production deployment: Create app_role
- [ ] Test Claude API with real bestemmingsplan PDFs
- [ ] BAG API key aanvragen (gratis)
- [ ] DSO API key aanvragen (gratis)

### Blockers

(None)

### Known Issues

- Backend register endpoint returns 500 (needs investigation)
- Backend auth router uses /auth prefix (not /api/auth like other routers) — Vite proxy rewrite compensates
- SET LOCAL asyncpg parameter binding fixed (use f-string with validated UUID)
- Kadaster eigendomsdata requires paid API (deferred to post-v2.0)
- Monument restrictions are generic boilerplate (not property-specific)

---

## Session Continuity

**Last Session:** 2026-02-08 — Phase 14 complete (human-verified)
**Stopped At:** Phase 14 complete, ready for Phase 15
**Resume File:** None

---

*Last updated: 2026-02-08 (Phase 14 complete)*
