# Phase 90: Frontend Fysiek Risicoprofiel - Research

**Researched:** 2026-03-10
**Domain:** React/TypeScript frontend integration, MapLibre vector tile styling, Pydantic-to-TypeScript schema mapping
**Confidence:** HIGH

## Summary

Phase 90 is a pure frontend phase. All backend data is already flowing -- `FysiekRisicoProfiel` is populated in `PropertyReportResponse` via the property aggregator (Phase 88), and the sub-components (`SoilProfile`, `FoundationRisk`, `AsbestIndicator`, `BodemData`, `KCAFCostIndication`, `FunderingsrisicogebiedData`) are fully typed in `backend/app/schemas/fysiek_risico.py`. The challenge is threefold: (1) add TypeScript types mirroring the Pydantic schemas, (2) build a cohesive "Fysiek Risicoprofiel" section in ParcelDetailModal, and (3) add a foundation-risk tile coloring layer to the area scan map.

The critical architectural constraint is that **scan_results flags JSONB does NOT contain foundation risk data** -- the area scan pipeline only stores score, vacancy, market signals, and building metrics. For FRNT-03 (tile coloring by foundation risk), the tile_proxy SQL query must be extended to include foundation risk fields, or the area scan pipeline must be extended to store the risk level in flags. The simpler path is extending tile_proxy.py since it already JOINs parcel_cache and scan_results.

**Primary recommendation:** Extend the PropertyReportResponse TypeScript types with FysiekRisicoProfiel interfaces, build a FysiekRisicoprofielSection component for ParcelDetailModal, and add a `foundation_risk` overlay layer to ParcelScoreLayer.tsx backed by new fields in tile_proxy.py SQL.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| FRNT-01 | User sees Fysiek Risicoprofiel section in ParcelDetailModal with sub-cards for bodem, fundering, asbest, and verontreiniging | Backend FysiekRisicoProfiel schema fully available in PropertyReportResponse; TypeScript types need mirroring; new component needed |
| FRNT-02 | All risk indicators display amber confidence badges with source attribution and "indicatief" disclaimers | Each sub-schema has `disclaimer` field; risk levels are hoog/middel/laag/onbekend; amber-only styling per project decision |
| FRNT-03 | Area scan map tiles color parcels by foundation risk level alongside existing opportunity score | tile_proxy.py SQL needs extension; ParcelScoreLayer.tsx needs new overlay; LayerToggle catalog needs new entry |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19.x | UI rendering | Already in project |
| TypeScript | 5.x | Type safety | Already in project |
| MapLibre GL JS | 4.x | Map tile rendering | Already in project |
| Tailwind CSS | 4.x | Styling | Already in project |
| lucide-react | latest | Icons | Already in project |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @tanstack/react-query | 5.x | Data fetching (ParcelDetailModal uses useParcelEnrichment) | Only if new API endpoint needed |

### Alternatives Considered
None -- this is pure frontend integration using existing stack.

**Installation:**
No new dependencies needed.

## Architecture Patterns

### FRNT-01: ParcelDetailModal FysiekRisicoProfiel Section

The ParcelDetailModal currently shows data from `ScanResultItem` (tile/scan data). The `FysiekRisicoProfiel` data lives in `PropertyReportResponse` (per-property API response). Two architectural options:

**Option A (Recommended): Enrichment via existing report endpoint**
The ParcelDetailModal already fetches enrichment via `useParcelEnrichment`. The fysiek risico data can be fetched on-demand when the modal opens, similar to how vergunningen are loaded. This matches the existing Tier 2 enrichment pattern.

**Option B: New dedicated endpoint**
Build a `/parcels/{id}/fysiek-risico` endpoint. Unnecessary -- the data is already in PropertyReportResponse.

**Decision: Option A.** The `fysiek_risico_profiel` field already exists on `PropertyReportResponse`. The frontend needs to either (a) use the existing report endpoint or (b) extend the at-point endpoint response to include it.

