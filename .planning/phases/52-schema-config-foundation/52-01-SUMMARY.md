---
phase: 52-schema-config-foundation
plan: 01
subsystem: api
tags: [pydantic, schemas, energy-label, woz, brk, monument, property-report]

# Dependency graph
requires:
  - phase: 51-meldingen-ux
    provides: "v6.0 shipped baseline for v7.0 build-on"
provides:
  - "EnergyLabel Pydantic model (backend/app/schemas/energy_label.py)"
  - "WOZWaarde and WOZData Pydantic models (backend/app/schemas/woz.py)"
  - "BRKOwnership and ZakelijkGerechtigde Pydantic models (backend/app/schemas/brk_ownership.py)"
  - "RCEMonumentDetail added to monument.py for Phase 53 enrichment"
  - "PropertyReportResponse extended with energy_label, woz_data, brk_ownership (all Optional)"
affects:
  - phase 53 (api-clients) — schema types for EP-Online, WOZ, BRK, RCE Linked Data clients
  - phase 54 (brk-integration) — BRKOwnership schema ready
  - phase 55 (aggregator-integration) — PropertyReportResponse fields ready for wiring

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "All external-API schema fields use | None = Field(default=None) — tolerates field name corrections in Phase 53"
    - "BRK schema module docstring MUST NEVER be cached warning (Kadaster Tier 3)"
    - "New PropertyReportResponse sections follow Phase 3/4 pattern: import at top, add as Optional field at bottom"

key-files:
  created:
    - backend/app/schemas/energy_label.py
    - backend/app/schemas/woz.py
    - backend/app/schemas/brk_ownership.py
  modified:
    - backend/app/schemas/monument.py
    - backend/app/schemas/property.py

key-decisions:
  - "All external-API fields use | None defaults — EP-Online/WOZ/RCE field names are MEDIUM/LOW confidence, Phase 53 will validate live"
  - "BRKOwnership placed in own module with Kadaster Tier 3 caching prohibition in docstring"
  - "RCEMonumentDetail added to monument.py (not a new file) since it enriches MonumentStatus"
  - "MonumentStatus.rce_detail is Optional[RCEMonumentDetail] — Phase 55 aggregator attaches enriched data"
  - "INF-05 (completeness denominator 6->9) intentionally deferred to Phase 55 — changing denominator without wiring new sections gives wrong scores"

patterns-established:
  - "Pattern: New PropertyReportResponse section = new schema file + import in property.py + Optional field at class bottom"
  - "Pattern: BRK schema modules always include caching prohibition in module docstring"

requirements-completed: []

# Metrics
duration: 12min
completed: 2026-02-24
---

# Phase 52 Plan 01: Schema & Config Foundation Summary

**5 new Pydantic schemas (EnergyLabel, WOZWaarde, WOZData, ZakelijkGerechtigde, BRKOwnership, RCEMonumentDetail) and PropertyReportResponse extended with 3 Optional v7.0 sections (energy_label, woz_data, brk_ownership)**

## Performance

- **Duration:** 12 min
- **Started:** 2026-02-24T03:21:02Z
- **Completed:** 2026-02-24T03:32:49Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Created 3 new schema files (energy_label.py, woz.py, brk_ownership.py) — all default-constructible, all external-API fields Optional
- Added RCEMonumentDetail class to monument.py and MonumentStatus.rce_detail Optional field
- Extended PropertyReportResponse with energy_label, woz_data, brk_ownership — all Optional for backward compat with existing JSONB reports
- Zero ruff errors across all 5 schema files
- No circular imports — new files import only from pydantic

## Task Commits

Each task was committed atomically:

1. **Task 1: Create EnergyLabel, WOZData, and BRKOwnership schema files** - `0e60976` (feat)
2. **Task 2: Add RCEMonumentDetail to monument.py and extend PropertyReportResponse** - `723fd4b` (feat)

## Files Created/Modified
- `backend/app/schemas/energy_label.py` — EnergyLabel model: 10 fields, energieklasse/registratie_datum/geldig_tot/is_geldig/berekenings_type/soort_opname/opname_datum/bag_vbo_id/is_geregistreerd/niet_geregistreerd_reden
- `backend/app/schemas/woz.py` — WOZWaarde (3 fields) and WOZData (8 fields) with low_confidence flag and WOZ Waardeloket bron default
- `backend/app/schemas/brk_ownership.py` — ZakelijkGerechtigde (3 fields with Literal eigenaar_type) and BRKOwnership (6 fields) with Kadaster Tier 3 caching prohibition
- `backend/app/schemas/monument.py` — Added RCEMonumentDetail class (8 fields) and MonumentStatus.rce_detail Optional field
- `backend/app/schemas/property.py` — Added imports for EnergyLabel, WOZData, BRKOwnership; added 3 new Optional fields to PropertyReportResponse

## Decisions Made
- All external-API fields use `| None` defaults: EP-Online V5 and WOZ field names are MEDIUM confidence (camelCase vs snake_case unknown), RCE Linked Data fields are LOW confidence. Phase 53 will validate and may rename.
- BRKOwnership placed in its own schema module with Kadaster Tier 3 caching prohibition in module docstring — critical legal compliance note visible to all future developers.
- RCEMonumentDetail added to existing `monument.py` (not a new `monument_detail.py` file) since it enriches MonumentStatus and belongs with the monument domain.
- INF-05 completeness denominator change (6→9) deferred to Phase 55 — changing denominator in Phase 52 without wiring the new section variables produces incorrect scores.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- The plan's backward-compat verification command used incorrect BAGAddressResponse field names (`bag_nummeraanduiding_id` instead of `nummeraanduiding_id`). Fixed the test command inline — the underlying schema backward compatibility was confirmed with the correct field name.
- Pre-existing test failures unrelated to this plan: `test_refresh_token_reuse_detection`, `test_full_orchestration_all_sections_available`, 3 DSO client tests, 2 SRU tests, 1 zoning aggregator test — all confirmed pre-existing by reverting schema changes and re-running.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 53 (API Clients) has all schema types ready: EnergyLabel, WOZData, BRKOwnership, RCEMonumentDetail
- Phase 54 (BRK Integration) has BRKOwnership schema ready
- Phase 55 (Aggregator Integration) has PropertyReportResponse fields ready for wiring
- No blockers

---
*Phase: 52-schema-config-foundation*
*Completed: 2026-02-24*
