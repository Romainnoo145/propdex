# Project Research Summary

**Project:** Propdex v14.0 Fysiek Risicoprofiel
**Domain:** Physical risk assessment for Dutch PropTech property due diligence
**Researched:** 2026-03-09
**Confidence:** HIGH

## Executive Summary

Propdex v14.0 adds per-parcel physical risk intelligence -- foundation risk, soil type classification, and enhanced asbestos assessment -- to the existing property due diligence platform. This closes the single most expensive blind spot in Dutch property development: foundation problems that routinely cost 50,000-200,000+ EUR and are invisible at acquisition. The approach combines two new public government data sources (BRO Bodemkaart WMS for soil type, PDOK Funderingsrisicogebieden WFS for area-level context) with a deterministic heuristic engine that assesses risk from bouwjaar x bodemtype. No new dependencies are needed -- the entire milestone builds on existing httpx, asyncio.gather, JSONB cache, and rate limiter patterns.

The recommended approach is conservative and defensible: use only verified PDOK-hosted public APIs (no undocumented endpoints), present all results as indicative signals with prominent disclaimers, and keep the heuristic engine as a pure function that is transparent and explainable. The PDOK Funderingsrisicogebieden data is postcode-level (PC6), not parcel-level -- it must be clearly labeled as area context, never as a parcel-specific assessment. The foundation risk heuristic (bouwjaar + soil type) provides the parcel-specific signal.

The primary risk is presenting heuristic-derived risk as definitive assessment. Professional users (developers who understand foundations) will immediately dismiss the platform if it overstates confidence. The mitigation is consistent: amber badges (never red) for heuristic data, mandatory disclaimer fields in every schema, and transparent derivation shown in the UI ("Bouwjaar 1952 + kleigrond = mogelijk houten paalfundering"). A secondary risk is the soil data source choice -- ARCHITECTURE.md proposed WUR soilphysics.wur.nl (undocumented internal endpoint), while STACK.md and PITFALLS.md both recommend PDOK BRO Bodemkaart WMS (documented, verified, stable). Use PDOK WMS exclusively.

## Key Findings

### Recommended Stack

Zero new dependencies. All features build on the existing Python backend (httpx, asyncio, pyproj, lxml) and React/Tailwind frontend. Two new government API clients follow the identical pattern as existing clients (bodemloket_arcgis.py, bag_wfs.py). The foundation risk engine and soil classifier are pure Python logic -- no libraries needed.

**Core technologies (all existing):**
- **httpx** -- HTTP client for BRO WMS GetFeatureInfo and PDOK WFS GetFeature
- **pyproj** -- CRS transformation (RD New to WGS84, already in use)
- **JSONB cache** via `cache_manager.py` -- 365-day TTL for soil data, 180-day for funderingsgebieden
- **asyncio.gather** -- parallel fetch alongside existing 7 API calls, zero latency increase

### Expected Features

**Must have (table stakes):**
- Soil type classification (klei/veen/zand/leem) via BRO Bodemkaart WMS -- every foundation assessment starts here
- Foundation risk heuristic (bouwjaar x bodemtype) -- 750K+ Dutch homes on wooden piles, professionals know this rule
- PDOK Funderingsrisicogebieden context signal -- official RVO data at PC6 level
- Combined traffic-light risk summary with Dutch-language explanation
- Asbestos v2 with BAG gebruiksdoel refinement (school/fabriek = higher risk)
- Source attribution and disclaimers on every risk indicator

**Should have (differentiators):**
- Combined Fysiek Risicoprofiel section in ParcelDetailModal -- nobody else integrates soil + foundation + asbest + contamination for Dutch property
- Confidence-tiered visual hierarchy (verified data vs heuristic indicators)

**Defer (v2+):**
- Climate context signal (droogte/bodemdaling) -- needs Klimaateffectatlas integration
- Foundation risk in area scan tiles -- needs per-parcel soil at scale
- Risk-to-cost estimation (KCAF reference prices) -- needs heavy disclaimers
- Soil profile depth view -- uncertain API availability
- Asbest sanering cost indication -- market rates too variable

### Architecture Approach

The architecture follows the established aggregator pattern: two new government API clients feed into two new aggregator services (with JSONB cache), which feed into a pure-function heuristic engine, all orchestrated by the existing `property_aggregator.py` via `asyncio.gather()`. The combined `FysiekRisicoProfiel` schema composes foundation risk, soil profile, asbestos v2, and existing contamination data into one typed response field. No new database tables or migrations are needed -- all data flows through the existing cache infrastructure.

