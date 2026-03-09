# Pitfalls Research: v14.0 Fysiek Risicoprofiel

**Domain:** Physical risk assessment (foundation, soil, asbestos) for Dutch PropTech platform
**Researched:** 2026-03-09
**Confidence:** HIGH -- pitfalls verified against existing codebase, PDOK documentation, and known data gaps from v9.0/v11.0 experience

---

## Critical Pitfalls

### Pitfall 1: bodemdata.nl Is NOT a REST API -- It Is a Map Viewer Backed by BRO/PDOK Services

**What goes wrong:**
The previous research session noted "bodemdata.nl -- free API for soil profiles per coordinate" as the primary new data source. This is misleading. bodemdata.nl is a WUR (Wageningen University) map viewer application that renders data from the Bodemkundig Informatiesysteem (BIS). It does not expose a public REST API endpoint you can query programmatically with a coordinate. The actual data source is the **BRO Bodemkaart (SGM)** dataset, served through PDOK as a **WMS-only service** (no WFS, no OGC API Features). There is no documented WFS endpoint for querying soil type features by coordinate.

**Why it happens:**
The name "bodemdata.nl" suggests an API-ready data service. Developers visit the site, see soil profiles rendered on a map, and assume there is a query endpoint behind it. In reality, the viewer uses internal WUR services that are not publicly documented or guaranteed stable.

**Consequences:**
Building a client against undocumented bodemdata.nl internal endpoints risks breaking when WUR updates their viewer. The endpoint could have rate limits, IP restrictions, or change without notice. You ship a feature that works in development but fails silently in production.

**How to avoid:**
Use the **BRO Bodemkaart WMS via PDOK** (`https://service.pdok.nl/bzk/bro-bodemkaart/wms/v1_0`) with `GetFeatureInfo` requests. This is the same pattern already used for bestemmingsplan data in `zoning_aggregator.py`. The WMS GetFeatureInfo request takes a coordinate (in EPSG:28992) and returns the soil classification for that point. The bodemkaart provides grondsoort (soil type: klei, veen, zand, leem) and bodemcode at 1:50,000 scale.

Alternative: Download the Bodemkaart via PDOK Atom feed as a GeoPackage/GML file and load into PostGIS for local spatial queries. This eliminates runtime API dependency entirely and is faster for batch operations (area scans).

**Warning signs:**
- HTTP 403 or connection refused from bodemdata.nl endpoints
- Undocumented response formats that change between calls
- No version number or SLA in the URL pattern

**Phase to address:** Phase 87 (first phase -- soil data integration)

---

### Pitfall 2: PDOK Funderingsrisicogebieden Is Postcode-Level, Not Parcel-Level -- Do NOT Present It as Parcel-Specific Risk

**What goes wrong:**
The PDOK Indicatieve Aandachtsgebieden Funderingsproblematiek dataset returns MultiPolygon features per **PC6 postcode area**, with attributes like `percvoor1970` (percentage of buildings before 1970) and `fgr` (fysisch-geografische regio = soil category). Developers treat this as parcel-level foundation risk data and display "Hoog funderingsrisico" on a specific building. A user then makes a 500K acquisition decision based on this indicator, discovers the actual foundation is fine, and loses trust in the platform.

**Why it happens:**
The WFS returns a polygon that spatially contains the parcel. A naive `ST_Contains` or `ST_Intersects` query returns a result, and developers assume it applies to that specific parcel. But `percvoor1970 = 45%` means 45% of buildings in that entire postcode area were built before 1970 -- it says nothing about the specific parcel.

**Consequences:**
- False positives: New buildings in old neighborhoods flagged as high risk
- False negatives: Old buildings in newer postcode areas not flagged
- Liability: Users cite Propdex risk assessment in due diligence reports
- Credibility loss when a second opinion contradicts the platform

**How to avoid:**
- Label PDOK data explicitly as **"context signal"** or **"aandachtsgebied"**, never as parcel-specific risk
- Always combine with per-parcel bouwjaar from BAG (already in ParcelCache)
- The foundation heuristic (bouwjaar x bodemtype) is the parcel-specific indicator; PDOK data is the area-level context
- UI must show "Dit pand ligt in een aandachtsgebied voor funderingsproblematiek" not "Dit pand heeft funderingsrisico"
- Include the PDOK disclaimer: the map does not make statements about specific foundations

**Warning signs:**
- UI mockup shows red/amber badge directly on a parcel with no qualifier text
- Risk label derived from postcode data alone without checking bouwjaar
- No disclaimer text in the schema or UI component

**Phase to address:** Phase 88 (foundation risk heuristic) -- get the labeling right from day one

