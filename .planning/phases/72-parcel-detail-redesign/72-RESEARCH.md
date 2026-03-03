# Phase 72: Parcel Detail Panel Redesign - Research

**Researched:** 2026-03-03
**Domain:** Frontend React/TypeScript + Backend SQLAlchemy/Alembic — data model extension + UI rewrite
**Confidence:** HIGH (all findings from direct codebase inspection)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Optie C — drie echte bars** replaces the current abstract scoring pillars
- **"Vrije ruimte"** — real unbuilt percentage: `(1 - pand_footprint/parcel_area) × 100`
  - BAG footprint overlap already calculated in scan pipeline but NOT stored
  - Need to add `pand_oppervlakte_m2` to ScanResult model
  - overlap_area already computed at ~line 201 of `backend/app/jobs/area_scan.py`
- **"Beschikbaarheid"** — `vacancy_confidence × 100` (existing model is decent)
  - Rename from "Leegstandsrisico"
  - Show top vacancy reason as context line
- **"Transformatiepotentie"** — weighted mix:
  - bouwjaar (older = higher potential)
  - bestemming (wonen/gemengd = higher)
  - perceelgrootte (bigger = higher)
  - Context shows e.g. "Bouwjaar 1962, wonen ok"
- Remove all FAR/TAR references from ParcelDetailModal and InspectorPanel
- Remove `formatPlanruimteLabel()` function
- Remove `deriveBuildabilityScore()` function
- Remove "Planruimte (FAR/TAR)" section
- Keep the ScoreDonut (overall potentiescore)
- Existing scan data needs backfill for pand_oppervlakte_m2
- No new API dependencies — all data already available or computable from existing fields

### Claude's Discretion
- ScoreDonut chart: keep or replace with simpler layout (user preference)
- Exact formula weights for Transformatiepotentie

### Deferred Ideas (OUT OF SCOPE)
- None specified
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| UX-01 | Replace abstract score pillars with three real data bars: Vrije ruimte (unbuilt %, from pand_oppervlakte_m2), Beschikbaarheid (vacancy_confidence), Transformatiepotentie (bouwjaar + bestemming + perceelgrootte) — remove all FAR/TAR references | Backend: capture pand_oppervlakte_m2 in scan pipeline and store in ScanResult.flags["building_metrics"]; Frontend: rewrite ScorePillarRows bindings; cleanup dead code (formatPlanruimteLabel, deriveBuildabilityScore, Planruimte section) |
</phase_requirements>

## Summary

Phase 72 is a focused data model extension (backend) plus UI rewrite (frontend) that replaces three abstract scoring pillars with three real-data bars in the parcel detail panel. The work is self-contained — no new external dependencies, no new API calls, no changes to the core scoring engine.

The critical path is: (1) extend `_derive_bag_attributes_for_parcel()` in `area_scan.py` to also accumulate total BAG pand footprint area and return it; (2) thread that value through the `scored_parcels` tuple and store inside `ScanResult.flags["building_metrics"]["pand_oppervlakte_m2"]`; (3) expose it through the existing `building_metrics` dict on `ScanResultItem` (no schema change needed); (4) rewrite the three pillar bars in `ParcelDetailModal.tsx` using the new data; (5) remove all FAR/TAR dead code from both `ParcelDetailModal.tsx` and `InspectorPanel.tsx`.

The backfill question: existing `ScanResult` rows do not have `pand_oppervlakte_m2` because BAG footprint data is computed at scan time but NOT persisted in `ParcelCache`. There is no way to re-derive it without re-scanning. Therefore historical records will have `null` for this field and the "Vrije ruimte" bar should gracefully show "Footprint onbekend" for those cases. No backfill script is needed or possible. New scans will capture the data automatically.

