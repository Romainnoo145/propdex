---
phase: 74-3dbag-building-data
plan: "02"
subsystem: backend/jobs
tags: [3dbag, area-scan, building-metrics, actual-dimensions, identificaties, pipeline]
dependency_graph:
  requires:
    - phase: 74-3dbag-building-data
      provides: "Plan 01 BAG3DClient + bag_3d_client singleton + get_panden_in_bbox()"
  provides:
    - "BagSpatialIndex.identificaties — BAG pand numeric IDs for 3D BAG join"
    - "3D BAG bbox fetch in scan Phase 2b (non-fatal try/except)"
    - "actual_bouwhoogte + actual_bouwlagen merged into ScanResult.flags.building_metrics JSONB"
  affects: [area_scan_job, BagSpatialIndex, _derive_bag_attributes_for_parcel, building_metrics, ScanResult]
tech_stack:
  added: []
  patterns:
    - "6-tuple return from _derive_bag_attributes_for_parcel (adds bag_identificaties)"
    - "Non-fatal try/except for optional 3D BAG enrichment — scan continues on failure"
    - "NL.IMBAG.Pand. prefix prepended to numeric BAG WFS IDs for 3D BAG dict lookup"
    - "max() across intersecting panden — tallest building represents parcel envelope"
key_files:
  created: []
  modified:
    - backend/app/jobs/area_scan.py
    - backend/tests/unit/test_area_scan.py
decisions:
  - "max() across intersecting panden for actual_bouwhoogte/actual_bouwlagen — tallest building represents the parcel's actual buildable envelope"
  - "Non-fatal 3D BAG fetch — logger.warning on failure, scan continues with empty bag_3d_data"
  - "ID prefix normalization: prepend NL.IMBAG.Pand. to numeric BAG WFS IDs; check startswith('NL.') to avoid double-prefix"
metrics:
  duration: "~4 minutes"
  completed: "2026-03-03"
  tasks: 2
  files_created: 0
  files_modified: 2
---

# Phase 74 Plan 02: 3D BAG Scan Pipeline Integration Summary

**One-liner:** Wired bag_3d_client into area_scan_job — BagSpatialIndex stores pand identificaties, Phase 2b fetches 3D BAG data per scan bbox (non-fatal), and Phase 4 merges actual_bouwhoogte + actual_bouwlagen into building_metrics JSONB; 9 unit tests GREEN.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Extend BagSpatialIndex and wire 3D BAG into scan pipeline | b34d7a6 | app/jobs/area_scan.py |
| 2 | Update area_scan unit tests for 6-tuple and 3D BAG merge | f2c5dd4 | tests/unit/test_area_scan.py |

## What Was Built

### area_scan.py — Pipeline Integration

**BagSpatialIndex extended:**
- Added `identificaties: list[str | None]` field after `representative_points`
- `_build_bag_spatial_index()` now extracts `props.get("identificatie")` for each BAG WFS feature and stores in `identificaties` list

**_derive_bag_attributes_for_parcel() — 6-tuple return:**
- Return type changed from 5-tuple to 6-tuple: `(has_pand, bouwjaar, pand_status, best_address_point, pand_oppervlakte_m2, bag_identificaties)`
- Collects identificaties from all intersecting BAG panden (those passing `MIN_BUILDING_OVERLAP_M2` threshold)
- None identificaties excluded from the list
- All early returns updated: `(False, None, None, None, None, [])`

**Phase 2b — 3D BAG bbox fetch (non-fatal):**
```python
bag_3d_data: dict[str, dict] = {}
try:
    bag_3d_data = await bag_3d_client.get_panden_in_bbox(
        scan.bbox_minx, scan.bbox_miny,
        scan.bbox_maxx, scan.bbox_maxy,
        http_client,
    )
    logger.info(f"Scan {scan_id}: 3D BAG data for {len(bag_3d_data)} panden")
except Exception as e:
    logger.warning(f"Scan {scan_id}: 3D BAG fetch failed (non-fatal): {e}")
```

**scored_parcels tuple extended to 13 elements:**
- 13th element: `bag_identificaties: list[str]`
- Phase 3 unpack from `_upsert_parcel_cache` returns 4-tuple (adds `bag_identificaties`)
- Phase 4 unpacking updated to include `bag_identificaties`
- Phase 5 address targets unpacking updated to include `_bag_ids`

**Phase 4 — actual dimensions merge:**
```python
for pand_id in (bag_identificaties or []):
    full_id = f"NL.IMBAG.Pand.{pand_id}" if not pand_id.startswith("NL.") else pand_id
    bag_3d_entry = bag_3d_data.get(full_id)
    if bag_3d_entry:
        h = bag_3d_entry.get("actual_bouwhoogte")
        bl = bag_3d_entry.get("actual_bouwlagen")
        if h is not None:
            actual_hoogte = h if actual_hoogte is None else max(actual_hoogte, h)
        if bl is not None:
            actual_lagen = bl if actual_lagen is None else max(actual_lagen, bl)
if actual_hoogte is not None:
    final_bm["actual_bouwhoogte"] = actual_hoogte
if actual_lagen is not None:
    final_bm["actual_bouwlagen"] = actual_lagen
```

### test_area_scan.py — Updated Tests

**Existing tests updated (4 tests):**
- All `BagSpatialIndex` constructor calls now include `identificaties` field
- All 5-tuple unpacking updated to 6-tuple (adds `bag_ids` variable)
- `test_returns_none_when_no_building_intersects`: added `assert bag_ids == []`
- `test_ignores_building_that_only_touches_boundary`: added `assert bag_ids == []`

**New tests added (3 tests) — TestDeriveBagAttributesIdentificaties:**
1. `test_returns_identificaties_for_intersecting_buildings` — 2 intersecting buildings → both IDs in bag_ids
2. `test_excludes_none_identificaties_from_result` — None identificatie → empty bag_ids list
3. `test_build_bag_spatial_index_stores_identificaties` — WFS features with identificatie → stored in BagSpatialIndex.identificaties

**9 tests total GREEN.**

## Decisions Made

1. **max() for multiple panden:** When a parcel has multiple intersecting BAG buildings, use max() for both actual_bouwhoogte and actual_bouwlagen. The tallest/largest building represents the parcel's actual buildable envelope.

2. **Non-fatal 3D BAG fetch:** 3D BAG enrichment is best-effort. Any exception (network, auth, API error) logs a warning and sets `bag_3d_data = {}` so the scan completes normally with null actual dimensions.

3. **ID prefix normalization:** BAG WFS returns numeric IDs (e.g. "0363100012345678"); 3D BAG OGC API returns "NL.IMBAG.Pand.0363100012345678". Lookup code prepends "NL.IMBAG.Pand." when needed, guarded by `startswith("NL.")` check.

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

Files found:
- FOUND: backend/app/jobs/area_scan.py
- FOUND: backend/tests/unit/test_area_scan.py
- FOUND: .planning/phases/74-3dbag-building-data/74-02-SUMMARY.md

Commits found:
- FOUND: b34d7a6 (feat(74-02): wire 3D BAG into area scan pipeline)
- FOUND: f2c5dd4 (test(74-02): update area_scan tests for 6-tuple + add identificaties tests)