---

### Pitfall 3: Foundation Heuristic Presented as Definitive Assessment Instead of Indicative Signal

**What goes wrong:**
The foundation risk heuristic (bouwjaar < 1970 + klei/veen soil = "waarschijnlijk houten palen" = HOOG risico) is a reasonable screening indicator, but developers present it with the same confidence level as data from BAG or Kadaster. Users treat "HOOG funderingsrisico" as equivalent to a professional foundation inspection report, skip the actual inspection, and get burned.

**Why it happens:**
The existing asbest_indicator.py already uses a risk/reden pattern that works well. Developers copy this pattern for foundation risk without adjusting the confidence communication. The code says `risk="hoog"`, the UI shows a red badge, and users read it as a definitive assessment.

**Consequences:**
- Users skip professional foundation inspections (10-20K savings that cost 100K+ when wrong)
- Platform becomes liable for investment decisions based on indicative data
- Professional users (developers who know foundations) dismiss the entire platform as unreliable

**How to avoid:**
- Use different terminology: `indicatie` not `risico`, `aandachtspunt` not `probleem`
- Always include a `disclaimer` field (like BodemData already does) that states this is indicative
- Add a `recommended_action` field: "Laat een funderingsonderzoek uitvoeren door een gecertificeerd bureau"
- Include `confidence` level explicitly in the schema: "heuristic" vs "inspection" vs "unknown"
- Never use red for heuristic-only data; use amber/orange to distinguish from verified data
- Show the derivation transparently: "Bouwjaar 1952 + kleigrond = mogelijk houten paalfundering"

**Warning signs:**
- Schema has `risk: Literal["hoog", "middel", "laag"]` without `confidence` or `basis` field
- UI shows same red badge for heuristic risk and verified data
- No disclaimer text anywhere in the response

**Phase to address:** Phase 88 (foundation risk heuristic engine)

---

### Pitfall 4: ParcelCache Has No Postcode -- PDOK Funderingsdata Join Requires Spatial Query

**What goes wrong:**
The ParcelCache model has `gemeente_code` and `parcel_id` but no `postcode` field. The PDOK Funderingsrisicogebieden data is keyed by PC6 postcode area polygons. Developers assume they can do a simple lookup by postcode, discover there is no postcode in ParcelCache, and either add a postcode column (schema migration + backfill for ~100K parcels) or do a PDOK geocode to get the postcode (adding an API call per parcel in area scans).

**Why it happens:**
Area scans pull parcel data from BAG WFS which returns geometry, bouwjaar, pand_status -- but not postcode. Postcode is on the address (nummeraanduiding), not the parcel (perceel). The data models correctly reflect this separation.

**Consequences:**
- Adding a postcode column requires migration + backfill across all existing parcels
- Per-parcel PDOK geocode calls during area scan multiply scan time by 2-5x
- Batch operations (scan 2000 parcels) become unfeasible with per-parcel postcode lookups

**How to avoid:**
- Use **spatial join** against the PDOK funderingsgebieden WFS polygons directly: `ST_Intersects(parcel.geometry, funderings_polygon.geometry)`
- Pre-load the funderingsgebieden data into PostGIS (it is a national dataset, ~10MB): download via PDOK Atom feed, load as a reference table, spatial join at query time
- This is the same pattern used for CBS wijk boundaries and bestemmingsplan zones
- Do NOT add a postcode column to ParcelCache just for this feature

**Warning signs:**
- Migration file adding `postcode` column to `parcel_cache`
- PDOK suggest/geocode calls inside area scan loop
- Foundation risk lookup taking > 1 second per parcel

