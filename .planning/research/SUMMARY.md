# Project Research Summary

**Project:** Propdex — Dutch Property Intelligence Platform
**Domain:** PropTech / Property Intelligence / Government Data Aggregation
**Researched:** 2026-02-07
**Confidence:** MEDIUM

## Executive Summary

Propdex is a property intelligence platform for Dutch projectontwikkelaars specializing in heritage redevelopment (churches, monuments, commercial-to-residential). The core value proposition is collapsing 3-6 weeks of manual regulatory research into 3-minute structured reports. This is achieved by orchestrating parallel calls to Dutch government APIs (BAG, PDOK, Kadaster, ruimtelijkeplannen.nl) combined with AI-powered document parsing for bestemmingsplan PDFs where API data is insufficient.

The recommended stack centers on Python (FastAPI) + PostgreSQL (PostGIS) for the backend intelligence engine, with Next.js for the dashboard UI. The critical architectural pattern is fan-out/fan-in data aggregation: fetch all government data sources in parallel, aggregate gracefully with partial failure handling, and fall back to AI parsing only when API data is unavailable. Multi-tenant data isolation must be foundational from day one with `organization_id` filtering on every query.

The primary risks are: (1) treating AI-parsed zoning regulations as definitive legal facts when accuracy is 85-95%, (2) assuming Dutch government APIs are always available when they have rate limits and downtime, and (3) fragmented monument data across multiple inconsistent sources. Mitigation requires confidence scoring on all AI outputs, aggressive caching with staleness indicators, and querying all monument sources with explicit conflict detection. The product is an intelligence engine first, CRM second — avoid scope creep into full pipeline management or 3D visualization.

## Key Findings

### Recommended Stack

**Backend:** Python 3.12+ with FastAPI (async-native, type-safe), PostgreSQL 16+ with PostGIS extension (required for spatial queries), and Redis for caching and job queues. Python is ideal for this domain due to excellent GIS libraries (geopandas, shapely) and AI/LLM integration.

