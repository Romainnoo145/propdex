# Feature Research: v3.0 Area Intelligence

**Domain:** Area-based Property Intelligence / Development Opportunity Discovery
**Researched:** 2026-02-10
**Confidence:** MEDIUM

## Executive Summary

This research focuses on **NEW features for v3.0 Area Intelligence**, building on the existing v2.0 map-first property lookup platform. v3.0 transforms Propdex from "enter address → get report" to "scan area → find opportunities" — identifying parcels with building zoning but no buildings, cross-referencing with permits and municipal decisions, and surfacing qualified leads with owner information.

**Key findings:**
- Area selection via gemeente boundaries is table stakes (PropertyRadar uses census tracts, Dutch users expect CBS gebiedsindelingen)
- Smart pre-filtering pipeline (BAG has_pand → bestemming → permits) reduces API costs by 97.5% (2000 parcels → 50 qualified)
- Owner lookup (Kadaster BRK) is expensive and privacy-restricted — MUST filter first, lookup last
- Vergunningen monitoring via Officiële Bekendmakingen is expected (all 342 Dutch municipalities connected, 8M+ residents enrolled)
- Expandable source cards with AI summaries follow accordion UX best practices (caret icon, aria-expanded)
- Progressive loading (infinite scroll or pagination) is required for 2000+ parcel lists

---

## Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Map-based area selection** | Industry standard (PropertyRadar, LightBox) — users expect to draw/select scan regions | MEDIUM | Multiple selection modes needed: polygon draw, gemeente boundaries, wijk/buurt selection, address radius. Start with gemeente (simplest). |
| **Parcel list with filters** | Core workflow after scan — users need to filter 2000+ parcels to ~50 qualified leads | MEDIUM | Must support: bestemming type, has_pand boolean, permit activity, parcel size, last update date. Table or card grid layout. |
| **Parcel detail view** | Users expect to click parcel → see detailed intelligence before calling owner | MEDIUM | Modal/drawer with multi-source data (extends existing v2.0 report modal pattern), AI summary, map highlighting. |
| **Owner contact information** | Critical for outreach — can't approach owners without NAW gegevens | HIGH | Kadaster BRK paid API, privacy restrictions (only for qualified leads with legitimate interest), batch lookup for <100 parcels. |
| **Export to CSV/Excel** | Standard PropTech workflow — developers need lists for CRM, letters, spreadsheets | LOW | Filtered parcel list with owner info, coordinates, bestemming, opportunity score. One-click download button. |
| **Save searches/areas** | Users scan same gemeente weekly for new permits/changes | LOW | Save area polygon + filter criteria, re-run scan with freshness check. Extends existing report save pattern. |
| **Freshness indicators** | Government data changes weekly — users need to know "when was this scanned?" | LOW | Already exists for reports (v1.1), extend to area scans and parcel details. Show per-source timestamps. |
| **Progressive loading** | Scanning 2000+ parcels takes time — users expect UI to remain responsive | MEDIUM | Infinite scroll + pagination for parcel list, background jobs for heavy API calls (ARQ worker already exists). |

### Why These Are Table Stakes