**Primary recommendation:** Store `pand_oppervlakte_m2` in `ScanResult.flags["building_metrics"]` JSONB dict (no Alembic migration needed); thread through the scan pipeline's existing tuple structure; display gracefully as "onbekend" when null; computed Transformatiepotentie entirely in frontend from existing fields.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Shapely | Already installed | Computing total BAG pand footprint area via `bag_geom.intersection(parcel_geometry).area` | Already used at line 201 of area_scan.py — just accumulate result |
| SQLAlchemy 2.x JSONB | Existing pattern | Store pand_oppervlakte_m2 in flags["building_metrics"] | No migration needed; consistent with existing metrics storage |
| Pydantic v2 | Already installed | No schema change needed — flows through `building_metrics: dict` | Already established |
| React + TypeScript | Existing stack | Frontend pillar rewrite | Established project stack |
| Tailwind CSS | Existing stack | Styling (unchanged ScorePillarRows component) | All existing UI uses Tailwind utilities |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| No new libraries needed | — | — | All tools already present in the project |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Storing in flags["building_metrics"] JSONB | New `pand_oppervlakte_m2 Float` column on `ScanResult` | Column = cleaner typing + SQL-filterable + indexed; JSONB = zero migration, consistent with other scan metadata. For a nullable display-only metric, JSONB wins for this phase. Promote to column if future phases need SQL filtering. |
| Recomputing footprint from stored geometry at read time | Storing at scan time | Re-computation would require fetching live BAG API data which is NOT persisted per parcel. Infeasible at read time. Store at scan time is the only option. |

**Installation:** No new packages needed.

## Architecture Patterns

### Recommended Project Structure
```
backend/app/jobs/area_scan.py           # Extend _derive_bag_attributes_for_parcel() + thread through pipeline
backend/app/scans/schemas.py            # No change needed (building_metrics: dict | None already covers it)
backend/app/scans/router.py             # No change needed (building_metrics passthrough)
frontend/src/components/results/ParcelDetailModal.tsx   # Main rewrite — three pillar bars
frontend/src/components/layout/InspectorPanel.tsx       # Remove FAR/TAR dead code (Bouwruimte Delta section)
frontend/src/components/results/ParcelCard.tsx          # Remove buildability subscore display
frontend/src/lib/types/scan.ts          # No type change needed (building_metrics already Record<string,unknown>)
frontend/src/lib/score.ts               # Keep extractScoreSubscores (still used by ParcelCard for vacancy display)
```

### Pattern 1: pand_oppervlakte_m2 Capture in Scan Pipeline

**What:** Modify `_derive_bag_attributes_for_parcel()` to accumulate total BAG pand footprint intersecting the parcel (sum of all qualifying BAG pand intersections). Return as 5th element of the tuple. Thread through to flags storage.

**Current state (area_scan.py line 173-225):**
```python
# Returns: tuple[bool, int | None, str | None, tuple[float, float] | None]
# Tracks best_overlap_area (largest single pand) but NOT total footprint area
def _derive_bag_attributes_for_parcel(...):
    best_overlap_area = -1.0   # only tracks the single largest pand
    # Missing: total_footprint_area accumulator
```

**Required change — extend to return total footprint:**
```python
def _derive_bag_attributes_for_parcel(
    parcel_geometry: BaseGeometry,
    bag_index: BagSpatialIndex | None,
) -> tuple[bool, int | None, str | None, tuple[float, float] | None, float | None]:
    if bag_index is None:
        return False, None, None, None, None

    candidate_indices = bag_index.tree.query(parcel_geometry)
    if len(candidate_indices) == 0:
        return False, None, None, None, None

    intersect_count = 0
    total_footprint_area = 0.0      # NEW: sum all qualifying pand intersections
    matched_bouwjaren: list[int] = []
    matched_statuses: list[str] = []
    best_address_point: tuple[float, float] | None = None
    best_overlap_area = -1.0

    # ... existing loop unchanged except adding accumulator:
    for raw_idx in iterable_indices:
        idx = int(raw_idx)
        bag_geom = bag_index.geometries[idx]
        if not bag_geom.intersects(parcel_geometry):
            continue
        overlap_area = bag_geom.intersection(parcel_geometry).area
        if overlap_area < MIN_BUILDING_OVERLAP_M2:
            continue
        intersect_count += 1
        total_footprint_area += overlap_area    # NEW: accumulate
        if overlap_area > best_overlap_area:
            best_overlap_area = overlap_area
            best_address_point = bag_index.representative_points[idx]
        # ... rest unchanged

    if intersect_count == 0:
        return False, None, None, None, None

    pand_oppervlakte_m2: float | None = total_footprint_area if total_footprint_area > 0 else None
    return True, bouwjaar_value, pand_status_value, best_address_point, pand_oppervlakte_m2
```

