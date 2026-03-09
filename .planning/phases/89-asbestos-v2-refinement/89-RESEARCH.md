# Phase 89: Asbestos v2 Refinement - Research

**Researched:** 2026-03-10
**Domain:** Asbestos risk heuristic with BAG gebruiksdoel enrichment
**Confidence:** HIGH

## Summary

This phase refines the existing `assess_asbest_risk()` function (in `backend/app/services/asbest_indicator.py`) to account for BAG gebruiksdoel when determining asbestos risk. The current implementation uses bouwjaar only, mapping to NEN 2991 risk bands. Phase 89 adds gebruiksdoel as an **additive-only** signal: industrial and educational buildings get elevated risk, but risk never drops below the bouwjaar baseline.

The implementation is minimal and well-scoped. All required data (gebruiksdoel) is already present on `BuildingData` as `list[str]`. The aggregator already passes `building` to `assess_asbest_risk()`. The only changes are: (1) enhance the risk function to read gebruiksdoel from BuildingData, (2) apply additive uplift logic, (3) update the explanation text, (4) add the `gebruiksdoel_factor` field to `AsbestIndicator` schema, (5) update tests, (6) update frontend type.

**Primary recommendation:** Modify `assess_asbest_risk()` to accept gebruiksdoel from the existing BuildingData, uplift risk for industrial/educational functions, and append gebruiksdoel context to the explanation string. No new API calls, no new dependencies.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ASBT-01 | User sees refined asbestos risk that accounts for BAG gebruiksdoel (industrial/educational = higher risk) | BuildingData already has `gebruiksdoel: list[str]` populated from BAG API. Function signature change + uplift logic. |
| ASBT-02 | Asbestos v2 never reduces risk below bouwjaar baseline (gebruiksdoel is additive only) | Implement as `max(bouwjaar_risk, gebruiksdoel_adjusted_risk)` pattern. Test boundary cases. |
</phase_requirements>

## Standard Stack

### Core

No new libraries needed. This phase modifies existing pure Python functions.

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| pydantic | (existing) | Schema for AsbestIndicator | Already used throughout |

### Supporting

None needed.

### Alternatives Considered

None -- this is a pure logic change within existing infrastructure.

## Architecture Patterns

### Existing Code Structure (relevant files)

```
backend/app/
  services/
    asbest_indicator.py          # assess_asbest_risk() -- MODIFY
    foundation_risk_engine.py    # build_fysiek_risico_profiel() -- NO CHANGE
    property_aggregator.py       # calls assess_asbest_risk(building=building) -- NO CHANGE
  schemas/
    property.py                  # AsbestIndicator schema -- ADD gebruiksdoel_factor field
    address.py                   # BuildingData.gebruiksdoel: list[str] -- ALREADY EXISTS
frontend/src/
  lib/types/property.ts         # AsbestIndicator interface -- ADD gebruiksdoel_factor field
```

### Pattern 1: Additive-Only Risk Uplift

**What:** Compute bouwjaar baseline first, then apply gebruiksdoel uplift. Never go below baseline.
**When to use:** When a secondary factor should only increase risk, never decrease it.
**Example:**

```python
# Step 1: compute bouwjaar baseline (existing logic)
baseline = _bouwjaar_risk(bouwjaar)  # "geen", "hoog", "middel", "onbekend"

# Step 2: check gebruiksdoel for uplift
has_elevated_function = _has_elevated_gebruiksdoel(building.gebruiksdoel)

# Step 3: apply uplift (additive only -- ASBT-02)
if has_elevated_function:
    final_risk = max(baseline, "middel")  # using severity ordering
    # If baseline was already "hoog", stays "hoog"
    # If baseline was "middel", stays "middel" (gebruiksdoel confirms)
    # If baseline was "geen" (post-1993), uplift to "middel"
    # If baseline was "onbekend", stays "onbekend" (can't assess)
```

### Pattern 2: BAG Gebruiksdoel Values (HIGH confidence)

BAG API v2 returns these standardized gebruiksdoel values (Bouwbesluit 2012 / Besluit bouwwerken leefomgeving):

