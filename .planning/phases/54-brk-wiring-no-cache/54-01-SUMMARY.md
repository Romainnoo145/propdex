---
phase: 54-brk-wiring-no-cache
plan: 01
subsystem: api
tags: [brk, pydantic, property-aggregator, mTLS, kadaster, ownership, three-state-schema]

# Dependency graph
requires:
  - phase: 53-api-clients
    provides: BRKBevragenClient singleton with mTLS, get_eigendom(), brk_limiter, _configured attribute
provides:
  - Three-state BRKOwnership schema (available/unavailable/error) with PerceelOwnership wrapper
  - ClassVar never_cache marker on BRKOwnership — signals save layer to strip before JSONB persist
  - CadastralParcel.identificatie field populated from PDOK feature properties
  - BRKBevragenClient.is_configured public property
  - fetch_brk_ownership() Step 2b in property aggregator — sequential after asyncio.gather
  - PropertyReportResponse.brk_ownership always present (not Optional, default_factory)
affects: [55-aggregator-enrichment, 56-property-report-frontend, reports-service-save, reports-router-get]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Step 2b sequential pattern: BRK runs after asyncio.gather completes, using cadastral identificatie"
    - "Three-state schema status literal: available/unavailable/error with PerceelOwnership array wrapper"
    - "ClassVar[bool] never_cache marker on Pydantic model — excluded from model_dump serialization"
    - "Single mTLS client for all percelen: one brk_client.create_client() call per aggregation"
    - "Always-return async function: fetch_brk_ownership never raises, catches all exceptions"
    - "Public is_configured property over private _configured attribute access from aggregator"

key-files:
  created: []
  modified:
    - backend/app/schemas/brk_ownership.py
    - backend/app/schemas/property.py
    - backend/app/government_apis/brk_bevragen.py
    - backend/app/services/property_aggregator.py

key-decisions:
  - "Three-state status (available/unavailable/error) over boolean is_beschikbaar — explicit, frontend-consumable"
  - "ClassVar[bool] never_cache on BRKOwnership — Pydantic excludes ClassVar from serialization, save layer reads class attribute"
  - "PerceelOwnership wrapper per perceel — supports multi-perceel properties and apartment complexes"
  - "Single mTLS client for all percelen in one aggregation call — avoids repeated SSL handshakes"
  - "fetch_brk_ownership never raises — catches GovernmentAPIError and generic Exception, returns error status"
  - "Public is_configured property added to BRKBevragenClient — consistent with EPOnlineClient pattern, no private attribute access from aggregator"
  - "No Redis cache for BRK — safest Kadaster Tier 3 interpretation; re-fetch on view is already real-time"

patterns-established:
  - "Step 2b pattern: sequential BRK after gather using cadastral identificatie from Step 2a"
  - "Always-return pattern: fetch_brk_ownership() catches all exceptions, returns BRKOwnership(status=error)"
  - "never_cache ClassVar marker: save layer strips field before JSONB persist"

requirements-completed: [BRK-01, BRK-05]

# Metrics
duration: 3min
completed: 2026-02-24
---

# Phase 54 Plan 01: BRK Wiring Summary

**Three-state BRKOwnership schema (available/unavailable/error) with PerceelOwnership wrapper, wired as Step 2b in property aggregator after asyncio.gather using PDOK cadastral identificatie**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-24T05:59:19Z
- **Completed:** 2026-02-24T06:02:34Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Evolved BRKOwnership from flat boolean schema to three-state (available/unavailable/error) with per-perceel PerceelOwnership array
- Added ClassVar never_cache marker (excluded from Pydantic serialization) as explicit signal for save layer
- Added CadastralParcel.identificatie field — populated from PDOK feature properties, enables BRK lookup and re-fetch on view
- Added public is_configured property to BRKBevragenClient — consistent with EPOnlineClient pattern
- Wired fetch_brk_ownership() as Step 2b in aggregate_property_data(), sequential after asyncio.gather
- PropertyReportResponse.brk_ownership changed from Optional to always-present with default_factory

## Task Commits

Each task was committed atomically:

1. **Task 1: Evolve BRKOwnership schema and CadastralParcel** - `af0d739` (feat)
2. **Task 2: Wire BRK Step 2b into property aggregator** - `75fd850` (feat)

**Plan metadata:** committed with SUMMARY.md

## Files Created/Modified
- `backend/app/schemas/brk_ownership.py` - Rewritten to three-state schema with PerceelOwnership wrapper and ClassVar never_cache
- `backend/app/schemas/property.py` - CadastralParcel.identificatie added; brk_ownership changed from Optional to always-present
- `backend/app/government_apis/brk_bevragen.py` - Added public is_configured property
- `backend/app/services/property_aggregator.py` - Added _parse_perceel_ownership(), fetch_brk_ownership() Step 2b, CadastralParcel.identificatie population, brk_ownership in PropertyReportResponse constructor

## Decisions Made
- Used ClassVar[bool] for never_cache marker (Option A from research) — Pydantic excludes ClassVar from serialization; save layer reads BRKOwnership.never_cache as class attribute
- No Redis cache for BRK in Phase 54 — safest Kadaster Tier 3 interpretation; re-fetch-on-view approach is already real-time
- Single mTLS client for all percelen in one aggregation — avoids repeated SSL handshakes per research Pitfall 4
- fetch_brk_ownership() catches both GovernmentAPIError and generic Exception — always returns BRKOwnership

## Deviations from Plan

None - plan executed exactly as written.

The plan's verification script had a minor error (used `straatnaam` instead of `straat` for BAGAddressResponse) — this was the test script's error, not a code issue. All plan-specified changes were implemented as specified.

## Issues Encountered
- None. Plan verification script used wrong field name `straatnaam` (correct is `straat`) in BAGAddressResponse — identified during verification, not a code defect.

## User Setup Required
None - no external service configuration required. BRK Bevragen will return `status="unavailable"` with admin_hint until PKIOverheid certificates are configured.

## Next Phase Readiness
- BRK wiring complete — fetch_brk_ownership() runs as Step 2b for every aggregation
- Save layer (reports/service.py) still needs to strip brk_ownership before JSONB persist (Phase 54 Plan 02 or later)
- GET report handler still needs re-fetch-on-view logic (Phase 54 Plan 02 or later)
- CadastralParcel.identificatie now populated — re-fetch on view can use stored perceel IDs
- BRKOwnership.never_cache class attribute ready for save layer to check

---
*Phase: 54-brk-wiring-no-cache*
*Completed: 2026-02-24*
