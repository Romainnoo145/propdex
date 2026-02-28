# Propdex -- Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-28)

**Core value:** Area -> Opportunity Intelligence -- scan any Dutch municipality and instantly find development opportunities
**Current focus:** v8.0 Client Demo Readiness — Phase 62: Scan Pipeline Reliability

---

## Current Position

Phase: 62 of 66 (Scan Pipeline Reliability)
Plan: 1 of 2 complete
Status: In progress
Last activity: 2026-02-28 — Plan 01 complete (BAG WFS retry + coverage tracking)

Progress: [█░░░░░░░░░] 11% (1/9 plans complete)

---

## Performance Metrics

**v8.0 Client Demo Readiness (In Progress)**
- Phase 62 Plan 01: completed ~25min (BAG WFS retry + abort-on-failure + coverage_ratio + completed_with_warnings)

**v7.2 Developer Dossier Intelligence (Completed)**
- Phase 59 Plan 01: completed (buildability delta contract + calculations + report/map presentation)
- Phase 60 Plan 01: completed (Layer A Wkb precheck + optional Layer B refinement contract)
- Phase 61 Plan 01: completed (permit precedent benchmark by municipality + comparable type + report integration)

**v7.1 Workspace Productization (Completed)**
- Phase 58: 5 plans completed (workspace role context, URL-state hardening, operational UX, canonical parcel flow, handoff)

**v7.0 Deep Property Data (Completed)**
- Phase 54 Plan 01: 3 min (BRK schema + aggregator wiring)
- Phase 54 Plan 02: 5 min (BRK strip-before-save + re-fetch-on-view + 6 integration tests)
- Phase 55 Plan 01: 5 min (RCE Linked Data two-step enrichment in monument_aggregator)
- Phase 55 Plan 02: 2 min (EP-Online + WOZ into 5-parallel Step 2a gather, completeness 6->9)

---

## Accumulated Context

### Key Patterns (carry forward)

- Direct `db.add()/db.flush()/db.commit()` pattern (NOT `async with db.begin()`)
- parcel_cache.geometry is EPSG:28992; always ST_Transform(geometry, 4326) before GeoJSON
- 404 not 403 for cross-org access (prevents enumeration)
- SET LOCAL f-string (not params): asyncpg doesn't support parameterized SET statements
- Three-state contract: return model | None (not-found/unconfigured) | raise GovernmentAPIError (error)
- retry_with_backoff: shared helper in base.py, wraps any async HTTP callable; 429-aware by default; retry_on_errors=True adds 5xx/network retry
- BAG WFS abort-on-failure: area_scan_job sets status=failed + error_detail JSONB, returns early (no silent garbage data)
- coverage_ratio + address_resolution_ratio tracked on AreaScan post-scan; completed_with_warnings when thresholds breached
- ClassVar[bool] never_cache marker: BRKOwnership.never_cache = True
- text-on-accent: all amber/accent-background elements use this utility
- Defined grey scale: only 100, 300, 400, 600, 700, 800, 850, 900, 950

### v8.0 Context

- **Root cause known**: BAG WFS failure in area_scan.py is silent -- causes entire scan to produce garbage data (no bouwjaar, no addresses, wrong scoring). Fix this first before any data work.
- **Venlo is the target**: 21 wijken, must all have complete data before demo.
- **Phase 62 is the gate**: All subsequent phases depend on scan pipeline being reliable.
- **retry_with_backoff already exists** in base.py -- reuse for SCAN-01 BAG retry.
- **--force-all pattern needed**: Existing scan jobs skip rows with ON CONFLICT DO NOTHING; need override mode.

### Ongoing TODOs

- Production deployment: Create app_role (sql/setup_app_role.sql)
- Production deployment: Update Docker container to postgis/postgis:16-3.5
- BAG API key aanvragen (gratis)
- DSO API key aanvragen (gratis)
- Kadaster BRK Bevragen API toegang regelen (betaald)
- PLU WMS change detection live validation (MON-02)

### Blockers/Concerns

None.

---

## Session Continuity

**Last Session:** 2026-02-28T19:40:00Z
**Stopped At:** Completed 62-01-PLAN.md (BAG WFS retry + coverage tracking)
**Resume File:** .planning/phases/62-scan-pipeline-reliability/62-01-SUMMARY.md

**Next Action:** Run `/gsd:execute-phase 62` to continue with Plan 02.

---

*State updated: 2026-02-28 -- Phase 62 Plan 01 complete, BAG WFS scan pipeline reliability established*