**Core technologies:**
- **FastAPI + Pydantic 2.10+**: Async-native API framework with automatic validation — essential for orchestrating parallel government API calls with type-safe schemas
- **PostgreSQL + PostGIS**: Spatial database required for property boundaries, coordinate transformations (Dutch RD to WGS84), and geographic queries
- **Anthropic Claude API (Opus 4.6 / Sonnet 4.5)**: Best-in-class for Dutch document extraction from bestemmingsplan PDFs with long context (200K tokens)
- **Leaflet + React-Leaflet**: Lightweight mapping library that integrates natively with PDOK (Dutch government) tile services without API costs
- **Next.js 15+ (App Router)**: Modern React framework for dashboard, server components for performance, excellent TypeScript support
- **Celery + Redis**: Background job queue for async PDF processing (10-30s LLM calls can't block HTTP requests)

**Critical integrations:**
- PDOK APIs (WFS/WMS) for geospatial data — requires Proj4js for RD (EPSG:28992) to WGS84 coordinate transformation
- BAG API for address validation and building characteristics
- Kadaster API for ownership data (requires OAuth2, paid service, €0.50-€2.00 per query)
- ruimtelijkeplannen.nl API for bestemmingsplan metadata and PDF URLs

**What to avoid:**
- Google Maps API (expensive, poor integration with Dutch PDOK data)
- Sequential API calls (use asyncio.gather for parallel fetching)
- SQLite (no PostGIS equivalent, can't handle concurrent writes)
- LangChain (adds unnecessary abstraction for document extraction)

### Expected Features

**Must have (table stakes):**
- **Address input with BAG autocomplete** — gateway to all intelligence
- **Kadaster property data** — ownership, boundaries, basic characteristics
- **Monument status check** — rijksmonument, gemeentelijk monument, beschermd stadsgezicht (from RCE database)
- **Bestemmingsplan summary** — current zoning, permitted uses, building restrictions (parsed from IMRO/PDF)
- **Map visualization** — property boundaries with PDOK cadastral overlay
- **PDF report export** — share findings with team/investors
- **Property save/list** — revisit previous lookups

**Should have (competitive advantage):**
- **Monument restriction detail** — plain-language "what can/can't be changed" for heritage projects
- **Subsidy eligibility detection** — auto-match to Rijksdienst, provincial, municipal heritage subsidy programs (20+ programs)
- **Property comparison view** — side-by-side compare 3-5 opportunities
- **Erfpacht analysis** — leasehold terms, buy-out costs, restrictions (critical for Amsterdam/Utrecht)
- **Environmental constraints** — geluid (noise), luchtkwaliteit (air quality), externe veiligheid (safety zones)
- **Development constraint scoring** — red/yellow/green rating for project complexity
- **Historical sales data** — comparable transactions from Kadaster

**Defer (v2+):**
- **Welstandscommissie prediction** — aesthetic board approval likelihood (requires ML model)
- **Financial feasibility calculator** — rough development budget estimation
- **Church-specific data enrichment** — usage history, community objections, deconsecration status
- **API for CRM integration** — push reports into client's existing systems
- **Alert system** — notify when zoning changes for saved properties

**Anti-features (deliberately not building):**
- Full CRM with pipeline management — scope creep, integration hell with existing CRMs
- 3D visualization/renders — enormous complexity, not decision-critical at pre-acquisition phase
- Real-time property alerts — Dutch heritage market doesn't work that way (deals via networks, not open listings)
- Automated valuation models — heritage properties are never comparable, creates false precision
- Mobile app (native) — desktop research workflow, developers don't make €5M decisions on phone

### Architecture Approach

The system follows a **layered service architecture** with clear separation: Presentation (Next.js dashboard) → API Gateway (FastAPI with JWT auth) → Orchestration Layer (property intelligence + document processing orchestrators) → Data Services Layer (individual government API clients + AI document parser) → Persistence (PostgreSQL + Redis cache + blob storage for PDFs).

**Major components:**
1. **Property Intelligence Orchestrator** — Coordinates fan-out/fan-in pattern for parallel government API calls (BAG, PDOK, Kadaster, ruimtelijkeplannen), aggregates results with graceful partial failure handling, returns unified property report with data source attribution
2. **Document Processing Orchestrator** — Manages API-first with AI fallback strategy: fetch bestemmingsplan via API if available, else download PDF, parse with LLM in background job, store structured output with confidence scoring
3. **API Client Abstraction Layer** — Base client with cache-aside pattern, retry logic, rate limiting, circuit breakers; each government API (BAG, PDOK, Kadaster, etc.) gets dedicated client inheriting shared functionality
4. **Multi-Tenant Middleware** — Extracts `organization_id` from JWT, injects into all queries, enforces row-level security; composite indexes on (organization_id, created_at) for performance
5. **Cache Manager** — Source-specific TTLs (BAG: 24h, Kadaster: 7d, bestemmingsplan: 90d), staleness indicators, manual refresh capability

**Critical patterns:**
- **Fan-out/fan-in for parallel API calls** — asyncio.gather() with return_exceptions=True, execute 5 APIs in 2s instead of 10s sequential
- **Cache-aside with TTL** — check Redis before calling government APIs, cache with source-specific TTLs based on data volatility
- **Async job queue for heavy processing** — Celery workers for LLM parsing (10-30s operations), return job ID immediately, poll for status
- **Multi-tenant data isolation** — `organization_id` on every table, injected via dependency, never trust client-provided org ID

**Scaling bottlenecks (in order):**
1. LLM processing (10-30s per PDF) — scale Celery workers horizontally
2. Government API rate limits — implement request queuing, cache aggressively
3. Database write pressure — batch inserts, connection pooling (pgbouncer)

### Critical Pitfalls

1. **Treating AI-parsed bestemmingsplan as 100% accurate** — LLMs achieve 85-95% accuracy on Dutch zoning PDFs, but confident wrong answers can cause €500k+ investment mistakes. Mitigation: always show confidence scores (LOW/MEDIUM/HIGH), flag ambiguous interpretations with "Verify with notaris" warnings, include direct PDF snippets for user verification, never use words like "definitief" for AI-parsed data.

2. **Assuming Dutch government APIs are always available** — PDOK/BAG/Kadaster have rate limits and downtime. Synchronous report generation fails completely when one API is down. Mitigation: implement aggressive caching with staleness indicators, build async report generation (queue request, fetch in background), display partial reports with "missing data" flags rather than failing completely, store fetched data permanently (never re-fetch same address).

3. **Monument data is fragmented and inconsistent** — Monument status lives in multiple systems (RCE Monumentenregister, BAG, Kadaster, gemeentelijke databases) with different update cycles. Picking one "authoritative" source misses monuments not synced yet. Mitigation: query ALL monument sources and show results with source attribution, flag conflicts explicitly ("RCE says monument, BAG says no monument — verify with gemeente"), include beschermd stadsgezicht separately (different restrictions than individual monuments).

4. **Ignoring data freshness differences** — BAG updates daily, Kadaster updates weekly-monthly, bestemmingsplannen update irregularly. Uniform 30-day cache causes stale ownership data. Mitigation: source-specific cache strategies (BAG: 24h, Kadaster eigenaar: 7d max, bestemmingsplan: check every 14d), show explicit staleness indicators ("BAG data: Updated 2 hours ago"), allow force-refresh, flag "high risk of staleness" for critical fields like ownership.

5. **PDF parsing fails silently on complex documents** — Bestemmingsplan PDFs have zoning rules in tables, footnotes, appendices. LLM extracts main text body, misses critical restrictions in footnotes. Scanned PDFs with OCR errors cause misreads. Mitigation: detect document type (digital vs scanned), parse structure metadata (tables, footnotes), flag complex structures ("Contains tables — AI parsing may be incomplete"), extract all sections separately (regels, verbeelding, toelichting), validate extracted numbers against physical constraints.

6. **GDPR violation with cached owner data** — Kadaster eigenaar (owner names) is personal data under AVG. Caching without proper consent and retention policy risks fines. Mitigation: classify eigenaar as personal data requiring AVG compliance, short retention (7-30d) with automatic deletion, don't include in default cached records, require user acceptance before showing, don't include in exported PDFs by default, log access for audit trail.

7. **Multi-jurisdiction properties** — Parcels spanning two gemeenten need bestemmingsplannen from both municipalities. Address lookup returns single gemeente, missing the second jurisdiction's stricter rules. Mitigation: after BAG lookup, query Kadaster for parcel boundaries, check if boundary intersects multiple gemeente borders (PDOK BRT), fetch plans from ALL municipalities, flag clearly ("Property spans 2 municipalities — different rules may apply").

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Foundation & Core Data Pipeline
**Rationale:** All intelligence depends on reliable government API integration. Must establish multi-tenant data isolation, caching patterns, and error handling before building features. Parallel API orchestration is the core technical challenge.

**Delivers:**
- Address input resolves to valid property
- Parallel fetching from BAG, PDOK, Kadaster APIs
- Unified property report with data source attribution
- Basic caching with source-specific TTLs
- Multi-tenant authentication and data isolation

**Addresses features:**
- Address input with BAG autocomplete (table stakes)
- Kadaster property data (table stakes)
- Basic property characteristics (table stakes)
- Map visualization with PDOK (table stakes)

**Avoids pitfalls:**
- API availability assumptions (cache-aside pattern, graceful degradation from day one)
- Data freshness differences (source-specific TTLs from start)
- Multi-tenant security (organization_id filtering foundational)
- GDPR owner data (proper data classification and retention)

**Build order:** Database models → Auth + multi-tenant middleware → Base API client with cache-aside → Individual API clients (BAG → PDOK → Kadaster) → Property Intelligence Orchestrator → Report Generator

### Phase 2: AI Document Parsing & Monument Intelligence
**Rationale:** Once core API data flows, add AI fallback for bestemmingsplan parsing and comprehensive monument checking. These are the differentiators for heritage redevelopment market. Requires async job infrastructure for slow LLM operations.

**Delivers:**
- Bestemmingsplan PDF download and AI parsing
- Structured zoning extraction with confidence scores
- Monument status from all sources (RCE, BAG, Kadaster)
- Conflict detection for inconsistent monument data
- Background job queue for heavy processing

**Addresses features:**
- Bestemmingsplan summary (table stakes, critical differentiator)
- Monument status check (table stakes)
- Monument restriction detail (competitive advantage)

**Avoids pitfalls:**
- AI parsing accuracy (confidence scoring, verification UI, explicit disclaimers)
- PDF parsing silent failures (structure detection, complexity indicators)
- Monument data fragmentation (query all sources, flag conflicts)
- Synchronous LLM calls (Celery workers, job status polling)

**Uses stack:**
- Celery + Redis for async jobs
- Anthropic Claude API for document extraction
- PyPDF + pdf2image for PDF processing
- Pydantic schemas for structured output validation

**Implements architecture:**
- Document Processing Orchestrator
- AI Document Processing Service (PDF Parser + LLM Client)
- Async Job Queue setup

### Phase 3: Advanced Intelligence & Differentiation
**Rationale:** With reliable data foundation and AI parsing working, add features that differentiate for heritage projects. Subsidy matching, erfpacht analysis, and environmental constraints complete the "instant due diligence" value proposition.

**Delivers:**
- Subsidy eligibility detection for heritage programs
- Erfpacht (leasehold) analysis for Amsterdam/Utrecht properties
- Environmental constraints (geluid, luchtkwaliteit, externe veiligheid)
- Development constraint scoring (red/yellow/green rating)
- Property comparison view (side-by-side 3-5 properties)
- Historical sales data integration

**Addresses features:**
- Subsidy eligibility (competitive advantage, high value for churches)
- Erfpacht analysis (competitive advantage, critical for NL cities)
- Environmental constraints (competitive advantage)
- Constraint scoring (competitive advantage, speeds pre-screening)
- Property comparison (should-have, users evaluate multiple opportunities)
- Historical sales data (table stakes)

**Avoids pitfalls:**
- Multi-jurisdiction properties (boundary intersection checks, multi-gemeente plans)
- Bestemmingsplan complexity (parse special provisions: overgangsrecht, wijzigingsbevoegdheid)

### Phase 4: MVP Refinement & User Validation
**Rationale:** Core intelligence features complete, now optimize for single-client deployment. Focus on UX polish, error handling, performance, and gathering feedback before expanding feature set.

**Delivers:**
- Property save/list functionality
- PDF report export with freshness timestamps
- User authentication and authorization
- Error handling improvements
- Performance optimization (database indexes, query optimization)
- Admin dashboard for API health monitoring

**Addresses features:**
- Property save/list (table stakes)
- PDF export (table stakes)
- User authentication (should-have for multi-user orgs)

**Addresses pitfalls:**
- UX pitfalls (progress indicators, friendly error messages, tooltips for Dutch terms)
- "Looks done but isn't" items (force-refresh, staleness indicators, verification flows)

### Phase 5: Multi-Tenant SaaS Expansion
**Rationale:** After validation with single client, prepare for scale. Add features needed for multiple paying organizations, usage monitoring, and operational excellence.

**Delivers:**
- Organization management and switching
- Per-organization rate limiting and quotas
- Usage analytics and billing integration
- Enhanced caching strategies
- Monitoring and alerting for government API SLAs
- API documentation for potential integrations

**Addresses features:**
- Custom report templates (v2+)
- API for CRM integration (v2+, only if multiple clients request)

**Addresses scaling:**
- Rate limiting per organization
- Connection pooling (pgbounger)
- Separate Celery worker fleet
- Regional deployment if expanding beyond NL

### Phase Ordering Rationale

- **Foundation first:** Cannot build intelligence features without reliable government API integration. Caching, async patterns, and multi-tenancy are architectural — retrofitting later requires rewriting data layer.
- **AI parsing after APIs:** API-first with AI fallback means APIs must work before adding AI layer. Also establishes job queue infrastructure needed for slow LLM operations.
- **Differentiation after reliability:** Users forgive missing advanced features but not broken core data. Monument intelligence, subsidies, erfpacht analysis only valuable if foundation is trusted.
- **MVP validation before scale:** Single-client validation proves value proposition before investing in multi-tenant operational features.

### Research Flags

**Phases likely needing deeper research during planning:**
- **Phase 1 (Foundation):** Current PDOK WFS endpoint URLs, BAG API rate limits, Kadaster API authentication flow in 2026 — need live API testing
- **Phase 2 (AI Parsing):** Claude API behavior with real Dutch bestemmingsplan PDFs (encoding, layout handling), prompt engineering for structured extraction, cost optimization (Opus vs Sonnet)
- **Phase 3 (Advanced Intelligence):** Current subsidy programs and eligibility criteria, erfpacht contract data availability, Atlas Leefomgeving API for environmental constraints

**Phases with standard patterns (can skip research-phase):**
- **Phase 4 (Refinement):** Standard CRUD operations, PDF generation, auth flows — well-documented patterns
- **Phase 5 (SaaS Expansion):** Multi-tenant SaaS patterns are established, monitoring/alerting is standard DevOps

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| **Stack** | HIGH | FastAPI + PostgreSQL + PostGIS is proven for GIS data aggregation. Python GIS libraries (geopandas, shapely) are industry standard. Claude API is current best for document extraction. |
| **Features** | HIGH | Table stakes features (address lookup, Kadaster data, zoning, monument status) are well-understood. Differentiators (subsidies, erfpacht) validated by Dutch PropTech domain knowledge. Anti-features (CRM scope creep) prevent known pitfalls. |
| **Architecture** | HIGH | Fan-out/fan-in, cache-aside, async job queue, multi-tenant isolation are established patterns. Dutch government API ecosystem (PDOK, BAG, Kadaster) structure is known. |
| **Pitfalls** | MEDIUM | AI parsing accuracy issues are domain-general knowledge. Dutch-specific pitfalls (monument fragmentation, multi-jurisdiction) based on regulatory structure understanding but not verified with recent production systems. |

**Overall confidence:** MEDIUM

### Gaps to Address

**During Phase 1 planning:**
- [ ] Verify current PDOK/BAG API endpoints, authentication, rate limits (may have changed since Jan 2025 training cutoff)
- [ ] Test Kadaster API access flow, confirm pricing model in 2026
- [ ] Confirm Next.js 15 stability or stick with Next.js 14 (15 was recent at training cutoff)
- [ ] Check Vercel pricing for EU-only deployment (GDPR requirement for some clients)

**During Phase 2 planning:**
- [ ] Test Claude API with 5-10 real bestemmingsplan PDFs (various vintages, municipalities) to validate accuracy assumptions
- [ ] Verify pdf2image system dependencies (requires poppler-utils)
- [ ] Benchmark Claude Opus 4.6 vs Sonnet 4.5 for extraction quality/cost trade-off
- [ ] Map all monument data sources (RCE, BAG, gemeentelijke portals) and test API access

**During Phase 3 planning:**
- [ ] Audit current heritage subsidy programs (Rijksdienst, provincial, municipal) — programs change annually
- [ ] Verify erfpacht data availability from Kadaster API (contract terms, buy-out calculations)
- [ ] Research Atlas Leefomgeving API for environmental constraint data (geluid, luchtkwaliteit)

**During Phase 5 planning:**
- [ ] Validate PostgreSQL row-level security approach for organization_id filtering
- [ ] Confirm NextAuth.js v5 stability (was beta at training cutoff)

## Sources

### PRIMARY (HIGH confidence)
- **Klarifai global coding standards** (CLAUDE.md) — multi-tenant security patterns, async/await requirements, validation standards
- **Dutch government API ecosystem knowledge** — PDOK (WFS/WMS), BAG (Basisregistratie Adressen en Gebouwen), Kadaster structure, ruimtelijkeplannen.nl
- **FastAPI + PostgreSQL + PostGIS architecture patterns** — established for GIS data aggregation platforms
- **Multi-tenant SaaS patterns** — row-level security with organization_id, standard for Klarifai projects
- **AI document parsing best practices** — Claude API for structured extraction, confidence scoring, human-in-the-loop verification

### SECONDARY (MEDIUM confidence)
- **Dutch PropTech domain knowledge** — heritage redevelopment challenges, bestemmingsplan complexity, monument regulations
- **Property intelligence platform patterns** — data aggregation, due diligence automation (e.g., Transect UK, Prophetic US)
- **Fan-out/fan-in async patterns** — asyncio.gather() for parallel API calls, graceful partial failure handling
- **Cache-aside with TTL strategies** — Redis patterns for government data with varying volatility

### TERTIARY (LOW confidence, needs validation)
- **Specific government API versions and rate limits** — Kadaster API pricing (€0.50-€2.00 per query), PDOK rate limits, BAG API authentication
- **Monument data source availability** — Rijksmonumentenregister API status, gemeentelijke monument databases
- **Subsidy program specifics** — BIJ (Besluit Instandhouding Jachten), SIM (Subsidieregeling Instandhouding Monumenten), current eligibility
- **Omgevingswet transition** — New regulatory framework launched July 2024, parallel systems for bestemmingsplan vs omgevingsplan

**Recommendation:** Treat technology choices and architectural patterns as HIGH confidence. Treat external API specifics, rate limits, and Dutch regulatory details as MEDIUM confidence requiring validation during Phase 1-2 implementation.

---
*Research completed: 2026-02-07*
*Ready for roadmap: yes*
*Files synthesized: STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md*
