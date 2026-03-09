# Feature Landscape: Fysiek Risicoprofiel (Physical Risk Assessment)

**Domain:** Physical building risk assessment for PropTech real estate due diligence (Netherlands)
**Researched:** 2026-03-09
**Confidence:** MEDIUM-HIGH -- PDOK/BRO endpoints verified via PDOK service pages; KCAF heuristics confirmed via multiple sources; soil data access path (WMS GetFeatureInfo) verified but not yet live-tested.

---

## Context: Current State and Problem

Propdex already has basic physical risk signals scattered across the report:
- **asbest_indicator.py**: Bouwjaar-only NEN 2991 risk bands (hoog/middel/geen/onbekend)
- **bodemloket_arcgis.py**: WBB soil contamination dossiers (Bodemloket ArcGIS REST)
- **3D BAG**: Building height, footprint, bouwlagen per pand
- **BAG data**: Bouwjaar, gebruiksdoel, pand geometry already in BuildingData schema

The gap: **no integrated physical risk view**. A developer looking at a pre-1970 building on clay soil near a contaminated site must mentally combine three separate report sections. Worse, foundation risk (the single most expensive hidden cost in Dutch property development) has zero coverage -- no data source, no heuristic, nothing.

Dutch property developers routinely face 50,000-200,000+ EUR foundation repair costs that were invisible at acquisition. This milestone closes that gap.

---

## Table Stakes

Features users expect when a platform claims "physical risk assessment" for property due diligence. Missing = product feels incomplete or untrustworthy.

| Feature | Why Expected | Complexity | Dependencies | Notes |
|---------|--------------|------------|--------------|-------|
| **Soil type classification** (klei/veen/zand/leem) | Every foundation assessment starts with "what soil is this built on?" KCAF, Deltares, and all TDD firms use soil type as primary input | Med | BRO Bodemkaart WMS via PDOK | WMS GetFeatureInfo at coordinate -- no WFS available. Returns grondsoort per 1:50k polygon. Not parcel-precise but good enough for risk indication |
| **Foundation risk heuristic** (bouwjaar x bodemtype) | 750K+ homes on wooden piles in NL. Pre-1970 + klei/veen = "waarschijnlijk houten palen" per KCAF. Every property professional knows this rule | Low | Soil type + existing bouwjaar from BAG | Pure logic: bouwjaar < 1970 AND soil in (klei, veen) = HOOG; bouwjaar < 1970 AND zand = LAAG; post-1970 = betonpalen (LAAG) |
| **PDOK Funderingsrisicogebieden** context signal | RVO publishes official "indicatieve aandachtsgebieden" at PC6 level. Every municipality uses this for policy. Not showing it when available = negligent | Low-Med | PDOK WFS endpoint already known | `service.pdok.nl/rvo/indgebfunderingsproblematiek/wfs/v1_0`, returns GeoJSON. Fields: percvoor1970, fgr (soil category), legenda (risk label). Query by bbox or filter on postcode |
| **Combined risk summary** with traffic-light rating | Professionals expect a single "is this a concern?" signal, not raw data dumps. Red/orange/green with explanation | Low | All three above feeding into one view | Heuristic engine combining signals into HOOG/MIDDEL/LAAG/ONBEKEND with Dutch-language explanation |
| **Asbestos v2** with building function refinement | Bouwjaar-only is table stakes (already have it). Adding BAG gebruiksdoel makes it credible: industrial/educational buildings from 1963-1993 have materially higher asbestos probability than residential | Low | Existing asbest_indicator.py + BAG gebruiksdoel already in BuildingData | industriefunctie, bijeenkomstfunctie, onderwijsfunctie = risk_boost. Purely additive to existing logic |
| **Source attribution and disclaimers** | Government data = indicative only. Legal liability if users treat it as definitive. Must show "dit is een indicatie, geen funderingsonderzoek" | Low | All features | Same pattern as existing Bodemloket disclaimer. Per KCAF: "De gegevens zijn indicatief en vervangen geen funderingsonderzoek" |

## Differentiators

Features that set Propdex apart. Not universally expected, but valued by sophisticated developers.

