# Propdex

## What This Is

A property intelligence platform for Dutch projectontwikkelaars (real estate developers) who buy churches, monuments, land, and commercial buildings to redevelop into residential projects. The platform compresses weeks of due diligence research into minutes by automating property data collection, zoning analysis, and heritage status checks. Full-stack application with production-hardened backend and map-first web interface.

## Who It's For

**Primary user:** A Dutch projectontwikkelaar with a mixed portfolio — churches/monuments, land plots, and commercial-to-residential conversions. Small team of 1-5 users.

**How they work today:** When they find a potential property (a church for sale, a plot of land, an old office building), they spend 3-6 weeks manually checking bestemmingsplannen, kadaster records, monument status, and subsidy eligibility. This costs 10-30k+ per opportunity in advisor fees, and by the time due diligence is done, faster competitors have already bought it.

**What they need:** Enter an address, get an instant structured report with everything needed for a go/no-go decision.

## Core Value

**Area -> Opportunity Intelligence**

Scan any Dutch municipality or neighborhood and instantly find unused building opportunities — parcels with residential zoning but no buildings, no recent permits, and reachable owners. From area scan to qualified lead list in minutes instead of weeks.

This is the ONE thing that must work. Everything else is secondary.

## Current State

**Shipped:** v14.0 Fysiek Risicoprofiel (2026-03-10)
**Codebase:** ~28,000 lines Python + ~22,000 lines TypeScript/React (~50,000 LOC total)
**Backend:** FastAPI, SQLAlchemy 2.x (async), PostgreSQL/PostGIS, Alembic, PyJWT, pwdlib/Argon2id, httpx, shapely, pyproj, GeoAlchemy2, anthropic (Claude), arq (Redis), WeasyPrint
**Frontend:** React 19, Vite 7 (autoCodeSplitting + manualChunks), TypeScript strict, MapLibre GL JS 4.x, TanStack Query v5, TanStack Router, TanStack Table, Tailwind v4, Industrial Amber design system, Storybook
**Tests:** 275 backend (104 unit + 171 integration) + 46 new tests in v6.0, 74% coverage, 80%+ core modules

**What's working:**
- Physical risk profile: per-parcel foundation risk, asbestos exposure, soil classification, and contamination signals with amber indicative badges
- Foundation risk map overlay: area scan tiles colored by bouwjaar-based foundation risk level
- Meldingen intelligence: bekendmakingen geocoded to parcels via PDOK, matched parcel IDs persisted, post-scan retro-matching
- Melding-to-map flow: click matched melding → fly to amber map marker → generate report from verified parcel data
- Server-backed per-change read tracking with "Markeer alles als gelezen" action
- Meldingen feed: gemeente filter dropdown, action state badges, infinite scroll pagination (25 records/page)
- Address intelligence: multi-strategy Dutch address extraction, category classification (e.g. "Omgevingsvergunning aangevraagd")
- Report from address: standalone report creation without requiring area scan first
- Scan history: browsable list of all previous scans with gemeente/wijk metadata, re-open on map or results table
- Map visualization: scanned wijken highlighted with amber overlay, individual parcels colored by opportunity score via MVT tiles, toggleable score layer
- Report from parcel: one-click "Genereer rapport" for any scan result parcel, uses existing property aggregator pipeline
- Data presentation: gemeente SVG cards, wijk drill-down, 3-level breadcrumb navigation, ChangeTimeline per wijk
- Industrial Amber design system with oklch tokens, Inter/JetBrains Mono fonts, 5 UI primitives, 11 Storybook stories
- Persistent MapLibre map (never unmounts), SideRailNav icon sidebar, InspectorPanel slide-over
- Silver desaturated map with PDOK aerial/topographic tiles, kadaster parcel boundaries, bestemmingsplan zones
- CBS gemeente boundaries with click-to-zoom, wijk boundaries with click-to-scan
- Separate /resultaten route with URL-persisted filters, multi-column sort, checkbox selection, bulk CSV export
- Mobile responsive: BottomTabNav, InspectorPanel bottom sheet, ParcelCard layout, 44px touch targets, read-only mode
- Settings page: account profile, password, notifications, appearance preferences
- Bundle-split build: 4 vendor chunks + 15 route chunks
- Deep property data: WOZ-waarde, energielabel, BRK eigendomsdata, RCE monument detail enrichment
- Workspace productization: role context switching, URL-state hardening, scope-aware controls, canonical map parcel flow
- Developer dossier intelligence: buildability delta, Wkb precheck (Layer A + optional Layer B), permit precedent benchmark
- CBS wijkstatistieken: WOZ gemiddelde, stedelijkheidsklasse, demographics displayed per wijk via OData v4 client
- Rechtspraak jurisprudentie: court ruling search with omgevingsrecht filter, inline document viewing, rebuilt backend infrastructure
- AI juridisch klimaat: Claude-powered per-ruling summaries (bezwaargrond, uitkomst, relevantie) + aggregated klimaat score + vergunnings-succeskans
- Map toggle state machine: centralized useMapLayerState hook, controlled LayerToggle, eliminated stale closure bugs
- All previous v1.0-v6.0 functionality preserved

