# Phase 78: Extended CBS Demographics & Income - Research

**Researched:** 2026-03-07
**Domain:** CBS OData v4 API extension, demographic data modeling, frontend data visualization
**Confidence:** HIGH

## Summary

Phase 78 extends the existing CBS OData v4 client to fetch 14 additional measure codes from the same Kerncijfers wijken en buurten dataset (86165NED). The infrastructure is fully in place: the `CBSODataClient`, rate limiter, retry logic, JSONB storage in `neighborhood_metrics`, and the frontend `CbsNeighborhoodCard` component all exist. This phase is purely additive: more measure codes in the backend, extended JSONB payload structure, and new frontend cards/visualizations.

The CBS API has been verified to contain all required measure codes for age distribution (5 groups), household composition (4 fields), income metrics (3 variants), and income distribution (4 percentile fields). All use the same Observations endpoint pattern already implemented. Zero new dependencies are needed on both backend and frontend.

The frontend work depends on Phase 77.1 (tabbed layout) which creates a "Demografie & Inkomen" tab in WijkDetailView and WijkMapPanel. This phase fills that tab with age distribution bars, household composition metrics, income cards, WOZ/inkomen ratio, vergrijzing indicator, and doelgroep classification label. All derived indicators (vergrijzing/verjonging, doelgroep profiel) are computed client-side from the raw CBS data -- no AI or complex backend logic needed.

**Primary recommendation:** Add 14 measure codes to `MEASURE_CODES` dict in `cbs_odata.py`, extend the `get_neighborhood_data()` return payload with `leeftijdsverdeling`, `huishoudens`, and `inkomen` sub-objects, then build 4 frontend card components for the Demografie & Inkomen tab.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DEMO-01 | Wijk detail toont leeftijdsverdeling (0-14, 15-24, 25-44, 45-64, 65+) | CBS measure codes verified: 10680, 53050, 53310, 53715, 80200 (percentages) |
| DEMO-02 | Wijk detail toont huishoudenssamenstelling (eenpersoons, zonder kinderen, met kinderen, gem. grootte) | CBS measure codes verified: 1050015, 1016040, 1016030, M000114 |
| DEMO-03 | Wijk detail toont inkomenscijfers (gem. inkomen per ontvanger, per inwoner, gestandaardiseerd) | CBS measure codes verified: M000223 (already fetched), M000224, M000222 |
| DEMO-04 | Wijk detail toont inkomensverdeling (% laagste 40%, % hoogste 20%) | CBS measure codes verified: D000187, D000185 (personen), D000186, D000184 (huishoudens) |
| DEMO-05 | Wijk detail toont WOZ/inkomen ratio als marktconformiteits-indicator | Derived client-side: WOZ (already fetched) / inkomen per ontvanger |
| DEMO-06 | Wijk detail toont vergrijzing/verjonging indicator | Derived client-side: 65+ percentage vs 0-14 + 15-24 percentage comparison |
| DEMO-07 | Wijk detail toont doelgroep-validatie profiel label | Derived client-side: rule-based classification from age + household data |
</phase_requirements>

## Standard Stack

### Core (already installed -- zero new dependencies)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| httpx | existing | CBS API requests | Already used by CBSODataClient |
| SQLAlchemy 2.x | existing | JSONB storage in AreaScan | Already in use |
| React | 19.x | Frontend components | Already in use |
| Tailwind CSS | 4.x | Styling for bars/charts | Already in use |
| TanStack Query | 5.x | Data fetching | Already in use |

### No New Dependencies
This phase requires zero new pip or npm packages. Age distribution bars are simple `<div>` elements with percentage widths (same pattern as the existing Koop/Huur ratio bar in `CbsNeighborhoodCard.tsx`). No charting library needed.

## Architecture Patterns

### Backend: Extending the CBS Client

The change is contained to a single file (`cbs_odata.py`) plus the return payload structure.

