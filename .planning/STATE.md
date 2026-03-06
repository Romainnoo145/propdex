# Propdex -- Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-06)

**Core value:** Area -> Opportunity Intelligence -- scan any Dutch municipality and instantly find development opportunities
**Current focus:** v11.0 Open Data Intelligence — Phase 75 (CBS Wijkstatistieken)

---

## Current Position

Phase: 75 of 77 (CBS Wijkstatistieken)
Plan: — (ready to plan)
Status: Ready to plan
Last activity: 2026-03-06 — v11.0 roadmap created (3 phases: 75-77)

Progress: [░░░░░░░░░░] 0% (v11.0 milestone)

---

## Performance Metrics

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
- `app/government_apis/exceptions.py` does not exist but is imported by rechtspraak.py + jurisprudence.py -- startup blocker; must be created as re-export from base.py at start of Phase 76
- CBS OData v3 URL (`opendata.cbs.nl`) is deprecated -- must migrate to `datasets.cbs.nl/odata/v1/CBS/`
- CBS wijk lookup must prefix gemeente code: `startswith(Identifier, 'WK{gemeente_code}')` -- "Centrum" matches 80+ records nationally without prefix
- lxml must replace stdlib xml.etree.ElementTree in rechtspraak.py for XXE protection
- AI: never ask Claude to generate citations -- only summarize provided ECLI texts
- Rechtspraak scoring 2-3/10 from prior agent -- full rebuild, not patching

### Pending Todos

- Production deployment: Create app_role (sql/setup_app_role.sql)
- BAG API key aanvragen (gratis)
- DSO API key aanvragen (gratis)
- Kadaster BRK Bevragen API toegang regelen (betaald)
- PLU WMS change detection live validation (MON-02)

### Blockers/Concerns

- CBS 2025 dataset measure codes for `86165NED` must be verified live before Phase 75 client rewrite -- codes verified against 2024 dataset only
- AI analysis latency unknown until tested with real Raad van State rulings (can be 80K+ tokens)

---

## Session Continuity

**Last Session:** 2026-03-06
**Stopped At:** v11.0 roadmap created -- ready to plan Phase 75
**Resume File:** None

**Next Action:** `/gsd:plan-phase 75`

---

*State updated: 2026-03-06 -- v11.0 roadmap created, Phase 75 ready to plan*