## Business Model

- Built for one specific client first (single-tenant MVP)
- Designed for multi-tenant SaaS expansion into the Dutch developer market
- Revenue model TBD — likely subscription-based per organization

## Platform

- Web dashboard (desktop-first) for primary workflow
- Mobile companion app planned for on-site property checks (post-MVP)

## Data Strategy

**Multi-source intelligence with smart caching:**
- **Tier 1 — Lightweight pre-scan (stored in DB):** Perceel geometrie + has_pand boolean + bestemming naam. ~1KB per perceel, entire gemeente fits in ~15MB
- **Tier 2 — On-demand details (JSONB cache):** Vergunningen, raadsinformatie, full bestemmingsplan, eigendomsdata. Fetched when user clicks, cached with source-specific TTLs
- **Tier 3 — Paid APIs (only for qualified leads):** Kadaster BRK eigendomsdata. Only queried after free filters reduce 2000+ percelen to ~50 top opportunities
- **AI document parsing** as fallback: bestemmingsplan PDFs via Claude API for municipalities without good digital APIs
- **Government data sources:** PDOK, BAG, DSO, RCE, Officiële Bekendmakingen (SRU), Open Raadsinformatie, Kadaster BRK Bevragen

## Technical Constraints

- **Backend:** FastAPI + async PostgreSQL (SQLAlchemy 2.x)
- **Frontend:** React 19 + Vite 7 + TypeScript strict + Tailwind v4
- Must support Dutch-language content and data sources
- Must comply with AVG/GDPR for personal data handling
- Multi-tenant architecture from the start (even if single client initially)
- Organization-based data isolation (per Klarifai standards)

## What This Is NOT

- Not a 3D visualization or BIM tool (integration possible later)
- Not a construction project management tool
- Not a financial modeling platform (feasibility calculations are a future phase)
- Not a subsidy application tool (matching is future; auto-filing is out of scope)
- Not a buyer/sales CRM for selling finished units
- Not an AI-generated photos/videos tool — marketing feature, not core intelligence

## Requirements

### Validated

