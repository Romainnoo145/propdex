# Phase 88: Foundation Risk Engine - Research

**Researched:** 2026-03-10
**Domain:** Foundation risk heuristic (bouwjaar x bodemtype), KCAF cost reference ranges, combined Fysiek Risicoprofiel schema
**Confidence:** HIGH

## Summary

Phase 88 builds the core intelligence engine for foundation risk assessment. It takes the soil type data from Phase 87 (BRO Bodemkaart WMS classification: klei/veen/zand/leem) and combines it with BAG bouwjaar to produce a per-parcel foundation risk rating (HOOG/MIDDEL/LAAG/ONBEKEND). This is a well-understood heuristic used by KCAF (Kennis Centrum Aanpak Funderingsproblematiek) and the entire Dutch foundation repair industry: pre-1970 buildings on klei/veen soils likely have wooden pile foundations that are vulnerable to rot and settlement. Post-1970 buildings almost universally use concrete piles, which are not vulnerable.

The phase also introduces two new composite outputs: (1) a KCAF-referenced cost range for foundation repair based on pand footprint area and risk level, and (2) a combined FysiekRisicoProfiel schema that aggregates foundation risk, soil profile, asbestos indicator, and contamination data into one typed response field. Both outputs require zero new API calls or external data -- they are pure functions computed from data already available in the property aggregator pipeline (soil_profile from Phase 87, bouwjaar from BAG, oppervlakte from BAG, asbest_indicator from Phase 67, bodem_data from Phase 68).

The implementation requires zero new dependencies. The foundation risk engine is a pure Python function with no external calls. The KCAF cost ranges are a static lookup table. The FysiekRisicoProfiel schema composes existing data. Everything wires into the existing `property_aggregator.py` flow after the `asyncio.gather()` results are processed (synchronous post-processing, no additional API latency).

**Primary recommendation:** Build a pure-function `assess_foundation_risk()` in `foundation_risk_engine.py`, a static `KCAF_COST_RANGES` lookup in the same file, Pydantic schemas for `FoundationRisk` and `FysiekRisicoProfiel`, and wire into `property_aggregator.py` as synchronous post-processing after gather results.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| FUND-01 | User sees foundation risk rating (HOOG/MIDDEL/LAAG/ONBEKEND) derived from bouwjaar x bodemtype heuristic | Pure function: bouwjaar + soil_profile.dominant_type -> risk level with Dutch derivation text. Decision matrix documented below. |
| FUND-02 | User sees combined Fysiek Risicoprofiel summary with traffic-light rating and Dutch-language explanation | FysiekRisicoProfiel Pydantic schema composing FoundationRisk + SoilProfile + AsbestIndicator + BodemData + overall risk level. Overall derived from worst-of foundation/asbest/contamination. |
| FUND-03 | User sees KCAF reference cost range for foundation repair based on pand footprint and risk level | Static lookup: KCAF reference ranges are 700-1000 EUR/m2 for standard repairs. Multiply by BAG oppervlakte (ground floor proxy). Heavy disclaimers mandatory. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| pydantic | v2 (existing) | FoundationRisk + FysiekRisicoProfiel schemas | Already used for all API response schemas |

### Supporting
No new libraries needed. Everything is pure Python logic operating on existing data.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Static KCAF cost lookup | KCAF Herstelkosten Calculator API | KCAF calculator is a web form, not an API. Static ranges are sufficient for indicative pricing with disclaimers. |
| Deterministic heuristic | ML model | No public training data exists. Deterministic heuristic is more explainable and defensible for professional users. |
| Worst-of overall risk | Weighted risk scoring | Weighted scoring implies false precision. Worst-of is conservative and explainable: "De hoogste deelrisico bepaalt het totaalrisico." |

**Installation:**
```bash
# No new packages needed
```

## Architecture Patterns

