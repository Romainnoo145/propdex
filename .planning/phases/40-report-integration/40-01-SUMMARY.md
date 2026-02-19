---
phase: 40-report-integration
plan: "01"
subsystem: backend-reports
tags: [reports, parcel, aggregator, endpoint, rate-limit]
dependency_graph:
  requires:
    - backend/app/models/parcel_cache.py
    - backend/app/services/property_aggregator.py
    - backend/app/reports/service.py
    - backend/app/schemas/address.py
  provides:
    - POST /api/reports/from-parcel endpoint
    - ReportFromParcelRequest schema
    - _parse_parcel_address helper
  affects:
    - backend/app/reports/router.py
    - backend/app/schemas/report.py
tech_stack:
  added: []
  patterns:
    - ParcelCache query with org isolation
    - aggregate_property_data + service.save_report pipeline
    - PDOK weergavenaam address parsing via regex
key_files:
  created: []
  modified:
    - backend/app/schemas/report.py
    - backend/app/reports/router.py
decisions:
  - "POST /from-parcel placed after /cities and before /{report_id} -- static sub-paths must precede parameterized paths in FastAPI"
  - "Rate limit 10/minute matches /{report_id}/refresh -- both trigger external API calls"
  - "502 Bad Gateway for aggregator failures -- distinguishes upstream API errors from server errors"
  - "Huisnummer extraction from pre-comma portion of address -- avoids matching 4-digit sequences in postcodes"
metrics:
  duration: "~2 minutes"
  completed_date: "2026-02-20"
  tasks_completed: 2
  files_modified: 2
---

# Phase 40 Plan 01: Report Integration from Parcel Summary

**One-liner:** POST /from-parcel endpoint chains ParcelCache lookup + PDOK address parsing + property aggregator + report save into one authenticated, rate-limited action.

## What Was Built

### ReportFromParcelRequest Schema (`backend/app/schemas/report.py`)

New Pydantic schema placed before `ReportSaveRequest`:

```python
class ReportFromParcelRequest(BaseModel):
    """Schema for generating a report from a scan result parcel."""
    parcel_id: uuid.UUID = Field(description="ParcelCache UUID")
    notes: str | None = Field(default=None, description="Optional notes for the report")
    project_id: uuid.UUID | None = Field(
        default=None, description="Optional project folder ID"
    )
```

### Address Parser (`backend/app/reports/router.py`)

Module-level helper that extracts postcode and huisnummer from PDOK weergavenaam format:

```python
def _parse_parcel_address(address: str) -> tuple[str, int] | None:
```

Handles:
- `"Kerkstraat 42, 5911AA Venlo"` -> `("5911 AA", 42)`
- `"Kerkstraat 42a, 5911 AA Venlo"` -> `("5911 AA", 42)`
- `"Dorpsstraat 1 bis, 1234 AB Stad"` -> `("1234 AB", 1)`

### POST /api/reports/from-parcel Endpoint

Full pipeline in one endpoint:
1. Query `ParcelCache` by `parcel_id` AND `organization_id` (multi-tenant isolation)
2. Check address is non-empty
3. Parse address to postcode + huisnummer
4. Build `AddressInput` and call `aggregate_property_data()`
5. Save via `service.save_report()`
6. Return `ReportDetailResponse` with HTTP 201

Error handling:
- 404 "Perceel niet gevonden" -- parcel not found or wrong org
- 422 "Geen geldig adres beschikbaar voor dit perceel" -- null/empty address
- 422 "Adres kan niet worden verwerkt: {address}" -- unparseable format
- 502 "Fout bij ophalen van perceeldata: {e}" -- aggregator upstream failure
- 500 -- unexpected internal errors

## Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add ReportFromParcelRequest schema | 012f187 | backend/app/schemas/report.py |
| 2 | Add POST /from-parcel endpoint with address parser | 7558df2 | backend/app/reports/router.py |

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

- backend/app/schemas/report.py: FOUND
- backend/app/reports/router.py: FOUND
- Commit 012f187: FOUND
- Commit 7558df2: FOUND