- User can enter a Dutch address and receive a structured property report — v1.0
- Report includes kadaster data (ownership, plot, transactions) — v1.0
- Report includes zoning summary (permitted functions, height, density, parking) — v1.0
- Report includes monument/heritage status and restrictions — v1.0
- User can save reports and revisit them — v1.0
- Property data sourced via Dutch government APIs (PDOK, BAG, ruimtelijkeplannen.nl) — v1.0
- AI parsing of bestemmingsplan PDFs as fallback for unstructured data — v1.0
- Authentication and user management for small team — v1.0
- Organization-based data isolation — v1.0
- Comprehensive automated test suite across all backend modules — v1.1
- Row-level security enforcement with app_role (not superuser bypass) — v1.1
- Configuration consolidation and per-org freshness thresholds — v1.1
- ARQ worker lifecycle integrated with application startup — v1.1
- Multi-tenant isolation verified at all layers — v1.1
- Formal verification documentation for all phases — v1.1
- Full-page interactive map with PDOK aerial imagery and topographic layers — v2.0
- Kadaster parcel boundaries as toggleable map layer — v2.0
- Address search with PDOK autocomplete integrated in map UI — v2.0
- Floating detail panel showing property intelligence report on click — v2.0
- Sidebar with tab navigation (Rapporten, Projecten, Instellingen) — v2.0
- PDF export of property intelligence report from frontend — v2.0
- Auth flow (login/register) in frontend — v2.0
- Bestemmingsplan base layer: render zoning plans as colored zones on the map per gemeente — v3.1
- Area deep-dive: wijk-based selection triggers focused BAG scan with bestemmingsplan enrichment — v3.1
- Refined scoring: opportunity score using zoning type + vacant land + permits + parcel size — v3.1
- Parcel detail modal with on-demand SRU vergunningen enrichment — v3.1
- Change monitoring: track new vergunningen per gemeente via SRU Bekendmakingen — v3.1
- Bestemmingsplan wijzigingen: detect zoning changes via PLU WMS delta (needs live validation) — v3.1
- Parcel list with filtering: sortable table with bestemming, size, score filters — v3.1
- Industrial Amber design system with Tailwind v4 @theme tokens and lucide-react icons — v4.0
- Persistent MapView with icon sidebar navigation between Kaart/Resultaten/Projecten — v4.0
- Silver desaturated map base layer with glassmorphism refinement — v4.0
- Results view as separate /resultaten route with scan_id URL bridge — v4.0
- Glassmorphism components fully migrated to Industrial Amber design system — v4.0
- Skeleton/EmptyState/ErrorState feedback primitives with scan progress stepper — v4.0
- Multi-criteria sorting, checkbox selection, bulk export, category-grouped filters — v4.0
- Mobile responsive read-only mode with BottomTabNav, bottom sheet, card layout, 44px touch targets — v4.0
- Settings page with account/password/notifications/appearance sections — v4.0
- Scan results persist and are browsable from Projecten view — v5.0
- Map shows scanned wijken and individual parcel results with score coloring — v5.0
- Full property reports can be generated for scan result parcels — v5.0
- Auth integration tests match cookie-based CookieTokenResponse flow — v5.0
- ARQ worker handles re-runs idempotently via ON CONFLICT DO NOTHING — v5.0
- Tech debt resolved: unused packages, legacy Tailwind classes, dead imports — v5.0
- Gemeente SVG cards, wijk drill-down, 3-level breadcrumb navigation — v5.1
- Bekendmakingen → parcel matching via PDOK geocoding + PostGIS spatial lookup — v6.0
- Melding → map → rapport flow (click matched parcel → fly to map → generate report) — v6.0
- Address intelligence: multi-strategy extraction + category classification — v6.0
- Server-side per-change read/unread tracking (ChangeReadState model replacing localStorage) — v6.0
- Meldingen UX: gemeente filter, action state badges, infinite scroll pagination — v6.0
- Report from address: standalone report creation without requiring area scan — v6.0
- WOZ-waarde integration (government-assessed property valuations via Waardeloket) — v7.0
- Energielabel integration (energy performance ratings from EP-Online/RVO) — v7.0
- Kadaster BRK eigendomsdata (ownership, purchase history, mortgage status) — v7.0
- RCE monument detail enrichment (property-specific heritage data replacing generic boilerplate) — v7.0
- Workspace role context switching and scope-aware controls — v7.1
- URL-state hardening and source-aware report navigation — v7.1
- Canonical map parcel flow with layer catalog and refresh-safe selection — v7.1
- Buildability delta contract (hoeveel kan hier nog?) with confidence scoring — v7.2
- Wkb precheck (Layer A auto-check + optional Layer B refinement) — v7.2
- Permit precedent benchmark by municipality and comparable type — v7.2
- CBS wijkstatistieken (WOZ, stedelijkheid, demographics) in wijk detail view via OData v4 — v11.0
- Rechtspraak jurisprudentie search with omgevingsrecht filter and inline document viewing — v11.0
- AI-powered per-ruling summaries (bezwaargrond, uitkomst, relevantie) as collapsible badges — v11.0
- Aggregated juridisch klimaat score + vergunnings-succeskans percentage — v11.0
- AI analysis via ARQ background job with polling (non-blocking) — v11.0
- Extended CBS neighborhood metrics (inkomen, huishoudenssamenstelling, leeftijdsverdeling) — v12.0
- CBS criminaliteitsdata integration (OData v3, misdrijfcijfers per gemeente) — v12.0
- CBS voorzieningennabijheid (afstand tot scholen, supermarkten, OV-knooppunten) — v12.0
- Per-parcel soil type classification (klei/veen/zand/leem) via BRO Bodemkaart WMS — v14.0
- PDOK Funderingsrisicogebieden context (% pre-1970, soil region, risk label) per postal code area — v14.0
- Foundation risk rating (HOOG/MIDDEL/LAAG) from bouwjaar x bodemtype heuristic with KCAF cost ranges — v14.0
- Combined Fysiek Risicoprofiel with worst-of aggregation across foundation, soil, asbestos, contamination — v14.0
- Gebruiksdoel-aware asbestos risk with additive-only NEN 2991 uplift — v14.0
- FysiekRisicoprofielSection in ParcelDetailModal with amber confidence badges and 4 sub-cards — v14.0
- Foundation risk overlay on area scan map tiles — v14.0