### Recommended Project Structure
```
backend/app/
  services/
    foundation_risk_engine.py  # NEW: pure function assess_foundation_risk() + KCAF cost ranges
  schemas/
    fysiek_risico.py           # MODIFY: add FoundationRisk, FysiekRisicoProfiel, KCAFCostIndication
  services/
    property_aggregator.py     # MODIFY: add synchronous post-processing after gather
  schemas/
    property.py                # MODIFY: add fysiek_risico_profiel field to PropertyReportResponse
```

### Pattern 1: Pure Function Risk Engine (foundation_risk_engine.py)
**What:** Stateless pure function that takes bouwjaar + soil type + area context and returns a typed FoundationRisk object with risk level, derivation text, and confidence.
**When to use:** All deterministic risk assessments where inputs are known at compute time.
**Why pure function:** No I/O, no database, no async. Can be unit tested trivially. Follows the existing `assess_asbest_risk()` pattern in `asbest_indicator.py` exactly.
**Example:**
```python
# Source: follows existing asbest_indicator.py pattern
def assess_foundation_risk(
    *,
    building: BuildingData | None,
    soil_profile: SoilProfile | None,
    funderingsrisicogebied: FunderingsrisicogebiedData | None,
) -> FoundationRisk:
    """Assess foundation risk from bouwjaar x bodemtype heuristic."""
    if building is None or building.bouwjaar is None:
        return FoundationRisk(
            risk="onbekend",
            bouwjaar=None,
            bodemtype=None,
            reden="Bouwjaar niet beschikbaar -- funderingsrisico kan niet worden bepaald.",
        )

    bouwjaar = building.bouwjaar
    bodemtype = soil_profile.dominant_type if soil_profile else "onbekend"

    if bouwjaar >= 1970:
        return FoundationRisk(
            risk="laag",
            bouwjaar=bouwjaar,
            bodemtype=bodemtype,
            reden=(
                f"Bouwjaar {bouwjaar} -- na 1970. "
                "Gebouwen uit deze periode zijn vrijwel altijd gefundeerd op betonnen "
                "heipalen of een gewapende betonplaat. Geen verhoogd funderingsrisico."
            ),
        )

    # Pre-1970: risk depends on soil type
    if bodemtype in ("veen", "klei"):
        return FoundationRisk(
            risk="hoog",
            bouwjaar=bouwjaar,
            bodemtype=bodemtype,
            reden=(
                f"Bouwjaar {bouwjaar} + {bodemtype}grond. "
                "Gebouwen van voor 1970 op klei- of veengrond hebben waarschijnlijk "
                "een houten paalfundering. Deze is kwetsbaar voor paalrot door "
                "grondwaterstandverlaging en biologische aantasting."
            ),
            recommended_action=(
                "Laat een funderingsonderzoek uitvoeren door een "
                "SC530/F3O-gecertificeerd bedrijf."
            ),
        )
    elif bodemtype == "leem":
        return FoundationRisk(
            risk="middel",
            bouwjaar=bouwjaar,
            bodemtype=bodemtype,
            reden=(
                f"Bouwjaar {bouwjaar} + leemgrond. "
                "Leemgrond heeft wisselende draagkracht. Afhankelijk van de "
                "lokale grondwaterstand kan een houten paalfundering aanwezig zijn."
            ),
            recommended_action="Overweeg een funderingsonderzoek bij verbouwplannen.",
        )
    elif bodemtype == "zand":
        return FoundationRisk(
            risk="laag",
            bouwjaar=bouwjaar,
            bodemtype=bodemtype,
            reden=(
                f"Bouwjaar {bouwjaar} + zandgrond. "
                "Op zandgrond wordt doorgaans gefundeerd op staal (direct op de "
                "draagkrachtige zandlaag). Geen verhoogd funderingsrisico."
            ),
        )
    else:
        # onbekend soil type
        return FoundationRisk(
            risk="onbekend",
            bouwjaar=bouwjaar,
            bodemtype=bodemtype,
            reden=(
                f"Bouwjaar {bouwjaar} -- bodemtype onbekend. "
                "Zonder bodemclassificatie kan het funderingsrisico niet worden bepaald."
            ),
        )
```