| Gebruiksdoel | Dutch | Risk Relevance |
|--------------|-------|----------------|
| `woonfunctie` | Wonen | Baseline -- no uplift |
| `bijeenkomstfunctie` | Vergaderen/evenementen | No uplift |
| `celfunctie` | Gevangenis | No uplift |
| `gezondheidszorgfunctie` | Ziekenhuis/verpleeghuis | No uplift |
| `industriefunctie` | Fabriek/werkplaats | **UPLIFT** -- asbestos heavily used in industrial buildings |
| `kantoorfunctie` | Kantoor | No uplift |
| `logiesfunctie` | Hotel/pension | No uplift |
| `onderwijsfunctie` | School/universiteit | **UPLIFT** -- asbestos common in school buildings (plafonds, isolatie) |
| `overige gebruiksfunctie` | Overig | No uplift |
| `sportfunctie` | Sporthal | No uplift |
| `winkelfunctie` | Winkel | No uplift |

**Key insight:** Only `industriefunctie` and `onderwijsfunctie` warrant uplift. Industrial buildings used asbestos extensively in insulation, roofing (golfplaten), pipe lagging. Educational buildings (especially 1950s-1980s) used asbestos ceiling tiles and thermal insulation.

Note: Values from BAG are capitalized (e.g., `"Woonfunctie"`) -- existing code already lowercases for comparison (see `wkb_classifier.py` pattern).

### Pattern 3: Uplift Decision Matrix

| Bouwjaar Baseline | Gebruiksdoel Elevated? | Final Risk | Explanation |
|-------------------|----------------------|------------|-------------|
| `"hoog"` (1963-1993) | Yes | `"hoog"` | Stays hoog, mention gebruiksdoel confirms |
| `"hoog"` (1963-1993) | No | `"hoog"` | No change |
| `"middel"` (pre-1963) | Yes | `"middel"` | Stays middel, mention gebruiksdoel |
| `"middel"` (pre-1963) | No | `"middel"` | No change |
| `"geen"` (post-1993) | Yes | `"middel"` | **UPLIFT** -- post-ban but industrial/school may still contain legacy materials |
| `"geen"` (post-1993) | No | `"geen"` | No change |
| `"onbekend"` | Yes | `"onbekend"` | Cannot assess without bouwjaar |
| `"onbekend"` | No | `"onbekend"` | Cannot assess |

**Rationale for post-1993 uplift to "middel":** While asbestos was banned in new building materials from 1 January 1994, industrial and educational buildings constructed shortly after the ban may still contain asbestos in existing structural elements that were not replaced, imported materials, or pre-existing components incorporated during construction. The uplift to "middel" (not "hoog") reflects this reduced but non-zero risk.

### Anti-Patterns to Avoid

- **Mutating risk downward:** ASBT-02 explicitly forbids this. The gebruiksdoel check must ONLY ever raise risk or leave it unchanged.
- **Adding async/API calls:** This function is pure/synchronous. BuildingData.gebruiksdoel is already populated before this function is called.
- **Changing the function signature to require new aggregator data:** BuildingData already contains gebruiksdoel. No aggregator changes needed.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Risk severity comparison | String comparison | `_RISK_SEVERITY` dict from `foundation_risk_engine.py` | Already exists, handles ordering correctly |
| Gebruiksdoel normalization | Custom parsing | `.lower()` on list items | BAG values are simple capitalized strings |

## Common Pitfalls

### Pitfall 1: Case Sensitivity on Gebruiksdoel
**What goes wrong:** BAG returns `"Industriefunctie"` (capitalized), comparison against `"industriefunctie"` fails.
**Why it happens:** BAG API returns capitalized values.
**How to avoid:** Lowercase all gebruiksdoel values before comparison, same pattern as `wkb_classifier.py`.
**Warning signs:** Tests pass with hardcoded lowercase but fail with real BAG data.

### Pitfall 2: Empty Gebruiksdoel List
**What goes wrong:** BuildingData.gebruiksdoel defaults to `[]`. Code that doesn't handle empty list may error.
**Why it happens:** Some parcels have no verblijfsobject or VBO lookup fails.
**How to avoid:** `_has_elevated_gebruiksdoel()` should return `False` for empty list.

### Pitfall 3: Uplift on "onbekend" Baseline
**What goes wrong:** Uplifting "onbekend" to "middel" based on gebruiksdoel without bouwjaar context.
**Why it happens:** If bouwjaar is unknown, risk is "onbekend" -- applying gebruiksdoel uplift would create false precision.
**How to avoid:** Only apply gebruiksdoel uplift when bouwjaar baseline is a concrete risk level ("hoog", "middel", "geen"), never when "onbekend".

### Pitfall 4: Forgetting to Update Frontend Type
**What goes wrong:** Backend returns `gebruiksdoel_factor` but TypeScript type doesn't include it.
**How to avoid:** Update `AsbestIndicator` interface in `frontend/src/lib/types/property.ts`.