**Call site in `_upsert_parcel_cache` (line ~834):**
```python
# Before (4-tuple unpack):
has_pand, bouwjaar, pand_status, address_lookup_xy = _derive_bag_attributes_for_parcel(
    parcel_geom_shape, bag_index,
)
# After (5-tuple unpack):
has_pand, bouwjaar, pand_status, address_lookup_xy, pand_oppervlakte_m2 = _derive_bag_attributes_for_parcel(
    parcel_geom_shape, bag_index,
)
```

**Return `pand_oppervlakte_m2` from `_upsert_parcel_cache`:**
```python
# Before:
return parcel, address_lookup_xy
# After:
return parcel, address_lookup_xy, pand_oppervlakte_m2
```

**Thread through `scored_parcels` tuple in `area_scan_job`:**
```python
# Call site (line ~409):
parcel, centroid_xy, pand_oppervlakte_m2 = await _upsert_parcel_cache(...)

# scored_parcels.append (line ~418) — add pand_oppervlakte_m2 as last element:
scored_parcels.append((
    parcel, score_breakdown.total_score, score_breakdown.category,
    score_breakdown.factors, score_breakdown.vacancy_subscore,
    score_breakdown.buildability_subscore, score_breakdown.model_version,
    insights.vacancy_signal, insights.signals, insights.building_metrics,
    centroid_xy, pand_oppervlakte_m2,   # NEW last element
))

# Phase 4 unpacking (line ~488) — add pand_oppervlakte_m2:
for (
    parcel, score, category, factors,
    vacancy_subscore, buildability_subscore, score_model_version,
    vacancy_signal, opportunity_signals, building_metrics, _centroid,
    pand_oppervlakte_m2,    # NEW
) in all_ranked:
    ...
    # In flags construction, merge into building_metrics:
    final_bm: dict = dict(building_metrics) if isinstance(building_metrics, dict) else {}
    if pand_oppervlakte_m2 is not None:
        final_bm["pand_oppervlakte_m2"] = pand_oppervlakte_m2
    # Store final_bm instead of building_metrics in flags dict
```

**Also update `_batch_resolve_addresses` call site (line ~557-565):**
```python
# The address_targets iteration unpacks from scored_parcels tuples
# Update the unpack to handle the new 12-element tuple
await _batch_resolve_addresses(
    [
        (p, c)
        for p, _s, _cat, _f, _vsub, _bsub, _ver, _vs, _os, _bm, c, _pom in address_targets
    ],  # c is still element 10 (centroid_xy)
    ...
)
```

### Pattern 2: Frontend Pillar Rewrite in ParcelDetailModal.tsx

**Functions to REMOVE:**
- `formatPlanruimteLabel()` (lines 49-84) — entire function
- `deriveBuildabilityScore()` (lines 120-162) — entire function
- `deriveTransformationScore()` (lines 179-198) — entire function

**Variables to REMOVE from component body:**
```typescript
// Remove these:
const maxBebouwingspercentage = ...   // building_metrics FAR/TAR read
const maxFloorAreaRatio = ...         // building_metrics FAR/TAR read
const supportsResidentialMixed = hasResidentialMixedBestemming(...)  // KEEP — needed for Transformatiepotentie
const planruimte = formatPlanruimteLabel(...)   // remove
const buildabilityPillar = deriveBuildabilityScore(...)   // remove
const transformationPillar = deriveTransformationScore(...) // remove
```

**NEW variables in component body:**
```typescript
// Keep supportsResidentialMixed (still needed for Transformatiepotentie)
const supportsResidentialMixed = hasResidentialMixedBestemming(parcel.bestemmingen)

// Pillar 1: Vrije ruimte from pand_oppervlakte_m2
const pandOppervlaktM2 = (parcel.building_metrics as {
  pand_oppervlakte_m2?: number | null
} | null)?.pand_oppervlakte_m2 ?? null
const vrijeRuimtePct: number | null =
  pandOppervlaktM2 != null && parcel.area_m2 != null && parcel.area_m2 > 0
    ? Math.max(0, Math.min(100, (1 - pandOppervlaktM2 / parcel.area_m2) * 100))
    : null

// Pillar 2: Beschikbaarheid from vacancy_confidence
const beschikbaarheidPct: number | null =
  parcel.vacancy_confidence != null
    ? Math.round(parcel.vacancy_confidence * 100)
    : null
const topVacancyReason: string | undefined =
  (parcel.vacancy_reasons?.[0] ?? '').replace(/^(HARD|PROXY):\s*/i, '').trim() || undefined

// Pillar 3: Transformatiepotentie from bouwjaar + bestemming + perceelgrootte
const transformatiePotentie = deriveTransformatiePotentie(
  parcel.bouwjaar, supportsResidentialMixed, parcel.area_m2
)
```