| Feature | Value Proposition | Complexity | Dependencies | Notes |
|---------|-------------------|------------|--------------|-------|
| **Combined Fysiek Risicoprofiel section** in ParcelDetailModal | Nobody else combines soil + foundation + asbest + contamination in one panel for Dutch property. Matrixian/Calcasa focus on valuation, FunderMaps is foundation-only, Bodemloket is contamination-only. Integration IS the value | Med | All table stakes features | Single collapsible section with sub-cards: Bodemtype, Funderingsrisico, Asbest, Bodemverontreiniging |
| **Climate context signal** (droogte + bodemdaling) | Since 2025, organizations legally required to map physical climate risks. Drought causes wooden pile rot; bodemdaling exacerbates foundation damage. Showing this connects physical risk to climate adaptation -- very current topic | High | External data sources (Klimaateffectatlas, KNMI) | DEFERRED for this milestone. Worth noting for roadmap: would need Klimaateffectatlas WMS integration |
| **Foundation risk per area scan** (not just per-parcel) | Coloring entire wijk by foundation risk during area scan would instantly show which neighborhoods have highest physical risk exposure | Med-High | Foundation heuristic at scale, tile coloring logic | Requires soil type per parcel centroid at scan time. Could pre-compute via BRO WMS for entire wijk bbox. Consider for future phase |
| **Risk-to-cost estimation** | "Funderingsherstel voor dit type pand kost indicatief 40.000-80.000 EUR" based on KCAF reference prices per m2 footprint | Med | Foundation risk + pand_oppervlakte from 3D BAG/BAG | KCAF publishes reference ranges. Would need careful disclaimers. HIGH value for go/no-go decisions |
| **Asbest sanering cost indication** | "Asbestverwijdering voor industriefunctie 80m2 kost indicatief 5.000-15.000 EUR" | Med | Asbest v2 + oppervlakte | Market rates vary wildly. Could provide order-of-magnitude indication only. DEFERRED |
| **Soil profile depth view** | bodemdata.nl has soil profiles to 1.2m depth -- showing layer composition (e.g., 0-30cm klei, 30-80cm veen, 80-120cm zand) would be unique | High | bodemdata.nl profielbeschrijvingen API (if available) | WMS GetFeatureInfo may return profile data. Needs live testing. DEFERRED for this milestone |

## Anti-Features

Features to explicitly NOT build. These are scope traps or domain boundaries.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Actual foundation inspection report** | Legal liability. Only SC530/F3O-certified firms may perform funderingsonderzoek. Producing anything that looks like an inspection report creates liability | Label everything "indicatief risicoprofiel" and recommend certified inspection |
| **Asbestinventarisatie** | NEN 2991 requires physical inspection by certified asbestinventarisatiebedrijf. Cannot be done remotely | Show risk indicator + "Inventarisatie verplicht voor sloop/verbouwing" recommendation |
| **FunderMaps integration** | Proprietary data, commercial API, municipality-dependent coverage (only ~35% of pre-1970 buildings). Dependency on external party for core feature | Use freely available PDOK + BRO + KCAF heuristics instead |
| **BRO grondwater monitoring** | Only ~380 wells nationwide, ~10km apart. Far too sparse for per-parcel assessment | Skip entirely. Soil type from BRO Bodemkaart is sufficient proxy |
| **Amsterdam bouwdossier archive** | Only Amsterdam has digital bouwdossier API. Building for one city is not worth the effort | Skip. Historical building plans are not needed for risk indication |
| **ML-based foundation risk model** | Training data doesn't exist in public domain (KCAF/FunderMaps data is proprietary). Would be garbage-in-garbage-out | Use deterministic heuristic (bouwjaar x bodemtype). Well-understood, explainable, defensible |
| **Precise cost calculations** | Too many variables (pand type, foundation type, soil condition, contractor availability). False precision is worse than no number | At most show KCAF reference ranges with heavy disclaimers. DEFERRED |
| **Sloopmelding/asbestmelding filing** | Government integration, regulated process, liability. Out of scope for intelligence platform | Show that it's needed, link to Omgevingsloket |

## Feature Dependencies

