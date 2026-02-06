# Stack Research

**Domain:** Property Intelligence Platform (Dutch PropTech)
**Researched:** 2026-02-07
**Overall Confidence:** MEDIUM (based on training data from Jan 2025, external verification unavailable)

## Recommended Stack

### Backend Core

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **Python** | 3.12+ | Backend language | Excellent libraries for GIS (geopandas, shapely), PDF processing (pypdf, pdfplumber), and AI/LLM integration. Strong typing with type hints. Standard for data processing pipelines. |
| **FastAPI** | 0.115+ | Web framework | Async-native, automatic OpenAPI docs, excellent type safety with Pydantic v2. Fast development, production-ready performance. Standard for modern Python APIs. |
| **PostgreSQL** | 16+ | Primary database | Industry standard for relational data. Multi-tenant ready (row-level security). **Critical:** PostGIS extension for spatial data (property boundaries, coordinates). |
| **PostGIS** | 3.4+ | Spatial database extension | Required for storing/querying geographic data (property locations, boundaries, zoning maps). Supports WGS84 coordinates used by Dutch government APIs. |
| **Redis** | 7.2+ | Cache + job queue | Cache government API responses (BAG, Kadaster are rate-limited). Job queue for async PDF processing. Session storage for multi-tenant auth. |

### Frontend Core

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **Next.js** | 15+ (App Router) | Frontend framework | React-based, excellent TypeScript support, server components for performance. App Router for nested layouts (dashboard structure). Standard for modern SaaS dashboards. |
| **TypeScript** | 5.7+ | Language | Type safety across stack. Reduces bugs in complex domain (property data has many optional fields). Excellent IDE support. |
| **Tailwind CSS** | 4.0+ | Styling | Utility-first, rapid development. Consistent design system. Aligns with Klarifai coding standards. |
| **Shadcn/ui** | Latest | Component library | Accessible, customizable components. Copy-paste approach (no dependency). Built on Radix UI primitives. Standard for modern SaaS interfaces. |

### Mapping & GIS

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **Leaflet** | 1.9+ | Web mapping library | Lightweight (38KB), mature, excellent plugin ecosystem. Works with Dutch PDOK tile services. Better than Google Maps for Dutch government data integration. |
| **React-Leaflet** | 4.2+ | React wrapper for Leaflet | Declarative React components for maps. Handles component lifecycle correctly. |
| **Proj4js** | 2.12+ | Coordinate transformation | Dutch government data uses RD (Rijksdriehoeksmeting) coordinates. Proj4js converts between RD and WGS84/Web Mercator for web display. **Critical for PDOK integration.** |

### AI & Document Processing

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **Anthropic Claude API** | Opus 4.6 / Sonnet 4.5 | AI document parsing | Best-in-class for structured extraction from PDFs. Handles Dutch text natively. Vision API can process PDF pages as images. Long context (200K tokens) handles full bestemmingsplan documents. |
| **PyPDF** | 5.1+ | PDF text extraction | Pure Python, fast, handles most Dutch government PDFs. Extract text before sending to Claude (cheaper than vision API). |
| **pdf2image** | 1.17+ | PDF to image conversion | Convert PDF pages to images for Claude Vision API when text extraction fails (scanned documents, complex layouts). |
| **Pydantic** | 2.10+ | Data validation | Define structured output schemas for Claude. Type-safe property report generation. Critical for ensuring LLM outputs match database schema. |