**NEW `deriveTransformatiePotentie` function (replaces `deriveTransformationScore`):**
```typescript
function deriveTransformatiePotentie(
  bouwjaar: number | null,
  supportsResidentialMixed: boolean,
  area_m2: number | null,
): { score: number; label: string } {
  // Bouwjaar score: older = higher potential (0-40 points)
  const bouwjaarScore =
    bouwjaar == null ? 20
    : bouwjaar < 1960 ? 40
    : bouwjaar < 1980 ? 30
    : bouwjaar < 2000 ? 20
    : bouwjaar < 2010 ? 10
    : 5

  // Bestemming score: wonen/gemengd = higher (0-40 points)
  const bestemmingScore = supportsResidentialMixed ? 40 : 15

  // Perceelgrootte score: bigger = higher (0-20 points)
  const areaScore =
    area_m2 == null ? 10
    : area_m2 >= 1500 ? 20
    : area_m2 >= 750 ? 15
    : area_m2 >= 300 ? 10
    : 5

  const score = bouwjaarScore + bestemmingScore + areaScore

  // Context label: "Bouwjaar 1962 · wonen ok" or "Bouwjaar 1998 · niet-wonen"
  const parts: string[] = []
  if (bouwjaar != null) parts.push(`Bouwjaar ${bouwjaar}`)
  parts.push(supportsResidentialMixed ? 'wonen ok' : 'niet-wonen')
  const label = parts.join(' · ')

  return { score, label }
}
```

**Updated ScorePillarRows usages:**
```typescript
// In Score Section JSX (replaces lines 459-479):
<ScorePillarRows
  label="Vrije ruimte"
  value={vrijeRuimtePct}
  context={
    pandOppervlaktM2 != null && parcel.area_m2 != null
      ? `${Math.round(pandOppervlaktM2)} m² bebouwd`
      : parcel.has_pand
        ? 'Footprint onbekend'
        : 'Geen pand'
  }
/>
<ScorePillarRows
  label="Beschikbaarheid"
  value={beschikbaarheidPct}
  context={topVacancyReason}
/>
<ScorePillarRows
  label="Transformatiepotentie"
  value={transformatiePotentie.score}
  context={transformatiePotentie.label}
/>
```

**Remove the entire "Planruimte (FAR/TAR)" JSX section (lines 532-560):**
```typescript
// DELETE this entire block:
{/* Build metrics */}
<div>
  <div className="mb-3 flex items-center gap-1.5">
    <h3 className="text-sm font-medium text-grey-100">
      Planruimte (FAR/TAR)
    </h3>
    ...
  </div>
  <div className="grid grid-cols-2 gap-4">
    <div>TAR card</div>
    <div>FAR card</div>
  </div>
</div>
```

### Pattern 3: InspectorPanel.tsx Dead Code Removal

**Remove `deriveBuildabilityForInspector()` function (lines 25-77).**

**Remove `buildability` variable (line ~100):**
```typescript
// Remove this line:
const buildability = parcel ? deriveBuildabilityForInspector(parcel) : null
```

**Remove the entire "Bouwruimte Delta" JSX section (lines 273-321):**
```typescript
// DELETE this entire conditional block:
{buildability && (
  <div className="space-y-2">
    <div className="flex items-center justify-between gap-2">
      <p className="text-xs font-medium text-grey-400 uppercase tracking-wider">Bouwruimte Delta</p>
      ...
    </div>
    {buildability.maxBebouwingspercentage != null && (...)}
    {buildability.maxFar != null && (...)}
    {buildability.maxBuildableAreaM2 != null && (...)}
    {buildability.remainingBuildableAreaM2 != null && (...)}
    {buildability.notes.length > 0 && (...)}
  </div>
)}
```