**Area selection:** PropertyRadar (US market leader) uses census tract selection with FIPS codes. Dutch equivalent is CBS gebiedsindelingen (gemeente/wijk/buurt). Users expect to click a region on the map or search by name. Source: [PropertyRadar Opportunity Zones](https://help.propertyradar.com/en/articles/4445648-opportunity-zones), [CBS Gebiedsindelingen](https://www.cbs.nl/nl-nl/dossier/nederland-regionaal/geografische-data/cbs-gebiedsindelingen)

**Parcel list with filters:** PropertyRadar offers "250+ filter criteria" for real-time list building. Propdex doesn't need 250 (overkill), but core filters are expected: zoning type, building presence, permit activity, parcel size. Source: [PropertyRadar Features Overview](https://www.propertyradar.com/features-overview)

**Owner contact information:** PropertyRadar advertises "157M+ properties with verified owner contacts." In Netherlands, Kadaster BRK is the authoritative source, but it's paid and privacy-restricted. Users expect owner NAW data for outreach. Source: [Kadaster Eigendomsinformatie](https://www.kadaster.nl/producten/woning/eigendomsinformatie), [Openbaarheid en Privacy](https://www.kadaster.nl/over-ons/beleid/openbaarheid-en-privacy)

**CSV export:** Standard feature across all PropTech platforms. Users export to Excel for CRM import, mail merge for letters, internal tracking. No export = friction.

**Progressive loading:** 2000+ parcels cannot render in a single page load without freezing the browser. Industry standard is infinite scroll (mobile) or pagination (desktop) with 50-100 items per page. Source: [Pagination vs Infinite Scroll](https://ashishmisal.medium.com/pagination-vs-infinite-scroll-vs-load-more-data-loading-ux-patterns-in-react-53534e23244d)

---

## Differentiators (Competitive Advantage)

Features that set the product apart. Not required, but valuable.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Smart pre-filtering pipeline** | Reduce 2000 parcels → 50 opportunities BEFORE hitting paid APIs (97.5% cost reduction) | HIGH | Tier 1: BAG has_pand + bestemming (free, stored in DB). Tier 2: Permits, raadsinformatie (free, JSONB cache). Tier 3: BRK eigendom only for top 50 (paid). This is THE differentiator — cost-efficient opportunity discovery. |
| **AI opportunity scoring** | Automated ranking by development potential — users get best leads first | HIGH | Score based on: bestemming match (Wonen = high), years unused (longer = higher), no recent permits (activity = lower score), parcel size (larger = higher), proximity to infrastructure. LLM could also score based on raadsinformatie sentiment. |
| **Multi-source cross-referencing** | Unique value: BAG + DSO + Vergunningen + Raadsinformatie in one view | MEDIUM | Existing report aggregator pattern extends well (already handles PDOK/BAG/DSO/RCE in v1.0). Add Officiële Bekendmakingen SRU API + Open Raadsinformatie API. Source-specific TTL caching. |
| **Vergunningen monitoring** | Alert when permit filed in saved area — catch opportunities as they emerge | MEDIUM | Officiële Bekendmakingen SRU API (daily updates, not real-time). Background job (ARQ worker) checks saved areas daily, flags new permits. Email digest or in-app notifications. |
| **Expandable source cards** | Progressive disclosure per data source — reduces cognitive load | LOW | Accordion pattern with AI summary at top, raw data collapsed below. Follows Material Design guidelines (caret icon, aria-expanded). Source: [Accordion UI Design](https://mobbin.com/glossary/accordion) |
| **Municipality decision context** | Show gemeenteraad decisions affecting parcels — understand political climate | MEDIUM | Open Raadsinformatie API, LLM summarization, link to parcel via location/bestemming keywords. Example: "Gemeenteraad approved 'Wonen' rezoning for Stationsgebied, 2025-11-12." |
| **Historical permit timeline** | Visualize permit activity over time — spot patterns (e.g., years of inactivity) | MEDIUM | Timeline component showing vergunningen, raadsbesluit, eigendom changes. Helps identify "stalled" projects vs active development. |
| **Batch owner lookup** | Process top 50 parcels through BRK in one API call instead of 50 separate calls | HIGH | Kadaster BRK bulk endpoint (if available), fallback to sequential with rate limiting. Reduces lookup time from 5-10 minutes to <1 minute. |

### Why These Differentiate

**Smart pre-filtering pipeline:** PropertyRadar and LightBox charge per property lookup or subscription tier. Propdex's 3-tier pipeline (free filters → free APIs → paid APIs) minimizes costs. If scanning a gemeente with 2000 parcels, filtering to "Wonen zoning + no building + no recent permit" might yield 50 parcels. Only those 50 trigger BRK owner lookup (€0.50/lookup = €25 instead of €1000). This is a business model advantage.

**AI opportunity scoring:** LightBox announced "automated rent comps and operating expense extraction" for Q1 2026 (appraisal intelligence). Propdex can differentiate with Dutch-specific scoring: bestemming match (Wonen > Gemengd > Overig), permit inactivity (10 years unused > 1 year), raadsinformatie sentiment (positive rezoning decisions). Source: [LightBox Appraisal Intelligence](https://www.prnewswire.com/news-releases/lightbox-enhances-appraisal-intelligence-to-give-lenders-unmatched-financial-visibility-amid-rising-credit-and-regulatory-demands-302638256.html)

**Vergunningen monitoring:** Berichten over uw Buurt (Dutch government service) enrolls all residents 25+ for permit notifications in their neighborhood. This sets user expectations: "I get permit alerts for my home, why not for my scan areas?" Propdex extending this to projectontwikkelaars is a natural fit. Source: [Berichten over uw Buurt](https://www.overheid.nl/berichten-over-uw-buurt)

**Multi-source cross-referencing:** Most platforms show cadastral data OR zoning data OR permits. Few combine all three in one view. Propdex already does this for single properties (v1.0 report aggregator). Extending to area scans is a competitive advantage.

---

## Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Real-time everything** | "I want to see live permit filings" | Officiële Bekendmakingen updates **daily**, not real-time. Real-time polling wastes API quota and confuses users with empty results. Also, permits are announced AFTER filing (delay inherent). | Daily background job + freshness indicator ("Last checked: 2 hours ago") + manual refresh button for power users. |
| **Scan entire Netherlands** | "Why limit to gemeente? I want all of NL" | Netherlands has ~340 gemeentes, ~10M+ parcels total. Scanning all = database explosion (10GB+), API quota death, unusable UI (infinite scroll of 10M items?). PropertyRadar limits to counties/census tracts for same reason. | Per-gemeente scans with multi-gemeente saved searches. "Scan 5 gemeentes" is manageable. "Scan all NL" is not. Progressive rollout (start with 1 gemeente, allow adding more). |
| **Auto-generate owner letters** | "Can AI write the acquisition letter?" | **Legal liability:** AI-generated letter could violate GDPR (improper use of personal data), make false claims (bestemming interpretation), or damage reputation (tone mismatch). **User control:** Projectontwikkelaars want customization based on owner relationship (cold outreach vs warm intro). | Export contact list → user's CRM/mail merge. Provide letter **templates** (not auto-generation). Example: "Geachte heer/mevrouw [Naam], wij zijn geïnteresseerd in uw perceel..." User fills in specifics. |
| **CRM integration** | "Connect to our Salesforce/HubSpot/Pipedrive" | Every developer uses different CRM (or Excel). Integration maintenance nightmare (10+ CRM APIs, auth flows, field mapping). Scope creep for MVP. Better to validate core workflow first. | CSV export with standard fields (address, owner, contact, score) → user imports to their CRM. If 3+ users request same CRM, build integration in v3.2+. Provide API for custom integrations (future). |
| **3D visualization of parcels** | "Show what could be built (3D model)" | Requires 3D building modeling engine (SketchUp/Revit domain), height calculations, setback analysis, shadow studies. **Different product category.** Also requires detailed bestemming parsing (bouwvlak geometry, height limits, setbacks) which is complex. | Link to external 3D tools (e.g., SketchUp for Web), provide raw bestemming data (bouwvlak polygon, max height, FAR) for their modeling. Focus on "what CAN be built" (zoning rules) not "what it WILL look like" (3D viz). |
| **Financial feasibility calculator** | "What's the ROI / IRR / NPV?" | Requires market data (WOZ comps, construction costs per m², financing rates), user assumptions (rental income, exit cap rate, holding period). **Wrong domain for intelligence platform.** Financial modeling is a separate tool (Excel, Argus). | Provide raw inputs (parcel size, max FAR, WOZ waarde) → user's financial model. Future: integrate with financial modeling APIs (post-MVP, if demand validated). |
| **Mobile app for area scanning** | "I want to scan from my phone" | Map polygon drawing + 2000-row data table = **terrible mobile UX.** Area scanning is desktop workflow (research/analysis phase). Mobile is for on-site checks ("I'm standing at the property, show me the report"). PROJECT.md already acknowledges this: "Mobile companion app planned for on-site property checks (post-MVP)." | Desktop-first for scanning. Mobile-responsive for viewing saved scans and parcel details. Mobile app for field work (future, separate scope). |

### Why These Are Anti-Features

**Real-time everything:** Officiële Bekendmakingen publishes daily (not real-time). Real-time polling would hit the API every minute and return nothing 99.9% of the time. This wastes quota and creates false urgency. Daily background check is appropriate cadence. Source: [Berichten over uw Buurt](https://www.overheid.nl/berichten-over-uw-buurt)

**Scan entire NL:** PropertyRadar limits searches to specific regions (counties, census tracts) for performance and cost reasons. Unlimited scans = API abuse and database bloat. Dutch users can achieve "scan NL" by saving 10-20 high-priority gemeentes and monitoring those. Source: [PropertyRadar Features](https://www.propertyradar.com/features-overview)

**Auto-generate letters:** GDPR Article 22 restricts "automated decision-making" with legal effects. While letter generation isn't a decision, using personal data (owner name/address from BRK) in an automated process without explicit consent is risky. Better to provide templates and let users customize. Source: AVG/GDPR compliance best practices.

**CRM integration:** Classic scope creep. Every client wants their specific CRM integrated. Build CSV export first, validate demand, then prioritize top 3 CRMs if usage justifies. Source: SaaS product development best practices.

---

## Feature Dependencies

```
[Area Selection Tool]
    └──requires──> [Map with Gemeente Boundaries Layer]
                       └──requires──> [CBS Gebiedsindelingen API/Data]
                       └──requires──> [Click handler for gemeente polygons]

[Parcel List with Filters]
    └──requires──> [Area Scan Results (stored in DB)]
    └──requires──> [BAG Bulk Query (has_pand boolean)]
    └──requires──> [Bestemming Filter (from DSO)]
    └──requires──> [UI: Table or card grid with sort/filter controls]

[Opportunity Scoring]
    └──requires──> [Parcel List with Filters]
    └──requires──> [Vergunningen Data (permit history)]
    └──requires──> [BAG Bouwjaar/Status (building age)]
    └──requires──> [Scoring algorithm (rule-based or ML)]
    └──enhances──> [Parcel List (default sort by score DESC)]

[Owner Contact Lookup]
    └──requires──> [Filtered Parcel List (~50 qualified)]
    └──requires──> [Kadaster BRK API subscription + credentials]
    └──requires──> [User consent/legitimate interest documentation]
    └──conflicts──> [Scan Entire Netherlands] (cost explosion: €500K+ for 10M parcels)

[Vergunningen Monitoring]
    └──requires──> [Saved Area/Search feature]
    └──requires──> [Background Job Scheduler (ARQ already exists in v1.1)]
    └──requires──> [Officiële Bekendmakingen SRU API integration]
    └──enhances──> [Parcel Detail View (show new permits since last scan)]

[Multi-Source Cross-Reference]
    └──requires──> [Existing Report Aggregator Pattern (v1.0)]
    └──requires──> [JSONB Cache with Source-Specific TTLs]
    └──requires──> [Officiële Bekendmakingen API + Open Raadsinformatie API]
    └──enhances──> [Parcel Detail Modal (expandable source cards)]

[Batch Owner Lookup]
    └──requires──> [Owner Contact Lookup (single)]
    └──requires──> [Kadaster BRK Bulk Endpoint investigation (may not exist)]
    └──fallback──> [Sequential lookup with rate limiting (5 req/sec)]
```

### Dependency Notes

- **Area Selection requires CBS Gebiedsindelingen:** Dutch municipalities, wijken, and buurten come from CBS with official polygon boundaries. Need to load this dataset once (GeoJSON or shapefile) and cache in database or serve as vector tiles. CBS provides historical boundaries from 1995+. Source: [CBS Gebiedsindelingen](https://www.cbs.nl/nl-nl/dossier/nederland-regionaal/geografische-data/cbs-gebiedsindelingen)

- **Parcel List requires BAG Bulk Query:** To show "empty land," must cross-reference parcels (BRK) against buildings (BAG panden). This requires bulk query: "For these 2000 parcels, which have buildings?" Store result as `has_pand: boolean` in DB to avoid re-querying. BAG API supports bulk queries via GeoJSON or WFS. Source: [BAG Basisregistratie](https://data.overheid.nl/en/dataset/basisregistratie-adressen-en-gebouwen-bag-)

- **Opportunity Scoring enhances Parcel List:** Scoring is not required to show parcels, but dramatically improves UX by surfacing best leads first. Can be added after basic filtering works. Rule-based scoring (bestemming match + years unused + no permits) is simpler than ML and adequate for MVP.

- **Owner Lookup conflicts with Scan All NL:** Kadaster BRK charges per lookup (likely €0.50-1.00 per parcel, exact pricing unclear). Scanning 10M parcels → retrieving owner data for 200K filtered results = €100K-200K in API costs. **MUST filter to <100 parcels before owner lookup.** This is a hard constraint. Source: [Kadaster Eigendomsinformatie](https://www.kadaster.nl/zakelijk/producten/eigendom/eigendomsinformatie)

- **Vergunningen Monitoring requires Saved Areas:** Cannot monitor "everything" — need user to define area (gemeente polygon) + filters (bestemming type, parcel size), then check daily for new permits in that area. Uses existing ARQ worker pattern (already used for AI bestemmingsplan parsing in v1.0).

- **Multi-Source Cross-Reference extends Existing Aggregator:** v1.0 report aggregator already handles parallel fetching of PDOK, BAG, DSO, RCE APIs. Adding Officiële Bekendmakingen (SRU) and Open Raadsinformatie follows same pattern: `asyncio.gather()` for parallel fetch, merge results, cache in JSONB with source-specific TTLs.

- **Batch Owner Lookup optimization:** Need to investigate if Kadaster BRK offers bulk endpoint (e.g., "give me owner data for these 50 parcel IDs in one call"). If not, fallback is sequential lookup with rate limiting. At 5 requests/second (conservative), 50 parcels = 10 seconds. Acceptable UX with progress bar.

---

## MVP Definition (v3.0)

### Launch With (v3.0)

Minimum viable product — what's needed to validate the area intelligence concept.

- [x] **Map-based gemeente selection** — Click gemeente boundary on map → load all parcels in that gemeente (leverages existing MapLibre map from v2.0, add CBS gemeentegrenzen as GeoJSON layer with click handler)
- [x] **BAG bulk has_pand cross-reference** — Pre-scan: for each parcel in gemeente, query BAG API "does this parcel have a building?" → store `has_pand: boolean` + geometry in DB (~1KB per parcel, entire gemeente ~15MB for 15K parcels)
- [x] **Bestemming filter** — Filter parcels by "Wonen" zoning + bouwvlak present (uses existing DSO integration from v1.0, extend with bulk query or per-parcel lookup with caching)
- [x] **Parcel list with basic filters** — Table view: parcel ID (kadastraal nummer), size (oppervlakte m²), bestemming (zoning name), has_pand (Yes/No), last_updated (timestamp). Sort by any column, filter by bestemming type and has_pand boolean.
- [x] **Parcel detail modal** — Click parcel in list → open modal with AI summary + expandable source cards (extends existing v2.0 report modal pattern). Show: kadaster info, bestemming details, vergunningen (if any), raadsinformatie (if relevant). NO owner info yet (defer to v3.1).
- [x] **CSV export of filtered parcels** — Button to download current filtered list as CSV: columns = parcel ID, address, size, bestemming, has_pand, last_scanned. NO owner info (privacy constraint until BRK integration).
- [x] **Progressive loading for parcel list** — Infinite scroll (mobile-friendly) or paginated table (desktop, 50 rows per page). Render 50 parcels initially, load more on scroll/page click. Prevents browser freeze on 2000-row table.
- [x] **Vergunningen data in parcel detail** — Show permit activity via Officiële Bekendmakingen SRU API: recent permits filed within 500m radius of parcel. Display in expandable "Vergunningen" card with date, type, status. Cache in JSONB per parcel.

**Why these first:**
- Proves the area scan workflow: select region → see parcel list → filter → view details → export.
- Leverages existing v2.0 map UI and v1.0 API patterns (aggregator, JSONB caching, ARQ background jobs).
- No new paid APIs yet (BAG, DSO, Officiële Bekendmakingen are free).
- Defers expensive BRK owner lookup until workflow validated.

### Add After Validation (v3.1)

Features to add once core area scan workflow is validated with users.

- [ ] **Owner contact lookup (Kadaster BRK)** — Trigger: User filters to <100 parcels, clicks "Get Owner Info" button → backend fetches BRK data for all filtered parcels → adds owner NAW (name, address) to parcel list and detail view. **Privacy:** User must document legitimate interest (acquisition purpose). **Cost:** Estimate €0.50-1.00 per lookup, so 100 parcels = €50-100 per scan. Acceptable for qualified leads.

- [ ] **Opportunity scoring** — Trigger: User feedback that manual prioritization is painful ("which parcels should I contact first?"). Add automated scoring: `score = bestemming_match * 0.4 + years_unused * 0.3 + permit_inactivity * 0.2 + parcel_size * 0.1`. Display score in parcel list (sortable), add badge ("High Potential" for score >0.7). Algorithm can be refined based on user feedback.

- [ ] **Saved area scans** — Trigger: User scans same gemeente 3+ times (observed via logs). Add "Save Search" feature: name the scan, save gemeente polygon + filter criteria (bestemming type, has_pand, min/max size). Sidebar "Saved Scans" tab lists saved searches. Click to re-run scan with freshness check ("3 new parcels since last scan").

- [ ] **Polygon draw tool** — Trigger: User wants custom area (not full gemeente, e.g., "just the industrial zone near the harbor"). Add Mapbox Draw or Turf.js for custom polygon drawing on map. Calculate bbox, query parcels within polygon. More complex than gemeente click (requires geometry intersection), but high value for power users.

- [ ] **Raadsinformatie integration** — Trigger: User asks "Why is this gemeente interesting? Any rezoning plans?" Add Open Raadsinformatie API: fetch recent gemeenteraad decisions mentioning "wonen," "bestemmingsplan," or location keywords. Display in "Municipal Decisions" expandable card in parcel detail modal. LLM summarizes relevance to parcel.

- [ ] **Vergunningen monitoring/alerts** — Trigger: User wants to track new permits in saved area (not just one-time scan). Add daily background job (ARQ worker): for each saved scan, query Officiële Bekendmakingen API for new permits since last check. If found, flag in UI ("3 new permits in Amsterdam Noord") and optionally send email digest. Requires notification infrastructure (email service, in-app alert component).

**Why defer to v3.1:**
- Owner lookup is expensive (paid API) — validate that users actually convert filtered parcels to leads before spending on BRK integration.
- Opportunity scoring requires user feedback to tune algorithm (what signals matter most?).
- Saved scans and monitoring add state management complexity (not needed for single-use scans).
- Polygon draw is power user feature (most users will use gemeente boundaries).

### Future Consideration (v3.2+)

Features to defer until product-market fit is established.

- [ ] **Wijk/buurt selection** — Why defer: Adds UI complexity (3 admin levels instead of 1: gemeente → wijk → buurt). Gemeente is granular enough for MVP (average 15K parcels). If users request "scan just this neighborhood," add in v3.2.

- [ ] **Address radius selection** — Why defer: "Show all parcels within 1km of this address" is complex (geometry buffer, parcel intersection). Use case unclear (why not just draw polygon?). Wait for user demand.

- [ ] **Historical permit timeline** — Why defer: Requires storing historical vergunningen data (not just current state). Timeline UI component adds complexity. Nice-to-have for "spot patterns over time," but not must-have for initial lead discovery.

- [ ] **Batch owner lookup optimization** — Why defer: Sequential BRK lookup (5 req/sec) is acceptable for <100 parcels (20 seconds with progress bar). Only optimize if users frequently scan >100 parcels AND wait time becomes bottleneck. Investigate Kadaster BRK bulk endpoint first.

- [ ] **Multi-gemeente saved searches** — Why defer: "Monitor these 5 gemeentes" adds state management complexity (which gemeentes? aggregate results or separate?). Single gemeente is MVP. Multi-gemeente is logical next step after saved scans validated.

- [ ] **Email/push notifications for monitoring** — Why defer: Requires notification infrastructure (SendGrid/Mailgun for email, Firebase for push). In-app alerts ("3 new parcels since last scan") are sufficient for v3.1. Email digests are v3.2+ (once monitoring workflow validated).

- [ ] **API for CRM integration** — Why defer: No user demand yet. Build when 3+ users request same CRM integration (Salesforce, HubSpot, Pipedrive). Provide REST API with OAuth2 for custom integrations (future).

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Map-based gemeente selection | HIGH | MEDIUM (CBS GeoJSON + click handler) | P1 |
| BAG bulk has_pand cross-reference | HIGH | HIGH (bulk API + DB storage + caching) | P1 |
| Bestemming filter | HIGH | MEDIUM (extend DSO integration) | P1 |
| Parcel list with filters | HIGH | MEDIUM (table UI + sort/filter controls) | P1 |
| Parcel detail modal | HIGH | MEDIUM (extend v2.0 modal, add source cards) | P1 |
| CSV export (no owner info) | HIGH | LOW (CSV library + download button) | P1 |
| Progressive loading | MEDIUM | LOW (infinite scroll or pagination library) | P1 |
| Vergunningen data in detail | MEDIUM | MEDIUM (SRU API + JSONB cache) | P1 |
| Owner contact lookup (BRK) | HIGH | HIGH (paid API + privacy compliance) | P2 |
| Opportunity scoring | HIGH | HIGH (algorithm design + user feedback loop) | P2 |
| Saved area scans | MEDIUM | MEDIUM (DB schema + sidebar UI) | P2 |
| Polygon draw tool | MEDIUM | MEDIUM (Mapbox Draw + geometry queries) | P2 |
| Raadsinformatie integration | LOW | MEDIUM (Open Raadsinformatie API + LLM) | P2 |
| Vergunningen monitoring | MEDIUM | HIGH (ARQ jobs + notification UI) | P2 |
| Wijk/buurt selection | LOW | MEDIUM (3-level hierarchy UI) | P3 |
| Address radius selection | LOW | MEDIUM (geometry buffer + intersection) | P3 |
| Historical permit timeline | LOW | HIGH (historical data storage + timeline UI) | P3 |
| Batch owner lookup optimization | LOW | HIGH (investigate BRK bulk endpoint) | P3 |
| Multi-gemeente searches | LOW | MEDIUM (aggregate state management) | P3 |
| Email/push notifications | LOW | HIGH (email/push infrastructure) | P3 |
| API for CRM integration | LOW | HIGH (REST API + OAuth2 + docs) | P3 |

**Priority key:**
- P1: Must have for v3.0 launch (area scan workflow proven)
- P2: Should have for v3.1 (add after workflow validated)
- P3: Nice to have for v3.2+ (future consideration)

---

## Competitor Feature Analysis

| Feature | PropertyRadar (US) | LightBox (US) | Propdex v3.0 (NL) |
|---------|-------------------|---------------|-------------------|
| **Area selection** | Census tract via FIPS codes | Map-based feature service queries | CBS gemeente boundaries (click to select), future: polygon draw |
| **Filter criteria** | 250+ criteria (property type, owner, equity, liens, foreclosure, etc.) | Zoning, parcel, assessment, building data layers | Focus on development opportunities: bestemming type, has_pand boolean, permit activity, parcel size. Fewer filters but more relevant for projectontwikkelaars. |
| **Property list** | Real-time list builder, updates as you add criteria | Feature service with parcel/zoning/assessment data | Parcel list with sort/filter, infinite scroll, CSV export. Comparable UX. |
| **Owner data** | 157M+ properties with verified owner contacts (phone/email/mortgage) | Ownership data in parcel feature service | Kadaster BRK (authoritative Dutch source), only for qualified leads (<100 parcels). More restricted due to privacy laws (AVG/GDPR). |
| **Opportunity discovery** | Opportunity Zones Quick Lists (pre-defined filters for IRS-designated zones) | Appraisal intelligence (Q1 2026): automated rent comps, operating expense extraction | AI opportunity scoring (bestemming match, permit inactivity, raadsinformatie context). Dutch-specific signals. |
| **Permit monitoring** | Not clear from search results | Not clear from search results | Officiële Bekendmakingen SRU API (official Dutch government source), cross-referenced with parcel location + bestemming. Daily background checks. |
| **Export** | Lead export to CSV, CRM integrations | API access to feature service data | CSV export (v3.0), API for CRM integration (future). |
| **Pricing model** | Subscription tiers (not disclosed in search results) | Subscription tiers (not disclosed) | Smart pre-filtering (97.5% cost reduction) allows lower pricing. BRK lookup only for qualified leads. |

**Key Differentiator:** PropertyRadar and LightBox focus on US market (Census data, IRS Opportunity Zones, mortgage/foreclosure data). Propdex focuses on Dutch government data sources (BAG, BRK, DSO, Officiële Bekendmakingen, Open Raadsinformatie) with Dutch-language UI and workflows. **Multi-source cross-referencing** (BAG + vergunningen + raadsinformatie) in one view is unique value. **Smart pre-filtering pipeline** (free APIs first, paid APIs last) is a cost advantage not advertised by competitors.

Sources:
- [PropertyRadar Features Overview](https://www.propertyradar.com/features-overview)
- [PropertyRadar Opportunity Zones](https://help.propertyradar.com/en/articles/4445648-opportunity-zones)
- [LightBox Data Platform](https://www.lightboxre.com/data/)
- [LightBox Appraisal Intelligence](https://www.prnewswire.com/news-releases/lightbox-enhances-appraisal-intelligence-to-give-lenders-unmatched-financial-visibility-amid-rising-credit-and-regulatory-demands-302638256.html)

---

## Dutch Market Specifics

### Government Data Sources (Quality Issues)

| Source | Purpose | Access | Known Quality Issues |
|--------|---------|--------|---------------------|
| **CBS Gebiedsindelingen** | Gemeente/wijk/buurt boundaries (polygons) | Free, open data (GeoJSON, shapefile) | **Stable and authoritative.** Gemeentes change boundaries occasionally (e.g., municipality mergers). Requires annual update. Historical data available from 1995+. |
| **BAG (Basisregistratie Adressen en Gebouwen)** | Buildings and addresses | Free, open data (WFS, REST API) | **Issue 1:** Missing addresses in apartment buildings (BAG-BRK coupling mismatch). **Issue 2:** Construction date (`bouwjaar`) sometimes missing or incorrect. **Issue 3:** Status codes (`status`) inconsistent across municipalities (some use "Pand in gebruik," others use "Verbouwing pand"). Maintained by municipalities, quality varies. Source: [Kwaliteit BAG-BRK koppeling](https://labs.kadaster.nl/dataanalyse/koppelingbagbrk/kwaliteit_bag_brk_koppeling/) |
| **BRK (Basisregistratie Kadaster)** | Cadastral parcels, ownership | **Paid API** (per lookup, subscription model) | **Issue 1:** BAG-BRK coupling mismatches — when parcel split, all addresses copied to all new parcels (8 addresses → 8 parcels each with 8 addresses). **Issue 2:** KBI-addresses (known in BRK but not in BAG) create orphaned records. **Issue 3:** Apartment rights (`appartementsrecht`) not correctly linked to residential objects. Kadaster working on quality improvements (2025 initiative, ongoing). **Consequences:** Incorrect coupling prevents sale, permit issuance, subsidy eligibility. Source: [Kwaliteit BAG-BRK](https://labs.kadaster.nl/dataanalyse/koppelingbagbrk/kwaliteit_bag_brk_koppeling/) |
| **DSO (Digitaal Stelsel Omgevingswet)** | Zoning plans (bestemmingsplannen) | Free, open data (WFS, REST API) | **Issue 1:** Not all municipalities have digital plans (fallback to PDF parsing required). **Issue 2:** Omgevingswet transition period until 2032 — mixed systems (old bestemmingsplannen vs new omgevingsplannen). **Issue 3:** Geometry precision issues (parcel boundary vs bouwvlak mismatch, sometimes 10m+ offset). **Issue 4:** Plangebied (zoning area) vs individual parcel — need to intersect parcel with plangebied to get bestemming. Source: [Omgevingswet](https://www.government.nl/topics/environment-and-planning-act) |
| **Officiële Bekendmakingen (SRU API)** | Permit announcements (vergunningen), municipal decisions | Free, open data (SRU XML API) | **Issue 1:** Updates daily (not real-time), so "new permit" may be 24 hours old. **Issue 2:** Requires spatial search (lat/lon + radius) or text search (unreliable for automated filtering — misspellings, inconsistent terminology). **Issue 3:** No structured data — PDF attachments, requires parsing for details. **Issue 4:** Not all municipalities use same categories (some publish as "omgevingsvergunning," others as "bouwvergunning"). Source: [Berichten over uw Buurt](https://www.overheid.nl/berichten-over-uw-buurt) |
| **Open Raadsinformatie** | Municipal council decisions, meeting minutes | Free, open data (REST API) | **Issue 1:** Unstructured text (meeting minutes, decisions) — requires NLP/LLM to extract relevant info. **Issue 2:** No direct link to parcels (must infer via location mentions: "Stationsgebied," "Havenstraat 12"). **Issue 3:** Not all municipalities participate (coverage is patchy). **Issue 4:** Historical data varies (some municipalities only have recent years). Source: Implied from Open Data NL practices |

### Data Quality Mitigation Strategies

1. **BAG has_pand boolean:** Cross-reference parcels with BAG panden to get "has building" status. Store as boolean in DB to avoid re-querying. If BAG returns empty, assume no building (false negatives possible due to missing data, but acceptable for MVP).

2. **Bestemming geometry mismatch:** When querying DSO for parcel's bestemming, use parcel centroid (not boundary) to avoid edge cases where parcel spans multiple zoning areas. If multiple bestemmingen returned, prioritize "Wonen" for opportunity scoring.

3. **BRK-BAG coupling errors:** Accept that some parcels will have incorrect/duplicate addresses. Display parcel ID (kadastraal nummer) as primary identifier, address as secondary. If address missing, show "Adres onbekend" (address unknown).

4. **Vergunningen spatial search:** Use 500m radius from parcel centroid to capture nearby permits (not just exact parcel match). This catches permits for adjacent parcels or street addresses that may affect development potential.

5. **Raadsinformatie relevance:** Use LLM to score relevance of municipal decisions to parcel (0-1 score based on location mentions, bestemming keywords, rezoning context). Only show decisions with score >0.5 to reduce noise.

### Legal/Privacy Constraints

- **BRK owner data (NAW gegevens):** Requires "gerechtvaardigd belang" (legitimate interest) per AVG Article 6(1)(f). Projectontwikkelaars qualify (property acquisition is legitimate business purpose), but must document purpose per request. Kadaster may audit usage. **Implementation:** Add checkbox "I confirm legitimate interest for property acquisition" before BRK lookup. Log purpose and timestamp per lookup for audit trail.

- **GDPR/AVG compliance for owner data:**
  - **Purpose limitation:** Only fetch owner data for qualified leads (post-filter), not all parcels.
  - **Data minimization:** Only request NAW (name, address, contact) — do not fetch financial data (mortgage, liens) unless explicitly needed.
  - **Retention limits:** Delete owner data after 90 days if no action taken (no contact, no offer). Allow user to extend retention if actively pursuing acquisition.
  - **User consent:** If sharing owner data with third parties (e.g., export to CRM, forward to partner), require explicit consent (checkbox: "I consent to exporting owner data").

- **Berichten over uw Buurt transparency:** All 342 Dutch municipalities now connected (as of 2026), 8M+ residents enrolled. Users expect permit transparency. If Propdex shows permits, must also show full context (not cherry-pick favorable permits). Source: [Berichten over uw Buurt](https://www.overheid.nl/berichten-over-uw-buurt)

- **Kadaster data re-use restrictions:** BRK data cannot be resold or sublicensed. Propdex can display to users, export for their use, but cannot provide as API to third parties without separate Kadaster agreement.

### Dutch Workflow Context

Based on search results for "grondpositie verwerving" (land acquisition) and "projectontwikkeling":

1. **Lead discovery** — Scan gemeente for parcels with building potential (Propdex v3.0)
2. **Lead qualification** — Filter by bestemming, permit history, parcel size, owner type (e.g., gemeente-owned vs private) (Propdex v3.0)
3. **Owner research** — Get NAW gegevens from BRK, check if owner is active investor vs inherited property (Propdex v3.0 via BRK)
4. **Initial outreach** — Letter/call to owner expressing interest (user's CRM/manual process — outside Propdex scope, CSV export enables this)
5. **Due diligence** — If owner interested, full property report with kadaster, monument status, subsidy eligibility (existing v1.0/v2.0 Propdex features)
6. **Acquisition** — Negotiate purchase, legal due diligence, closing (outside scope)

**Propdex positioning:** Steps 1-3 (discovery → qualification → owner contact). Step 4 is export to user's CRM. Step 5 is existing property intelligence report (v1.0/v2.0). Steps 1-3 are the NEW value for v3.0.

Source: [Wat doet een projectontwikkelaar?](https://www.continu.nl/seo/wat-doet-een/wat-doet-een-projectontwikkelaar), [Grondverwerving](https://www.gloudemans.nl/expertises/grondverwerving/)

---

## UX Patterns for Area Intelligence

### 1. Area Selection Patterns

| Pattern | When to Use | Complexity | Propdex Application |
|---------|-------------|------------|---------------------|
| **Click administrative boundary** | Users want to scan entire municipality or district | LOW | v3.0: Click gemeente boundary on map → scan starts. Future: wijk/buurt hierarchical selection. |
| **Draw polygon** | Users want custom area (e.g., "just the harbor district") | MEDIUM | v3.1: Mapbox Draw plugin. Useful for power users who know exact area. |
| **Address radius** | Users want "all parcels within 2km of this address" | MEDIUM | v3.2+: Buffer geometry around point. Use case: "scan around our existing project." |
| **Import KML/GeoJSON** | Users have pre-defined scan areas from GIS tools | LOW | v3.2+: File upload → parse → scan. For advanced users with existing workflows. |

**Best practice:** Start with administrative boundaries (simplest, most common use case). Add polygon draw after validating workflow. Source: [Map UI Design](https://www.eleken.co/blog-posts/map-ui-design)

### 2. Parcel List Display Patterns

| Pattern | When to Use | Complexity | Propdex Application |
|---------|-------------|------------|---------------------|
| **Data table** | Desktop, many columns, sortable, filterable | MEDIUM | v3.0: TanStack Table with sort/filter controls. 50 rows per page, pagination at bottom. |
| **Card grid** | Mobile/tablet, visual emphasis, fewer columns | MEDIUM | v3.0 mobile: Card per parcel showing address, size, bestemming, score. Tap to open detail. |
| **Map pins** | Spatial context important, <500 results | HIGH | v3.1: Plot filtered parcels as pins on map. Cluster at low zoom, individual pins at high zoom. |
| **Hybrid (list + map)** | Best of both worlds, split screen | HIGH | v3.2+: Split screen with list on left, map on right. Click parcel in list → highlight on map. |

**Best practice:** Start with table (desktop) + card grid (mobile). Add map pins in v3.1 after table workflow validated. Source: [Data Grid UX](https://mui.com/x/react-data-grid/)

### 3. Progressive Disclosure for Parcel Details

| Level | What to Show | Pattern | Propdex Application |
|-------|--------------|---------|---------------------|
| **L1: List row** | Address, size, bestemming, score | Inline in table | v3.0: "Stationsstraat 12, 450 m², Wonen, Score: 8.2" |
| **L2: Hover/expand** | +Owner name, permit count, last activity | Expandable row or tooltip | v3.0: Hover shows tooltip with owner name (if fetched), "3 permits in last 5 years" |
| **L3: Detail modal** | Full report with all sources | Modal or slide-out panel | v3.0: Click parcel → modal with AI summary + expandable source cards (Kadaster, Bestemming, Vergunningen, Raadsinformatie) |

**Best practice:** Minimize cognitive load. Show high-level info in list, details on demand. Source: [Accordion UI Design](https://mobbin.com/glossary/accordion)

### 4. Expandable Source Cards (Detail Modal)

Based on accordion UX best practices:

```
┌─────────────────────────────────────────────────────┐
│ Parcel Detail: Stationsstraat 12, Amsterdam    [X]  │
├─────────────────────────────────────────────────────┤
│                                                      │
│ 🤖 AI Summary                                       │
│ This 450 m² parcel has "Wonen" zoning with         │
│ building rights for up to 4 stories. No building   │
│ currently present. No permits filed in last 10     │
│ years. High development potential.                  │
│                                                      │
├─────────────────────────────────────────────────────┤
│                                                      │
│ ▼ Kadaster (Cadastral Data)            [Cached: 2d]│
│   - Kadastraal nummer: AMS01-K-12345                │
│   - Oppervlakte: 450 m²                             │
│   - Eigenaar: [Fetch Owner Info] ←button            │
│   - Laatste transactie: 2022-03-15                  │
│                                                      │
│ ▼ Bestemming (Zoning)                  [Cached: 3m]│
│   - Type: Wonen (Residential)                       │
│   - Max hoogte: 15m (4 stories)                     │
│   - Bouwvlak: 70% coverage allowed                  │
│   - Confidence: AI-parsed, 85%                      │
│                                                      │
│ ▶ Vergunningen (Permits)               [Cached: 1d]│
│   [Collapsed — click caret to expand]               │
│                                                      │
│ ▶ Raadsinformatie (Council Decisions) [Cached: 1w] │
│   [Collapsed — click caret to expand]               │
│                                                      │
└─────────────────────────────────────────────────────┘
```

**Icon convention:**
- `▼` = Expanded (default for first 2 cards: Kadaster, Bestemming)
- `▶` = Collapsed (default for later cards: Vergunningen, Raadsinformatie)

**Interaction:**
- Click caret icon → toggle expand/collapse
- Click anywhere in header → toggle (larger click target)
- `aria-expanded="true|false"` for accessibility
- Smooth height animation (300ms ease)

**Source:** [Designing The Perfect Accordion](https://www.smashingmagazine.com/2017/06/designing-perfect-accordion-checklist/)

### 5. Progressive Loading Patterns

For 2000+ parcel list:

| Pattern | Desktop | Mobile | Complexity | Propdex Application |
|---------|---------|--------|------------|---------------------|
| **Pagination** | Preferred (explicit page control) | Acceptable | LOW | v3.0 desktop: TanStack Table with pagination, 50 rows per page, "Page 1 of 40" indicator |
| **Infinite scroll** | Acceptable (less common) | Preferred (gesture-driven) | MEDIUM | v3.0 mobile: Load 50 parcels initially, fetch next 50 when scroll reaches bottom. Loading spinner at end. |
| **Virtual scroll** | Best performance for 10K+ rows | Not needed (smaller screens) | HIGH | v3.1+ optimization: Only render visible rows + buffer. TanStack Table supports this. |
| **"Load More" button** | Hybrid (user control + progressive) | Good compromise | LOW | v3.0 fallback: If infinite scroll breaks, show "Load 50 More" button at end. |

**Best practice:** Pagination for desktop (explicit control), infinite scroll for mobile (gesture-driven). Virtual scroll only if performance becomes issue. Source: [Pagination vs Infinite Scroll](https://ashishmisal.medium.com/pagination-vs-infinite-scroll-vs-load-more-data-loading-ux-patterns-in-react-53534e23244d)

---

## Sources

### PropTech Platforms (US Market)
- [PropertyRadar Features Overview](https://www.propertyradar.com/features-overview) — 250+ filter criteria, real-time list builder
- [PropertyRadar Opportunity Zones](https://help.propertyradar.com/en/articles/4445648-opportunity-zones) — Census tract selection for opportunity discovery
- [LightBox Data Platform](https://www.lightboxre.com/data/) — Zoning, parcel, assessment data
- [LightBox Appraisal Intelligence](https://www.prnewswire.com/news-releases/lightbox-enhances-appraisal-intelligence-to-give-lenders-unmatched-financial-visibility-amid-rising-credit-and-regulatory-demands-302638256.html) — Q1 2026 enhancements

### Dutch Government Data
- [CBS Gebiedsindelingen](https://www.cbs.nl/nl-nl/dossier/nederland-regionaal/geografische-data/cbs-gebiedsindelingen) — Gemeente/wijk/buurt boundaries
- [Kwaliteit BAG-BRK koppeling](https://labs.kadaster.nl/dataanalyse/koppelingbagbrk/kwaliteit_bag_brk_koppeling/) — Known quality issues in BAG-BRK data coupling
- [Berichten over uw Buurt](https://www.overheid.nl/berichten-over-uw-buurt) — Dutch government permit announcement service (342 municipalities, 8M+ residents)
- [Kadaster Eigendomsinformatie](https://www.kadaster.nl/producten/woning/eigendomsinformatie) — BRK owner data access
- [Kadaster Openbaarheid en Privacy](https://www.kadaster.nl/over-ons/beleid/openbaarheid-en-privacy) — BRK privacy constraints and legitimate interest requirement
- [Omgevingswet](https://www.government.nl/topics/environment-and-planning-act) — Transition period until 2032, mixed systems

### Dutch Real Estate Development Workflow
- [Wat doet een projectontwikkelaar?](https://www.continu.nl/seo/wat-doet-een/wat-doet-een-projectontwikkelaar) — Project developer workflow (acquisition → development → sale)
- [Grondverwerving](https://www.gloudemans.nl/expertises/grondverwerving/) — Land acquisition expertise
- [Wat is een woonbestemming?](https://fortus.nl/kennisbank/woonbestemming/) — Residential zoning explanation

### UX Patterns
- [Map UI Design: Best Practices](https://www.eleken.co/blog-posts/map-ui-design) — Map-first design patterns, layer toggles, clustering
- [Draw a Search: Implementing Polygon-based Searches on Maps](https://www.codemotion.com/magazine/backend/polygon-based-searches-on-maps/) — Polygon drawing UX
- [Pagination vs Infinite Scroll vs Load More](https://ashishmisal.medium.com/pagination-vs-infinite-scroll-vs-load-more-data-loading-ux-patterns-in-react-53534e23244d) — Progressive loading patterns
- [Accordion UI Design](https://mobbin.com/glossary/accordion) — Expandable card best practices (caret icon, aria-expanded)
- [Designing The Perfect Accordion](https://www.smashingmagazine.com/2017/06/designing-perfect-accordion-checklist/) — Accessibility and interaction design for accordions

---

**Next Steps:** Use this feature landscape to inform v3.0 roadmap phase breakdown. Priority order: (1) Area selection + parcel list, (2) Parcel detail modal + vergunningen, (3) CSV export + progressive loading, (4) Owner lookup (v3.1). Defer polygon draw, opportunity scoring, saved scans, monitoring to v3.1+.

---
*Feature research for: Propdex v3.0 Area Intelligence*
*Researched: 2026-02-10*
*Confidence: MEDIUM (WebSearch + official Dutch government sources | NOT VERIFIED: Context7 unavailable, proprietary PropTech platform documentation not accessible)*