**Pattern: Add measure codes to the existing dict**
```python
# cbs_odata.py — extend MEASURE_CODES dict
MEASURE_CODES: dict[str, str] = {
    # Existing
    "woz": "M001642",
    "stedelijkheid": "ST0001",
    "oad": "ST0003",
    "inwoners": "T001036",
    "woningvoorraad": "M000297",
    "koopwoningen": "1014800",
    "huurwoningen": "1014850_2",
    "dichtheid": "M000100",
    "inkomen": "M000223",
    # NEW — Age groups (percentages)
    "leeftijd_0_14": "10680",
    "leeftijd_15_24": "53050",
    "leeftijd_25_44": "53310",
    "leeftijd_45_64": "53715",
    "leeftijd_65_plus": "80200",
    # NEW — Households
    "huishoudens_totaal": "1050010_2",
    "huishoudens_eenpersoons": "1050015",
    "huishoudens_zonder_kinderen": "1016040",
    "huishoudens_met_kinderen": "1016030",
    "gem_huishoudensgrootte": "M000114",
    # NEW — Income (extended)
    "inkomen_per_inwoner": "M000224",
    "inkomen_gestandaardiseerd": "M000222",
    # NEW — Income distribution
    "inkomen_laagste_40_personen": "D000187",
    "inkomen_hoogste_20_personen": "D000185",
}
```

**Pattern: Extend return payload in `get_neighborhood_data()`**
```python
return {
    "bron": "CBS StatLine OData v4",
    "dataset": f"{self.dataset_id} - Kerncijfers wijken en buurten",
    "peiljaar": self.peiljaar,
    "data": {
        # ... existing fields unchanged ...
        "leeftijdsverdeling": {
            "perc_0_14": data.get("leeftijd_0_14"),
            "perc_15_24": data.get("leeftijd_15_24"),
            "perc_25_44": data.get("leeftijd_25_44"),
            "perc_45_64": data.get("leeftijd_45_64"),
            "perc_65_plus": data.get("leeftijd_65_plus"),
        },
        "huishoudens": {
            "totaal": data.get("huishoudens_totaal"),
            "eenpersoons": data.get("huishoudens_eenpersoons"),
            "zonder_kinderen": data.get("huishoudens_zonder_kinderen"),
            "met_kinderen": data.get("huishoudens_met_kinderen"),
            "gemiddelde_grootte": data.get("gem_huishoudensgrootte"),
        },
        "inkomen": {
            "gem_per_ontvanger": data.get("inkomen"),
            "gem_per_inwoner": data.get("inkomen_per_inwoner"),
            "gem_gestandaardiseerd": data.get("inkomen_gestandaardiseerd"),
            "perc_laagste_40": data.get("inkomen_laagste_40_personen"),
            "perc_hoogste_20": data.get("inkomen_hoogste_20_personen"),
        },
    },
}
```

### Frontend: Component Structure

Phase 77.1 creates the tabbed layout with a "Demografie & Inkomen" tab. This phase fills it with card components.

```
frontend/src/components/projects/
├── CbsNeighborhoodCard.tsx       # EXISTING — keep for Overzicht tab
├── DemografieTab.tsx             # NEW — container for Demografie & Inkomen tab
├── AgeDistributionCard.tsx       # NEW — horizontal bars for 5 age groups
├── HouseholdCard.tsx             # NEW — household composition + avg size
├── IncomeCard.tsx                # NEW — income metrics + distribution
└── DoelgroepLabel.tsx            # NEW — derived classification badge
```

**Pattern: Horizontal bar chart with Tailwind (matching existing Koop/Huur pattern)**
```typescript
// AgeDistributionCard.tsx — age group bars
interface AgeGroup {
  label: string
  percentage: number | null
  color: string  // Tailwind bg class
}

function AgeBar({ label, percentage, color }: AgeGroup) {
  if (percentage == null) return null
  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between">
        <span className="text-xs text-grey-400">{label}</span>
        <span className="text-xs font-medium text-grey-300">{percentage}%</span>
      </div>
      <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-grey-800">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${percentage}%` }} />
      </div>
    </div>
  )
}
```

**Pattern: Doelgroep classification (client-side derivation)**
```typescript
type DoelgroepProfiel = 'studentenwijk' | 'gezinswijk' | 'vergrijzend' | 'gemengd'

function deriveDoelgroep(leeftijdsverdeling: LeeftijdsVerdeling, huishoudens: Huishoudens): DoelgroepProfiel {
  const { perc_15_24, perc_65_plus, perc_0_14 } = leeftijdsverdeling
  const { eenpersoons, totaal } = huishoudens

  // Student area: high 15-24 + high single-person households
  if (perc_15_24 != null && perc_15_24 > 20 && eenpersoons != null && totaal != null && (eenpersoons / totaal) > 0.5) {
    return 'studentenwijk'
  }
  // Aging area: 65+ dominant
  if (perc_65_plus != null && perc_65_plus > 25) {
    return 'vergrijzend'
  }
  // Family area: high 0-14 + households with children
  if (perc_0_14 != null && perc_0_14 > 20) {
    return 'gezinswijk'
  }
  return 'gemengd'
}
```

**Pattern: Vergrijzing/verjonging indicator**
```typescript
type VergrijzingRichting = 'vergrijzend' | 'stabiel' | 'verjongend'