InspectorPanel does NOT have `ScorePillarRows` pillar bars — it is the compact map slide-over. No pillar bar replacement needed there, only dead code removal.

### Pattern 4: ParcelCard.tsx Cleanup

Remove the buildability subscore display (lines 114-120):
```typescript
// REMOVE this block:
{(subscores.vacancy != null || subscores.buildability != null) && (
  <div className="flex items-center gap-2 text-[11px] text-grey-500">
    {subscores.buildability != null && (
      <span className="tabular-nums">Bouwruimte {Math.round(subscores.buildability)}</span>
    )}
  </div>
)}
```

The `extractScoreSubscores` import can be removed from ParcelCard if vacancy display is also removed, OR kept if vacancy subscore is still shown. The current code only shows buildability (not vacancy) in that block — so the entire `subscores` variable and `extractScoreSubscores` call can be removed from ParcelCard.

### Anti-Patterns to Avoid
- **Storing `pand_oppervlakte_m2` in `ParcelCache`:** ParcelCache stores parcel-level data that persists across scans. The BAG footprint is scan-time derived and should stay in ScanResult.
- **Adding Alembic migration for `pand_oppervlakte_m2`:** Not needed when storing in flags JSONB. Avoid the migration overhead.
- **Displaying raw vacancy_reasons strings with "HARD:" / "PROXY:" prefixes:** Strip these prefixes at display time.
- **Clamping Vrije Ruimte on backend:** Clamp only on frontend (Math.max/min). Backend should store the raw computed value.
- **Making `pand_oppervlakte_m2` required:** It is null for all pre-Phase-72 scan results. All reads must be null-safe.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Geometry intersection area | Custom polygon math | `shapely.intersection(parcel_geometry).area` | Already used at area_scan.py line 201 — just sum the results |
| Backfill script for historical scans | Custom migration tool | None needed — show "onbekend" gracefully | BAG data not persisted; re-derivation impossible without re-scan |
| JSONB flags update pattern | Custom batch update | Pattern from `backfill_scan_building_metrics.py` | If a future backfill IS needed for flags, this tool is the template |

**Key insight:** The pand_oppervlakte_m2 cannot be backfilled for historical records because the BAG footprint geometries are not stored anywhere — they are fetched from the live BAG WFS API at scan time and only summary attributes (`has_pand`, `bouwjaar`, `pand_status`) are persisted in `ParcelCache`. Historical "Vrije ruimte" will show as "onbekend" until parcels are re-scanned.

## Common Pitfalls

### Pitfall 1: Return Signature Change Breaks Test Unpacking
**What goes wrong:** `_derive_bag_attributes_for_parcel()` currently returns a 4-tuple. Extending to 5-tuple breaks all unpackings.
**Why it happens:** Positional tuple unpacking is fragile.
**How to avoid:** Search for all call sites of `_derive_bag_attributes_for_parcel` — there is one in production (`_upsert_parcel_cache` at line ~834) and likely mock calls in unit tests. Update all simultaneously.
**Warning signs:** `ValueError: too many values to unpack` or `not enough values to unpack` at test time.

### Pitfall 2: scored_parcels Tuple Has 11 Elements — Adding 12th
**What goes wrong:** The `scored_parcels` list holds 11-element tuples. The unpacking in Phase 4 (~line 488) and the `address_targets` iteration (~line 560) both reference specific tuple positions.
**Why it happens:** Long positional tuples are fragile — adding an element shifts positions.
**How to avoid:** Add `pand_oppervlakte_m2` as the LAST element (position 11) and update BOTH unpackings:
- Phase 4 loop unpack (adds variable name)
- `_batch_resolve_addresses` call (uses `p, _s, _cat, _f, _vsub, _bsub, _ver, _vs, _os, _bm, c` — add `_pom` at end)
**Warning signs:** `ValueError` during scan job execution.

### Pitfall 3: Vrije Ruimte Shows > 100% or Negative
**What goes wrong:** Geometry precision differences between BAG pand footprint (RD EPSG:28992) and parcel geometry can cause `pand_oppervlakte_m2 > parcel.area_m2` by a small margin.
**Why it happens:** Different data sources with different precision.
**How to avoid:** Always clamp on frontend: `Math.max(0, Math.min(100, (1 - pandOppervlaktM2 / parcel.area_m2) * 100))`.