### Pattern 2: KCAF Cost Range Lookup
**What:** Static dict mapping risk level to EUR/m2 cost range. Multiplied by BAG oppervlakte (ground floor proxy).
**When to use:** Indicative cost estimation with prominent disclaimers.
**Example:**
```python
# Source: KCAF reference ranges (kcaf.nl/funderingsherstelcalculator)
# Standard funderingsherstel: 700-1000 EUR/m2 (2025 reference)
# These are INDICATIVE reference ranges, not quotes.
KCAF_COST_RANGES: dict[str, tuple[int, int]] = {
    "hoog": (700, 1000),     # Full foundation repair likely needed
    "middel": (400, 700),    # Partial repair / reinforcement
}

def estimate_kcaf_cost(
    *,
    risk: str,
    oppervlakte_m2: int | None,
) -> KCAFCostIndication | None:
    """Estimate foundation repair cost from KCAF reference ranges."""
    if risk not in KCAF_COST_RANGES or not oppervlakte_m2 or oppervlakte_m2 <= 0:
        return None

    low_per_m2, high_per_m2 = KCAF_COST_RANGES[risk]
    return KCAFCostIndication(
        low_eur=low_per_m2 * oppervlakte_m2,
        high_eur=high_per_m2 * oppervlakte_m2,
        low_per_m2=low_per_m2,
        high_per_m2=high_per_m2,
        oppervlakte_m2=oppervlakte_m2,
        disclaimer=(
            "Indicatieve kostenrange op basis van KCAF referentiecijfers "
            f"({low_per_m2}-{high_per_m2} EUR/m2). Werkelijke kosten hangen af van "
            "funderingstype, schadeomvang, bodemgesteldheid en aannemer. "
            "Dit is geen offerte en geen vervanging voor een funderingsonderzoek."
        ),
    )
```

### Pattern 3: Composite FysiekRisicoProfiel (synchronous post-processing)
**What:** After asyncio.gather completes and all data is available, compute derived values synchronously.
**When to use:** When the output depends on multiple gather results but requires no I/O.
**Placement in property_aggregator.py:**
```python
# After line 1064 (existing asbest_result computation):
foundation_risk = assess_foundation_risk(
    building=building,
    soil_profile=soil_profile,
    funderingsrisicogebied=funderingsrisicogebied,
)
kcaf_cost = estimate_kcaf_cost(
    risk=foundation_risk.risk,
    oppervlakte_m2=building.oppervlakte if building else None,
)
fysiek_risico_profiel = build_fysiek_risico_profiel(
    foundation_risk=foundation_risk,
    soil_profile=soil_profile,
    asbest_indicator=asbest_result,
    bodem_data=bodem_data,
    funderingsrisicogebied=funderingsrisicogebied,
    kcaf_cost=kcaf_cost,
)
```

### Anti-Patterns to Avoid
- **Making assess_foundation_risk async:** It is a pure function with no I/O. Keep it synchronous like assess_asbest_risk().
- **Adding foundation risk to asyncio.gather:** The risk engine depends on soil_profile (a gather result). It MUST run after gather completes.
- **Using red badges for heuristic data:** All foundation risk indicators must use amber badges. Red implies definitive assessment, which requires a certified funderingsonderzoek.
- **Presenting KCAF costs without disclaimers:** The KCAFCostIndication schema MUST have a disclaimer field that is always populated. UI must render the disclaimer prominently.
- **Computing overall FysiekRisicoProfiel risk as a weighted average:** Use worst-of (highest risk) across foundation/asbest/contamination. Weighted scoring implies false precision.
- **Adding oppervlakte_m2 to KCAF calculation from pand_oppervlakte_m2 (3D BAG):** Use BAG `building.oppervlakte` (gebruiksoppervlakte) as ground floor proxy. It is already available in the aggregator. 3D BAG pand_oppervlakte_m2 is NOT in the aggregator flow.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Foundation risk assessment | ML model or external API | Deterministic pure function (bouwjaar x bodemtype matrix) | No training data, explainability is critical for professional users |
| Cost estimation | Real-time contractor pricing | Static KCAF reference ranges with disclaimers | Too many variables for precision; false precision is worse than ranges |
| Overall risk aggregation | Weighted scoring model | Worst-of across sub-risks | Conservative, explainable, no coefficient tuning needed |
| Soil type input | New API call | `soil_profile` from Phase 87 gather results | Already fetched in parallel, available after gather |