function deriveVergrijzingRichting(perc_65_plus: number | null, perc_0_14: number | null, perc_15_24: number | null): VergrijzingRichting {
  if (perc_65_plus == null) return 'stabiel'
  const jong = (perc_0_14 ?? 0) + (perc_15_24 ?? 0)
  const ratio = perc_65_plus / (jong || 1)
  if (ratio > 1.5) return 'vergrijzend'
  if (ratio < 0.6) return 'verjongend'
  return 'stabiel'
}
```

**Pattern: WOZ/Inkomen ratio**
```typescript
function computeWozInkomenRatio(woz: number | null, inkomen: number | null): number | null {
  if (woz == null || inkomen == null || inkomen === 0) return null
  // WOZ is in units of 1000 EUR in CBS data
  return (woz * 1000) / inkomen
}
// Interpretation: ratio > 8 = hoge ratio (dure markt vs inkomen)
// ratio < 5 = lage ratio (betaalbaar)
```

### Anti-Patterns to Avoid
- **Do NOT create separate API endpoints for demographic data.** It is already fetched during scan and stored in `neighborhood_metrics` JSONB. The frontend reads it from the existing scan response.
- **Do NOT use a charting library (Chart.js, Recharts, etc.)** for simple percentage bars. Tailwind `<div>` bars match the existing pattern and add zero bundle size.
- **Do NOT add demographic derivations (doelgroep, vergrijzing) to the backend.** These are display-only classifications that benefit from instant client-side recomputation if thresholds change.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CBS data fetching | New API client | Extend existing `CBSODataClient` | Same dataset, same endpoint, just more measure codes |
| Percentage bar charts | Install Recharts/Chart.js | Tailwind `<div>` with percentage width | Existing pattern (Koop/Huur bar), zero dependencies |
| Number formatting | Custom formatters | `Intl.NumberFormat('nl-NL')` | Already used in CbsNeighborhoodCard |
| Currency formatting | Custom EUR formatter | `toLocaleString('nl-NL')` with prefix | Already used for WOZ display |

## Common Pitfalls

### Pitfall 1: CBS Values Are in Units (Not Always Obvious)
**What goes wrong:** WOZ values in CBS are in thousands (e.g., 285 = EUR 285,000). Income values are in EUR (not thousands). Mixing them up creates wrong ratios.
**Why it happens:** CBS does not consistently document units in the OData metadata.
**How to avoid:** The existing code already handles WOZ with `Math.round(gemiddelde_woz_waarde * 1000)`. Apply the same pattern. Income values (M000223, M000224, M000222) are already in EUR -- no multiplication needed.
**Warning signs:** WOZ/inkomen ratio looks unreasonably small (forgot to multiply WOZ by 1000) or large (multiplied income too).

### Pitfall 2: CBS ValueAttribute Suppression
**What goes wrong:** Some wijk-level data is suppressed by CBS for privacy (small populations). The observation exists but has a non-empty `ValueAttribute` indicating suppression.
**Why it happens:** CBS suppresses data for wijken with <100 observations to prevent individual identification.
**How to avoid:** Already handled in `_fetch_observations()` which only uses values where `ValueAttribute == ""`. Frontend must handle `null` for every field gracefully.
**Warning signs:** A wijk shows `null` for income distribution but valid data for population. This is normal CBS behavior, not a bug.

### Pitfall 3: Household Counts vs Percentages
**What goes wrong:** Household composition (eenpersoons, met kinderen, zonder kinderen) are absolute counts, NOT percentages. Displaying them as percentages without dividing by total is misleading.
**Why it happens:** CBS measure codes 1050015, 1016030, 1016040 return absolute numbers. Only huishoudens_totaal (1050010_2) gives the denominator.
**How to avoid:** Compute percentages client-side: `(eenpersoons / totaal) * 100`. Always check for null/zero denominator.
**Warning signs:** "95% eenpersoons" on a rural wijk -- probably raw count, not percentage.

### Pitfall 4: OData Filter Length Limit
**What goes wrong:** With 23 measure codes, the OData `$filter` query string with `Measure eq 'X' or Measure eq 'Y'` becomes long. CBS may return 414 URI Too Long.
**Why it happens:** Each measure code adds ~25 chars to the filter. 23 codes = ~575 chars in the filter clause alone.
**How to avoid:** CBS OData v4 supports the `in` operator: `Measure in ('M001642','ST0001',...)`. If URI length becomes a problem, switch to `$filter=Measure in (...)` syntax. However, current length (23 codes) should be safe -- test with a real request first.
**Warning signs:** HTTP 414 from CBS API.

### Pitfall 5: Forgetting to Update TypeScript Types
**What goes wrong:** Backend adds new fields to `neighborhood_metrics` JSONB but frontend `CbsNeighborhoodMetrics` type is not updated, causing type errors or runtime crashes.
**How to avoid:** Update `CbsNeighborhoodMetrics` in `scan.ts` in the same plan as the backend change. The type must match the backend payload exactly.

## Code Examples

### CBS OData Filter with `in` Operator (Alternative)
```python
# If URI length becomes an issue, use `in` operator instead of chained `or`:
measure_codes_str = ",".join(f"'{code}'" for code in MEASURE_CODES.values())
params = {
    "$filter": f"WijkenEnBuurten eq '{identifier}' and Measure in ({measure_codes_str})",
    "$select": "Measure,Value,ValueAttribute",
}
```

### Extended TypeScript Types
```typescript
// scan.ts — extend CbsNeighborhoodMetrics
export interface CbsLeeftijdsVerdeling {
  perc_0_14: number | null
  perc_15_24: number | null
  perc_25_44: number | null
  perc_45_64: number | null
  perc_65_plus: number | null
}