### Pitfall 4: Vacancy Reasons Show Internal Prefixes
**What goes wrong:** `vacancy_reasons[0]` returns "HARD: Geen pand geregistreerd op perceel" — the "HARD:" prefix is an internal classification marker, not user-facing.
**Why it happens:** The `compute_vacancy_confidence()` function in `parcel_scoring.py` formats reasons as `"HARD: ..."` / `"PROXY: ..."` for internal categorization.
**How to avoid:** Strip the prefix on frontend: `reason.replace(/^(HARD|PROXY):\s*/i, '').trim()`.

### Pitfall 5: InspectorPanel FAR/TAR Missed
**What goes wrong:** Developer only removes FAR/TAR from `ParcelDetailModal.tsx` but misses `InspectorPanel.tsx` which has its own `deriveBuildabilityForInspector()` function (lines 25-77) and "Bouwruimte Delta" section (lines 273-321).
**Why it happens:** Two separate components render parcel data.
**How to avoid:** Plan must explicitly call out BOTH components as targets. InspectorPanel is the map-side slide-over (no pillar bars, but has FAR/TAR delta section).

### Pitfall 6: Backfill Misunderstanding — BAG Data Not Persisted
**What goes wrong:** Plan assumes BAG footprint data can be re-derived for existing scan results without re-scanning.
**Why it happens:** The `backfill_scan_building_metrics.py` tool works because `bestemmingen` IS persisted in `ParcelCache`. But `pand_oppervlakte_m2` needs the BAG spatial index which is NOT persisted anywhere.
**How to avoid:** Accept that historical scans show `null` for `pand_oppervlakte_m2`. Display "Footprint onbekend" gracefully. No backfill script needed. Document this clearly in plan.

### Pitfall 7: `_upsert_parcel_cache` Returns Only 2 Values — Must Update to 3
**What goes wrong:** `_upsert_parcel_cache` currently returns `(parcel, address_lookup_xy)`. If `pand_oppervlakte_m2` is captured inside but not returned, it is lost.
**Why it happens:** The function's return type signature must be extended to `tuple[ParcelCache, tuple[float, float] | None, float | None]`.
**How to avoid:** Update the function's return statement AND type annotation AND call site unpacking together.

### Pitfall 8: area_scan.py Line Count Approaching 300 Lines Limit
**What goes wrong:** `area_scan.py` is already large (935+ lines). Adding more code may push it over project's 300-line guideline per file.
**Why it happens:** File grew organically with each phase.
**How to avoid:** The changes are small (< 20 lines net change). No split needed for this phase. Note for future refactoring.

## Code Examples

### Backend: Extended `_derive_bag_attributes_for_parcel` signature
```python
# Source: backend/app/jobs/area_scan.py (direct codebase inspection)
def _derive_bag_attributes_for_parcel(
    parcel_geometry: BaseGeometry,
    bag_index: BagSpatialIndex | None,
) -> tuple[bool, int | None, str | None, tuple[float, float] | None, float | None]:
    """Derive parcel-level BAG attributes from intersecting building footprints.

    Returns: (has_pand, bouwjaar, pand_status, address_point, pand_oppervlakte_m2)
    pand_oppervlakte_m2: total area of all qualifying BAG pand footprints within parcel (m²)
    """
    if bag_index is None:
        return False, None, None, None, None

    candidate_indices = bag_index.tree.query(parcel_geometry)
    if len(candidate_indices) == 0:
        return False, None, None, None, None

    intersect_count = 0
    total_footprint_area = 0.0      # sum of all qualifying pand intersections
    ...
    for raw_idx in iterable_indices:
        ...
        overlap_area = bag_geom.intersection(parcel_geometry).area
        if overlap_area < MIN_BUILDING_OVERLAP_M2:
            continue
        intersect_count += 1
        total_footprint_area += overlap_area    # accumulate all panden
        ...

    if intersect_count == 0:
        return False, None, None, None, None

    pand_oppervlakte_m2: float | None = total_footprint_area if total_footprint_area > 0 else None
    return True, bouwjaar_value, pand_status_value, best_address_point, pand_oppervlakte_m2
```

