# Propdex — Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-08)

**Core Value:** Address -> Property Intelligence Report
**Current Focus:** v2.0 Frontend

---

## Current Position

**Milestone:** v2.0 Frontend
**Phase:** 13 — Map Foundation & Layout
**Plan:** 02 of 3
**Status:** In progress

**Last activity:** 2026-02-08 — Completed 13-02-PLAN.md (MapView + AppLayout)

**Progress:** ████░░░░░░░░░░░░░░░░ 2/15 plans (13%)

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

**Recent decisions (Phase 13-01, 13-02):**
- React 19: Latest stable React with concurrent features
- Tailwind v4: New Vite plugin architecture with @import syntax
- ESLint 9: Flat config system with typescript-eslint
- Z-index CSS scale: Steps of 100 for flexibility (0, 10, 100, 200, ...)
- CSS variables for brand colors: NEVER hardcode colors in components
- TypeScript strict mode: All safety flags including noUncheckedIndexedAccess
- useRef for MapLibre map instance: Prevents re-render loops (NOT useState)
- map.remove() cleanup: Prevents MapLibre Worker memory leaks
- Dual PDOK sources: aerial (visible) + topo (hidden) for future layer toggle

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

**Last Session:** 2026-02-08 — Completed 13-02 (MapView + AppLayout)
**Stopped At:** Completed 13-02-PLAN.md
**Resume File:** None

---

*Last updated: 2026-02-08 (Phase 13-02 complete)*