Looking at the at-point endpoint (`/parcels/at-point`), it constructs a `ParcelAtPointResponse` from raw SQL -- it does NOT call the property aggregator, so fysiek risico data is NOT available there. The cleanest path is to add a lightweight endpoint or extend `useParcelEnrichment` to fetch fysiek risico alongside vergunningen.

However, examining the data flow more carefully: the ParcelDetailModal receives a `ScanResultItem` from the scan results list or from `at-point`. The fysiek risico computation requires real-time API calls (BRO WMS, PDOK WFS) which happen in the property aggregator. The area scan does NOT compute fysiek risico per-parcel (too expensive for thousands of parcels).

**Revised approach:** The fysiek risico section should load on-demand when the ParcelDetailModal opens, making API calls for that specific parcel. This matches the Tier 2 enrichment pattern already established. Either:
1. Extend the enrichment endpoint to include fysiek risico
2. Call the property report endpoint (`/properties/report`) and extract fysiek_risico_profiel

Option 2 is cleaner -- the data is already computed there. But it's a heavy endpoint (calls 9+ APIs). A better approach: create a lightweight `/parcels/{id}/fysiek-risico` endpoint that only calls the 3 fysiek risico APIs (BRO, funderingsrisico, foundation engine) and returns `FysiekRisicoProfiel`.

**Final recommendation:** Create a new lightweight endpoint that computes fysiek risico on-demand for a single parcel, with a React Query hook (`useFysiekRisico`) in the frontend.

### FRNT-02: Amber Confidence Badges

Each sub-risk in FysiekRisicoProfiel has:
- `risk: "hoog" | "middel" | "laag" | "onbekend"`
- `disclaimer: string` (source attribution text)
- `reden: string` (explanation text)

Per project decision: **ALL badges are amber, never red.** Even "hoog" risk gets amber styling with different intensity. This prevents the UI from implying definitive/authoritative risk assessment.

Existing badge pattern in the codebase:
```typescript
// From ParcelDetailModal -- amber-accent badges
<span className="rounded-full border border-amber-accent/40 bg-amber-accent/10 px-2.5 py-1 text-xs text-amber-accent">
```

Risk level badge variants (all amber family):
- `hoog`: `border-amber-500/40 bg-amber-500/15 text-amber-400` (strongest amber)
- `middel`: `border-amber-accent/30 bg-amber-accent/10 text-amber-accent` (standard amber)
- `laag`: `border-grey-700 bg-grey-850 text-grey-300` (muted, not alarming)
- `onbekend`: `border-grey-800 bg-grey-900 text-grey-500` (deemphasized)

### FRNT-03: Foundation Risk Tile Coloring

**Current tile architecture:**
- `tile_proxy.py` generates MVT tiles via PostGIS `ST_AsMVT`
- `ParcelScoreLayer.tsx` adds multiple overlay layers (score, built_status, vacancy_signal, build_capacity, report_coverage)
- `layers.ts` defines the layer catalog (5 existing overlays)
- `LayerToggle.tsx` renders dropdown for overlay selection
- `useMapLayerState` hook manages active overlay state

**The problem:** Foundation risk is computed by `foundation_risk_engine.py` using bouwjaar + soil type. The area scan pipeline does NOT store this data. The tile_proxy.py SQL query has no access to fysiek risico fields.

**Solution approach:**
1. Compute foundation risk level during the area scan pipeline and store in `scan_results.flags` as `foundation_risk_level` (hoog/middel/laag/onbekend). This is a pure function -- no API calls needed since bouwjaar is already in parcel_cache.
2. BUT soil_type is NOT in scan_results or parcel_cache. It requires a WMS call per parcel, which is too expensive at scan time.

**Revised approach:** Use a **heuristic proxy** for tile coloring that doesn't require soil data:
- `bouwjaar < 1945` = likely hoog risk (wooden piles era)
- `bouwjaar 1945-1970` = middel risk (transition era)
- `bouwjaar > 1970` = laag risk (concrete piles)
- `bouwjaar is null` = onbekend

