# Quick Task 2: Redesign scoring, add qualification filter, and resolve addresses

**Date:** 2026-02-15
**Type:** Feature overhaul

## Goal

Fix three fundamental problems with scan results:
1. All scores cluster around 50 (broken 4-factor formula)
2. Addresses show "Onbekend" (never populated)
3. ALL 10,000 parcels displayed (no qualification threshold)

## Tasks

### Task 1: Schema + Scoring Redesign
- Add `bouwjaar`, `pand_status` to ParcelCache model
- Add `wijk_naam`, `project_id` to AreaScan model
- Alembic migration for new columns
- Rewrite scoring from 4-factor to 5-factor model targeting "leeg/onderbenut"
- New factors: pand_status_signal (30), building_age (20), zoning_value (25), footprint_size (15), underutilization combo (10)
- Rewrite all scoring tests (41 tests)

### Task 2: Pipeline Overhaul
- Restructure area_scan_job from 4 to 6 phases
- Phase 4: Qualification filter (score >= 40, cap at 150)
- Phase 5: Batch reverse geocode qualifying parcels via PDOK Locatieserver
- Phase 6: Auto-create wijk project folder
- Add `reverse()` method to PDOKLocatieserver client
- Extract `bouwjaar`/`pand_status` from BAG WFS properties during upsert

### Task 3: Frontend + API Updates
- Add `bouwjaar`, `pand_status` to schemas and ScanResultItem
- Add `wijk_naam` to ScanCreateRequest, pass from frontend
- Add `pand_status` filter and `bouwjaar` sort to results endpoint
- Replace "Bebouwd" column with sortable "Bouwjaar" column
- Replace "Onbebouwd" toggle with "Status" dropdown
- Show qualification ratio in results header
- Invalidate results cache on scan completion

## Files Modified (15)

1. `backend/app/models/parcel_cache.py`
2. `backend/app/models/area_scan.py`
3. `backend/alembic/versions/a1b2c3d4e5f6_add_bouwjaar_status_wijk_project.py` (new)
4. `backend/app/government_apis/pdok_locatieserver.py`
5. `backend/app/services/parcel_scoring.py`
6. `backend/tests/test_parcel_scoring.py`
7. `backend/app/jobs/area_scan.py`
8. `backend/app/scans/schemas.py`
9. `backend/app/scans/service.py`
10. `backend/app/scans/router.py`
11. `frontend/src/lib/types/scan.ts`
12. `frontend/src/components/results/ResultsTable.tsx`
13. `frontend/src/components/results/ResultsFilterPanel.tsx`
14. `frontend/src/components/results/ParcelDetailModal.tsx`
15. `frontend/src/routes/_authenticated/map.tsx`