**Major components:**
1. **BRO Bodemkaart WMS client** (`bro_bodemkaart.py`) -- GetFeatureInfo at RD coordinate, returns soilcode + Dutch name
2. **PDOK Funderingsrisico WFS client** (`pdok_funderingsrisico.py`) -- GetFeature by postcode/BBOX, returns PC6-level context
3. **Soil classifier** (`soil_classifier.py`) -- static dict mapping bodemcode prefix to grondsoort category
4. **Foundation risk engine** (`foundation_risk_engine.py`) -- pure function: bouwjaar x bodemtype x area context = risk level
5. **Fysiek risico aggregator** (`fysiek_risico_aggregator.py`) -- orchestrates fetch + cache + heuristic computation
6. **Frontend FysiekRisicoProfiel section** -- collapsible card in ParcelDetailModal after Property Info Grid

### Critical Pitfalls

1. **Soil data source confusion** -- bodemdata.nl and WUR soilphysics.wur.nl are undocumented internal endpoints, not public APIs. Use PDOK BRO Bodemkaart WMS GetFeatureInfo exclusively. Verified live, returns JSON with soilcode and Dutch soil name.

2. **PDOK Funderingsgebieden is postcode-level, not parcel-level** -- never present PC6 area statistics as parcel-specific risk. Always combine with per-parcel bouwjaar. UI must say "Dit pand ligt in een aandachtsgebied" not "Dit pand heeft funderingsrisico."

3. **Heuristic presented as definitive assessment** -- use amber badges (never red) for heuristic-derived risk. Include disclaimer field in every schema. Show derivation transparently. Add recommended_action ("Laat een funderingsonderzoek uitvoeren").

4. **ParcelCache has no postcode field** -- do not add a postcode column for PDOK lookup. Use the postcode already available in scan results address data, or use spatial BBOX query against WFS.

5. **BAG gebruiksdoel reflects current function, not historical** -- a 1970s school converted to apartments shows "woonfunctie." Bouwjaar must remain the primary asbestos risk driver; gebruiksdoel is additive only.

## Implications for Roadmap

Based on research, suggested phase structure (4 phases, starting at Phase 87):

### Phase 87: Soil Data Integration + Schemas
**Rationale:** Foundation dependency -- soil type is required input for the foundation heuristic. Must be built first. Schemas define the contract for all subsequent phases.
**Delivers:** BRO Bodemkaart WMS client, soil code classifier (static dict mapping), soil aggregator with JSONB cache, all Pydantic schemas (`FysiekRisicoProfiel`, `FoundationRisk`, `SoilProfile`, `FunderingsrisicogebiedData`), rate limiter entries
**Addresses:** BODEM-01 (soil type classification), BODEM-02 (soil code mapping)
**Avoids:** Pitfall 1 (wrong API -- uses PDOK WMS, not bodemdata.nl), Pitfall 4 (no postcode column -- uses coordinate-based WMS query)

### Phase 88: Foundation Risk Heuristic + PDOK Integration
**Rationale:** Depends on soil type from Phase 87. Core intelligence of the milestone.
**Delivers:** PDOK Funderingsrisicogebieden WFS client + aggregator, foundation risk heuristic engine (pure function with bouwjaar x bodemtype matrix), wiring into property_aggregator.py asyncio.gather, FysiekRisicoProfiel field on PropertyReportResponse
**Addresses:** FUND-01 (PDOK context data), FUND-02 (heuristic engine), FUND-03 (aggregator integration)
**Avoids:** Pitfall 2 (postcode-level data labeled as area context only), Pitfall 3 (heuristic with disclaimer and confidence field, never presented as definitive)

### Phase 89: Asbestos v2 Refinement
**Rationale:** Independent of Phases 87-88 technically, but logically follows. Small scope -- extends existing asbest_indicator.py with two optional parameters.
**Delivers:** Extended `assess_asbest_risk()` accepting optional gebruiksdoel + has_bodem_dossiers, richer Dutch-language explanation text, updated tests
**Addresses:** ASBT-01 (building function refinement), ASBT-02 (soil context signal)
**Avoids:** Pitfall 5 (gebruiksdoel is additive only, bouwjaar remains primary driver)

### Phase 90: Frontend Fysiek Risicoprofiel
**Rationale:** Depends on all backend work (Phases 87-89). Presentation layer.
**Delivers:** FysiekRisicoProfiel section in ParcelDetailModal with foundation risk card, soil type indicator, asbestos v2 card, disclaimers, source attribution. TypeScript types matching backend schemas. Confidence-tiered visual hierarchy (amber for heuristic, solid for verified data).
**Addresses:** FRNT-01 (risk section), FRNT-02 (confidence-tiered badges), FRNT-03 (disclaimers and source attribution)
**Avoids:** UX pitfalls (amber not red for heuristic, placement after Property Info Grid, plain Dutch soil names, derivation transparency)