```
BAG bouwjaar (EXISTING) ─────────────────────┐
BAG gebruiksdoel (EXISTING) ──────────────────┤
                                              ├──→ Asbest v2 (enhanced risk bands)
                                              │
BRO Bodemkaart WMS GetFeatureInfo ────────────┼──→ Soil Type Classification
                                              │       │
                                              │       ├──→ Foundation Risk Heuristic
                                              │       │       │
PDOK Funderingsrisicogebieden WFS ────────────┼───────┼───────┤
                                              │       │       │
                                              │       │       └──→ Combined Fysiek Risicoprofiel
Bodemloket WBB dossiers (EXISTING) ───────────┘       │               │
                                                      │               └──→ Frontend Section
3D BAG footprint/height (EXISTING) ───────────────────┘                      in ParcelDetailModal
```

**Critical path:** BRO Bodemkaart WMS integration is the single new external dependency. Everything else builds on existing data or uses PDOK WFS (proven pattern). If BRO WMS GetFeatureInfo fails or returns insufficient data, the foundation heuristic falls back to PDOK Funderingsrisicogebieden (PC6-level soil category) as a less precise but still useful proxy.

## MVP Recommendation

**Must have (this milestone):**
1. **Soil type via BRO Bodemkaart WMS** -- new government API client, JSONB cache, returns grondsoort
2. **Foundation risk heuristic** -- pure Python logic combining bouwjaar + bodemtype + PDOK funderingsgebied
3. **PDOK Funderingsrisicogebieden WFS** -- new government API client, queries by coordinate bbox
4. **Asbest v2** -- extend existing asbest_indicator.py with gebruiksdoel-based risk modifiers
5. **Fysiek Risicoprofiel frontend section** -- new collapsible section in ParcelDetailModal combining all four risk signals

**Defer:**
- Climate context signal (droogte/bodemdaling): Needs Klimaateffectatlas integration, separate milestone
- Foundation risk in area scan tiles: Needs per-parcel soil type at scale, performance concern
- Risk-to-cost estimation: Needs KCAF reference data, heavy disclaimers, separate milestone
- Soil profile depth view: Uncertain API availability, not needed for risk indication
- Asbest sanering cost: Market rate data unreliable, separate milestone

## Data Source Summary

| Source | Endpoint | Access | Data Returned | Cache TTL |
|--------|----------|--------|---------------|-----------|
| BRO Bodemkaart | `service.pdok.nl/bzk/bro-bodemkaart/wms/v1_0` (WMS GetFeatureInfo) | Free, public, no auth | Grondsoort (soil type), bodemcode, bodemtype description | 90 days (geological data, extremely stable) |
| PDOK Funderingsgebieden | `service.pdok.nl/rvo/indgebfunderingsproblematiek/wfs/v1_0` (WFS GetFeature) | Free, public, no auth | percvoor1970, fgr (soil category), legenda (risk label), geometry | 90 days (updated infrequently) |
| BAG (existing) | Various BAG API endpoints | Already integrated | bouwjaar, gebruiksdoel | Already cached |
| Bodemloket (existing) | `gis.gdngeoservices.nl/.../MapServer/0/query` | Already integrated | WBB dossiers | 30 days |
| 3D BAG (existing) | CityJSON API | Already integrated | pand_oppervlakte_m2, height | Already cached |

## Sources

- [PDOK Indicatieve Aandachtsgebieden Funderingsproblematiek](https://www.pdok.nl/introductie/-/article/indicatieve-aandachtsgebieden-funderingsproblematiek) -- dataset description and service endpoints
- [PDOK BRO Bodemkaart (SGM)](https://www.pdok.nl/ogc-webservices/-/article/bro-bodemkaart-sgm-) -- WMS-only service, no WFS available
- [KCAF - Kennis Centrum Aanpak Funderingsproblematiek](https://www.kcaf.nl/) -- foundation risk methodology, 750K homes on wooden piles
- [RVO Nationale Aanpak Funderingsproblematiek](https://www.rvo.nl/onderwerpen/funderingsproblematiek/nationale-aanpak) -- national policy context
- [Deltares Foundation Damage Research](https://www.deltares.nl/en/news/foundation-damage-the-netherlands-mapped-out-for-national-approach-to-foundation-problems) -- 1M+ buildings at risk
- [NEN 2991:2015](https://www.nen.nl/nen-2991-2015-nl-207667) -- asbestos risk assessment standard
- [BAG Gebruiksdoel](https://catalogus.kadaster.nl/bag/nl/page/Gebruiksdoel) -- 11 building function classifications
- [BlueLabel Funderingsrisico](https://www.bluelabel.net/paalrot/) -- 2025 legal requirements for climate risk mapping
