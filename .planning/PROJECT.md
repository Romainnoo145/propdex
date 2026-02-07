# Propdex

## What This Is

A property intelligence platform for Dutch projectontwikkelaars (real estate developers) who buy churches, monuments, land, and commercial buildings to redevelop into residential projects. The platform compresses weeks of due diligence research into minutes by automating property data collection, zoning analysis, and heritage status checks.

## Who It's For

**Primary user:** A Dutch projectontwikkelaar with a mixed portfolio — churches/monuments, land plots, and commercial-to-residential conversions. Small team of 1-5 users.

**How they work today:** When they find a potential property (a church for sale, a plot of land, an old office building), they spend 3-6 weeks manually checking bestemmingsplannen, kadaster records, monument status, and subsidy eligibility. This costs €10-30k+ per opportunity in advisor fees, and by the time due diligence is done, faster competitors have already bought it.

**What they need:** Enter an address, get an instant structured report with everything needed for a go/no-go decision.

## Core Value

**Address → Property Intelligence Report**

Enter any Dutch address and receive within minutes:
- Kadaster data: ownership, transactions, plot boundaries, surface area
- Zoning summary: permitted functions (wonen, zorg, horeca), max height, density, parking requirements — extracted from bestemmingsplannen
- Monument/heritage status: rijksmonument, gemeentelijk monument, or none — with applicable restrictions
- Key restrictions and opportunities identified

This is the ONE thing that must work. Everything else is secondary.

## Current State

**Shipped:** v1.0 Core Intelligence Engine (2026-02-07)
**Codebase:** 8,281 lines Python (FastAPI backend)
**Tech Stack:** FastAPI, SQLAlchemy 2.x (async), PostgreSQL, Alembic, PyJWT, pwdlib/Argon2id, httpx, shapely, pyproj, anthropic (Claude), arq (Redis), WeasyPrint

**What's working:**
- Full backend API with 23+ authenticated endpoints
- Property lookup with parallel government API fetching (PDOK, BAG, DSO, RCE)
- AI bestemmingsplan parsing via Claude with background processing
- Report management with save/list/search, project folders, PDF export
- Multi-tenant isolation enforced at every layer

**What's next:** Production hardening (tests, RLS enforcement, config cleanup)

## Current Milestone: v1.1 Production Hardening

**Goal:** Stabilize the v1.0 backend with comprehensive test coverage, enforce row-level security properly, and clean up configuration debt — making the codebase production-ready before building the frontend.

**Target features:**
- Comprehensive automated test suite (unit + integration) across all 5 backend modules
- RLS enforcement with proper app_role database connection (not superuser bypass)
- Configuration cleanup (.env deduplication, configurable freshness thresholds)
- ARQ worker lifecycle integration with main application
- Phase 1 formal verification

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

### Active

- [ ] User can track multiple properties as opportunities in a simple pipeline
- [ ] Address input with BAG autocomplete suggestions
- [ ] Interactive map visualization with property location on PDOK tile layers
- [ ] PDF export of property intelligence report (branded, professional layout)
- [ ] Comparison view — side-by-side comparison of 2-3 properties
- [ ] Role-based access (admin, analyst, viewer) for larger teams

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
| Due diligence speed is core value, not CRM | Client's biggest pain is research time, not contact management | Confirmed — core report pipeline works |
| Hybrid data sourcing (API + AI parsing) | Not all municipalities have good digital data; APIs alone won't cover everything | Confirmed — 5 API clients + Claude fallback |
| One client first, then SaaS | De-risks the product by validating with a real user before scaling | Multi-tenant from day one, ready for expansion |
| Web-first, mobile later | Primary workflow is research/analysis — desktop suits better | Backend-only v1.0, frontend next |
| MVP = address-to-report | Smallest thing that saves time and proves the concept | Confirmed — full report pipeline working |
| FastAPI + async PostgreSQL | Domain needs: async I/O for parallel API calls, JSONB for flexible caching, spatial queries | Stack proven across 5 phases |
| PyJWT + Argon2id (not python-jose/bcrypt) | Security: PyJWT prevents algorithm confusion, Argon2id is memory-hard | Production-ready auth system |
| PostgreSQL JSONB cache (not Redis) | Reduces infrastructure; cache survives restarts; leverages existing DB | Working well, Redis only for ARQ jobs |
| Progressive loading for AI parsing | Claude API takes 10-30s; never block HTTP response | ARQ worker + polling pattern working |
| PropertyReportResponse as central schema | One schema flows from aggregator through save to PDF export | Clean data contract across all phases |
| Tech debt before frontend | Stabilize backend before stacking frontend on top | — Pending |

## Context

- **Developer:** Klarifai (info@klarifai.nl)
- **Market:** Netherlands / Belgium
- **Domain:** PropTech / Real Estate Development
- **Comparable platforms:** Transect (US, land GIS), Datagrid (zoning AI), Prophetic (deal intelligence), Spartner (NL, AI for vastgoed), LightBox (zoning data)
- **Key Dutch data sources:** PDOK, BAG, Kadaster, ruimtelijkeplannen.nl, Rijksdienst voor het Cultureel Erfgoed

---
*Last updated: 2026-02-07 after v1.1 milestone start*