### Active

## Current Milestone: v15.0 Aura

**Goal:** Complete frontend overhaul — replace Industrial Amber with "Aura" design system (glassmorphism, bento grid, Satoshi font), rebuild every view as a viewport-locked floating interface over the map, eliminate all scrolling via click-through progressive disclosure.

**Target features:**
- Aura design system: Soft-Tech palette, glassmorphism on key surfaces, Satoshi font, bento grid pods
- Viewport-locked layout: map fills 100%, floating SideRailNav left, search pill top-left, filter chips top-center
- Parcel detail: floating right panel, satellite crop hero, score badge overlay, click-through data layers
- Wijk bottom bento sheet: 4-column fly-up layout replacing sidebar
- Backend parcel aerial crop API endpoint
- Results table: Aura visual treatment on /resultaten route
- Jurisprudentie: full wizard + explorer redesign in Aura
- Meldingen: full redesign with bento cards
- Reports page: bento layout with click-through sections
- Settings: Aura visual update
- Desktop only, light mode only (drop dark mode)

### Future

- [ ] Additional professional verticals: tekenaars, constructeurs, asbest/bodem onderzoekers, aannemers
- [ ] Payment infrastructure: credit system, per-lead billing, subscriptions
- [ ] B2B API for large borgingspartijen (Woningborg, Kiwa)
- [ ] Lead pipeline with Dutch stages: Nieuw → Onderzoek → Contact → Onderhandeling → Afgewezen/Gekocht
- [ ] Lead status visualization on map (color-coded by pipeline stage)
- [ ] Role-based access (admin, analyst, viewer)

### Out of Scope