**Key insight:** This phase adds zero new I/O. Everything is synchronous post-processing of data already fetched by Phase 87. The entire phase is pure functions + Pydantic schemas + wiring.

## Common Pitfalls

### Pitfall 1: Foundation Risk Presented as Definitive Assessment
**What goes wrong:** UI shows "Dit pand heeft funderingsrisico" in red, implying certainty.
**Why it happens:** Developer treats heuristic output like verified API data.
**How to avoid:** FoundationRisk schema has mandatory `disclaimer` field. Risk levels use amber badges (never red). Derivation text explains the reasoning transparently. Include `recommended_action` field for hoog/middel risks pointing to professional inspection.
**Warning signs:** Any red color coding for foundation risk. Any text saying "heeft" instead of "heeft mogelijk" or "indicatief".

### Pitfall 2: KCAF Cost Range Without Disclaimers
**What goes wrong:** User sees "Funderingsherstel: EUR 56.000 - 80.000" and treats it as a quote.
**Why it happens:** Cost numbers are compelling and users anchor on them.
**How to avoid:** KCAFCostIndication always includes disclaimer text. UI renders disclaimer at same visual weight as the numbers. Include "indicatief" in the section header. Use `~` prefix or "ca." to signal approximation.
**Warning signs:** Cost numbers displayed without adjacent disclaimer text.

### Pitfall 3: BAG Oppervlakte Used Incorrectly for KCAF Cost
**What goes wrong:** BAG `oppervlakte` is gebruiksoppervlakte (total usable floor area across all floors), not ground floor footprint. A 3-story 180m2 building has ~60m2 footprint, but BAG reports 180m2.
**Why it happens:** BAG oppervlakte is the only area readily available. Ground floor footprint requires geometry computation.
**How to avoid:** Document that BAG oppervlakte is a CONSERVATIVE UPPER BOUND for cost estimation (cost will be lower if actual footprint is smaller). Include this in the disclaimer text. Alternatively, if cadastral_parcel.oppervlakte is available, use that as a footprint proxy (parcels approximate building footprint in urban areas).
**Warning signs:** Cost estimates seem unreasonably high for small buildings.

### Pitfall 4: Missing Soil Data Treated as "No Risk"
**What goes wrong:** When soil_profile is None or dominant_type is "onbekend", the engine returns "laag" risk instead of "onbekend".
**Why it happens:** Developer treats missing data as absence of risk.
**How to avoid:** Missing soil type MUST result in "onbekend" risk with explanation. The heuristic REQUIRES soil type as input -- without it, the result is indeterminate.
**Warning signs:** Foundation risk = "laag" when soil_profile is None.

### Pitfall 5: Completeness Score Regression
**What goes wrong:** Adding fysiek_risico_profiel to PropertyReportResponse increases the denominator, dropping existing reports' completeness scores.
**Why it happens:** The total_sections denominator changes.
**How to avoid:** fysiek_risico_profiel is a DERIVED field (computed from existing data, not a new fetch). It should NOT increase the denominator. Only count it in the numerator if present. The denominator stays at 11 (Phase 87 value). FysiekRisicoProfiel is always computed when its inputs exist, so it adds no new "missing data" risk.
**Warning signs:** Completeness score drops for existing reports after Phase 88 deployment.