### Dutch Government API Integration

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **httpx** | 0.28+ | HTTP client | Async-native HTTP client for calling PDOK, BAG, Kadaster APIs. Better than requests for async/await patterns. Connection pooling for performance. |
| **geopandas** | 1.0+ | Spatial data processing | Process GeoJSON/GML responses from PDOK. Spatial joins (e.g., "which bestemmingsplan polygon contains this address?"). |
| **shapely** | 2.0+ | Geometric operations | Work with property boundaries, zoning polygons. Check if point is within polygon. Buffer calculations for nearby properties. |
| **OWSLib** | 0.32+ | OGC web services client | PDOK exposes data via WFS (Web Feature Service). OWSLib handles WFS protocol, returns GeoJSON. Alternative to manual HTTP requests. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **SQLAlchemy** | 2.0+ | ORM | Database access with type safety. Async support. Multi-tenant filtering (organization_id). GeoAlchemy2 for PostGIS types. |
| **GeoAlchemy2** | 0.15+ | PostGIS ORM integration | Map PostGIS geometry columns to SQLAlchemy models. Query spatial data with Pythonic syntax. |
| **Alembic** | 1.14+ | Database migrations | Version-controlled schema changes. Critical for multi-tenant SaaS (can't break existing orgs). |
| **Celery** | 5.4+ | Task queue | Background processing for slow operations (PDF parsing, multi-property reports). Use Redis as broker. |
| **python-dotenv** | 1.0+ | Environment config | Load API keys, database URLs from .env files. Standard config approach. |
| **pytest** | 8.3+ | Testing framework | Write tests before deploying to production. Fixtures for database setup. |
| **ruff** | 0.9+ | Linter + formatter | Klarifai standard. Fast, replaces flake8 + black + isort. |
| **mypy** | 1.14+ | Type checker | Klarifai standard. Catch type errors before runtime. |

### Authentication & Security

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **NextAuth.js** | 5+ (Auth.js) | Authentication | Email/password + OAuth. Built-in CSRF protection. Works with Next.js App Router. Multi-tenant session management. |
| **bcrypt** | 6.0+ | Password hashing | Industry standard for password storage. Required for AVG/GDPR compliance. |
| **python-jose** | 3.3+ | JWT handling (backend) | Issue/verify JWTs for API authentication. HS256 or RS256 signing. |

### Deployment & Infrastructure

| Tool | Purpose | Notes |
|------|---------|-------|
| **Docker** | Containerization | Multi-container setup: web, worker, postgres, redis. Consistent dev/prod environments. |
| **Docker Compose** | Local development | Define entire stack in docker-compose.yml. One command to start all services. |
| **Vercel** | Frontend hosting | Zero-config Next.js deployment. Preview environments for PRs. Edge functions for API routes. **Alternative:** Render, Railway for full-stack. |
| **Railway / Render** | Backend hosting | Postgres + Redis + Python backend. EU region available (GDPR). Affordable for MVP. |
| **GitHub Actions** | CI/CD | Run tests, type checks, linters on every PR. Deploy to staging/production automatically. |

## Installation

### Backend (Python)

```bash
# Create virtual environment
python3.12 -m venv venv
source venv/bin/activate

# Core dependencies
pip install fastapi[all]==0.115.0 \
            uvicorn[standard]==0.34.0 \
            sqlalchemy==2.0.36 \
            geoalchemy2==0.15.2 \
            psycopg[binary]==3.2.3 \
            alembic==1.14.0 \
            redis==5.2.0 \
            celery==5.4.0

# Dutch gov API integration
pip install httpx==0.28.1 \
            geopandas==1.0.1 \
            shapely==2.0.6 \
            owslib==0.32.0 \
            pyproj==3.7.0

# PDF & AI processing
pip install pypdf==5.1.0 \
            pdf2image==1.17.0 \
            anthropic==0.40.0 \
            pydantic==2.10.3

# Auth & security
pip install python-jose[cryptography]==3.3.0 \
            passlib[bcrypt]==1.7.4 \
            python-multipart==0.0.18

# Dev tools
pip install ruff==0.9.1 \
            mypy==1.14.0 \
            pytest==8.3.4 \
            pytest-asyncio==0.25.0 \
            python-dotenv==1.0.1
```

### Frontend (Next.js)

```bash
# Create Next.js app with TypeScript
npx create-next-app@latest crmplus-frontend \
  --typescript \
  --tailwind \
  --app \
  --no-src-dir \
  --import-alias "@/*"

cd crmplus-frontend

# Mapping libraries
npm install leaflet@1.9.4 \
            react-leaflet@4.2.1 \
            @types/leaflet@1.9.12 \
            proj4@2.12.1

# UI components
npx shadcn@latest init
npx shadcn@latest add button card form input table dialog

# Authentication
npm install next-auth@5.0.0-beta.25

# Dev tools
npm install -D @types/react@18.3.18 \
               @types/node@22.10.5 \
               typescript@5.7.3
```

### Database Setup

```bash
# Install PostgreSQL with PostGIS (via Docker)
docker run --name crmplus-db \
  -e POSTGRES_PASSWORD=dev_password \
  -e POSTGRES_DB=crmplus \
  -p 5432:5432 \
  -v crmplus_pgdata:/var/lib/postgresql/data \
  -d postgis/postgis:16-3.4

# Enable PostGIS extension (run in psql)
CREATE EXTENSION IF NOT EXISTS postgis;
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| **FastAPI** | Django + DRF | If you need built-in admin panel, more batteries-included approach. Slower development for API-only backends. |
| **PostgreSQL + PostGIS** | MongoDB + GeoJSON | Never for this use case. Dutch gov APIs return complex spatial data (polygons, multi-polygons). Relational model required. |
| **Next.js** | SvelteKit / Remix | If team prefers different framework. Next.js is most mature for SaaS dashboards with SSR + client components. |
| **Leaflet** | Mapbox GL JS | If you need 3D building rendering or vector tile styling. Mapbox costs more, requires API key. Leaflet works with free PDOK tiles. |
| **Claude API** | OpenAI GPT-4 | If you already have OpenAI contract. Claude handles Dutch text better, longer context for full documents. |
| **Celery** | Redis + manual workers | If you want simpler architecture. Celery adds complexity but provides retries, scheduling, monitoring. |
| **Vercel** | Self-hosted VPS | If you need full control or EU-only hosting. Vercel edge network is global (GDPR concern for some orgs). |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| **Google Maps API** | Expensive at scale. Poor integration with Dutch PDOK data (requires coordinate conversion, can't overlay WFS layers easily). | **Leaflet** with PDOK base maps (free, native RD support) |
| **PyPDF2** | Abandoned, last update 2022. Has bugs with Dutch PDFs (encoding issues). | **PyPDF** (active fork, better maintained) |
| **requests** library | Synchronous, blocks async event loop. No HTTP/2 support. | **httpx** (async-native, HTTP/2, same API as requests) |
| **Flask** | Requires many extensions for production (async, validation, docs). FastAPI has these built-in. | **FastAPI** |
| **SQLite** | No spatial extensions comparable to PostGIS. Can't handle concurrent writes (problematic for multi-tenant). | **PostgreSQL + PostGIS** |
| **OpenLayers** | More complex API than Leaflet. Overkill for this use case. Larger bundle size. | **Leaflet** (simpler, smaller, sufficient) |
| **LangChain** | Adds abstraction layer over LLM APIs. For document extraction, direct API calls are simpler and more reliable. Prompts are project-specific anyway. | **Direct Anthropic API** with Pydantic schemas |

## Stack Patterns by Use Case

### For MVP (1-5 users, single organization)

**Backend:**
- Monolithic FastAPI app (no microservices)
- Single Postgres database (no sharding)
- Redis for caching only (defer Celery until background jobs needed)
- Direct API calls (no queue for small volumes)

**Frontend:**
- Next.js with App Router
- Client-side Leaflet (SSR not critical for maps)
- Simple JWT auth (defer OAuth)

**Deployment:**
- Railway (backend + Postgres + Redis in one project)
- Vercel (frontend)
- GitHub Actions for CI

### For Multi-Tenant SaaS (scaling beyond MVP)

**Backend:**
- FastAPI with background workers
- Postgres with row-level security (`organization_id` filtering)
- Redis + Celery for async PDF processing
- Rate limiting per organization (prevent abuse)

**Frontend:**
- Same Next.js stack
- Organization switcher UI component
- API routes for server-side auth checks

**Deployment:**
- Kubernetes (if needed) or upgraded Railway plan
- Database read replicas (if reporting queries slow down writes)
- CDN for PDF cache (if serving parsed documents)

## Dutch Government API Specific Notes

### PDOK (Publieke Dienstverlening Op de Kaart)

**API Type:** WMS (map tiles), WFS (vector data), WMTS (cached tiles)
**Authentication:** None required (public data)
**Coordinate System:** RD New (EPSG:28992) - **must convert to WGS84 (EPSG:4326) for Leaflet**
**Rate Limits:** Generous, but cache responses in Redis to be polite

**Integration approach:**
```python
import httpx
import proj4

# Transform RD to WGS84
transformer = proj4.Transformer.from_crs("EPSG:28992", "EPSG:4326")

# Fetch BAG building data (example)
async with httpx.AsyncClient() as client:
    response = await client.get(
        "https://service.pdok.nl/lv/bag/wfs/v2_0",
        params={
            "service": "WFS",
            "version": "2.0.0",
            "request": "GetFeature",
            "typeName": "bag:pand",
            "outputFormat": "json",
            "filter": f"<filter><PropertyIsEqualTo><PropertyName>postcode</PropertyName><Value>{postcode}</Value></PropertyIsEqualTo></filter>"
        }
    )
    data = response.json()
```

### BAG (Basisregistratie Adressen en Gebouwen)

**API Type:** REST API (via PDOK WFS)
**Data:** Addresses, buildings, addresses-to-building relationships
**Update frequency:** Daily
**Critical for:** Validating user input (does address exist?), getting building metadata

### Kadaster API

**API Type:** REST API (requires authentication)
**Authentication:** OAuth2 (register for API key at kadaster.nl)
**Data:** Property ownership, parcel boundaries, liens/mortgages
**Rate Limits:** Tiered by plan (pay per request)
**Cost:** Approximately €0.50-€2.00 per property query
**Critical for:** Ownership data, legal restrictions

**Integration approach:**
- Cache aggressively (ownership changes infrequently)
- Only query when user requests full report (not on every address search)
- Store API keys in environment variables, rotate regularly

### Ruimtelijkeplannen.nl

**API Type:** None (data via download or WFS scraping)
**Data:** Zoning plans (bestemmingsplannen) as PDF + GML
**Challenge:** No stable API, must parse PDFs
**AI Strategy:** Download PDF, extract text with PyPDF, send to Claude for structured extraction

## Version Compatibility Matrix

| Package | Requires | Notes |
|---------|----------|-------|
| FastAPI 0.115+ | Pydantic 2.10+ | FastAPI v0.100+ requires Pydantic v2. Breaking changes from Pydantic v1. |
| GeoAlchemy2 0.15+ | SQLAlchemy 2.0+ | GeoAlchemy2 0.14+ required for SQLAlchemy 2.0 compatibility. |
| Next.js 15+ | React 19+ | Next.js 15 ships with React 19. Breaking changes in client components. |
| React-Leaflet 4.2+ | Leaflet 1.9+ | React-Leaflet 4.x requires Leaflet 1.9.x. Don't mix versions. |
| Celery 5.4+ | Redis 7.0+ | Celery 5.x works with Redis 6+, but Redis 7 recommended for better performance. |
| pytest 8.3+ | Python 3.8+ | Python 3.12+ recommended for better type hints in tests. |

## Confidence Assessment

| Technology Category | Confidence Level | Notes |
|-------------------|------------------|-------|
| **Backend (FastAPI, Postgres)** | HIGH | Standard stack, well-established patterns. Verified via training data. |
| **GIS (PostGIS, Leaflet)** | HIGH | Industry standard for spatial data. PostGIS is requirement for this domain. |
| **AI (Claude API)** | MEDIUM | Claude is current best for document extraction (as of Jan 2025), but OpenAI GPT-4 is viable alternative. Couldn't verify latest API versions. |
| **Dutch Gov APIs** | MEDIUM | PDOK/BAG patterns are stable, but specific API endpoints/versions not verified externally. Recommend testing during Phase 1. |
| **Frontend (Next.js 15)** | MEDIUM | Next.js 15 was recent as of training cutoff. App Router is stable, but verify current version. |
| **PDF Parsing** | MEDIUM | PyPDF + Claude is standard approach, but Dutch gov PDFs may have quirks. Recommend testing with real bestemmingsplan docs. |
| **Deployment** | LOW | Railway/Vercel recommendations based on general knowledge. Verify pricing and EU region availability. |

## Research Gaps & Validation Needed

**Before Phase 1 (Foundation):**
- [ ] Verify current PDOK WFS endpoint URLs (may have changed since Jan 2025)
- [ ] Test Kadaster API authentication flow (register for dev account)
- [ ] Confirm Next.js 15 stability (may want to use 14 if 15 has issues)
- [ ] Check Vercel pricing for EU-only deployment (GDPR requirement)

**Before Phase 2 (AI Integration):**
- [ ] Test Claude API with real Dutch bestemmingsplan PDFs (encoding, layout)
- [ ] Verify pdf2image dependencies (requires poppler-utils system package)
- [ ] Benchmark Claude Opus vs Sonnet for extraction quality/cost

**Before Phase 3 (Multi-Tenant):**
- [ ] Verify PostgreSQL row-level security approach for `organization_id`
- [ ] Test NextAuth.js v5 (beta as of training cutoff, may be stable now)

## Sources

**Unable to verify with external sources** (WebSearch and WebFetch unavailable during research session).

All recommendations based on:
- Training data (current through January 2025)
- Klarifai coding standards (from CLAUDE.md)
- General best practices for Python SaaS, GIS applications, and Dutch PropTech domain

**Recommendation:** Validate all version numbers and API endpoints during Phase 1 setup. Treat this research as HIGH confidence for technology choices, MEDIUM confidence for specific versions, LOW confidence for external API details.

---
*Stack research for: CRM Plus (Dutch Property Intelligence Platform)*
*Researched: 2026-02-07*
*Confidence: MEDIUM (external verification unavailable)*