This bouwjaar data IS already in the tile_proxy.py SQL output. The tile coloring can use a MapLibre data-driven expression on the existing `bouwjaar` field -- no backend changes needed.

**Even better:** Add the foundation risk heuristic result to the tile SQL directly:
```sql
CASE
  WHEN pc.bouwjaar IS NULL THEN 'onbekend'
  WHEN pc.bouwjaar < 1945 THEN 'hoog'
  WHEN pc.bouwjaar < 1970 THEN 'middel'
  ELSE 'laag'
END AS foundation_risk_proxy
```

This approach:
- Requires minimal backend change (one CASE in SQL)
- No area scan pipeline changes needed
- Tile data already includes bouwjaar
- Frontend adds one new overlay layer definition

### Recommended Project Structure (new files)
```
frontend/src/
  components/results/
    FysiekRisicoprofielSection.tsx  # New: risk section component
  hooks/
    useFysiekRisico.ts             # New: React Query hook for on-demand data
  lib/types/
    property.ts                     # Modified: add FysiekRisicoProfiel types
  components/map/
    ParcelScoreLayer.tsx            # Modified: add foundation risk overlay
  lib/map/
    layers.ts                       # Modified: add 'foundation_risk' to catalog
backend/app/
  services/
    tile_proxy.py                   # Modified: add foundation_risk_proxy column
  scans/
    router.py                       # Modified: add lightweight fysiek risico endpoint
```

### Anti-Patterns to Avoid
- **Never use red badges for risk**: Per project decision, all risk indicators are amber. "hoog" means amber-intense, not red.
- **Never present risk as definitive**: Every card must have "indicatief" disclaimer and source attribution.
- **Never block the modal on risk data loading**: Show a skeleton/loading state for the risk section while the enrichment call is in-flight.
- **Never call the full property report endpoint**: It's too heavy (9+ API calls). Create a focused endpoint instead.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Risk level badge styling | Custom badge component per risk type | Reusable `RiskBadge` component with `level` prop | 4 risk types x 4 sub-risks = combinatorial explosion if hand-rolled |
| Tile data-driven styling | JavaScript post-processing of tile features | MapLibre `interpolate`/`match` expressions | GPU-accelerated, no performance overhead |
| Foundation risk in tiles | Expensive per-parcel API calls at scan time | SQL CASE expression in tile_proxy.py | Bouwjaar is already in parcel_cache, zero additional I/O |
| Loading state for risk section | Custom loading spinners | Existing skeleton pattern from `useParcelEnrichment` | Consistent UX with existing enrichment sections |

## Common Pitfalls

### Pitfall 1: Scan data vs Report data confusion
**What goes wrong:** ParcelDetailModal uses `ScanResultItem` (from scan/tile data), but fysiek risico is in `PropertyReportResponse` (from property aggregator). Mixing these up leads to undefined fields.
**Why it happens:** The data sources look similar but come from completely different pipelines.
**How to avoid:** Keep the fysiek risico fetch as a separate React Query hook (`useFysiekRisico`), clearly separated from the scan result data.
**Warning signs:** `undefined` errors when accessing fysiek risico fields from ScanResultItem.

### Pitfall 2: MVT property type coercion
**What goes wrong:** MapLibre MVT properties are all strings or numbers. Booleans become `"true"`/`"false"` strings.
**Why it happens:** Protobuf (MVT format) doesn't support boolean values natively.
**How to avoid:** Always use `['to-string', ['coalesce', ['get', 'field'], 'default']]` pattern for boolean/null fields in MapLibre expressions. The existing ParcelScoreLayer already handles this correctly for `has_pand`.
**Warning signs:** Layer filter expressions not matching expected features.

### Pitfall 3: Circular import with TypeScript types
**What goes wrong:** Adding FysiekRisicoProfiel to property.ts creates import ordering issues.
**Why it happens:** Backend has this problem (solved with TYPE_CHECKING + model_rebuild), frontend types are simpler but can still have ordering issues.
**How to avoid:** Define fysiek risico types in property.ts (same file as other report types) -- TypeScript interfaces don't have runtime circular dependency issues.

