# Propdex -- Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-07)

**Core value:** Area -> Opportunity Intelligence -- scan any Dutch municipality and instantly find development opportunities
**Current focus:** v13.0 Juridisch Klimaat Intelligence

---

## Current Position

Phase: Not started (defining requirements)
Plan: --
Status: Defining requirements
Last activity: 2026-03-07 -- Milestone v13.0 started

---

## Accumulated Context

### Key Patterns (carry forward)

- CBS OData v4 client complete: datasets.cbs.nl/odata/v1/CBS, Observations + WijkenEnBuurtenCodes
- CBS OData v3 client: dataderden.cbs.nl, space-padded keys, TypedDataSet entity
- neighborhood_metrics JSONB on AreaScan -- extend with new data keys
- Direct `db.add()/db.flush()/db.commit()` pattern (NOT `async with db.begin()`)
- Three-state contract: return model | None | raise GovernmentAPIError
- Rate limiter: register APIRateLimiter singletons in rate_limiter.py
- Rechtspraak API: XML-based, ECLI identifiers, 10 req/s rate limit
- Existing jurisprudence: useJurisprudence hook, JurisprudenceSection component, backend search endpoint

### Decisions Made

(from v12.0 -- carry forward)
- CBS extended sub-objects as siblings of demografie, not nested
- Frontend interfaces optional for backward compatibility
- Separate CbsCrimeClient for OData v3 (different protocol from v4)

### Pending Todos

- Production deployment: Create app_role (sql/setup_app_role.sql)
- BAG API key aanvragen (gratis)
- Phase 81 (Locatie Score Investeringsprofiel) deferred from v12.0

### Blockers/Concerns

None.

---

## Session Continuity

**Last Session:** 2026-03-07
**Stopped At:** Milestone v13.0 initialized
**Resume File:** None

**Next Action:** Research or define requirements

---

*State updated: 2026-03-07 -- v13.0 milestone started*
