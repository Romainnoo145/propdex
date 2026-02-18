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

## Current Milestone: v5.0 Lead Pipeline

**Goal:** Transform scan results from throwaway data into persistent, actionable lead intelligence — scan persistence, map visualization of results, and a Dutch-language deal pipeline for tracking parcels from discovery to acquisition.

**Target features:**
- Scan results persistence — revisit any previous scan from Projecten view
- Map scan layers — scanned wijken highlighted + parcel results on map with score/status coloring
- Lead pipeline — select parcels → track through Nieuw → Onderzoek → Contact → Onderhandeling → Afgewezen/Gekocht
- Report integration — generate full property reports for lead parcels
- Bug fixes — register 500 error and known issues cleanup

## Current State

**Shipped:** v4.0 UX Redesign (2026-02-18)
**Codebase:** ~23,621 lines Python + ~16,234 lines TypeScript/React (~39,855 LOC total)
**Backend:** FastAPI, SQLAlchemy 2.x (async), PostgreSQL/PostGIS, Alembic, PyJWT, pwdlib/Argon2id, httpx, shapely, pyproj, GeoAlchemy2, anthropic (Claude), arq (Redis), WeasyPrint
**Frontend:** React 19, Vite 7 (autoCodeSplitting + manualChunks), TypeScript strict, MapLibre GL JS 4.x, TanStack Query v5, TanStack Router, TanStack Table, Tailwind v4, Industrial Amber design system, Storybook
**Tests:** 275 backend (104 unit + 171 integration), 74% coverage, 80%+ core modules

**What's working:**
- Industrial Amber design system with oklch tokens, Inter/JetBrains Mono fonts, 5 UI primitives, 11 Storybook stories
- Persistent MapLibre map (never unmounts), SideRailNav icon sidebar, InspectorPanel slide-over
- Silver desaturated map with PDOK aerial/topographic tiles, kadaster parcel boundaries, bestemmingsplan zones
- CBS gemeente boundaries with click-to-zoom, wijk boundaries with click-to-scan
- Separate /resultaten route with URL-persisted filters, multi-column sort, checkbox selection, bulk CSV export
- Category-grouped advanced filter panel (Oppervlak/Bestemming/Score), table-to-map hover sync
- ScanProgressOverlay with 3-step stepper, CTA button, automatic navigation to results
- Skeleton/EmptyState/ErrorState feedback primitives adopted across all data views
- Mobile responsive: BottomTabNav, InspectorPanel bottom sheet, ParcelCard layout, 44px touch targets, read-only mode
- Settings page: account profile, password, notifications, appearance preferences
- Bundle-split build: 4 vendor chunks + 15 route chunks (was 1,813KB monolith)
- Mobile glassmorphism disabled (solid backgrounds), motion-reduce:transition-none on InspectorPanel
- All previous v1.0-v3.1 functionality preserved (scan pipeline, change monitoring, reports, PDF export, auth)

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

### Active

- [ ] Scan results persist and are browsable from Projecten view
- [ ] Map shows scanned wijken and individual parcel results with score/status coloring
- [ ] Lead pipeline with Dutch stages: Nieuw → Onderzoek → Contact → Onderhandeling → Afgewezen/Gekocht
- [ ] Full property reports can be generated for lead parcels
- [ ] Backend register endpoint fixed
- [ ] Known bugs and tech debt resolved

### Future

- [ ] Eigendom lookup: Kadaster BRK Bevragen for ownership data (paid, only for qualified leads)
- [ ] WOZ waarde integration (free government data)
- [ ] Energielabel integration (free via RVO/Kadaster)
- [ ] Comparison view — side-by-side 2-3 properties
- [ ] Role-based access (admin, analyst, viewer)
- [ ] Lead status visualization on map (color-coded pins by pipeline stage)

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

## Context

- **Developer:** Klarifai (info@klarifai.nl)
- **Market:** Netherlands / Belgium
- **Domain:** PropTech / Real Estate Development
- **Comparable platforms:** Transect (US, land GIS), Datagrid (zoning AI), Prophetic (deal intelligence), Spartner (NL, AI for vastgoed), LightBox (zoning data)
- **Key Dutch data sources:** PDOK, BAG, Kadaster, ruimtelijkeplannen.nl, Rijksdienst voor het Cultureel Erfgoed
- **Known issues:**
  - Backend register endpoint returns 500 (needs investigation)
  - Kadaster eigendomsdata requires paid API (deferred)
  - Monument restrictions are generic boilerplate (not property-specific)
  - Mobile navigation: RESOLVED in v4.0 (BottomTabNav + all mobile adaptations complete)
  - PLU WMS change detection needs live data validation (MON-02)
  - Parcel count pre-check disabled (CRS mismatch between CBS bbox and BAG WFS)

---
*Last updated: 2026-02-18 after v5.0 Lead Pipeline milestone started*