**Phase to address:** Phase 87 (data integration) -- decide on spatial join pattern before building the client

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Hardcode soil classification mapping (bodemcode -> klei/veen/zand) | Fast implementation | Misclassifies edge cases (loss/zeeklei/beekklei subtypes) | MVP only -- replace with proper bodemcode taxonomy in v15+ |
| Query PDOK WMS per-parcel instead of pre-loading | No PostGIS schema change | 200ms+ per parcel, scan timeouts at 500+ parcels | Single-parcel on-demand lookups only |
| Skip funderingsgebieden pre-load, use WFS live queries | No local data management | WFS timeout at scale, PDOK rate limits | Never for area scans, acceptable for on-demand detail |
| Combine all risk data into single `fysiek_risico` JSONB column | One field in PropertyReportResponse | Cannot query/filter by individual risk factors | Never -- use typed schema fields |
| Use BAG `gebruiksdoel` directly as asbestos risk modifier | Free data, no new API | `gebruiksdoel` is current function, not historical -- a school converted to apartments still shows "woonfunctie" | Only for current-use screening, not historical risk |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| BRO Bodemkaart WMS | Using `GetMap` (returns image) instead of `GetFeatureInfo` (returns attributes) | Use `GetFeatureInfo` with `INFO_FORMAT=application/json` and specific layer name from GetCapabilities |
| BRO Bodemkaart WMS | Wrong CRS -- sending WGS84 coordinates to an EPSG:28992 service | Propdex already stores geometry in EPSG:28992 (RD New) -- use those coordinates directly |
| BRO Bodemkaart WMS | Not handling "no data" areas -- some coordinates fall outside bodemkaart coverage (water, urban fill) | Return `bodemtype: "onbekend"` with explanation, not an error |
| PDOK Funderingsgebieden WFS | Querying with `CQL_FILTER` that PDOK WFS does not support | Use `BBOX` filter in WFS GetFeature or download + PostGIS spatial join |
| PDOK Funderingsgebieden WFS | Expecting per-building data when it is per-postcode-area | Join on spatial intersection, always pair with per-parcel bouwjaar |
| Existing asbest_indicator.py | Adding `gebouwfunctie` from BAG as risk modifier without understanding it reflects CURRENT function | A 1970s school (high asbestos) converted to apartments shows `woonfunctie` -- would incorrectly reduce risk |
| PropertyReportResponse | Adding new fields without updating completeness_score calculation | Completeness score weights need to include new sections |
| property_aggregator.py | Adding soil/foundation lookups as sequential calls instead of parallel | Use `asyncio.gather()` like existing pattern -- soil + foundation can run in parallel with existing lookups |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Per-parcel WMS GetFeatureInfo during area scan | Scan time doubles from 30s to 60s for 500 parcels | Cache soil type per parcel in ParcelCache enrichment_data, or pre-load bodemkaart into PostGIS | > 100 parcels per scan |
| PDOK WFS funderingsgebieden live query per parcel | 429 rate limit errors from PDOK | Download national dataset once (~10MB), load into PostGIS, spatial join locally | > 50 parcels per scan |
| Foundation heuristic computed on every parcel detail view | Negligible CPU but redundant API calls for soil data | Cache result in enrichment_data JSONB with TTL (soil type does not change) | Not a real perf issue, but wastes API quota |
| Front-end rendering all risk sections for every parcel in map tiles | MVT tile payload bloats, map rendering slows | Risk data is detail-only (ParcelDetailModal), never in tiles | If someone adds risk to tile_proxy.py |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Including foundation risk in PDF reports without disclaimer | Legal liability for investment decisions based on indicative data | Always include disclaimer field, never render risk without it |
| Caching PDOK funderingsgebieden data without respecting license terms | PDOK open data license requires attribution | Include source attribution in schema and UI |
| Storing soil contamination (bodemloket) + foundation risk together implies clean/contaminated status | Users infer "no contamination + good foundation = safe to build" which is not guaranteed | Keep bodemloket (contamination) and bodemkaart (soil type) as separate, clearly labeled sections |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Show all risk indicators with equal visual weight | Users cannot distinguish "definitely asbestos risk" (bouwjaar 1975) from "might have foundation issues" (heuristic) | Use confidence-tiered visual hierarchy: verified data = solid badge, heuristic = outlined/dashed badge |
| Red "HOOG RISICO" badge for heuristic foundation assessment | Users panic, skip professional inspection, blame platform when wrong | Amber "AANDACHTSPUNT" with explanation of derivation + recommended action |
| Show soil type as raw bodemcode ("pZg23") | Meaningless to real estate developers | Map to plain Dutch: "Veen op zand" or "Kleigrond" with brief explanation |
| Show PDOK funderingsgebieden percentage without context | "45% pre-1970" means nothing to most users | Translate to actionable insight: "Dit postcode gebied bevat veel oudere woningen -- controleer specifiek dit pand" |
| Place risk section after 15 existing sections in ParcelDetailModal | Users never scroll that far | Place after Property Info Grid (early in flow), before Kansen & Aandachtspunten |
| Combine all physical risks into one collapsed section | Users who care about soil do not necessarily care about asbestos | Keep as one "Fysiek Risicoprofiel" section with clear sub-headings, but default expanded |

## "Looks Done But Isn't" Checklist