## Code Examples

### Foundation Risk Decision Matrix
```python
# Source: KCAF methodology (kcaf.nl/funderingsviewer)
# Rows: bouwjaar period
# Columns: soil type (dominant_type from Phase 87)
#
# | Bouwjaar    | veen  | klei  | leem   | zand | onbekend |
# |-------------|-------|-------|--------|------|----------|
# | >= 1970     | LAAG  | LAAG  | LAAG   | LAAG | LAAG     |
# | 1945-1969   | HOOG  | HOOG  | MIDDEL | LAAG | ONBEKEND |
# | < 1945      | HOOG  | HOOG  | MIDDEL | LAAG | ONBEKEND |
# | None        | ONBEKEND | ONBEKEND | ONBEKEND | ONBEKEND | ONBEKEND |
#
# Key insight: 1970 is the dividing line. After 1970, concrete piles
# became universal in the Netherlands. Before 1970, foundation type
# depends on soil: weak soils (veen/klei) required wooden piles;
# strong soils (zand) allowed direct "op staal" foundations.
```

### FoundationRisk Schema
```python
class FoundationRisk(BaseModel):
    """Foundation risk assessment from bouwjaar x bodemtype heuristic."""

    risk: Literal["hoog", "middel", "laag", "onbekend"] = Field(
        description="Foundation risk level",
    )
    bouwjaar: int | None = Field(
        default=None,
        description="Building year used in assessment",
    )
    bodemtype: str | None = Field(
        default=None,
        description="Soil type used in assessment (klei/veen/zand/leem/onbekend)",
    )
    reden: str = Field(
        description="Dutch-language explanation of risk derivation",
    )
    recommended_action: str | None = Field(
        default=None,
        description="Recommended follow-up action for hoog/middel risk",
    )
    disclaimer: str = Field(
        default=(
            "Indicatieve risicobeoordeling op basis van bouwjaar en bodemtype. "
            "Geen vervanging voor een gecertificeerd funderingsonderzoek."
        ),
    )
```

### KCAFCostIndication Schema
```python
class KCAFCostIndication(BaseModel):
    """Indicative foundation repair cost range from KCAF reference data."""

    low_eur: int = Field(description="Lower bound of cost range in EUR")
    high_eur: int = Field(description="Upper bound of cost range in EUR")
    low_per_m2: int = Field(description="Lower bound EUR per m2 (KCAF reference)")
    high_per_m2: int = Field(description="Upper bound EUR per m2 (KCAF reference)")
    oppervlakte_m2: int = Field(description="Building area used for calculation")
    disclaimer: str = Field(description="Mandatory cost disclaimer")
```

### FysiekRisicoProfiel Schema
```python
class FysiekRisicoProfiel(BaseModel):
    """Combined physical risk profile aggregating all risk signals."""

    overall_risk: Literal["hoog", "middel", "laag", "onbekend"] = Field(
        description="Worst-of across foundation, asbest, and contamination",
    )
    overall_explanation: str = Field(
        description="Dutch explanation of overall risk derivation",
    )
    foundation_risk: FoundationRisk | None = Field(
        default=None,
        description="Foundation risk from bouwjaar x bodemtype heuristic",
    )
    soil_profile: SoilProfile | None = Field(
        default=None,
        description="Soil classification from BRO Bodemkaart (Phase 87)",
    )
    asbest_indicator: AsbestIndicator | None = Field(
        default=None,
        description="Asbestos risk indicator (Phase 67, v2 in Phase 89)",
    )
    bodem_data: BodemData | None = Field(
        default=None,
        description="Soil contamination data from Bodemloket (Phase 68)",
    )
    funderingsrisicogebied: FunderingsrisicogebiedData | None = Field(
        default=None,
        description="Postcode-level area context from PDOK (Phase 87)",
    )
    kcaf_cost: KCAFCostIndication | None = Field(
        default=None,
        description="Indicative KCAF repair cost range (only for hoog/middel risk)",
    )
    disclaimer: str = Field(
        default=(
            "Fysiek risicoprofiel is een indicatieve beoordeling op basis van "
            "openbare data. Geen vervanging voor professioneel onderzoek."
        ),
    )
```

