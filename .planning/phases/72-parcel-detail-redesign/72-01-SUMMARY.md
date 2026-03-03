---
phase: 72-parcel-detail-redesign
plan: 01
subsystem: backend-scan-pipeline
tags: [area-scan, bag, footprint, building-metrics, scan-result]
dependency_graph:
  requires: []
  provides: [pand_oppervlakte_m2 in ScanResult.flags.building_metrics]
  affects: [frontend-vrije-ruimte-pillar]
tech_stack:
  added: []
  patterns: [5-tuple return, total footprint accumulator, JSONB merge before upsert]
key_files:
  created: []
  modified:
    - backend/app/jobs/area_scan.py
    - backend/tests/unit/test_area_scan.py
decisions:
  - "Accumulate total footprint area after MIN_BUILDING_OVERLAP_M2 guard — consistent with existing overlap semantics"
  - "Return None (not 0.0) when no buildings qualify — consumers can distinguish missing vs zero"
  - "Merge pand_oppervlakte_m2 into final_bm dict in Phase 4 — no schema migration needed (existing JSONB)"
metrics:
  duration: ~3min
  completed: 2026-03-03
  tasks_completed: 2
  files_modified: 2
---

# Phase 72 Plan 01: BAG Pand Footprint Area Capture Summary

**One-liner:** Extend area scan pipeline to accumulate total BAG pand footprint area per parcel and persist it in `ScanResult.flags["building_metrics"]["pand_oppervlakte_m2"]` for Vrije Ruimte unbuilt-percentage computation.

## What Was Built

The area scan pipeline now captures and persists total BAG pand footprint area per parcel:

1. `_derive_bag_attributes_for_parcel` — returns 5-tuple adding `pand_oppervlakte_m2: float | None` as the 5th element. A `total_footprint_area` accumulator sums all qualifying overlap areas (post-`MIN_BUILDING_OVERLAP_M2` guard) across all intersecting BAG panden.

2. `_upsert_parcel_cache` — updated to 3-tuple return `(parcel, address_lookup_xy, pand_oppervlakte_m2)` passing the footprint area through from the BAG attribute derivation.

3. `scored_parcels` — 12-element tuple with `pand_oppervlakte_m2` as the 12th element, carried alongside all existing scoring and signals data.

4. Phase 4 flags construction — `pand_oppervlakte_m2` merged into `final_bm` dict before `ScanResult` upsert. Replaces `building_metrics` with `final_bm` in `ranked_values` so existing building metric keys are preserved.

5. Phase 5 address targets unpacking — updated to 12-element pattern with `_pom` splat variable.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Extend _derive_bag_attributes_for_parcel to return total footprint area | 5b26f6b | backend/app/jobs/area_scan.py |
| 2 | Update unit tests for 5-tuple return signature | b53ecfa | backend/tests/unit/test_area_scan.py |

## Verification

- `python -m pytest backend/tests/unit/test_area_scan.py -x -v` — 6 passed
- `ruff check app/jobs/area_scan.py` — all checks passed
- `grep -n "pand_oppervlakte_m2" backend/app/jobs/area_scan.py` — appears in function signature (line 227-228), accumulation result (line 227), return (line 228), Phase 3 call site (lines 413, 434), Phase 4 unpacking (line 505), flags merge (lines 513-514), _upsert_parcel_cache init (line 843) and return (line 894)

## Deviations from Plan

None — plan executed exactly as written.

## Decisions Made

1. **Accumulate after MIN_BUILDING_OVERLAP_M2 guard** — The `total_footprint_area` accumulator is incremented after the `overlap_area < MIN_BUILDING_OVERLAP_M2: continue` guard, consistent with the existing semantics for what constitutes a "real" building overlap.

2. **Return None not 0.0 for empty parcel** — `pand_oppervlakte_m2 = total_footprint_area if total_footprint_area > 0 else None` ensures downstream consumers can distinguish "no buildings" from "buildings with zero area" (impossible in practice but explicit).

3. **Merge into existing JSONB column** — No schema migration needed; `building_metrics` is already a JSONB column in `ScanResult.flags`. The `final_bm` dict copy-and-merge pattern preserves existing keys (bouwjaar, pand_status etc.) while adding the new key.

## Self-Check: PASSED

- backend/app/jobs/area_scan.py: FOUND
- backend/tests/unit/test_area_scan.py: FOUND
- Commit 5b26f6b: FOUND
- Commit b53ecfa: FOUND