### Pitfall 4: TILE_SCHEMA_VERSION not bumped
**What goes wrong:** Browser caches old tiles without the new foundation_risk_proxy field, layer shows no data.
**Why it happens:** The frontend uses `TILE_SCHEMA_VERSION` to bust browser tile cache.
**How to avoid:** Bump `TILE_SCHEMA_VERSION` in `api.ts` (currently at '9') to '10' when adding the new SQL column.
**Warning signs:** New overlay layer shows no colored parcels despite data existing.

### Pitfall 5: Endpoint returns fysiek risico for parcels WITHOUT coordinate data
**What goes wrong:** BRO WMS requires RD coordinates. Parcels without geometry or building data can't get soil classification.
**Why it happens:** Not all parcels have building geometry (especially empty parcels).
**How to avoid:** Return `null` fysiek risico gracefully when coordinates are unavailable. Show "Onvoldoende gegevens" in the UI rather than an error.

## Code Examples

### TypeScript Types (add to property.ts)
```typescript
// Mirrors backend/app/schemas/fysiek_risico.py
export interface SoilProfile {
  soilcode: string | null
  soilname: string | null
  dominant_type: string // klei, veen, zand, leem, onbekend
  dominant_type_label: string
  disclaimer: string
}

export interface FunderingsrisicogebiedData {
  pc6: string
  gemeente: string | null
  fgr: string | null
  percvoor1970: number | null
  n_bag: number | null
  legenda: string | null
  disclaimer: string
}

export interface FoundationRisk {
  risk: 'hoog' | 'middel' | 'laag' | 'onbekend'
  bouwjaar: number | null
  bodemtype: string | null
  reden: string
  recommended_action: string | null
  disclaimer: string
}

export interface KCAFCostIndication {
  low_eur: number
  high_eur: number
  low_per_m2: number
  high_per_m2: number
  oppervlakte_m2: number
  disclaimer: string
}

export interface FysiekRisicoProfiel {
  overall_risk: 'hoog' | 'middel' | 'laag' | 'onbekend'
  overall_explanation: string
  foundation_risk: FoundationRisk | null
  soil_profile: SoilProfile | null
  asbest_indicator: AsbestIndicator | null
  bodem_data: BodemData | null
  funderingsrisicogebied: FunderingsrisicogebiedData | null
  kcaf_cost: KCAFCostIndication | null
  disclaimer: string
}
```

### Amber Risk Badge Pattern
```typescript
// Source: project convention (amber-only, never red)
const RISK_BADGE_STYLES: Record<string, string> = {
  hoog: 'border-amber-500/40 bg-amber-500/15 text-amber-400',
  middel: 'border-amber-accent/30 bg-amber-accent/10 text-amber-accent',
  laag: 'border-grey-700 bg-grey-850 text-grey-300',
  onbekend: 'border-grey-800 bg-grey-900 text-grey-500',
}

const RISK_LABELS: Record<string, string> = {
  hoog: 'Hoog risico',
  middel: 'Middel risico',
  laag: 'Laag risico',
  onbekend: 'Onbekend',
}
```

### Foundation Risk Tile Overlay (MapLibre expression)
```typescript
// Source: follows existing ParcelScoreLayer.tsx pattern
map.addLayer({
  id: PARCEL_FOUNDATION_RISK_FILL_LAYER_ID,
  type: 'fill',
  source: SOURCE_ID,
  'source-layer': sourceLayer,
  filter: ['has', 'score'],
  layout: { visibility: 'none' },
  paint: {
    'fill-color': [
      'match',
      ['to-string', ['coalesce', ['get', 'foundation_risk_proxy'], 'onbekend']],
      'hoog',     '#f59e0b', // Amber (NOT red)
      'middel',   '#fbbf24', // Light amber
      'laag',     '#64748b', // Slate grey
      '#475569',             // Default: dark slate (onbekend)
    ],
    'fill-opacity': [
      'case',
      ['boolean', ['feature-state', 'selected'], false], 0.9,
      ['boolean', ['feature-state', 'hover'], false], 0.8,
      0.58,
    ],
  },
  minzoom: 14,
})
```

