# Quick Task 2 Summary: Redesign scoring, add qualification filter, and resolve addresses

**Date:** 2026-02-15
**Commit:** 265aa49
**Status:** Complete

## What Changed

### Scoring: 4-factor → 5-factor model
- **Before:** vacant_land (always 0 for BAG data), size_optimal (clustered), zoning_residential (binary), recent_permits (never populated) → all scores ~50
- **After:** pand_status_signal (30), building_age (20), zoning_value (25), footprint_size (15), underutilization combo (10) → scores range 1-92, meaningful differentiation
- Categories: High >= 65, Medium >= 40, Low < 40
- 41 unit tests covering all factors, thresholds, and edge cases

### Pipeline: 4 phases → 6 phases
- Phase 4 (Qualify): Filters score >= 40, caps at 150 results per scan
- Phase 5 (Addresses): Batch reverse geocode via PDOK Locatieserver (only qualifying parcels)
- Phase 6 (Project): Auto-create wijk project folder, link to scan
- Extracts `bouwjaar` and `pand_status` from BAG WFS properties during upsert

### Schema
- `parcel_cache`: Added `bouwjaar` (int), `pand_status` (varchar 100)
- `area_scans`: Added `wijk_naam` (varchar 200), `project_id` (FK to projects)
- Migration: `a1b2c3d4e5f6`

### Frontend
- "Bebouwd" column → sortable "Bouwjaar" column
- "Onbebouwd" toggle → "Status" dropdown (Niet in gebruik, Sloopvergunning, Buiten gebruik, Bouwvergunning)
- Detail modal: Bouwjaar + Status cards replace Bebouwd card
- Header shows qualification ratio: "87 kansrijk van 4.231 gescand (98% afgevallen)"
- Cache invalidation on scan completion (fixes stale empty results)
- `wijk_naam` passed from wijk click handler

## Verification

- Steyl wijk scan: 150 qualifying of 3,925 scanned (96% filtered out)
- Score range: 41-62 (meaningful differentiation vs old 5-50 cluster)
- Top results: Sloopvergunning parcels correctly ranked highest
- Addresses resolved via PDOK reverse geocoding
- `ruff check` clean, `npm run check` clean, 41 scoring tests pass

## Stats

- **Lines changed:** +885 / -335
- **Files modified:** 15
- **Tests:** 41 (all new, replacing 14 old)