### Backend: flags storage for pand_oppervlakte_m2
```python
# Source: backend/app/jobs/area_scan.py Phase 4 (direct codebase inspection)
# Merge pand_oppervlakte_m2 into building_metrics before storing in flags:
final_bm: dict[str, float | None] = (
    dict(building_metrics) if isinstance(building_metrics, dict) else {}
)
if pand_oppervlakte_m2 is not None:
    final_bm["pand_oppervlakte_m2"] = pand_oppervlakte_m2

ranked_values.append({
    "organization_id": org_id,
    "scan_id": scan.id,
    "parcel_id": parcel.id,
    "score": score,
    "flags": {
        "category": category,
        "factors": factors,
        "subscores": {
            "vacancy": vacancy_subscore,
            "buildability": buildability_subscore,
        },
        "score_model_version": score_model_version,
        "vacancy_signal": vacancy_signal,
        "vacancy_confidence": vacancy_assessment.confidence,
        "vacancy_reasons": vacancy_assessment.reasons,
        "vacancy_model_version": vacancy_assessment.model_version,
        "market_signals": listing_signal,
        "opportunity_signals": opportunity_signals,
        "building_metrics": final_bm,   # now includes pand_oppervlakte_m2
    },
})
```

### Frontend: Read pand_oppervlakte_m2 from building_metrics
```typescript
// Source: frontend/src/components/results/ParcelDetailModal.tsx (direct codebase inspection)
// building_metrics is typed as Record<string, unknown> | null — cast for known keys:
const pandOppervlaktM2 = (parcel.building_metrics as {
  pand_oppervlakte_m2?: number | null
  max_bebouwingspercentage?: number | null
  max_floor_area_ratio?: number | null
} | null)?.pand_oppervlakte_m2 ?? null

const vrijeRuimtePct: number | null =
  pandOppervlaktM2 != null && parcel.area_m2 != null && parcel.area_m2 > 0
    ? Math.max(0, Math.min(100, (1 - pandOppervlaktM2 / parcel.area_m2) * 100))
    : null
```

### Frontend: Vacancy reason prefix stripping
```typescript
// Strip internal "HARD:" / "PROXY:" prefixes before display:
const topVacancyReason: string | undefined =
  (parcel.vacancy_reasons?.[0] ?? '').replace(/^(HARD|PROXY):\s*/i, '').trim() || undefined
```

### Frontend: Transformatiepotentie formula (Claude's discretion — calibrated 40/40/20 split)
```typescript
function deriveTransformatiePotentie(
  bouwjaar: number | null,
  supportsResidentialMixed: boolean,
  area_m2: number | null,
): { score: number; label: string } {
  const bouwjaarScore =
    bouwjaar == null ? 20
    : bouwjaar < 1960 ? 40  // very old, high transform potential
    : bouwjaar < 1980 ? 30
    : bouwjaar < 2000 ? 20
    : bouwjaar < 2010 ? 10
    : 5                     // very recent, low transform potential

  const bestemmingScore = supportsResidentialMixed ? 40 : 15

  const areaScore =
    area_m2 == null ? 10
    : area_m2 >= 1500 ? 20
    : area_m2 >= 750 ? 15
    : area_m2 >= 300 ? 10
    : 5

  const score = bouwjaarScore + bestemmingScore + areaScore

  const parts: string[] = []
  if (bouwjaar != null) parts.push(`Bouwjaar ${bouwjaar}`)
  parts.push(supportsResidentialMixed ? 'wonen ok' : 'niet-wonen')

  return { score, label: parts.join(' · ') }
}
```