### tile_proxy.py SQL Extension
```sql
-- Add to the mvt_data CTE SELECT list:
CASE
  WHEN pc.bouwjaar IS NULL THEN 'onbekend'
  WHEN pc.bouwjaar < 1945 THEN 'hoog'
  WHEN pc.bouwjaar BETWEEN 1945 AND 1969 THEN 'middel'
  ELSE 'laag'
END AS foundation_risk_proxy
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Full PropertyReportResponse for risk data | Lightweight per-parcel endpoint | Phase 90 | Avoids 9+ API calls when user just needs risk section |
| Risk computed at scan time for all parcels | On-demand per parcel + tile proxy heuristic | Phase 90 | Avoids expensive WMS calls for thousands of parcels |

## Open Questions

1. **Backend endpoint scope**
   - What we know: PropertyReportResponse includes fysiek_risico_profiel but is expensive (9+ APIs)
   - What's unclear: Should we create a new lightweight endpoint, or extend the existing enrichment endpoint?
   - Recommendation: New endpoint `/parcels/{parcel_id}/fysiek-risico` that only runs the 3 relevant APIs (BRO, funderingsrisico, foundation engine). This keeps the enrichment endpoint focused on vergunningen.

2. **Tile proxy foundation risk accuracy**
   - What we know: Bouwjaar-only proxy misses soil type factor (klei/veen amplifies risk)
   - What's unclear: Is the bouwjaar-only heuristic acceptable for tile coloring?
   - Recommendation: Yes -- tile coloring is for spatial pattern overview, not per-parcel assessment. The detailed risk (with soil type) shows in ParcelDetailModal. Add a tooltip/legend disclaimer: "Indicatief op basis van bouwjaar. Klik voor volledig profiel."

3. **ParcelDetailModal data flow for scan-initiated views**
   - What we know: Modal receives ScanResultItem from scan results; fysiek risico needs separate fetch
   - What's unclear: Is there a parcel identifier in ScanResultItem that can be used for the fysiek risico endpoint?
   - Recommendation: Yes -- `ScanResultItem.parcel_id` is the `ParcelCache.id` UUID, which has geometry for coordinate extraction. The new endpoint can accept this ID.

## Sources

### Primary (HIGH confidence)
- `backend/app/schemas/fysiek_risico.py` - Complete FysiekRisicoProfiel Pydantic schema with all sub-types
- `backend/app/schemas/property.py` - PropertyReportResponse already includes fysiek_risico_profiel field
- `backend/app/services/foundation_risk_engine.py` - Pure function risk engine, no I/O
- `backend/app/services/tile_proxy.py` - MVT tile generation SQL with JOIN pattern
- `frontend/src/components/map/ParcelScoreLayer.tsx` - Existing 5 overlay layers pattern
- `frontend/src/lib/map/layers.ts` - Layer catalog with ParcelOverlayLayerId type
- `frontend/src/components/results/ParcelDetailModal.tsx` - Current modal structure (763 lines)
- `frontend/src/lib/types/property.ts` - Existing TypeScript types (no fysiek risico types yet)
- `frontend/src/lib/types/scan.ts` - ScanResultItem type (no fysiek risico fields)

### Secondary (MEDIUM confidence)
- `backend/app/services/property_aggregator.py` - asyncio.gather wiring for fysiek risico
- `backend/app/jobs/area_scan.py` - Confirms scan_results.flags does NOT include fysiek risico

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All existing dependencies, no new libraries needed
- Architecture: HIGH - Clear separation between tile-level heuristic and per-parcel detail; established patterns for both
- Pitfalls: HIGH - Based on direct codebase analysis, known MVT quirks, existing patterns

**Research date:** 2026-03-10
**Valid until:** 2026-04-10 (stable frontend patterns, no external API changes expected)
