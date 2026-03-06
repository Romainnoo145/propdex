# Propdex -- Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-06)

**Core value:** Area -> Opportunity Intelligence -- scan any Dutch municipality and instantly find development opportunities
**Current focus:** v11.0 Open Data Intelligence — Phase 76 (Rechtspraak Jurisprudentie)

---

## Current Position

Phase: 76 of 77 (Rechtspraak Jurisprudentie)
Plan: 02 of N complete
Status: In progress
Last activity: 2026-03-07 — Phase 76 Plan 02 complete (Rechtspraak frontend polish)

Progress: [███░░░░░░░] ~30% (v11.0 milestone)

---

## Performance Metrics

**v11.0 Open Data Intelligence (In Progress)**
- Phase 75 Plan 01: ~5min
- Phase 75 Plan 02: ~5min
- Phase 76 Plan 01: ~2min
- Phase 76 Plan 02: ~3min

**v10.0 Parcel Detail Panel Redesign + DSO Bouwregels + 3D BAG (Completed)**
- Phase 72 Plan 01: ~3min
- Phase 72 Plan 02: ~3min
- Phase 74 Plan 03: ~2min

**v9.0 Risk Intelligence (Completed)**
- Phase 67 Plan 01: ~4min
- Phase 67 Plan 02: ~2min
- Phase 68 Plan 01: ~3min
- Phase 68 Plan 02: ~18min
- Phase 69 Plan 01: ~3min
- Phase 69 Plan 02: ~5min

*Updated after each plan completion*

---

## Accumulated Context

### Key Patterns (carry forward)

- Direct `db.add()/db.flush()/db.commit()` pattern (NOT `async with db.begin()`)
- parcel_cache.geometry is EPSG:28992; always ST_Transform(geometry, 4326) before GeoJSON
- 404 not 403 for cross-org access (prevents enumeration)
- Three-state contract: return model | None | raise GovernmentAPIError (never return error dicts)
- retry_with_backoff: shared helper in base.py, wraps any async HTTP callable
- Rate limiter: register APIRateLimiter singletons in rate_limiter.py -- NOT bare asyncio.Semaphore

### v11.0 Critical Notes

- CBS data already in `neighborhood_metrics` JSONB on AreaScan -- CBS-01 is frontend-only
- CBS OData v4 client complete (75-02): datasets.cbs.nl/odata/v1/CBS, Observations + WijkenEnBuurtenCodes
- CBS wijk lookup uses startswith(Identifier, 'WK{gemeente_code}') -- safe against 80+ national Centrum matches
- CBS_DATASET_ID configurable via env var (default 86165NED = 2025 dataset)
- bouwjaar_distributie fields are None in v4 -- M008209/M008210 are rolling 10yr window, not pre/post-2000
- Rechtspraak client rebuilt (76-01): lxml XXE-safe, APIRateLimiter, correct error signatures, ECLI validation, omgevingsrecht filter
- exceptions.py created as re-export shim from base.py -- startup blocker resolved (76-01)
- AI: never ask Claude to generate citations -- only summarize provided ECLI texts

### Decisions Made

- CBS v4: bouwjaar_distributie fields set to None -- M008209/M008210 are rolling 10-year window, not pre/post-2000 boundary (2026-03-06)
- CBS v4: gemeente_code required for safe wijk lookup -- national name-only search too ambiguous (2026-03-06)
- CBS v4: GovernmentAPIError on observations fetch failure (fatal); region lookup non-fatal (returns None) (2026-03-06)
- CBS_DATASET_ID as Settings field, not class constant -- allows env-var override per deployment (2026-03-06)
- [Phase 75-cbs-wijkstatistieken]: CbsNeighborhoodMetrics uses nested data structure matching CBS v4 client output (not flat v3 shape)
- [Phase 76-rechtspraak]: Full rewrite (not patching) — exceptions.py shim, lxml, APIRateLimiter, ECLI validation, omgevingsrecht hardcoded (2026-03-06)
- [Phase 76-rechtspraak]: return=DOC parameter prevents wasted lookups on entries without available documents (2026-03-06)
- [Phase 76-rechtspraak-02]: parseCourtFromTitle as file-level helper — court name replaces ECLI short form as primary meta in result cards (2026-03-07)
- [Phase 76-rechtspraak-02]: Badge "Omgevingsrecht filter actief" always visible — UX transparency for backend-side domain filter (2026-03-07)

### Pending Todos

- Production deployment: Create app_role (sql/setup_app_role.sql)
- BAG API key aanvragen (gratis)
- DSO API key aanvragen (gratis)
- Kadaster BRK Bevragen API toegang regelen (betaald)
- PLU WMS change detection live validation (MON-02)

### Blockers/Concerns

- CBS 2025 dataset measure codes for `86165NED` should be verified live -- codes cross-referenced against 2024 dataset only
- AI analysis latency unknown until tested with real Raad van State rulings (can be 80K+ tokens)

---

## Session Continuity

**Last Session:** 2026-03-07T17:00:37Z
**Stopped At:** Completed 76-02-PLAN.md
**Resume File:** None

**Next Action:** `/gsd:execute-phase 76` (plan 03 — Rechtspraak AI analysis, if planned)

---

*State updated: 2026-03-07 -- Phase 76 Plan 02 complete*
