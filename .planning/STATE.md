# Propdex -- Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-15)

**Core value:** Area -> Opportunity Intelligence -- scan any Dutch municipality and instantly find development opportunities
**Current focus:** v4.0 UX Redesign — Industrial Amber design system, navigation restructure, flow polish

---

## Current Position

**Milestone:** v4.0 UX Redesign
**Phase:** Phase 27 (Design System Foundation)
**Plan:** Not started
**Status:** Roadmap created, ready to begin Phase 27 planning

**Progress:** [░░░░░░░░░░] 0% (0/10 phases complete)

**Last activity:** 2026-02-16 — Roadmap created for v4.0

---

## Performance Metrics

**v3.1 Smart Area Intelligence (Shipped: 2026-02-15)**
- 5 phases (22-26), 22 plans, 16 requirements, 97 commits
- Bestemmingsplan visualization, wijk selection, results interface, change monitoring
- ~27,200 LOC (13,756 Python + 13,444 TypeScript)

**v3.0 Spatial Foundation (Shipped: 2026-02-11)**
- 4 phases (18-21), 20 plans, 14 requirements, 72 commits
- PostGIS, government API clients, scan pipeline, map visualization

**v2.0 Frontend (Shipped: 2026-02-09)**
- 5 phases (13-17), 24 plans, 9 requirements, 117 commits
- 8,804 LOC TypeScript/React

**v1.1 Production Hardening (Shipped: 2026-02-08)**
- 7 phases (6-12), 19 plans, 15 requirements, 71 commits
- 275 tests, 15,947 LOC Python

**v1.0 Core Intelligence Engine (Shipped: 2026-02-07)**
- 5 phases (1-5), 17 plans, 14 requirements, 79 commits
- 8,281 LOC Python

---

## Accumulated Context

### Active TODOs

- [ ] Define Phase 27 plans (Design System Foundation)
- [ ] Fix backend register endpoint 500 error
- [ ] Production deployment: Create app_role
- [ ] Production deployment: Update Docker container to postgis/postgis:16-3.5
- [ ] Test Claude API with real bestemmingsplan PDFs
- [ ] BAG API key aanvragen (gratis)
- [ ] DSO API key aanvragen (gratis)
- [ ] Kadaster BRK Bevragen API toegang regelen (betaald)
- [ ] Ruimtelijkeplannen.nl REST API v4 key aanvragen
- [ ] PLU WMS change detection live validation (MON-02)

### Known Issues

- Backend register endpoint returns 500 (needs investigation)
- Kadaster eigendomsdata requires paid API
- Monument restrictions are generic boilerplate (not property-specific)
- Mobile navigation: Side-rail hidden on mobile, no replacement navigation exists yet (will be addressed in Phase 34)
- Parcel count pre-check disabled (CRS mismatch between CBS bbox and BAG WFS)
- PLU WMS change detection needs live data validation

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 2 | Redesign scoring, add qualification filter, and resolve addresses | 2026-02-15 | 265aa49 | [2-redesign-scoring-add-qualification-filte](./quick/2-redesign-scoring-add-qualification-filte/) |

---

## Session Continuity

**Last Session:** 2026-02-16
**Stopped At:** Roadmap created for v4.0 UX Redesign
**Resume File:** None

**Next Action:** Run `/gsd:plan-phase 27` to create execution plans for Design System Foundation

---

*State updated: 2026-02-16 — v4.0 roadmap created, Phase 27 ready for planning*
