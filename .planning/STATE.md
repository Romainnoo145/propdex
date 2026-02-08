# Propdex — Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-08)

**Core Value:** Address -> Property Intelligence Report
**Current Focus:** v2.0 Frontend

---

## Current Position

**Milestone:** v2.0 Frontend
**Phase:** 14 — Authentication & Security
**Plan:** 2 of 3
**Status:** In progress

**Last activity:** 2026-02-08 — Completed 14-02-PLAN.md (TanStack Router setup)

**Progress:** █████░░░░░░░░░░░░░░░ 5/15 plans (33%)

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
- httpOnly cookies for refresh tokens: Prevents XSS attacks from stealing refresh tokens
- secure=False in development: Allows HTTP on localhost (production will use secure=True)
- path=/api/auth: Limits cookie scope to auth endpoints only for security
- Cookie-based refresh enables silent token refresh from frontend
- TanStack Router file-based routing: Type-safe routing with automatic route tree generation
- RouterContext pattern: Inject auth state into router for beforeLoad guards
- _authenticated layout route: DRY pattern for protected route authentication checks
- cookieDomainRewrite in Vite proxy: Enables httpOnly cookies in development

**Phase 13 decisions:**
- React 19: Latest stable React with concurrent features
- Tailwind v4: New Vite plugin architecture with @import syntax
- ESLint 9: Flat config system with typescript-eslint
- Z-index CSS scale: Steps of 100 for flexibility (0, 10, 100, 200, ...)
- CSS variables for brand colors: NEVER hardcode colors in components
- TypeScript strict mode: All safety flags including noUncheckedIndexedAccess
- useRef for MapLibre map instance: Prevents re-render loops (NOT useState)
- map.remove() cleanup: Prevents MapLibre Worker memory leaks
- ESRI World Imagery for satellite: Global coverage (PDOK aerial is NL-only, white JPEG borders)
- CartoDB Positron for kaart: Modern greyscale basemap
- Glassmorphism UI controls: Dark blur backdrop, white/70 active states

### Active TODOs

- [ ] Frontend integration (this milestone)
- [ ] Production deployment: Create app_role
- [ ] Test Claude API with real bestemmingsplan PDFs
- [ ] BAG API key aanvragen (gratis)
- [ ] DSO API key aanvragen (gratis)

### Blockers

(None)

### Known Issues

- SET LOCAL asyncpg parameter binding fixed (use f-string with validated UUID)
- Kadaster eigendomsdata requires paid API (deferred to post-v2.0)
- Monument restrictions are generic boilerplate (not property-specific)

---

## Session Continuity

**Last Session:** 2026-02-08 — Completed 14-02-PLAN.md
**Stopped At:** Completed 14-02-PLAN.md (TanStack Router setup)
**Resume File:** None

---

*Last updated: 2026-02-08 (14-02 complete)*