- [ ] **Soil type lookup:** Handles coordinates that fall outside bodemkaart coverage (water bodies, reclaimed land, urban fill) -- verify returns "onbekend" not 500
- [ ] **Foundation heuristic:** Handles `bouwjaar = None` gracefully (39% of ParcelCache entries may lack bouwjaar) -- verify returns "onbekend" not "laag"
- [ ] **Foundation heuristic:** Handles `bodemtype = None` (no coverage at coordinate) -- verify returns "onbekend" not "laag"
- [ ] **PDOK funderingsgebieden:** Handles parcels outside any postcode area polygon (rural areas, industrial zones) -- verify returns None not error
- [ ] **Asbestos v2:** `gebouwfunctie` from BAG reflects CURRENT function, not historical -- verify school-to-apartment conversion still shows "hoog"
- [ ] **PropertyReportResponse:** New fields have `| None` defaults so existing reports do not break when deserialized
- [ ] **Completeness score:** Updated to include new sections in the denominator -- verify old reports do not drop from 0.8 to 0.6
- [ ] **ParcelDetailModal:** New section renders correctly when all data is None (loading/unavailable state)
- [ ] **Cache invalidation:** Soil type cached indefinitely (geology does not change), foundation risk cached with bouwjaar dependency (re-assess if bouwjaar corrected)
- [ ] **Disclaimer text:** Present in schema, rendered in UI, included in PDF report (if/when PDF upgraded)

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Wrong API for soil data (bodemdata.nl internal vs PDOK WMS) | LOW | Swap the API client, keep the schema unchanged, re-cache affected parcels |
| Foundation risk presented as definitive | MEDIUM | Add disclaimer field to schema, update all UI components, re-run aggregator for cached reports |
| Postcode column added to ParcelCache | MEDIUM | Remove column, drop migration, switch to spatial join -- but must backfill enrichment_data |
| Red badges for heuristic data | LOW | CSS/component change only, no backend work |
| Missing bouwjaar handling | LOW | Add null check in heuristic, return "onbekend" -- pure code fix |
| PDOK rate limit hit during area scan | MEDIUM | Switch to pre-loaded PostGIS data, requires one-time data import + migration for reference table |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| bodemdata.nl is not an API | Phase 87 (soil data integration) | Verify using PDOK WMS GetFeatureInfo or PostGIS pre-load, not bodemdata.nl |
| Funderingsgebieden is postcode-level | Phase 88 (foundation heuristic) | Verify UI labels say "aandachtsgebied" not "pand risico" |
| Heuristic as definitive assessment | Phase 88 (foundation heuristic) | Verify disclaimer field exists in schema and renders in UI |
| No postcode in ParcelCache | Phase 87 (soil data) | Verify spatial join pattern, no postcode column migration |
| Asbestos v2 gebouwfunctie trap | Phase 89 (asbestos refinement) | Verify bouwjaar remains primary driver, gebouwfunctie is additive risk only |
| Performance at scan scale | Phase 87 (soil data) | Verify area scan with 500+ parcels completes in < 60 seconds |
| UX risk communication | Phase 90 (frontend integration) | Verify amber badges for heuristic, disclaimer visible, derivation shown |
| Completeness score regression | Phase 90 (frontend integration) | Verify existing reports maintain their completeness score |

## Sources

- [PDOK Bodemkaart SGM -- OGC Webservices](https://www.pdok.nl/ogc-webservices/-/article/bro-bodemkaart-sgm-) -- WMS only, no WFS
- [PDOK Indicatieve Aandachtsgebieden Funderingsproblematiek](https://www.pdok.nl/introductie/-/article/indicatieve-aandachtsgebieden-funderingsproblematiek) -- WFS at PC6 level
- [KCAF Funderingsviewer](https://www.kcaf.nl/funderingsviewer/) -- methodology: bouwjaar + FGR soil category
- [Data.overheid.nl -- Funderingsrisicogebieden dataset](https://data.overheid.nl/dataset/11058-indicatieve-aandachtsgebieden-funderingsproblematiek) -- dataset metadata
- [Duurzaam Funderingsherstel -- Soorten funderingen](https://www.duurzaamfunderingsherstel.nl/kennisbank/verschillende-soorten-funderingen/) -- foundation type reference
- [NEN 2991:2015](https://www.nen.nl/en/nen-2991-2015-nl-207667) -- asbestos risk assessment standard
- Existing codebase: `asbest_indicator.py`, `bodem_aggregator.py`, `bodemloket_arcgis.py`, `property_aggregator.py`, `parcel_cache.py`
- [Geoforum -- PDOK phasing out Bodemkaart WFS](https://geoforum.nl/t/pdok-faseert-huidige-webservices-bodemkaart-en-geomorfologische-kaart-uit/3351) -- confirms WFS removal

---
*Pitfalls research for: v14.0 Fysiek Risicoprofiel*
*Researched: 2026-03-09*
