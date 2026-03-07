# Propdex -- Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-07)

**Core value:** Area -> Opportunity Intelligence -- scan any Dutch municipality and instantly find development opportunities
**Current focus:** v13.0 Phase 79 -- Voorzieningen Nabijheid

---

## Current Position

Phase: 79 of 81 (Voorzieningen Nabijheid) -- COMPLETE
Plan: 2 of 2 in current phase
Status: Phase Complete
Last activity: 2026-03-07 -- Completed 79-02-PLAN.md

Progress: [██████████] 100%

---

## Performance Metrics

**Velocity:**
- Total plans completed: 4 (v13.0)
- Average duration: 2min
- Total execution time: 0.15 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| Phase 78 P01 | 2min | 2 tasks | 2 files |
| Phase 78 P02 | 2min | 2 tasks | 5 files |
| Phase 79 P01 | 3min | 2 tasks | 2 files |
| Phase 79 P02 | 2min | 2 tasks | 3 files |

*Updated after each plan completion*

## Accumulated Context

### Key Patterns (carry forward)

- CBS OData v4 client complete: datasets.cbs.nl/odata/v1/CBS, Observations + WijkenEnBuurtenCodes
- CBS wijk lookup uses startswith(Identifier, 'WK{gemeente_code}')
- CBS_DATASET_ID configurable via env var (default 86165NED = 2025 dataset)
- neighborhood_metrics JSONB on AreaScan -- extend with "nabijheid" and "criminaliteit" keys
- Direct `db.add()/db.flush()/db.commit()` pattern (NOT `async with db.begin()`)
- Three-state contract: return model | None | raise GovernmentAPIError
- Rate limiter: register APIRateLimiter singletons in rate_limiter.py

### v12.0 Research Notes

- Phase 78: Same API, 14 more measure codes -- zero new infrastructure
- Phase 79: CBS 86134NED for nabijheid -- same OData v4, verify protocol live
- Phase 80: OData v3 on dataderden.cbs.nl (47018NED) -- space-padded keys, TypedDataSet entity
- Phase 81: Percentile-rank normalization (NOT min-max), confidence tracking, 60% minimum completeness
- Zero new pip/npm dependencies across all phases

### Decisions Made

(for v12.0)
- [Phase 78]: CBS extended sub-objects as siblings of demografie, not nested
- [Phase 78]: Frontend interfaces optional for backward compatibility
- [Phase 78]: Derived indicators (vergrijzing, doelgroep, WOZ/inkomen) computed client-side
- [Phase 78]: Cards rendered sequentially -- Phase 77.1 will restructure into tabs
- [Phase 79]: Resolver methods accept optional dataset_id for multi-dataset CBS queries
- [Phase 79]: Nabijheid output keys mapped afstand_X to X_km for frontend consumption
- [Phase 79]: CbsNabijheid at root level of CbsNeighborhoodMetrics (not inside data), matching backend storage
- [Phase 79]: Distance thresholds: daily 1/3km, transport 3/10km for green/amber/red coloring

### Pending Todos

- Production deployment: Create app_role (sql/setup_app_role.sql)
- BAG API key aanvragen (gratis)
- CBS Nabijheid dataset protocol version: verify v4 on datasets.cbs.nl before Phase 79
- Politie crime data recency: confirm 2022+ data availability before Phase 80

### Blockers/Concerns

None.

---

## Session Continuity

**Last Session:** 2026-03-07T11:14:49Z
**Stopped At:** Completed 79-02-PLAN.md (Phase 79 complete)
**Resume File:** None

**Next Action:** `/gsd:plan-phase 80` (Criminaliteitsdata)

---

*State updated: 2026-03-07 -- v12.0 roadmap created*