export interface CbsHuishoudens {
  totaal: number | null
  eenpersoons: number | null
  zonder_kinderen: number | null
  met_kinderen: number | null
  gemiddelde_grootte: number | null
}

export interface CbsInkomen {
  gem_per_ontvanger: number | null
  gem_per_inwoner: number | null
  gem_gestandaardiseerd: number | null
  perc_laagste_40: number | null
  perc_hoogste_20: number | null
}

export interface CbsNeighborhoodMetrics {
  bron: string
  dataset: string
  peiljaar: number
  data: {
    gemiddelde_woz_waarde: number | null
    stedelijkheid: CbsStedelijkheid
    demografie: { /* existing fields */ }
    bouwjaar_distributie: { /* existing fields */ }
    // NEW
    leeftijdsverdeling: CbsLeeftijdsVerdeling
    huishoudens: CbsHuishoudens
    inkomen: CbsInkomen
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| CBS OData v3 (data.overheid.nl) | CBS OData v4 (datasets.cbs.nl) | 2024 | Already migrated in v11.0 |
| Separate API calls per metric | Single Observations query with multi-measure filter | Current | Already implemented |
| Frontend chart libraries | Tailwind CSS div bars | Current codebase pattern | Zero bundle cost |

**No deprecated approaches to worry about.** The CBS v4 API and dataset 86165NED are current.

## Open Questions

1. **OData `in` operator support**
   - What we know: CBS OData v4 follows OData 4.0 spec which supports `in` operator
   - What's unclear: Whether CBS's specific implementation supports it (some OData servers don't)
   - Recommendation: Start with chained `or` (existing pattern). Only switch to `in` if 414 errors occur. 23 measure codes should be fine.

2. **Age group percentages vs absolute values**
   - What we know: Measure codes 10680, 53050, 53310, 53715, 80200 are labeled as percentage values in the CBS metadata
   - What's unclear: Whether they are true percentages (0-100) or fractions (0-1)
   - Recommendation: Verify with a single API call during implementation. Most likely percentages (0-100) based on CBS convention for this dataset.

## Sources

### Primary (HIGH confidence)
- CBS OData v4 API MeasureCodes endpoint: `https://datasets.cbs.nl/odata/v1/CBS/86165NED/MeasureCodes` - all 14 new measure codes verified to exist with correct Identifiers
- Existing codebase: `backend/app/government_apis/cbs_odata.py` - client implementation patterns
- Existing codebase: `frontend/src/components/projects/CbsNeighborhoodCard.tsx` - frontend display patterns
- Existing codebase: `frontend/src/lib/types/scan.ts` - TypeScript type definitions

### Secondary (MEDIUM confidence)
- CBS StatLine documentation for Kerncijfers wijken en buurten dataset conventions

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - zero new dependencies, extending existing patterns
- Architecture: HIGH - identical API, same JSONB storage, additive frontend components
- Pitfalls: HIGH - based on direct experience with CBS API in existing codebase
- CBS Measure codes: HIGH - verified against live API MeasureCodes endpoint

**Research date:** 2026-03-07
**Valid until:** 2026-04-07 (CBS dataset IDs stable for 12+ months)
