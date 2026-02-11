# Feature Landscape: Bestemmingsplan Visualization & Area Deep-Dive

**Domain:** Zoning Visualization + Area-Based Property Scanning + Change Monitoring
**Researched:** 2026-02-11
**Confidence:** MEDIUM

## Executive Summary

This research focuses on THREE specific feature sets for the NEXT Propdex milestone:
1. **Bestemmingsplan as base layer** — Visual zoning overlay on map
2. **Area deep-dive scanning** — User-selected area → batch property enrichment
3. **Change monitoring** — Track new permits and zoning changes per gemeente

This is MORE FOCUSED than v3.0 Area Intelligence (which includes owner lookup, opportunity scoring, raadsinformatie). This milestone focuses on visualization + scanning mechanics + monitoring foundation.

**Key findings:**
- Bestemmingsplan WMS layers with SVBP2012 colors are table stakes (ruimtelijkeplannen.nl standard)
- Area selection via drawing tools (rectangle/polygon) is expected (MapLibre-Geoman or terra-draw)
- Replacing current "scan ALL panden" with bbox-filtered scans reduces API load by 90%+
- Vergunning monitoring via daily polling (not webhooks) is realistic and expected
- Bestemmingsplan change detection requires plan version storage and diff logic

---

## Table Stakes (Users Expect These)

Features users assume exist in Dutch GIS/proptech platforms. Missing these = product feels incomplete.

| Feature | Why Expected | Complexity | Dependencies on Existing |
|---------|--------------|------------|-------------------------|
| **Bestemmingsplan WMS Layer** | Standard in ruimtelijkeplannen.nl, DSO Omgevingsloket, 3D Cityplanner. Users expect colored zones showing wonen/bedrijven/agrarisch at a glance | MEDIUM | Extends existing MapLibre map (v2.0). Add PDOK WMS source with SVBP2012 SLD styling. Toggle layer control |
| **Click Zone → Show Plan Details** | ruimtelijkeplannen.nl lets users click polygon → see plan name, bestemming type, link to official doc. Expected interaction | LOW | WMS GetFeatureInfo on click → parse XML response. Display in QuickCard or toast |
| **Rectangle/Polygon Drawing Tools** | All GIS platforms (Google Earth, ArcGIS, QGIS) support area selection. Mobile: tap corners. Desktop: drag | MEDIUM | MapLibre needs drawing plugin: mapbox-gl-draw (legacy), terra-draw (modern), or MapLibre-Geoman (full-featured). No existing drawing tools |
| **Scan Progress Indicator** | Long-running operations (30+ seconds) need real-time feedback. Users expect progress bars for bulk operations | LOW | ALREADY EXISTS: ScanProgressOverlay (v2.0) with polling. Reuse for new scan type |
| **Parcel Boundary Highlighting** | When user scans area, show which parcels are included. Visual confirmation before triggering expensive API calls | MEDIUM | ALREADY EXISTS: Kadaster parcel WFS layer (v2.0). Extend with "selected parcels" highlight style |
| **Filter by Bestemmingsplan Type** | After scanning, users want to filter results by zone type (wonen, bedrijven, etc.) to focus on relevant opportunities | LOW | Extends existing scan results table. Add dropdown filter for bestemmingsplan hoofdgroep |

### Why These Are Table Stakes