### Overall Risk Derivation Logic
```python
def _derive_overall_risk(
    foundation_risk: FoundationRisk | None,
    asbest_indicator: AsbestIndicator | None,
    bodem_data: BodemData | None,
) -> tuple[str, str]:
    """Derive overall risk as worst-of across sub-risks.

    Returns (risk_level, explanation).
    """
    risk_levels = []
    explanations = []

    if foundation_risk and foundation_risk.risk != "onbekend":
        risk_levels.append(foundation_risk.risk)
        if foundation_risk.risk == "hoog":
            explanations.append("funderingsrisico (hoog)")

    if asbest_indicator and asbest_indicator.risk != "onbekend":
        risk_levels.append(asbest_indicator.risk)
        if asbest_indicator.risk == "hoog":
            explanations.append("asbestrisico (hoog)")

    if bodem_data and bodem_data.dossiers:
        risk_levels.append("middel")  # Any WBB dossier = at least middel
        explanations.append("bodemverontreiniging (WBB-dossier aanwezig)")

    if not risk_levels:
        return "onbekend", "Onvoldoende data beschikbaar voor risicobeoordeling."

    # Worst-of: hoog > middel > laag > geen
    RISK_ORDER = {"hoog": 3, "middel": 2, "laag": 1, "geen": 0}
    worst = max(risk_levels, key=lambda r: RISK_ORDER.get(r, -1))

    if worst in ("hoog", "middel") and explanations:
        explanation = f"Risicoprofiel {worst} op basis van: {', '.join(explanations)}."
    elif worst == "laag":
        explanation = "Geen verhoogde fysieke risico's gedetecteerd."
    else:
        explanation = "Geen verhoogde fysieke risico's gedetecteerd op basis van beschikbare data."

    return worst, explanation
```

