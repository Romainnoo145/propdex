# Propdex -- Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-07)

**Core value:** Area -> Opportunity Intelligence -- scan any Dutch municipality and instantly find development opportunities
**Current focus:** v12.0 Phase 78 -- Extended CBS Demographics & Income

---

## Current Position

Phase: 78 of 81 (Extended CBS Demographics & Income)
Plan: 0 of ? in current phase
Status: Ready to plan
Last activity: 2026-03-07 -- v12.0 roadmap created

Progress: [░░░░░░░░░░] 0%

---

## Performance Metrics

**Velocity:**
- Total plans completed: 0 (v12.0)
- Average duration: --
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

*Updated after each plan completion*

---

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

(None yet for v12.0)

### Pending Todos

- Production deployment: Create app_role (sql/setup_app_role.sql)
- BAG API key aanvragen (gratis)
- CBS Nabijheid dataset protocol version: verify v4 on datasets.cbs.nl before Phase 79
- Politie crime data recency: confirm 2022+ data availability before Phase 80

### Blockers/Concerns

None.

---

## Session Continuity

**Last Session:** 2026-03-07
**Stopped At:** v12.0 roadmap created
**Resume File:** None

**Next Action:** `/gsd:plan-phase 78`

---

*State updated: 2026-03-07 -- v12.0 roadmap created*
