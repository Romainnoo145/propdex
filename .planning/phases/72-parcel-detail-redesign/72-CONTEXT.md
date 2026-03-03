# Phase 72 Context: Parcel Detail Panel Redesign

## Decision (approved 2026-03-02, memory #11595)

**Optie C — drie echte bars** replaces the current abstract scoring pillars.

### Problem
Current pillars show useless data:
- "Bebouwbaarheid — Onbekend · FAR onbekend · TAR onbekend" (FAR: 0% fill rate, TAR: 7% fill rate)
- "Leegstandsrisico" — abstract score not directly meaningful
- "Transformatiekans" — abstract score

### New Design: Three Real Data Bars

1. **"Vrije ruimte"** — real unbuilt percentage: `(1 - pand_footprint/parcel_area) × 100`
   - BAG footprint overlap already calculated in scan pipeline but NOT stored
   - Need to add `pand_oppervlakte_m2` to ScanResult model
   - overlap_area already computed at ~line 201 of `backend/app/jobs/area_scan.py`

2. **"Beschikbaarheid"** — `vacancy_confidence × 100` (existing model is decent)
   - Rename from "Leegstandsrisico"
   - Show top vacancy reason as context line

3. **"Transformatiepotentie"** — weighted mix:
   - bouwjaar (older = higher potential)
   - bestemming (wonen/gemengd = higher)
   - perceelgrootte (bigger = higher)
   - Context shows e.g. "Bouwjaar 1962, wonen ok"

### What to Remove
- All FAR/TAR references from ParcelDetailModal and InspectorPanel
- `formatPlanruimteLabel()` function
- `deriveBuildabilityScore()` function
- "Planruimte (FAR/TAR)" section
- ScoreDonut chart (replace with simpler layout or keep — user preference)

### Files Involved
- `backend/app/jobs/area_scan.py` — store overlap_area as pand_oppervlakte_m2
- `backend/app/models/scan.py` — add column
- `backend/alembic/` — migration
- `frontend/src/components/results/ParcelDetailModal.tsx` — main rewrite
- `frontend/src/components/layout/InspectorPanel.tsx` — if it has pillars
- `frontend/src/components/results/ParcelCard.tsx` — cleanup
- `frontend/src/lib/score.ts` — if pillar logic lives here

### Constraints
- Keep the ScoreDonut (overall potentiescore) — it's useful
- Existing scan data needs backfill for pand_oppervlakte_m2
- No new API dependencies — all data already available or computable from existing fields
