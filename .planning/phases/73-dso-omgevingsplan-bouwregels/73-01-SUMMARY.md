---
phase: 73-dso-omgevingsplan-bouwregels
plan: "01"
subsystem: backend-zoning
tags: [dso, bouwregels, bouwlagen, plu-wms, building-metrics, scan]
dependency_graph:
  requires: []
  provides:
    - BuildingDimensions.max_bouwlagen field (DSO property report path)
    - zoning_aggregator bouwlagen extraction with Dutch synonym keywords
    - DSO cache key v4 (forces re-fetch)
    - PLU WMS max_bouwhoogte + max_bouwlagen extraction from maatvoering text
    - extract_building_metrics() returns 4 keys including bouwhoogte + bouwlagen
    - area_scan building_metrics JSONB auto-includes bouwhoogte/bouwlagen
  affects:
    - ScanResult.flags["building_metrics"] JSONB (new max_bouwhoogte/max_bouwlagen keys)
    - ZoningData.building_dimensions (new max_bouwlagen field)
    - DSO cached zoning responses (invalidated via v4 key bump)
tech_stack:
  added: []
  patterns:
    - int(round(waarde)) for float-to-int rounding of bouwlagen values
    - Range guard (1 < v <= 50) for bouwlagen, (2.0-100.0m) for bouwhoogte
    - dict(building_metrics) copy pattern in area_scan carries all keys automatically
key_files:
  created: []
  modified:
    - backend/app/schemas/zoning.py
    - backend/app/services/zoning_aggregator.py
    - backend/app/government_apis/plu_wfs.py
    - backend/app/services/parcel_scoring.py
    - backend/tests/unit/test_zoning_aggregator.py
decisions:
  - Use int(round(waarde)) NOT round(int(waarde)) for float rounding (3.7 -> 4, not 3)
  - Bouwlagen branch placed BEFORE generic 'hoogte' branch to avoid false matches
  - PLU WMS bouwhoogte filter excludes "goot" text to avoid goothoogte collision
  - No area_scan.py code changes needed -- dict(building_metrics) copy carries all keys automatically
  - Pre-existing mypy dict[str, Any] errors in zoning_aggregator.py are out of scope
metrics:
  duration: ~4 minutes
  completed_date: "2026-03-03"
  tasks_completed: 2
  files_modified: 5
  tests_added: 8
  tests_green: 38
---

# Phase 73 Plan 01: DSO Bouwregels Backend Extraction Summary

**One-liner:** max_bouwhoogte + max_bouwlagen extracted from PLU WMS maatvoering text and DSO maatvoeringen, persisted into ScanResult.flags["building_metrics"] via dict copy pattern; DSO cache bumped to v4.

## What Was Built

Two tasks implemented cleanly:

**Task 1: BuildingDimensions schema + DSO aggregator (e4409bf)**

- Added `max_bouwlagen: int | None` field to `BuildingDimensions` Pydantic model
- Updated `has_any_data` property to include `max_bouwlagen is not None` check
- Extended `_merge_building_dimensions()` to merge bouwlagen taking max of two values
- Added bouwlagen branch in `_extract_building_dimensions()` before generic "hoogte" branch, matching Dutch synonyms: bouwlagen, bouwlaag, verdieping, woonlagen
- Range guard: only 1 < waarde <= 50; float rounding: `int(round(waarde))` (not `round(int(waarde))` which truncates)
- Bumped DSO cache key from `dso:zoning:v3:{x}:{y}` to `dso:zoning:v4:{x}:{y}`
- Added 8 new unit tests (6 bouwlagen extraction + 2 merge tests), all GREEN

**Task 2: PLU WMS + parcel_scoring + area_scan flow (8acfa68)**

- Extended `PLUWMSClient._extract_metrics_from_features()` to extract `max_bouwhoogte` (2.0-100.0m range, excludes goothoogte text) and `max_bouwlagen` (1 < v <= 50 int) from maatvoering text
- `get_bestemming_at_point()` now propagates both new fields into each bestemming dict entry
- Extended `extract_building_metrics()` to return 4 keys always (max_bebouwingspercentage, max_floor_area_ratio, max_bouwhoogte, max_bouwlagen); passes through PLU WMS-sourced values with type guards
- Confirmed: `area_scan.py` `final_bm = dict(building_metrics)` already copies all keys automatically -- no code changes needed there
- All 38 zoning aggregator tests GREEN; ruff check clean on all modified files

## Data Flow

```
PLU WMS maatvoering layer
    -> PLUWMSClient._extract_metrics_from_features()
    -> bestemmingen dict entries (max_bouwhoogte, max_bouwlagen keys)
    -> extract_building_metrics() in parcel_scoring
    -> derive_opportunity_insights().building_metrics
    -> area_scan.py: final_bm = dict(building_metrics)
    -> ScanResult.flags["building_metrics"] JSONB

DSO API maatvoeringen
    -> _extract_building_dimensions() in zoning_aggregator
    -> BuildingDimensions.max_bouwlagen
    -> ZoningData.building_dimensions (property report path)
```

## Deviations from Plan

**1. [Rule 1 - Bug] Fixed int(round()) vs round(int()) ordering**

- **Found during:** Task 1 test execution
- **Issue:** Plan pseudocode used `round(int(waarde))` which truncates before rounding (3.7 -> 3, not 4)
- **Fix:** Changed to `int(round(waarde))` which rounds first then converts (3.7 -> 4)
- **Files modified:** `backend/app/services/zoning_aggregator.py`
- **Commit:** e4409bf

**2. [Rule 1 - Bug] Fixed test class organization for merge tests**

- **Found during:** Task 1 — merge tests needed separate class to be organized cleanly
- **Fix:** Added `TestMergeBuildingDimensions` class with 2 tests (not inside `TestExtractBuildingDimensions`)
- **Files modified:** `backend/tests/unit/test_zoning_aggregator.py`
- **Commit:** e4409bf

## Pre-existing Issues (Out of Scope)

- `test_bag_wfs.py::TestBAGWFSClient::test_truncation_detection` — pre-existing failure, unrelated
- `test_dso_client.py`, `test_rce_client.py`, `test_sru_bekendmakingen.py` — 10 pre-existing failures, unrelated
- mypy dict[str, Any] type parameter errors in zoning_aggregator.py — pre-existing, noted in STATE.md

## Self-Check

- [x] backend/app/schemas/zoning.py modified (max_bouwlagen field + has_any_data)
- [x] backend/app/services/zoning_aggregator.py modified (extraction + merge + cache v4)
- [x] backend/app/government_apis/plu_wfs.py modified (bouwhoogte + bouwlagen parsing)
- [x] backend/app/services/parcel_scoring.py modified (4-key return dict)
- [x] backend/tests/unit/test_zoning_aggregator.py modified (8 new tests)
- [x] Task 1 commit: e4409bf
- [x] Task 2 commit: 8acfa68
- [x] All 38 zoning aggregator tests GREEN
- [x] ruff check app/schemas/zoning.py app/services/zoning_aggregator.py app/government_apis/plu_wfs.py app/services/parcel_scoring.py app/jobs/area_scan.py: All checks passed