### Wiring into property_aggregator.py
```python
# AFTER the existing synchronous post-processing (line ~1064):
# asbest_result: AsbestIndicator = assess_asbest_risk(building=building)

# Phase 88: Foundation risk engine (synchronous, no I/O)
foundation_risk = assess_foundation_risk(
    building=building,
    soil_profile=soil_profile,
    funderingsrisicogebied=funderingsrisicogebied,
)
kcaf_cost = estimate_kcaf_cost(
    risk=foundation_risk.risk,
    oppervlakte_m2=building.oppervlakte if building else None,
)
fysiek_risico_profiel = build_fysiek_risico_profiel(
    foundation_risk=foundation_risk,
    soil_profile=soil_profile,
    asbest_indicator=asbest_result,
    bodem_data=bodem_data,
    funderingsrisicogebied=funderingsrisicogebied,
    kcaf_cost=kcaf_cost,
)

# Then pass fysiek_risico_profiel=fysiek_risico_profiel to PropertyReportResponse(...)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| KCAF Funderingsviewer for appraisals | FunderMaps funderingsrisicorapport for NWWI | 2025 | KCAF viewer is no longer valid for NWWI appraisals. Our use case is intelligence/screening (not appraisal), so KCAF methodology is still appropriate. |
| Flat cost estimate | KCAF Herstelkosten Calculator | 2024 | KCAF now has a web calculator. We use reference ranges (700-1000 EUR/m2) as indicative, not the full calculator. |

**Deprecated/outdated:**
- KCAF Funderingsviewer for formal appraisals (replaced by FunderMaps for NWWI validation). Still valid for indicative risk screening.
- WUR soilphysics.wur.nl as soil data source (Phase 87 resolved: use PDOK BRO Bodemkaart WMS exclusively).

## Open Questions

1. **BAG oppervlakte vs ground floor footprint for KCAF cost**
   - What we know: BAG `oppervlakte` is gebruiksoppervlakte (all floors summed), not ground floor footprint. A 3-floor 180m2 building has ~60m2 footprint.
   - What's unclear: Whether users will be confused by seemingly high cost estimates.
   - Recommendation: Use BAG oppervlakte as upper bound. Include explanation in disclaimer: "Oppervlakte is gebruiksoppervlakte (BAG), niet begane grond footprint. Werkelijke kosten zijn mogelijk lager." This is conservative (cost is overestimated, not underestimated). Consider using `cadastral_parcels[0].oppervlakte` as alternative when available, but this is parcel area (may include garden), not building footprint.

2. **Funderingsrisicogebied integration into heuristic**
   - What we know: PDOK data provides `percvoor1970` percentage and `legenda` risk label at PC6 level.
   - What's unclear: Whether to use the PDOK legenda to modify the per-parcel heuristic result.
   - Recommendation: Do NOT use PDOK data to override the per-parcel heuristic. Display it as area context only ("Dit pand ligt in een aandachtsgebied: [legenda]"). The per-parcel bouwjaar x bodemtype is more specific and should always take precedence.

3. **Area scan integration**
   - What we know: The area_scan job (`area_scan.py`) does NOT currently fetch soil_profile or funderingsrisicogebied data per parcel. Phase 87 only wired soil data into the property_aggregator (single-parcel flow).
   - What's unclear: Whether Phase 88 should wire foundation risk into area scan tiles.
   - Recommendation: Phase 88 should NOT modify area_scan.py. FRNT-03 (area scan tile coloring by foundation risk) is assigned to Phase 90 (Frontend). Adding per-parcel WMS calls during area scan would be a performance concern (500+ WMS requests). This is a future optimization.

## Sources

### Primary (HIGH confidence)
- Existing codebase: `asbest_indicator.py` (pure function pattern), `property_aggregator.py` (wiring pattern), `fysiek_risico.py` (existing Phase 87 schemas), `soil_classifier.py` (soil type categories)
- KCAF Funderingsviewer methodology: bouwjaar + soil region determines risk category. Pre-1970 + klei/veen = wooden piles = high risk. Source: [kcaf.nl/funderingsviewer](https://www.kcaf.nl/funderingsviewer/)
- KCAF Herstelkosten Calculator: reference cost ranges for foundation repair. Source: [kcaf.nl/funderingsherstelcalculator](https://www.kcaf.nl/funderingsherstelcalculator/)
- Foundation repair cost references: 700-1000 EUR/m2 for standard repairs, 50.000-100.000 EUR total per residence. Sources: [soilidfunderingsherstel.nl](https://www.soilidfunderingsherstel.nl/funderingsherstel-de-kosten/), [aannemer-gigant.nl](https://www.aannemer-gigant.nl/huis-verbouwen/funderingsherstel/)

### Secondary (MEDIUM confidence)
- 1970 dividing line for concrete vs wooden piles: widely accepted in Dutch construction industry. Verified via KCAF methodology and multiple contractor sources.
- Cost range for "middel" risk (400-700 EUR/m2): inferred from partial repair / reinforcement scenarios. Less documented than full repair costs.

### Tertiary (LOW confidence)
- BAG oppervlakte as ground floor proxy: known to overestimate for multi-story buildings. Adequate for indicative range with disclaimer.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - zero new dependencies, pure Python functions
- Architecture: HIGH - follows identical pattern to existing asbest_indicator.py, synchronous post-processing in property_aggregator.py
- Pitfalls: HIGH - all pitfalls verified against existing codebase patterns and KCAF methodology

**Research date:** 2026-03-10
**Valid until:** 2026-04-10 (30 days -- KCAF methodology is stable, cost ranges may need annual refresh)