### Frontend: ScorePillarRows component (unchanged — just different props)
```typescript
// The existing ScorePillarRows component (lines 243-275 of ParcelDetailModal.tsx) is reused unchanged.
// It accepts: label, value (0-100 number | null), context (string | undefined)
// The formatPillarLevel() function is also kept for the level text ("Hoog", "Matig", etc.)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| "Bebouwbaarheid" pillar from FAR/TAR (0% fill rate → always "onbekend") | "Vrije ruimte" from real BAG footprint area | Phase 72 | Real data replaces onbekend placeholder |
| "Leegstandsrisico" label for abstract score | "Beschikbaarheid" label for vacancy_confidence | Phase 72 | More intuitive naming |
| Transformatiepotentie from composite score + scoring engine internals | Simple weighted bouwjaar + bestemming + perceelgrootte | Phase 72 | Transparent, directly explainable inputs |
| Planruimte (FAR/TAR) section with TAR/FAR cards | Removed entirely | Phase 72 | Removes noisy "onbekend" placeholders |
| deriveBuildabilityForInspector() in InspectorPanel | Removed | Phase 72 | Dead code cleanup |

**Deprecated/outdated after Phase 72:**
- `formatPlanruimteLabel()`: Deleted, no replacement
- `deriveBuildabilityScore()`: Deleted, replaced by `pandOppervlaktM2 / area_m2` inline
- `deriveTransformationScore()`: Deleted, replaced by `deriveTransformatiePotentie()`
- `deriveBuildabilityForInspector()`: Deleted from InspectorPanel, no replacement there
- InspectorPanel "Bouwruimte Delta" section: Deleted, no replacement

## Open Questions

1. **Should `pand_oppervlakte_m2` be a top-level flags key or nested under `building_metrics`?**
   - What we know: `building_metrics` already exists and holds other zoning metrics. Nesting is consistent.
   - What's unclear: Future SQL filtering needs.
   - Recommendation: Nest in `building_metrics` for this phase. Promotes to a real column if filtering is needed later.

2. **Exact Transformatiepotentie formula calibration**
   - What we know: Must use bouwjaar, bestemming, perceelgrootte. Weights at Claude's discretion.
   - Recommendation: Use 40/40/20 split (Code Examples section). Results in 0-100 score. Example: 1958 pand + wonen + 800m² = 40+40+15 = 95. 2020 pand + bedrijf + 200m² = 5+15+5 = 25. Reasonable spread.

3. **vacancy_reasons prefix stripping — backend vs frontend?**
   - What we know: Prefixes are "HARD:" / "PROXY:" from `parcel_scoring.compute_vacancy_confidence()`. They are used for internal categorization.
   - Recommendation: Strip at frontend display layer only. Backend reason format is useful for debugging and should not be changed in this phase.

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection — `backend/app/jobs/area_scan.py` lines 173-226, 380-570, 755-884
- Direct codebase inspection — `backend/app/models/scan_result.py`
- Direct codebase inspection — `backend/app/scans/schemas.py` (ScanResultItem, building_metrics field)
- Direct codebase inspection — `backend/app/scans/service.py` (list_scan_results)
- Direct codebase inspection — `backend/app/scans/router.py` (ScanResultItem construction, lines 1942-2018)
- Direct codebase inspection — `backend/app/services/parcel_scoring.py` (vacancy_reasons format, lines 210-218)
- Direct codebase inspection — `backend/app/tools/backfill_scan_building_metrics.py` (backfill pattern)
- Direct codebase inspection — `frontend/src/components/results/ParcelDetailModal.tsx` (full 747 lines)
- Direct codebase inspection — `frontend/src/components/layout/InspectorPanel.tsx` (full 402 lines)
- Direct codebase inspection — `frontend/src/components/results/ParcelCard.tsx`
- Direct codebase inspection — `frontend/src/lib/types/scan.ts`
- Direct codebase inspection — `frontend/src/lib/score.ts`
- Direct codebase inspection — `backend/alembic/versions/3d97e34821f2_add_generated_dossiers_table.py` (migration pattern)
- Direct codebase inspection — `.planning/phases/72-parcel-detail-redesign/72-CONTEXT.md`

### Secondary (MEDIUM confidence)
- None — all findings from direct codebase inspection

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — confirmed from active imports and package usage
- Architecture: HIGH — all patterns derived from actual source code with exact line numbers
- Pitfalls: HIGH — identified from actual code structure (tuple arity, HARD/PROXY prefix format verified in parcel_scoring.py)
- Backfill constraint: HIGH — confirmed BAG data is NOT persisted in ParcelCache; only has_pand/bouwjaar/pand_status are stored

**Research date:** 2026-03-03
**Valid until:** 2026-04-03 (stable codebase — 30-day window)