### Phase Ordering Rationale

- **87 before 88**: Foundation heuristic requires soil type as input. The BRO client and classifier must exist first.
- **88 before 90**: Frontend cannot render risk data until backend produces it.
- **89 is semi-independent**: Could run in parallel with 88, but sequential ordering is simpler for a 4-phase milestone with one developer.
- **90 last**: Frontend integrates all backend outputs. Allows backend APIs to stabilize before UI work begins.
- **All phases require zero new dependencies**: No pip/npm additions means zero deployment risk.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 87:** BRO Bodemkaart WMS GetFeatureInfo coverage gaps need handling -- urban fill areas, water bodies, and recent land reclamation may return no data. STACK.md verified the endpoint live but edge cases need defensive coding.

Phases with standard patterns (skip research-phase):
- **Phase 88:** Foundation heuristic is well-documented by KCAF. PDOK WFS follows existing bag_wfs.py pattern exactly. Both endpoints verified live.
- **Phase 89:** Extending existing asbest_indicator.py with optional params. Trivial scope, no unknowns.
- **Phase 90:** Standard React component work following existing ParcelDetailModal patterns. No new frontend libraries.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Zero new dependencies. Both PDOK endpoints verified via live API calls with real Venlo data. Response schemas documented. |
| Features | MEDIUM-HIGH | Table stakes well-defined from KCAF methodology and industry practice. Differentiator value clear. Deferred features need future validation. |
| Architecture | HIGH | Follows identical patterns to 6 existing government API integrations. Build order derived from actual code dependency analysis. Minor disagreement on soil data source resolved in favor of PDOK WMS. |
| Pitfalls | HIGH | All critical pitfalls verified against existing codebase behavior and known data limitations. Phase-specific warnings map cleanly to suggested phases. |

**Overall confidence:** HIGH

### Gaps to Address

- **Soil data source disagreement:** ARCHITECTURE.md proposed WUR soilphysics.wur.nl, while STACK.md and PITFALLS.md recommend PDOK BRO Bodemkaart WMS. Resolution: use PDOK WMS exclusively. The WUR endpoint is undocumented, lacks versioning and SLA, and could break without notice. However, PDOK WMS returns a soil classification code (e.g., "cY23") rather than clay/sand/silt percentages -- the soil classifier must map codes to grondsoort categories via a static lookup table (documented in STACK.md).
- **BRO Bodemkaart coverage gaps:** 1:50,000 scale means some coordinates (urban fill, water, reclaimed land) return no data. Must return "onbekend" with explanation, never error.
- **Area scan performance:** Per-parcel WMS GetFeatureInfo at 500+ parcels may be slow. Consider pre-loading bodemkaart into PostGIS as a future optimization if scan times exceed 60s. This is a v14.1 concern, not v14.0.
- **Completeness score regression:** Adding FysiekRisicoProfiel to PropertyReportResponse changes the completeness score denominator. Must ensure existing reports do not drop in score.

## Sources

### Primary (HIGH confidence)
- PDOK BRO Bodemkaart WMS GetCapabilities + GetFeatureInfo -- verified live 2026-03-09, returns soilcode/soilname JSON
- PDOK Funderingsrisicogebieden WFS GetCapabilities + GetFeature -- verified live 2026-03-09, returns PC6-level GeoJSON
- BRO Catalogus Bodemkaart (docs.geostandaarden.nl/bro/SGM/) -- soil code prefix classification system
- KCAF (Kennis Centrum Aanpak Funderingsproblematiek) -- bouwjaar x bodemtype heuristic methodology
- Existing codebase -- asbest_indicator.py, bodem_aggregator.py, property_aggregator.py, cache_manager.py, rate_limiter.py patterns

### Secondary (MEDIUM confidence)
- WUR Legenda's en indelingen op bodemkaarten -- soil code prefix meanings (documentation not always current)
- NEN 2991:2015 -- asbestos risk assessment standard (used for existing v1, extended for v2)
- Deltares Foundation Damage Research -- 1M+ buildings at risk nationally

### Tertiary (LOW confidence)
- WUR soilphysics.wur.nl API -- verified working 2026-03-09 but undocumented, no SLA, should not be used as primary source
- Klimaateffectatlas for climate risk context -- deferred, not investigated

---
*Research completed: 2026-03-09*
*Ready for roadmap: yes*