## Code Examples

### Current assess_asbest_risk Signature
```python
# Source: backend/app/services/asbest_indicator.py
def assess_asbest_risk(*, building: BuildingData | None) -> AsbestIndicator:
```

No signature change needed -- `building.gebruiksdoel` is already accessible.

### Current AsbestIndicator Schema
```python
# Source: backend/app/schemas/property.py:342-358
class AsbestIndicator(BaseModel):
    risk: Literal["hoog", "middel", "geen", "onbekend"]
    bouwjaar: int | None = None
    norm_reference: str | None = None
    reden: str
```

Add `gebruiksdoel_factor` field:
```python
class AsbestIndicator(BaseModel):
    risk: Literal["hoog", "middel", "geen", "onbekend"]
    bouwjaar: int | None = None
    norm_reference: str | None = None
    gebruiksdoel_factor: str | None = Field(
        default=None,
        description="BAG gebruiksdoel that contributed to risk uplift (e.g., 'industriefunctie')",
    )
    reden: str
```

### Elevated Gebruiksdoel Check Pattern
```python
_ELEVATED_GEBRUIKSDOEL = {"industriefunctie", "onderwijsfunctie"}

def _has_elevated_gebruiksdoel(gebruiksdoel: list[str]) -> tuple[bool, str | None]:
    """Check if any gebruiksdoel warrants asbestos risk uplift."""
    for gd in gebruiksdoel:
        if gd.lower() in _ELEVATED_GEBRUIKSDOEL:
            return True, gd.lower()
    return False, None
```

### Aggregator Call (NO CHANGE needed)
```python
# Source: backend/app/services/property_aggregator.py:1069
asbest_result: AsbestIndicator = assess_asbest_risk(building=building)
```

Building already carries gebruiksdoel -- no aggregator modification required.

### Frontend Type Update
```typescript
// Source: frontend/src/lib/types/property.ts
export interface AsbestIndicator {
  risk: 'hoog' | 'middel' | 'geen' | 'onbekend'
  bouwjaar: number | null
  norm_reference: string | null
  gebruiksdoel_factor: string | null  // NEW
  reden: string
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Bouwjaar-only NEN 2991 bands | Bouwjaar + gebruiksdoel additive | Phase 89 (this phase) | Industrial/educational buildings get appropriate risk elevation |

**Not changing:**
- NEN 2991 risk bands remain the baseline
- The 1994 asbestos ban cutoff date is fixed Dutch law
- No external API calls added

## Open Questions

1. **Should `sportfunctie` get uplift?**
   - What we know: Sports halls (especially 1960s-1980s) sometimes had asbestos in roofing and ceiling materials
   - What's unclear: Whether prevalence is high enough to warrant uplift
   - Recommendation: Keep to industriefunctie + onderwijsfunctie only for v2. sportfunctie can be added in future if evidence supports it.

2. **Multiple gebruiksdoel values**
   - What we know: A building can have multiple gebruiksdoel values (e.g., `["woonfunctie", "industriefunctie"]`)
   - What's unclear: Nothing -- this is well-defined
   - Recommendation: If ANY gebruiksdoel is elevated, apply uplift. Use first matching elevated function for the `gebruiksdoel_factor` field.

## Sources

### Primary (HIGH confidence)
- `backend/app/services/asbest_indicator.py` -- current implementation reviewed
- `backend/app/schemas/property.py` -- AsbestIndicator schema reviewed
- `backend/app/schemas/address.py` -- BuildingData.gebruiksdoel field confirmed as `list[str]`
- `backend/app/services/address_resolver.py` -- confirms gebruiksdoel populated from BAG API
- `backend/app/services/wkb_classifier.py` -- `.lower()` pattern for gebruiksdoel comparison
- `backend/app/services/foundation_risk_engine.py` -- `_RISK_SEVERITY` dict and worst-of pattern
- `backend/tests/unit/test_asbest_indicator.py` -- existing test patterns
- `.planning/REQUIREMENTS.md` -- ASBT-01, ASBT-02 requirements

### Secondary (MEDIUM confidence)
- BAG gebruiksdoel values from Bouwbesluit 2012 (11 standardized functions) -- well-known Dutch registry standard

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new dependencies, pure logic change
- Architecture: HIGH - all data already flows through existing pipeline
- Pitfalls: HIGH - small surface area, well-understood edge cases

**Research date:** 2026-03-10
**Valid until:** 2026-06-10 (stable domain, no API changes expected)