**Bestemmingsplan as base layer:** Ruimtelijkeplannen.nl shows colored zones with legend. DSO Omgevingsloket "Regels op de kaart" does the same. Users browsing for development opportunities need to see "where is wonen zoning" at a glance, not click every parcel individually. Source: [Ruimtelijkeplannen.nl viewer](https://www.ruimtelijkeplannen.nl/viewer/view), [Regels op de kaart](https://iplo.nl/digitaal-stelsel/omgevingsloket/regels-kaart/)

**Drawing tools:** PropertyRadar (US), 3D Cityplanner (NL), Assetmaps (NL) all support polygon/bbox drawing for custom area selection. Without it, users limited to administrative boundaries (gemeente) which may be too broad (15K+ parcels). Source: [3D Cityplanner](https://3dcityplanner.com/), [Assetmaps](https://www.assetmaps.nl/en/)

**Scan progress:** Existing v2.0 area scan already has ScanProgressOverlay with polling. Users expect same pattern for new deep-dive scans. Absence of progress = users think app froze.

**Parcel highlighting:** Google Maps selection box shows "this is the area you're looking at." Same principle applies to parcel selection — users need visual confirmation of what's included before triggering scan.

---

## Differentiators (Competitive Advantage)

Features that set product apart. Not required, but valuable.

| Feature | Value Proposition | Complexity | Dependencies on Existing |
|---------|-------------------|------------|-------------------------|
| **Zoning-Aware Opportunity Scoring** | Existing opportunity scoring (v2.0) doesn't consider bestemmingsplan. Adding zone context (wonen=high, agrarisch=medium for residential dev) improves lead prioritization | MEDIUM | ALREADY EXISTS: Opportunity scoring system. Add bestemmingsplan hoofdgroep as factor (weight: 0.3). Requires zone data in scan results |
| **Bestemmingsplan + Kadaster Overlay** | Show parcel boundaries colored by zone type + score heatmap simultaneously. Unique combination not seen in competitors | LOW | ALREADY EXISTS: Kadaster parcel layer + MVT tile endpoint for scores. Add z-index stacking + opacity controls |
| **Historical Vergunning Density Heatmap** | Render density of recent permits as heatmap layer. Reveals "hot" development areas competitors are targeting | HIGH | REQUIRES: Vergunning data collection + geocoding + MVT tile generation. Extends existing MVT endpoint (v2.0 Phase 21-04) |
| **Smart Area Suggestions** | "Based on your searches, also try Noord Industrial with recent wonen conversions." AI-driven area recommendations | VERY HIGH | REQUIRES: Search history analytics + ML model. LOW confidence — data-intensive, post-launch feature |
| **Bestemmingsplan Change Diff** | When plan changes, show before/after comparison with highlighted polygons showing "what changed" | HIGH | REQUIRES: Plan version storage + geometry diff algorithm. Storage-heavy, defer to future |
| **Multi-Zone Deep-Dive Comparison** | Select 3 zones → side-by-side comparison of avg scores, pand density, vergunning activity | HIGH | REQUIRES: Parallel scans + aggregation + comparison UI. Complex UX, defer to future |

### Why These Differentiate

**Zoning-aware scoring:** Most proptech platforms (PropertyRadar, LightBox) don't have Dutch zoning context. Scoring that considers "wonen zone near transit = high value" vs "agrarisch zone far from city = low value" is Dutch-specific intelligence. Competitors show zoning data but don't score with it.

**Overlay combination:** Competitors show EITHER parcel boundaries OR zoning OR scores. Showing all three with interactive toggles is rare. Propdex already has 2/3 (parcels + scores), adding zoning completes the picture.

**Vergunning heatmap:** OmgevingsAlert shows permits as list/notifications. Visualizing density as heatmap is unique — helps users spot "this neighborhood has 20 permits filed, high developer activity."

---

## Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Real-Time Vergunning Webhooks** | "I want instant alerts when permit filed" | No gemeente offers webhooks. Building scraper for 345+ gemeenten = massive maintenance burden + legal risk (ToS violations). Officiële Bekendmakingen updates DAILY, not real-time | Daily polling with diff detection. Set expectation: "updated daily" not "real-time." Morning email digest "3 new permits in your watched areas" |
| **User-Generated Zone Annotations** | "Let me mark this zone as 'good for apartments'" | Introduces liability — if user adds wrong info, Propdex could be blamed for bad investment. Also UGC moderation overhead | Official data only. Provide "add private note" to reports (not shared) |
| **Funda Listing Integration** | "Show available properties for sale in this zone" | Funda/Brainbay require partnership/licensing. Copyright risk, pulls focus from core value (zoning intelligence) | Link to Funda search ("See listings in this area" → external link). Stay in intelligence lane, don't compete with listing platforms |
| **3D Building Visualization** | "Show what could be built (3D model)" | 3D rendering (3D Cityplanner style) is complex, memory-heavy, mobile-unfriendly. Not core to zoning intelligence. Requires detailed bestemming parsing (height limits, setbacks) | Stick to 2D with zone colors + parcel boundaries. Link to external 3D viewers if needed. Provide raw data (max height, FAR) for their modeling tools |
| **Custom Bestemmingsplan Drawing** | "Let me draw my own zoning plan" | Requires legal knowledge, introduces liability, needs plan submission workflows. Out of scope for intelligence platform | Show official plans only. Future: link to gemeente omgevingsloket for official plan amendment requests |
| **Social Features (Share Scans Publicly)** | "Post my scan results for others to see" | Privacy concerns (competitor intel), moderation overhead, shifts product from B2B tool to social platform | Private scans only. Export to PDF for manual sharing. Keep it professional tooling |

### Why These Are Anti-Features

**Real-time webhooks:** Officiële Bekendmakingen publishes daily. Real-time polling would hit API every minute and return nothing 99.9% of the time. Wastes quota, creates false urgency. Daily check is appropriate cadence. Source: [Berichten over uw Buurt](https://www.overheid.nl/berichten-over-uw-buurt)

**User annotations:** GDPR liability. If user marks zone incorrectly and developer makes bad investment based on it, Propdex could be liable. Official data only = safer.

**Funda integration:** Licensing complexity. Funda owns listing data, requires partnership. Propdex's value is PRE-listing intelligence (find opportunities before they're listed), not listing aggregation.

**3D visualization:** Different product category. 3D Cityplanner focuses on this. Propdex focuses on data aggregation and intelligence, not architectural modeling.

---

## Feature Dependencies

```
Bestemmingsplan WMS Layer
  ├──requires──> MapLibre map (ALREADY EXISTS v2.0)
  ├──requires──> PDOK WMS endpoint + SLD styling
  └──requires──> Layer toggle UI control

Click Zone → Show Plan Details
  ├──requires──> Bestemmingsplan WMS Layer
  └──requires──> WMS GetFeatureInfo handler

Rectangle/Polygon Drawing Tools
  ├──requires──> MapLibre drawing plugin (terra-draw or Geoman)
  └──requires──> Geometry → bbox calculation

Area Deep-Dive Scan
  ├──requires──> Drawing Tools (defines scan area)
  ├──requires──> Bbox → BAG panden API query
  ├──requires──> Existing property enrichment pipeline (v1.0)
  ├──requires──> ARQ background jobs (ALREADY EXISTS)
  └──requires──> ScanProgressOverlay (ALREADY EXISTS v2.0)

Zoning-Aware Opportunity Scoring
  ├──requires──> Area Deep-Dive Scan (scan results need zone data)
  ├──requires──> Bestemmingsplan hoofdgroep per pand
  ├──requires──> Existing scoring system (ALREADY EXISTS v2.0)
  └──enhances──> Scan results (adds score column)

Vergunning Monitoring
  ├──requires──> Saved scan areas (DB storage)
  ├──requires──> Daily background job (ARQ worker)
  ├──requires──> Officiële Bekendmakingen SRU API integration
  └──enhances──> Scan results (shows new permits since last check)

Bestemmingsplan Change Monitoring
  ├──requires──> Plan version storage (DB schema)
  ├──requires──> Daily polling of ruimtelijkeplannen.nl WFS
  ├──requires──> Diff detection algorithm (geometry + attributes)
  └──enhances──> Notification system (alerts on plan changes)
```

### Critical Path for MVP

1. **Bestemmingsplan WMS Layer** → Enables visual zone browsing
2. **Drawing Tools** → Enables area selection
3. **Area Deep-Dive Scan** → Replaces current "scan all panden" with bbox-filtered scan
4. **Zoning-Aware Scoring** → Adds intelligence to scan results

**Monitoring features (vergunning + plan changes) can be DEFERRED** to post-MVP — they enhance existing scans but aren't required for core workflow.

---

## MVP Recommendation

### Phase 1: Visual Foundation (Must Have)
1. **Bestemmingsplan WMS Layer** — PDOK WMS with SVBP2012 colors, toggleable, legend
2. **Click Zone → Plan Details** — Click polygon → toast/QuickCard with plan name + hoofdgroep
3. **Layer Toggle UI** — Aerial/topo (existing) + bestemmingsplan + kadaster parcels + scores

### Phase 2: Area Selection (Must Have)
4. **Drawing Tools Integration** — MapLibre-Geoman or terra-draw, rectangle + polygon modes
5. **Bbox Calculation** — Drawing geometry → bounding box for API queries
6. **Selected Parcels Highlight** — Visual confirmation of scan area

### Phase 3: Deep-Dive Scanning (Must Have)
7. **Replace Current Area Scan** — Current: fetches ALL panden in gemeente. New: fetches panden in user-drawn bbox only
8. **Bbox → BAG Panden Query** — Filter BAG API by bbox, reduce API calls by 90%+
9. **Extend ScanProgressOverlay** — Reuse existing progress UI for new scan type
10. **Scan Results with Bestemmingsplan** — Add hoofdgroep column to results table

### Phase 4: Zoning Intelligence (Should Have)
11. **Zoning-Aware Scoring** — Add bestemmingsplan hoofdgroep as scoring factor (weight: 0.3)
12. **Filter by Zone Type** — Dropdown filter in results table for hoofdgroep

### Phase 5: Monitoring Foundation (Nice to Have — DEFER)
13. **Save Scan Areas** — Store bbox + filters for re-scanning
14. **Daily Vergunning Check** — ARQ background job polls Officiële Bekendmakingen
15. **Daily Plan Change Check** — ARQ background job polls ruimtelijkeplannen.nl WFS
16. **Notification UI** — In-app badges for "3 new permits" + "1 plan changed"

**Rationale for deferring monitoring:** Monitoring requires saved scans (which require user accounts with scan history). Until users validate the scan workflow (Phases 1-4), monitoring is premature. Also, monitoring adds complexity (notification infrastructure, email service).

---

## Complexity Estimates

| Feature | LOC Estimate | Key Risks | Existing Code to Leverage |
|---------|--------------|-----------|--------------------------|
| Bestemmingsplan WMS Layer | ~200 | WMS performance in dense areas, SLD syntax | MapLibre setup (v2.0), layer toggle pattern |
| Click Zone → Plan Details | ~150 | GetFeatureInfo XML parsing, multi-polygon results | QuickCard component (v2.0) |
| Drawing Tools | ~300 | Library choice (mapbox-gl-draw EOL), mobile touch conflicts | MapLibre map instance (v2.0) |
| Bbox → BAG Panden Query | ~400 | BAG API rate limits, handling partial failures, bbox size limits | Existing BAG client (v1.0) |
| Replace Area Scan Logic | ~500 | Migration from "scan all panden" to "scan bbox panden," data compatibility | Existing area_scan_job (v2.0 Phase 21) |
| Zoning-Aware Scoring | ~200 | Mapping SVBP hoofdgroepen to weights, handling mixed zones | Existing scoring system (v2.0) |
| Vergunning Monitoring | ~800 | SRU API integration, spatial search (radius), geocoding, diff detection | ARQ worker infrastructure (v1.0) |
| Plan Change Monitoring | ~600 | WFS polling, plan version storage, geometry diff algorithm | ARQ worker infrastructure |

**Total for MVP (Phases 1-4):** ~1,750 LOC
**Total with Monitoring (Phase 5):** ~3,150 LOC

---

## User Workflow Integration

### Current Workflow (v2.0)
1. User searches address → map flies to location
2. Click parcel → QuickCard → Drawer → Modal
3. Save to report → add to project folder
4. **[GAP]** Can trigger area scan (gemeente-wide), but fetches ALL panden (slow, expensive)
5. **[GAP]** No visual zoning context — must click individual parcels to see bestemming
6. **[GAP]** No monitoring — must manually recheck for changes

### Proposed Workflow (This Milestone)
1. User toggles bestemmingsplan layer → **sees colored zones** (wonen, bedrijven, agrarisch)
2. Clicks zone → **sees plan details** (name, hoofdgroep, link to official doc)
3. Identifies promising area (e.g., wonen zone near station with low building density)
4. Draws rectangle or polygon around area (not entire gemeente)
5. Triggers **deep-dive scan** → backend fetches panden in bbox only (not all gemeente panden)
6. **Progress overlay** shows "Fetching 47 panden... Enriching 20/47..."
7. Results table shows panden with **bestemmingsplan hoofdgroep** + **zoning-aware scores**
8. Filters results by "Wonen" zone + "score > 70"
9. Clicks promising pand → detailed report (existing v2.0 modal)
10. Saves to project (existing v2.0 feature)

**Phase 5 (future):**
11. User saves scan area → system monitors daily for new permits + plan changes
12. Next day: "3 new permits in your saved area" notification

---

## Technical Implementation Notes

### Bestemmingsplan WMS Integration

**PDOK WMS Endpoint:** `https://geodata.nationaalgeoregister.nl/omgevingswet/wms`

**Layer name:** `bestemmingsplannen` (exact name TBD, check PDOK docs)

**SLD (Styled Layer Descriptor):** SVBP2012 defines standard colors per hoofdgroep. Example:
- Wonen (residential): RGB(255, 230, 180) — light orange
- Bedrijven (business): RGB(204, 204, 255) — light blue
- Agrarisch (agricultural): RGB(255, 255, 204) — light yellow
- Groen (green): RGB(180, 255, 180) — light green

Source: [SVBP2012 Functielijst](https://ro-standaarden.geonovum.nl/2012/SVBP/1.3/SVBP2012-v1.3.1.pdf)

**Performance:** SLD-enabled WMS allows server-side filtering (e.g., only show wonen zones). Use this to reduce tile payload in dense urban areas.

### Drawing Tools Library Choice

| Library | Status | Pros | Cons | Recommendation |
|---------|--------|------|------|----------------|
| **mapbox-gl-draw** | EOL (no longer maintained) | Widely used, stable | No updates, bugs won't be fixed | AVOID |
| **terra-draw** | Active (2025+) | Modern, lightweight, well-documented | Newer, smaller community | GOOD CHOICE |
| **MapLibre-Geoman** | Active (2025+) | Full-featured (circle, radius, cut, snap), Material Design | Heavier bundle size | BEST CHOICE if features needed |

**Recommendation:** MapLibre-Geoman for rectangle + polygon modes. Source: [MapLibre-Geoman Docs](https://geoman.io/docs/maplibre/category/draw-modes)

### BAG API Bbox Filtering

**Endpoint:** `https://api.bag.kadaster.nl/lvbag/individuelebevragingen/v2/panden`

**Query parameter:** `bbox=minx,miny,maxx,maxy` (EPSG:28992 RD New coordinates)

**Rate limit:** NOT for bulk queries. BAG API Terms: "explicitly not intended for bulk queries." Must use carefully.

**Mitigation:** Cache pand geometry in DB after first fetch. Re-query only for new scans.

Source: [BAG API Docs](https://www.kadaster.nl/zakelijk/producten/adressen-en-gebouwen/bag-api-individuele-bevragingen), [Geoforum BAG bbox discussion](https://geoforum.nl/t/perceel-in-bbox/4600)

### Vergunning Monitoring (Phase 5)

**API:** Officiële Bekendmakingen SRU (Search/Retrieve via URL)

**Endpoint:** `https://repository.overheid.nl/sru`

**Query:** Spatial search by lat/lon + radius, or text search by gemeente name

**Update frequency:** Daily (not real-time)

**Challenge:** No structured data — PDF attachments require parsing. Example: "Omgevingsvergunning voor bouwen woning op Stationsstraat 12."

**Approach:** Text search for keywords (omgevingsvergunning, bouwvergunning) + gemeente name. Store in DB with publication date. Daily job queries "show me permits published in last 24 hours."

Source: [Berichten over uw Buurt](https://www.overheid.nl/berichten-over-uw-buurt)

### Bestemmingsplan Change Monitoring (Phase 5)

**API:** Ruimtelijkeplannen.nl WFS

**Endpoint:** `https://geodata.nationaalgeoregister.nl/ruimtelijkeplannen/wfs`

**Layer:** `bestemmingsplannen`

**Strategy:**
1. Store plan version in DB (plan ID + last_modified date)
2. Daily job queries WFS for plans in watched gemeenten
3. Compare last_modified date → if newer, fetch plan, compute diff
4. Flag changed polygons (geometry or attributes changed)

**Challenge:** Geometry diff is complex. Simplified approach: flag plan as "changed" if any attribute or geometry modified. Detailed diff (which polygons changed) is v3.2+ feature.

---

## Sources

**Bestemmingsplan Visualization & Standards:**
- [RO Standaarden – Ruimtelijke Ordening | Geonovum](https://www.geonovum.nl/geo-standaarden/ro-standaarden-ruimtelijke-ordening)
- [Informatiemodel Ruimtelijke Ordening 2012 (IMRO2012)](https://docs.geostandaarden.nl/ro/imro/)
- [Standaard Vergelijkbare Bestemmingsplannen (SVBP2012)](https://www.geonovum.nl/geo-standaarden/ro-standaarden-ruimtelijke-ordening/standaard-vergelijkbare-bestemmingsplannen)
- [SVBP2012 v1.3.1 PDF](https://ro-standaarden.geonovum.nl/2012/SVBP/1.3/SVBP2012-v1.3.1.pdf)
- [SVBP Functielijst hoofdgroepen](https://ro-standaarden.geonovum.nl/2012/SVBP/1.3/SVBP2012-v1.3.1.pdf) — wonen, bedrijven, agrarisch, groen, etc.
- [Regels op de kaart in het Omgevingsloket | IPLO](https://iplo.nl/digitaal-stelsel/omgevingsloket/regels-kaart/)
- [Animatie Zo werkt Regels op de kaart](https://iplo.nl/digitaal-stelsel/omgevingsloket/animatie-zo-werkt-regels-op-kaart/)

**Data Access & APIs:**
- [Ruimtelijke plannen WMS | Nationaal Georegister](https://www.nationaalgeoregister.nl/geonetwork/srv/api/records/6c62e0a5-c215-4e47-94b0-a239e264417d)
- [Ruimtelijke plannen opvragen | Ontwikkelaarsportaal](https://developer.omgevingswet.overheid.nl/api-register/api/rp-opvragen/)
- [Ruimtelijke plannen (WMS) - PDOK](https://www.pdok.nl/ogc-webservices/-/article/ruimtelijke-plannen)
- [Open data en API's Omgevingswet | IPLO](https://iplo.nl/digitaal-stelsel/aansluiten/open-data-api/)
- [API-register | Ontwikkelaarsportaal DSO](https://developer.omgevingswet.overheid.nl/api-register/)
- [BAG API Individuele Bevragingen - Kadaster](https://www.kadaster.nl/zakelijk/producten/adressen-en-gebouwen/bag-api-individuele-bevragingen)
- [Panden opvragen binnen een polygon - BAG - Geoforum](https://geoforum.nl/t/panden-opvragen-binnen-een-polygon/9203)
- [Perceel in bbox - BAG - Geoforum](https://geoforum.nl/t/perceel-in-bbox/4600)

**Drawing Tools & Interaction:**
- [MapLibre GL JS - Draw polygon with mapbox-gl-draw](https://maplibre.org/maplibre-gl-js/docs/examples/draw-polygon-with-mapbox-gl-draw/)
- [Draw Modes | MapLibre-Geoman](https://geoman.io/docs/maplibre/category/draw-modes)
- [Draw Rectangle | MapLibre-Geoman](https://geoman.io/docs/maplibre/draw-modes/draw-rectangle)
- [Draw Polygon | MapLibre-Geoman](https://geoman.io/docs/maplibre/draw-modes/draw-polygon)
- [Draw geometries with terra-draw - MapLibre GL JS](https://maplibre.org/maplibre-gl-js/docs/examples/draw-geometries-with-terra-draw/)
- [maplibre-gl-terradraw announcement](https://talks.osgeo.org/foss4g-europe-2025/talk/UTUW8Z/)

**Monitoring & Alerts:**
- [OmgevingsAlert](https://www.omgevingsalert.nl/)
- [Berichten over uw Buurt](https://www.overheid.nl/berichten-over-uw-buurt) — 342 municipalities, 8M+ residents, daily updates
- [Webhooks vs. Polling | Medium](https://medium.com/@i.vikash/webhooks-vs-polling-understanding-the-difference-with-real-life-examples-b1ba1074328a)
- [Webhook System Design](https://systemdesignschool.io/problems/webhook/solution)

**Dutch Proptech & GIS:**
- [3D Cityplanner](https://3dcityplanner.com/) — bestemmingsplan layers + drawing tools
- [Assetmaps](https://www.assetmaps.nl/en/) — interactive real estate info platform
- [Brainbay - Property data and tools](https://brainbay.nl/en/)
- [Top 100 Proptech Companies in Netherlands | ensun](https://ensun.io/search/proptech/netherlands)
- [Ruimtelijkeplannen.nl viewer](https://www.ruimtelijkeplannen.nl/viewer/view) — standard for plan viewing

**Real Estate Development Context:**
- [Netherlands: From Public to Private Development | Scottish Land Commission](https://www.landcommission.gov.scot/downloads/5fd89047c9610_SLC%20Netherlands%20Case%20Study.pdf) — development-led vs plan-led urbanism
- [Spatial Determinants of Real Estate Appraisals | MDPI](https://www.mdpi.com/2220-9964/11/2/125) — location factors, demographics, property characteristics
- [Netherlands Real Estate Market Analysis | Investropa](https://investropa.com/blogs/news/netherlands-real-estate-market) — sustainability, infrastructure, demographics
