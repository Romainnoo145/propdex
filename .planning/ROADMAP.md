# Propdex — Roadmap

## Milestones

- ACTIVE **v2.0 Frontend** — Phases 13-17 (map-first React SPA)
- SHIPPED **v1.1 Production Hardening** — Phases 6-12 (shipped 2026-02-08)
- SHIPPED **v1.0 Core Intelligence Engine** — Phases 1-5 (shipped 2026-02-07)

## Active: v2.0 Frontend (Phases 13-17)

**Goal:** Map-first web interface — full-page MapLibre map with PDOK tiles, floating search, property detail panels, and report management sidebar.

**Stack:** React 19, Vite 7, TypeScript strict, MapLibre GL JS 4.x, TanStack Query v5, TanStack Router, Tailwind v4, pnpm

- [ ] Phase 13: Map Foundation & Layout — React/Vite scaffold, full-page MapLibre map, PDOK tiles, layer toggle, memory cleanup patterns, z-index scale (R1)
  **Plans:** 3 plans
  - [ ] 13-01-PLAN.md — Vite + React + TypeScript scaffold with tooling, z-index scale, PDOK constants
  - [ ] 13-02-PLAN.md — MapLibre map component with PDOK tiles, imperative state, cleanup, AppLayout
  - [ ] 13-03-PLAN.md — Layer toggle (aerial/topo) and visual verification
- [ ] Phase 14: Authentication & Security — Login/register flow, JWT in memory + httpOnly refresh cookie, silent refresh, protected routes, CORS config, backend cookie endpoint (R2, R8)
- [ ] Phase 15: Property Data & Map Interactions — Floating search with autocomplete, address lookup, property detail panel, parcel boundaries, GeoJSON clustering, coordinate projection verification (R3, R4, R5)
- [ ] Phase 16: Property Details & Reports — Detail panel with progressive disclosure, report save/list/search sidebar, PDF export, freshness indicators, data source badges (R6)
- [ ] Phase 17: Projects & Polish — Project folders CRUD, report-to-project assignment, mobile bottom sheet, monument badges, AI zoning display, force refresh (R7, R9)

**Dependency chain:**
```
Phase 13 (Map) → Phase 14 (Auth) → Phase 15 (Data) → Phase 16 (Reports) → Phase 17 (Polish)
```

**Requirements:** See REQUIREMENTS.md (9 requirements)

## Shipped

<details>
<summary>v1.1 Production Hardening (Phases 6-12) — SHIPPED 2026-02-08</summary>

- [x] Phase 6: Security & Configuration (3/3 plans) — RLS enforcement, config consolidation, per-org freshness
- [x] Phase 7: Test Infrastructure & Auth Testing (2/2 plans) — test framework, 51 auth tests, Phase 1 verification
- [x] Phase 8: Data Pipeline Testing (2/2 plans) — 55 API client + 20 cache manager tests
- [x] Phase 9: Intelligence Testing (3/3 plans) — 43 aggregator + 14 AI + 9 integration + 3 ARQ tests
- [x] Phase 10: Report & Multi-Tenant Testing (3/3 plans) — 15 report CRUD + 9 PDF + 9 multi-tenant tests
- [x] Phase 11: Coverage Gap Closure (4/4 plans) — 42 tests closing audit-identified gaps
- [x] Phase 12: Phase Documentation & Verification (2/2 plans) — retroactive VERIFICATION.md for all phases

**19 plans, 15 requirements, 275 tests, 15,947 LOC Python**
**Archive:** `.planning/milestones/v1.1-ROADMAP.md`

</details>

<details>
<summary>v1.0 Core Intelligence Engine (Phases 1-5) — SHIPPED 2026-02-07</summary>

- [x] Phase 1: Foundation & Authentication (3/3 plans) — JWT auth, multi-tenant RLS, email verification, Google OAuth, rate limiting
- [x] Phase 2: Core Data Pipeline (3/3 plans) — httpx client, JSONB cache, BAG/PDOK APIs, property aggregator
- [x] Phase 3: Zoning & Monument Intelligence (4/4 plans) — DSO zoning, RCE monuments, spatial intersection, PropertyReportResponse
- [x] Phase 4: AI Document Parsing (4/4 plans) — Claude PDF parsing, ARQ worker, job polling, upload fallback
- [x] Phase 5: Report Management (3/3 plans) — Save/list/search, project folders, PDF export, freshness detection

**17 plans, 14 requirements, 8,281 LOC Python**
**Archive:** `.planning/milestones/v1.0-ROADMAP.md`

</details>

---

## Progress

| Phase | Milestone | Plans | Status | Completed |
|-------|-----------|-------|--------|-----------|
| 1. Foundation & Authentication | v1.0 | 3/3 | Complete | 2026-02-07 |
| 2. Core Data Pipeline | v1.0 | 3/3 | Complete | 2026-02-07 |
| 3. Zoning & Monument Intelligence | v1.0 | 4/4 | Complete | 2026-02-07 |
| 4. AI Document Parsing | v1.0 | 4/4 | Complete | 2026-02-07 |
| 5. Report Management | v1.0 | 3/3 | Complete | 2026-02-07 |
| 6. Security & Configuration | v1.1 | 3/3 | Complete | 2026-02-07 |
| 7. Test Infrastructure & Auth Testing | v1.1 | 2/2 | Complete | 2026-02-07 |
| 8. Data Pipeline Testing | v1.1 | 2/2 | Complete | 2026-02-07 |
| 9. Intelligence Testing | v1.1 | 3/3 | Complete | 2026-02-08 |
| 10. Report & Multi-Tenant Testing | v1.1 | 3/3 | Complete | 2026-02-08 |
| 11. Coverage Gap Closure | v1.1 | 4/4 | Complete | 2026-02-08 |
| 12. Phase Documentation & Verification | v1.1 | 2/2 | Complete | 2026-02-08 |
| 13. Map Foundation & Layout | v2.0 | 0/3 | Planned | — |
| 14. Authentication & Security | v2.0 | 0/? | Pending | — |
| 15. Property Data & Map Interactions | v2.0 | 0/? | Pending | — |
| 16. Property Details & Reports | v2.0 | 0/? | Pending | — |
| 17. Projects & Polish | v2.0 | 0/? | Pending | — |

---

*Last updated: 2026-02-08 (Phase 13 planned — 3 plans in 3 waves)*
