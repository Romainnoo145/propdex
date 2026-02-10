---
phase: 20-area-scanner-rest-api
plan: 01
subsystem: area-scanner
tags:
  - schemas
  - migration
  - gemeente-service
  - foundation
dependency_graph:
  requires: []
  provides:
    - scan_schemas
    - parcels_failed_tracking
    - gemeente_bbox_lookup
  affects:
    - area_scans_table
    - scan_trigger_endpoint
    - scan_polling_endpoint
tech_stack:
  added:
    - pydantic_schemas_for_scans
  patterns:
    - request_response_schemas
    - alembic_manual_migration
    - cbs_wfs_geojson_query
key_files:
  created:
    - backend/app/scans/__init__.py
    - backend/app/scans/schemas.py
    - backend/app/services/gemeente_service.py
    - backend/alembic/versions/4fdf155bd206_add_parcels_failed_to_area_scans.py
  modified:
    - backend/app/models/area_scan.py
decisions:
  - decision: Use CQL_FILTER instead of XML Filter for CBS WFS queries
    rationale: Simpler syntax, URL-encoded parameters, easier to construct than XML
  - decision: Use 2024 CBS gebiedsindelingen WFS endpoint
    rationale: Latest stable year, 2026 endpoint may not exist yet
  - decision: Use shapely.geometry.shape for bbox extraction
    rationale: Handles complex geometries correctly, already in use in codebase
metrics:
  duration_seconds: 154
  tasks_completed: 2
  files_created: 4
  files_modified: 1
  lines_added: 280
  completed_at: 2026-02-10T14:57:37Z
---

# Phase 20 Plan 01: Area Scanner Foundation Summary

**One-liner:** Pydantic schemas for all scan operations, parcels_failed error tracking column, and CBS WFS gemeente bounding box lookup service

## Overview

Established the foundational data structures and infrastructure for the area scanner module. Created comprehensive Pydantic schemas covering trigger, polling, results, and export operations. Added database tracking for failed parcels to provide scan quality metrics. Implemented CBS WFS integration for gemeente bounding box lookup to define scan areas.

## Tasks Completed

### Task 1: Create scan module schemas
**Status:** Complete
**Commit:** 14c9911

Created the `app/scans` module with comprehensive Pydantic schemas:

- **ScanCreateRequest**: Trigger schema with gemeente_code, gemeente_naam, and force_rescan flag
- **ScanResponse**: Post-trigger response with status, scan_id, and needs_rescan indicator
- **ScanStatusResponse**: Polling schema with progress tracking (progress_pct, current_phase, parcels counts)
- **ScanResultItem**: Individual parcel result with score transparency (score_category, score_breakdown)
- **ScanResultsResponse**: Paginated results wrapper with scan metadata

All schemas follow existing project patterns from `app/schemas/report.py`, using proper field validation and descriptions.

### Task 2: Create Alembic migration and gemeente bbox service
**Status:** Complete
**Commit:** f6e65a4

**Part A: Database Migration**
- Created manual Alembic migration (not autogenerate to avoid PostGIS index false positives)
- Added `parcels_failed INTEGER NOT NULL DEFAULT 0` column to `area_scans` table
- Updated AreaScan model with `parcels_failed` field for error summary tracking
- Migration applied successfully: revision 4fdf155bd206

**Part B: Gemeente Bbox Service**
- Created `app/services/gemeente_service.py` with `get_gemeente_bbox()` function
- Queries CBS gebiedsindelingen WFS 2024 for gemeente boundaries
- Uses CQL_FILTER syntax for efficient lookup by gemeentecode
- Requests GeoJSON output format for easy parsing (not GML/XML)
- Uses shapely to compute bounds from returned geometry
- Returns dict with minx/miny/maxx/maxy in EPSG:28992 (RD New)
- Includes proper error handling (ValueError if gemeente not found)
- Logs bbox coordinates at INFO level for debugging

## Deviations from Plan

None - plan executed exactly as written.

## Technical Highlights

**Schema Design:**
- All datetime fields use naive UTC (project pattern: `datetime` not `datetime.now(timezone.utc)`)
- Score transparency fields (score_category, score_breakdown) enable client-facing conversations
- Progress tracking fields match AreaScan model for seamless mapping

**CBS WFS Integration:**
- CQL_FILTER provides cleaner syntax than XML Filter encoding
- GeoJSON output format simplifies parsing compared to GML
- shapely.geometry.shape handles complex multi-polygon geometries correctly
- 30-second timeout prevents hanging on slow WFS responses

**Error Tracking:**
- parcels_failed column enables quality metrics display: "Scanned 4,832 parcels (23 failed)"
- Default 0 prevents NULL issues in summary calculations
- Indexed via composite organization_id + gemeente_code index for efficient queries

## Success Criteria

- [x] All 5 schema classes importable with correct fields
- [x] ScanCreateRequest has gemeente_code, gemeente_naam, force_rescan
- [x] ScanResultItem has score_category and score_breakdown for transparency
- [x] parcels_failed column exists in area_scans table and AreaScan model
- [x] get_gemeente_bbox function accepts (gemeente_code, client) parameters
- [x] Returns dict with minx/miny/maxx/maxy
- [x] Alembic migration applied successfully
- [x] All imports verified
- [x] Ruff check passes

## Files Created

1. **backend/app/scans/__init__.py** - Scans module package marker
2. **backend/app/scans/schemas.py** - 5 Pydantic schemas for scan operations (175 lines)
3. **backend/app/services/gemeente_service.py** - CBS WFS gemeente bbox lookup (72 lines)
4. **backend/alembic/versions/4fdf155bd206_add_parcels_failed_to_area_scans.py** - Migration for error tracking column (33 lines)

## Files Modified

1. **backend/app/models/area_scan.py** - Added parcels_failed field (+1 line)

## Next Steps

This foundation enables:
- **Plan 20-02**: Scan trigger endpoint (create AreaScan, enqueue ARQ job)
- **Plan 20-03**: ARQ background job orchestrator (fetch parcels, compute scores)
- **Plan 20-04**: Polling and results endpoints (progress tracking, paginated results)
- **Plan 20-05**: Filtering and sorting (has_pand, bestemming_type, area range)
- **Plan 20-06**: Excel export (openpyxl, score transparency)

## Self-Check: PASSED

**Created files exist:**
- FOUND: backend/app/scans/__init__.py
- FOUND: backend/app/scans/schemas.py
- FOUND: backend/app/services/gemeente_service.py
- FOUND: backend/alembic/versions/4fdf155bd206_add_parcels_failed_to_area_scans.py

**Commits exist:**
- FOUND: 14c9911 (scan module schemas)
- FOUND: f6e65a4 (migration and gemeente service)

**Model field exists:**
- CONFIRMED: AreaScan.parcels_failed field present

**Imports verified:**
- PASSED: All 5 schema classes importable
- PASSED: gemeente_service.get_gemeente_bbox importable
- PASSED: AreaScan model has parcels_failed attribute

**Migration applied:**
- CONFIRMED: Migration 4fdf155bd206 at head

**Lint check:**
- PASSED: ruff check passed on all new code
