# Propdex -- Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-18)

**Core value:** Area -> Opportunity Intelligence -- scan any Dutch municipality and instantly find development opportunities
**Current focus:** Planning next milestone

---

## Current Position

**Milestone:** v4.0 UX Redesign — SHIPPED 2026-02-18
**Status:** Milestone complete, no active milestone

**Next Action:** Define next milestone via `/gsd:new-milestone`

---

## Performance Metrics

**v4.0 UX Redesign (Shipped: 2026-02-18)**
- 10 phases (27-36), 31 plans, 31 requirements, 129 commits
- Industrial Amber design system, persistent MapView, mobile responsive, settings page, bundle splitting
- ~16,234 LOC TypeScript/React (frontend)
- 3 days (2026-02-16 → 2026-02-18)

**v3.1 Smart Area Intelligence (Shipped: 2026-02-15)**
- 5 phases (22-26), 22 plans, 16 requirements, 97 commits
- ~27,200 LOC (13,756 Python + 13,444 TypeScript)

**v3.0 Spatial Foundation (Shipped: 2026-02-11)**
- 4 phases (18-21), 20 plans, 14 requirements, 72 commits

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
- Parcel count pre-check disabled (CRS mismatch between CBS bbox and BAG WFS)
- PLU WMS change detection needs live data validation
- Lighthouse >90 not achievable for pure SPA without SSR (v4.0 score: 57)
- react-resizable-panels unused but still in package.json
- ChangeTimeline.tsx and ProjectEditModal.tsx still have legacy gray-* classes

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 2 | Redesign scoring, add qualification filter, and resolve addresses | 2026-02-15 | 265aa49 | [2-redesign-scoring-add-qualification-filte](./quick/2-redesign-scoring-add-qualification-filte/) |

---

## Session Continuity

**Last Session:** 2026-02-18
**Stopped At:** v4.0 milestone complete
**Resume File:** None

**Next Action:** Define next milestone via `/gsd:new-milestone`

---

*State updated: 2026-02-18 — v4.0 UX Redesign milestone shipped (10 phases, 31 plans, 129 commits)*
