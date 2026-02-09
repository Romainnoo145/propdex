# Propdex

## What This Is

A property intelligence platform for Dutch projectontwikkelaars (real estate developers) who buy churches, monuments, land, and commercial buildings to redevelop into residential projects. The platform compresses weeks of due diligence research into minutes by automating property data collection, zoning analysis, and heritage status checks. Full-stack application with production-hardened backend and map-first web interface.

## Who It's For

**Primary user:** A Dutch projectontwikkelaar with a mixed portfolio — churches/monuments, land plots, and commercial-to-residential conversions. Small team of 1-5 users.

**How they work today:** When they find a potential property (a church for sale, a plot of land, an old office building), they spend 3-6 weeks manually checking bestemmingsplannen, kadaster records, monument status, and subsidy eligibility. This costs 10-30k+ per opportunity in advisor fees, and by the time due diligence is done, faster competitors have already bought it.

**What they need:** Enter an address, get an instant structured report with everything needed for a go/no-go decision.

## Core Value

**Address -> Property Intelligence Report**

Enter any Dutch address and receive within minutes:
- Kadaster data: ownership, transactions, plot boundaries, surface area
- Zoning summary: permitted functions (wonen, zorg, horeca), max height, density, parking requirements — extracted from bestemmingsplannen
- Monument/heritage status: rijksmonument, gemeentelijk monument, or none — with applicable restrictions
- Key restrictions and opportunities identified

This is the ONE thing that must work. Everything else is secondary.

## Current State

**Shipped:** v2.0 Frontend (2026-02-09)
**Codebase:** 15,947 lines Python (7,060 in tests) + 8,804 lines TypeScript/React
**Backend:** FastAPI, SQLAlchemy 2.x (async), PostgreSQL, Alembic, PyJWT, pwdlib/Argon2id, httpx, shapely, pyproj, anthropic (Claude), arq (Redis), WeasyPrint
**Frontend:** React 19, Vite 7, TypeScript strict, MapLibre GL JS 4.x, TanStack Query v5, TanStack Router, Tailwind v4, pnpm
**Tests:** 275 backend (104 unit + 171 integration), 74% coverage, 80%+ core modules

**What's working:**
- Full-page MapLibre map with PDOK aerial/topographic tiles and kadaster parcel boundaries
- Floating address search with PDOK Locatieserver autocomplete and fly-to-location
- Three-tier progressive disclosure (QuickCard → Drawer → Modal) for property intelligence
- Report management sidebar with search, save, PDF export, freshness indicators
- Project folders with CRUD, report assignment, and sidebar filtering
- Responsive drawer (desktop right panel, mobile bottom sheet) with force refresh
- JWT auth with httpOnly cookies, silent refresh, protected routes
- Full backend API with 23+ authenticated endpoints
- Property lookup with parallel government API fetching (PDOK, BAG, DSO, RCE)
- AI bestemmingsplan parsing via Claude with background processing
- Multi-tenant isolation enforced at every layer (HTTP, service, cache, database)
- Row-level security with fail-closed NULLIF policies on all 7 tenant tables

## Business Model

- Built for one specific client first (single-tenant MVP)
- Designed for multi-tenant SaaS expansion into the Dutch developer market
- Revenue model TBD — likely subscription-based per organization

## Platform

- Web dashboard (desktop-first) for primary workflow
- Mobile companion app planned for on-site property checks (post-MVP)

## Data Strategy

**Hybrid approach:**
- **API integrations** where available: Kadaster (PDOK), BAG (Basisregistratie Adressen en Gebouwen), ruimtelijkeplannen.nl, Rijksmonumentenregister
- **AI document parsing** as fallback: upload bestemmingsplan PDFs and extract zoning rules using Claude API — critical for municipalities without good digital APIs
- Gradual improvement: start with the most reliable API sources, expand AI parsing coverage over time

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

### Active

(None — define in next milestone via `/gsd:new-milestone`)

### Future (post v2.0)

- [ ] WOZ waarde integration (free government data)
- [ ] Energielabel integration (free via RVO/Kadaster)
- [ ] Property pipeline tracking (opportunities)
- [ ] Comparison view — side-by-side 2-3 properties
- [ ] Role-based access (admin, analyst, viewer)
- [ ] Kadaster eigendom/koopprijs integration (betaald)

### Out of Scope

- 3D visualization / virtual tours — separate product domain
- Subsidy application automation — too complex for v1, possible future integration
- Financial feasibility calculations — requires market data integrations beyond v1
- Buyer/investor CRM and marketing automation — different product phase
- Automated vergunning (permit) filing — requires government system integration
- AI-generated photos/videos — marketing feature, not core intelligence
- Construction/project management — different product category

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
| Glassmorphism design system | Transparent glass panels over map background | ✓ Good — distinctive, consistent look |
| TanStack Router + Query | Type-safe routing with file-based routes, data fetching with cache | ✓ Good — clean separation of concerns |
| Three-tier progressive disclosure | QuickCard → Drawer → Modal prevents information overload | ✓ Good — natural exploration flow |
| httpOnly cookies for refresh tokens | Prevents XSS attacks on auth tokens | ✓ Good — secure token lifecycle |
| Direct PDOK frontend calls | No backend proxy needed, PDOK is public, faster autocomplete | ✓ Good — removes latency |
| WMS raster for parcels (not vector tiles) | PDOK vector tile endpoint broken, WMS is stable and documented | ⚠️ Revisit — limits parcel click interaction |
| SET LOCAL f-string (not params) | asyncpg doesn't support parameterized SET statements | ✓ Good — bug found in live testing |
| NULLIF fail-closed RLS | Default-deny instead of default-allow for tenant isolation | ✓ Good — verified via 11 tests |
| 404 not 403 for cross-org access | Prevents resource enumeration attacks | ✓ Good — standard security pattern |

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
  - Parcel click/highlight not possible with WMS raster tiles
  - Mobile navigation: Side-rail hidden on mobile, no replacement navigation exists yet
  - ProjectList live mode: TODO for fetching reports per expanded project card

---
*Last updated: 2026-02-09 after v2.0 milestone*