- 3D visualization / virtual tours — separate product domain
- Subsidy application automation — too complex, possible future integration
- Financial feasibility calculations — requires market data integrations
- Buyer/investor CRM and marketing automation — different product phase
- Automated vergunning (permit) filing — requires government system integration
- AI-generated photos/videos — marketing feature, not core intelligence
- Construction/project management — different product category
- AirDNA / short-term rental analytics — not core to development opportunity identification
- Linked Data Overheid SPARQL — too complex for real-time queries, existing APIs suffice
- data.overheid.nl CKAN — aggregate statistics only, not address-level data

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Due diligence speed is core value, not CRM | Client's biggest pain is research time, not contact management | ✓ Good — core report pipeline works |
| Hybrid data sourcing (API + AI parsing) | Not all municipalities have good digital data; APIs alone won't cover everything | ✓ Good — 5 API clients + Claude fallback |
| One client first, then SaaS | De-risks the product by validating with a real user before scaling | ✓ Good — multi-tenant from day one |
| Web-first, mobile later | Primary workflow is research/analysis — desktop suits better | ✓ Good — responsive mobile support added in v2.0 |
| MVP = address-to-report | Smallest thing that saves time and proves the concept | ✓ Good — full pipeline working |
| FastAPI + async PostgreSQL | Domain needs: async I/O for parallel API calls, JSONB for flexible caching, spatial queries | ✓ Good — stack proven across 17 phases |
| PyJWT + Argon2id (not python-jose/bcrypt) | Security: PyJWT prevents algorithm confusion, Argon2id is memory-hard | ✓ Good — production-ready auth |
| PostgreSQL JSONB cache (not Redis) | Reduces infrastructure; cache survives restarts; leverages existing DB | ✓ Good — Redis only for ARQ jobs |
| Progressive loading for AI parsing | Claude API takes 10-30s; never block HTTP response | ✓ Good — ARQ worker + polling pattern |
| PropertyReportResponse as central schema | One schema flows from aggregator through save to PDF export | ✓ Good — clean data contract |
| Tech debt before frontend | Stabilize backend before stacking frontend on top | ✓ Good — 275 tests, RLS enforced |
| React 19 + Vite 7 (not SvelteKit) | Simpler, no SSR needed for dashboard app, wider ecosystem | ✓ Good — fast dev velocity |
| MapLibre (not Mapbox) | Free, same API as Mapbox, PDOK tiles for NL aerial imagery | ✓ Good — excellent Dutch coverage |
| Map-first UI (not dashboard) | The map IS the app — floating panels over full-page map | ✓ Good — intuitive spatial workflow |
| Glassmorphism design system | Transparent glass panels over map background | ✓ Replaced — Industrial Amber shipped in v4.0 |
| TanStack Router + Query | Type-safe routing with file-based routes, data fetching with cache | ✓ Good — clean separation of concerns |
| Three-tier progressive disclosure | QuickCard → Drawer → Modal prevents information overload | ✓ Good — natural exploration flow |
| httpOnly cookies for refresh tokens | Prevents XSS attacks on auth tokens | ✓ Good — secure token lifecycle |
| Direct PDOK frontend calls | No backend proxy needed, PDOK is public, faster autocomplete | ✓ Good — removes latency |
| WMS raster for parcels (not vector tiles) | PDOK vector tile endpoint broken, WMS is stable and documented | ⚠️ Revisit — limits parcel click interaction |
| SET LOCAL f-string (not params) | asyncpg doesn't support parameterized SET statements | ✓ Good — bug found in live testing |
| NULLIF fail-closed RLS | Default-deny instead of default-allow for tenant isolation | ✓ Good — verified via 11 tests |
| 404 not 403 for cross-org access | Prevents resource enumeration attacks | ✓ Good — standard security pattern |
| PostGIS for spatial joins (not Python Shapely) | Database-level geo operations for performance and consistency | ✓ Good — spatial queries proven across v3.0+v3.1 |
| PDOK WMS raster for bestemmingsplan (not vector) | PDOK PLU WFS doesn't exist; WMS is the only option | ✓ Good — works for visualization + GetFeatureInfo enrichment |
| CBS WFS for gemeente/wijk boundaries | Public, CORS-enabled, same service for both layers | ✓ Good — reliable Dutch geo data |
| Wijk-based selection (not drawing tools) | Terra-draw removed — click-based flow more natural for real estate users | ✓ Good — simpler UX, leverages existing map features |
| Three-tier data cache (DB/JSONB/BRK) | Pre-scan in DB, on-demand in JSONB, paid APIs never stored | ✓ Good — balances freshness vs API load |
| SVBP2012 standard for bestemming colors | National standard for zoning plan visualization | ✓ Good — consistent with official plans |
| Self-referential Project hierarchy | gemeente→wijk parent-child using same model, no new tables | ✓ Good — clean monitoring structure |
| ARQ daily cron for change detection | Reuses existing job infrastructure, runs at 03:00 UTC | ✓ Good — simple, proven pattern |
| Scan history reuses AreaScan table | No new models needed — COUNT(scan_results) for parcel_count | ✓ Good — zero schema changes |
| Amber overlay for scanned wijken | rgba(245,158,11,0.25) fill — distinct from emerald unscanned and blue monitored | ✓ Good — clear visual hierarchy |
| Score layer fires on [activeScanId, mapReady] | Separate from live scan completion effect — handles URL restoration path | ✓ Good — reliable state restoration |
| POST /from-parcel before /{report_id} | Static sub-paths must precede parameterized paths in FastAPI | ✓ Good — prevents route matching bugs |
| pg_insert().on_conflict_do_nothing() for ScanResult | index_elements form more robust than constraint name | ✓ Good — idempotent worker re-runs |
| ProjectEditModal keeps gray-* (light theme) | White card on dark backdrop is intentional UX — JSDoc documents decision | ✓ Good — readable modal pattern |
| Multi-strategy address extraction (5 regex) | Each strategy handles a subset of SRU title formats; fallback chain | ✓ Good — handles all common Dutch formats |
| PDOK geocoding + PostGIS ST_Contains | Geocode address → spatial lookup against ParcelCache polygons | ✓ Good — reliable parcel matching |
| Post-scan retro-matching for unmatched changes | Re-check after new ParcelCache entries arrive from area scan | ✓ Good — progressive matching improvement |
| ChangeReadState model (absence = unread) | Insert/delete rows instead of timestamps; LEFT JOIN for unread count | ✓ Good — clean, scalable pattern |
| matched_parcel_id on ChangeRecord (not computed) | Persisted FK — survives restarts, enables direct navigation | ✓ Good — single source of truth |
| useInfiniteQuery + IntersectionObserver | 25-record pages, sentinel-based scroll loading, has_more cursor | ✓ Good — scales to large feeds |
| Report from address endpoint (/from-address) | Bypass scan requirement for standalone report creation | ✓ Good — flexible workflow |
| BRO WMS for soil (not bodemdata.nl) | PDOK BRO Bodemkaart is the canonical source; bodemdata.nl has sparse API docs | ✓ Good — reliable WMS integration |
| Amber-only risk badges (never red) | Indicative assessments from public data — red implies definitive professional survey | ✓ Good — transparent communication |
| Bouwjaar-only proxy for tile coloring | Full bouwjaar x bodemtype only via per-parcel API; tiles don't have soil data | ✓ Good — performance vs precision tradeoff |
| Worst-of risk aggregation excluding onbekend | Unknown risks shouldn't drag overall assessment down | ✓ Good — avoids false alarms |
| Gebruiksdoel additive-only asbestos uplift | Industrial/educational use increases risk but never below bouwjaar baseline | ✓ Good — monotonic risk increase |
| KCAF cost ranges with disclaimers (not exact) | Too many variables for precise costs; reference ranges set expectations | ✓ Good — informative without liability |

## Context

- **Developer:** Klarifai (info@klarifai.nl)
- **Market:** Netherlands / Belgium
- **Domain:** PropTech / Real Estate Development
- **Comparable platforms:** Transect (US, land GIS), Datagrid (zoning AI), Prophetic (deal intelligence), Spartner (NL, AI for vastgoed), LightBox (zoning data)
- **Key Dutch data sources:** PDOK, BAG, Kadaster, ruimtelijkeplannen.nl, Rijksdienst voor het Cultureel Erfgoed
- **Known issues:**
  - BAG WFS fetch failure in area_scan.py is silent — causes entire scan to produce garbage data (no bouwjaar, no addresses, wrong scoring)
  - PLU WMS change detection needs live data validation (MON-02)
  - Parcel count pre-check disabled (CRS mismatch between CBS bbox and BAG WFS)
  - PDF export status unknown — needs audit after v7.x data additions

---
*Last updated: 2026-03-10 after v15.0 Aura milestone start*
