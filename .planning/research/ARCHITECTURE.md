# Architecture Research

**Domain:** Property Intelligence Platform (Multi-Source Government API + AI Document Parsing)
**Researched:** 2026-02-07
**Confidence:** MEDIUM (based on established patterns for data aggregation platforms, Dutch government API ecosystem knowledge, and AI document processing architectures)

## Standard Architecture

### System Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                       PRESENTATION LAYER                         │
├──────────────────────────────────────────────────────────────────┤
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌───────────┐  │
│  │  Address   │  │  Property  │  │    Map     │  │  Pipeline │  │
│  │   Input    │  │   Report   │  │   Viewer   │  │  Manager  │  │
│  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘  └─────┬─────┘  │
│        │               │               │               │         │
├────────┴───────────────┴───────────────┴───────────────┴─────────┤
│                       API GATEWAY LAYER                          │
├──────────────────────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────────────────────┐   │
│  │            Authentication & Multi-Tenant Router           │   │
│  └────────────────────────────┬──────────────────────────────┘   │
│                               │                                  │
├───────────────────────────────┴──────────────────────────────────┤
│                    ORCHESTRATION LAYER                           │
├──────────────────────────────────────────────────────────────────┤
│  ┌──────────────────┐  ┌──────────────────┐  ┌───────────────┐  │
│  │   Property       │  │   Document       │  │   Report      │  │
│  │   Intelligence   │  │   Processing     │  │   Generator   │  │
│  │   Orchestrator   │  │   Orchestrator   │  │   Service     │  │
│  └────────┬─────────┘  └────────┬─────────┘  └───────┬───────┘  │
│           │                     │                    │           │
├───────────┴─────────────────────┴────────────────────┴───────────┤
│                      DATA SERVICES LAYER                         │
├──────────────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐ │
│  │   BAG    │  │  PDOK    │  │ Kadaster │  │  Ruimtelijke     │ │
│  │ Service  │  │ Service  │  │ Service  │  │  Plannen Service │ │
│  └─────┬────┘  └─────┬────┘  └─────┬────┘  └─────────┬────────┘ │
│        │             │             │                  │          │
│  ┌─────┴─────────────┴─────────────┴──────────────────┴───────┐  │
│  │              API Client Abstraction Layer                  │  │
│  │         (Rate limiting, caching, retry logic)              │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │           AI Document Processing Service                  │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │   │
│  │  │ PDF Parser   │  │ LLM Client   │  │  Structured  │    │   │
│  │  │   Service    │  │   Service    │  │   Extractor  │    │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘    │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│                     PERSISTENCE LAYER                            │
├──────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │  PostgreSQL  │  │     Redis    │  │     Blob     │           │
│  │  (Primary)   │  │    (Cache)   │  │   Storage    │           │
│  │              │  │              │  │   (PDFs)     │           │
│  └──────────────┘  └──────────────┘  └──────────────┘           │
└──────────────────────────────────────────────────────────────────┘

External Dependencies:
┌─────────────────────────────────────────────────────────────┐
│  Dutch Government APIs:                                     │
│  • BAG API (Basisregistratie Adressen en Gebouwen)         │
│  • PDOK API (Publieke Dienstverlening Op de Kaart)         │
│  • Kadaster API (Land registry data)                       │
│  • ruimtelijkeplannen.nl API (Zoning plans)                │
│  • Rijksmonumentenregister API (Heritage monuments)        │
└─────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| **Property Intelligence Orchestrator** | Coordinates multi-source data fetching, handles parallel API calls, manages fallback to AI parsing | FastAPI/Flask async service with aiohttp for concurrent requests |
| **Document Processing Orchestrator** | Manages PDF download, parsing, LLM extraction pipeline, retry logic | FastAPI with Celery for background jobs, or async task queue |
| **API Client Abstraction Layer** | Provides unified interface to government APIs, handles authentication, rate limiting, circuit breaking | Python httpx client with tenacity for retries, Redis for rate limiting |
| **BAG/PDOK/Kadaster Services** | Domain-specific clients for each government API, data normalization | Separate service classes per API with pydantic models for validation |
| **AI Document Processing Service** | PDF parsing, LLM prompt management, structured data extraction | PyPDF2/pdfplumber + OpenAI/Anthropic API client, prompt templates |
| **Report Generator Service** | Aggregates data from multiple sources, handles missing data gracefully, generates unified report | Data aggregation service with template-based report generation |
| **Cache Layer (Redis)** | Caches API responses, stores job status, manages rate limit state | Redis with TTL-based expiration, separate keyspaces per data source |
| **Primary Database (PostgreSQL)** | Stores properties, reports, pipeline state, organization data (multi-tenant) | PostgreSQL with organization_id on all tables, GIS extensions for geo data |
| **Blob Storage** | Stores original PDF documents, processed documents, cached map tiles | S3-compatible storage (MinIO locally, AWS S3/Azure Blob in production) |

## Recommended Project Structure

```
propdex/
├── backend/
│   ├── app/
│   │   ├── api/                    # API routes and endpoints
│   │   │   ├── v1/
│   │   │   │   ├── properties.py   # Property CRUD and intelligence endpoints
│   │   │   │   ├── reports.py      # Report generation and retrieval
│   │   │   │   ├── pipeline.py     # Pipeline management endpoints
│   │   │   │   └── auth.py         # Authentication endpoints
│   │   │   └── dependencies.py     # Shared FastAPI dependencies
│   │   ├── core/
│   │   │   ├── config.py           # Configuration management
│   │   │   ├── security.py         # Auth, multi-tenant middleware
│   │   │   └── database.py         # Database connection and session
│   │   ├── models/                 # SQLAlchemy ORM models
│   │   │   ├── property.py
│   │   │   ├── report.py
│   │   │   ├── organization.py     # Multi-tenant organization model
│   │   │   └── document.py
│   │   ├── schemas/                # Pydantic schemas for validation
│   │   │   ├── property.py
│   │   │   ├── report.py
│   │   │   └── government_api.py   # API response schemas
│   │   ├── services/               # Business logic layer
│   │   │   ├── orchestration/
│   │   │   │   ├── property_intelligence.py  # Main orchestrator
│   │   │   │   └── document_processing.py    # Document orchestrator
│   │   │   ├── government_apis/
│   │   │   │   ├── base.py         # Base client with retry/rate limiting
│   │   │   │   ├── bag_client.py
│   │   │   │   ├── pdok_client.py
│   │   │   │   ├── kadaster_client.py
│   │   │   │   └── ruimtelijkeplannen_client.py
│   │   │   ├── ai/
│   │   │   │   ├── pdf_parser.py
│   │   │   │   ├── llm_client.py   # OpenAI/Anthropic client
│   │   │   │   └── prompt_templates.py
│   │   │   ├── report_generator.py
│   │   │   └── cache_manager.py
│   │   ├── workers/                # Background task workers
│   │   │   ├── celery_app.py
│   │   │   └── tasks.py            # Async job definitions
│   │   └── utils/
│   │       ├── geo.py              # Geospatial utilities
│   │       └── validators.py       # Dutch address validation
│   ├── alembic/                    # Database migrations
│   ├── tests/
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── app/                    # Next.js App Router
│   │   │   ├── (dashboard)/
│   │   │   │   ├── properties/
│   │   │   │   ├── reports/
│   │   │   │   └── pipeline/
│   │   │   ├── api/                # API route handlers (if using Next.js API routes)
│   │   │   └── auth/
│   │   ├── components/
│   │   │   ├── properties/
│   │   │   │   ├── AddressInput.tsx
│   │   │   │   └── PropertyCard.tsx
│   │   │   ├── reports/
│   │   │   │   ├── ReportViewer.tsx
│   │   │   │   └── DataSourceIndicator.tsx
│   │   │   ├── maps/
│   │   │   │   └── PropertyMap.tsx  # Leaflet/Mapbox integration
│   │   │   └── pipeline/
│   │   │       └── PipelineBoard.tsx
│   │   ├── lib/
│   │   │   ├── api-client.ts       # Backend API client
│   │   │   └── multi-tenant.ts     # Organization context
│   │   └── types/
│   │       └── property.ts
│   ├── package.json
│   └── tsconfig.json
├── shared/                         # Shared types/utilities (if monorepo)
│   └── types/
└── docker-compose.yml              # Local development stack
```

### Structure Rationale

- **services/orchestration/:** Core business logic lives here. Orchestrators coordinate multiple data sources and handle complex workflows (parallel API calls, fallback strategies).
- **services/government_apis/:** Each government API gets its own client for maintainability. Base client provides shared functionality (auth, retries, rate limiting).
- **services/ai/:** AI/LLM integration isolated for easy swapping of providers or models. Prompt templates separated for easy iteration.
- **workers/:** Heavy tasks (PDF processing, LLM calls) run asynchronously to avoid blocking HTTP requests.
- **frontend separation:** React/Next.js frontend is completely decoupled from backend, communicates only via REST API. Enables independent deployment.

## Architectural Patterns

### Pattern 1: Fan-Out/Fan-In Data Aggregation

**What:** Send parallel requests to multiple government APIs simultaneously, then aggregate results once all complete.

**When to use:** When fetching property data from multiple independent sources (BAG, PDOK, Kadaster, etc.) where responses are independent.

**Trade-offs:**
- PRO: Dramatically faster than sequential requests (5 APIs in 2s instead of 10s)
- PRO: Natural resilience - one API failure doesn't block others
- CON: Complexity in handling partial failures
- CON: Need to manage rate limits across parallel requests

**Example:**
```python
# services/orchestration/property_intelligence.py
import asyncio
from typing import Dict, Any, Optional

class PropertyIntelligenceOrchestrator:
    def __init__(
        self,
        bag_client: BAGClient,
        pdok_client: PDOKClient,
        kadaster_client: KadasterClient,
        ruimtelijkeplannen_client: RuimtelijkePlannenClient,
    ):
        self.clients = {
            'bag': bag_client,
            'pdok': pdok_client,
            'kadaster': kadaster_client,
            'ruimtelijkeplannen': ruimtelijkeplannen_client,
        }

    async def fetch_property_data(
        self,
        address: str,
        organization_id: str
    ) -> Dict[str, Any]:
        """
        Fan-out: fetch from all APIs in parallel
        Fan-in: aggregate results with graceful degradation
        """
        # Create tasks for all API calls
        tasks = {
            name: client.fetch_property_data(address, organization_id)
            for name, client in self.clients.items()
        }

        # Execute all in parallel, gather results even if some fail
        results = await asyncio.gather(
            *tasks.values(),
            return_exceptions=True  # Don't fail entire batch if one API fails
        )

        # Map results back to source names
        data = {}
        for (name, _), result in zip(tasks.items(), results):
            if isinstance(result, Exception):
                # Log error but continue
                logger.error(f"{name} API failed: {result}")
                data[name] = {'status': 'error', 'error': str(result)}
            else:
                data[name] = {'status': 'success', 'data': result}

        # Aggregate into unified property report
        return self._aggregate_property_data(data)

    def _aggregate_property_data(self, sources: Dict[str, Any]) -> Dict[str, Any]:
        """Combine data from multiple sources with priority rules"""
        report = {
            'basic_info': self._extract_from_bag(sources.get('bag')),
            'geospatial': self._extract_from_pdok(sources.get('pdok')),
            'ownership': self._extract_from_kadaster(sources.get('kadaster')),
            'zoning': self._extract_from_ruimtelijkeplannen(sources.get('ruimtelijkeplannen')),
            'data_sources': self._get_source_status(sources),
        }
        return report
```

### Pattern 2: API-First with AI Fallback

**What:** Try to fetch structured data from government APIs first; if unavailable or insufficient, fall back to AI-powered PDF parsing.

**When to use:** When dealing with Dutch government data where some information is available via API (BAG, PDOK) but detailed zoning info (bestemmingsplan) requires parsing PDFs.

**Trade-offs:**
- PRO: Use reliable, fast, free API data when available
- PRO: LLM parsing only when necessary (cost control)
- PRO: Graceful degradation if APIs are down
- CON: Complex logic to determine when to trigger fallback
- CON: Need to merge structured API data with unstructured AI-extracted data

**Example:**
```python
# services/orchestration/document_processing.py
from enum import Enum

class DataSource(Enum):
    API = "api"
    AI_PARSED = "ai_parsed"
    MANUAL = "manual"

class DocumentProcessingOrchestrator:
    async def get_zoning_info(
        self,
        property_address: str,
        organization_id: str
    ) -> Dict[str, Any]:
        """
        Try API first, fall back to AI parsing if needed
        """
        # 1. Try API first
        try:
            zoning_data = await self.ruimtelijkeplannen_client.get_zoning(
                property_address,
                organization_id
            )

            # Check if data is complete enough
            if self._is_zoning_data_complete(zoning_data):
                return {
                    'data': zoning_data,
                    'source': DataSource.API,
                    'confidence': 'high'
                }
        except Exception as e:
            logger.warning(f"API fetch failed: {e}, falling back to AI parsing")

        # 2. Fallback: fetch PDF and parse with AI
        try:
            # Download bestemmingsplan PDF
            pdf_url = await self.ruimtelijkeplannen_client.get_plan_pdf_url(
                property_address
            )
            pdf_content = await self._download_pdf(pdf_url)

            # Store original in blob storage
            pdf_key = await self.blob_storage.store(
                pdf_content,
                f"bestemmingsplannen/{organization_id}/{property_address}.pdf"
            )

            # Parse with AI
            zoning_data = await self.ai_parser.extract_zoning_info(
                pdf_content,
                property_address
            )

            return {
                'data': zoning_data,
                'source': DataSource.AI_PARSED,
                'confidence': 'medium',
                'pdf_url': pdf_key
            }
        except Exception as e:
            logger.error(f"AI parsing failed: {e}")
            return {
                'data': None,
                'source': None,
                'confidence': 'none',
                'error': str(e),
                'requires_manual_review': True
            }
```

### Pattern 3: Multi-Tenant Data Isolation with Row-Level Security

**What:** Every database query automatically filters by `organization_id` through middleware, ensuring complete tenant isolation.

**When to use:** Multi-tenant SaaS from day one (as per project context).

**Trade-offs:**
- PRO: Complete data isolation, no risk of cross-tenant data leaks
- PRO: Single database for all tenants (simpler ops than schema-per-tenant)
- CON: Every query must include organization_id filter (enforced at middleware level)
- CON: Indexes must include organization_id for performance

**Example:**
```python
# app/core/security.py
from fastapi import Depends, HTTPException, Request
from sqlalchemy.orm import Session

async def get_current_organization(
    request: Request,
    db: Session = Depends(get_db)
) -> str:
    """Extract organization_id from JWT token"""
    token = request.headers.get("Authorization")
    # Validate JWT and extract organization_id
    organization_id = validate_jwt_and_extract_org(token)
    return organization_id

# app/models/property.py
from sqlalchemy import Column, String, Index
from app.core.database import Base

class Property(Base):
    __tablename__ = "properties"

    id = Column(String, primary_key=True)
    organization_id = Column(String, nullable=False, index=True)  # CRITICAL
    address = Column(String, nullable=False)
    # ... other fields

    __table_args__ = (
        # Composite index for fast tenant-scoped queries
        Index('idx_org_created', 'organization_id', 'created_at'),
    )

# app/api/v1/properties.py
from fastapi import APIRouter, Depends
from app.core.security import get_current_organization

router = APIRouter()

@router.get("/properties")
async def list_properties(
    organization_id: str = Depends(get_current_organization),
    db: Session = Depends(get_db)
):
    # organization_id automatically injected from JWT
    properties = db.query(Property).filter(
        Property.organization_id == organization_id
    ).all()
    return properties
```

### Pattern 4: Cache-Aside with TTL for Government API Data

**What:** Check Redis cache before calling government APIs. Cache responses with appropriate TTL based on data volatility.

**When to use:** Government data changes infrequently (building data rarely changes, zoning plans update monthly/yearly).

**Trade-offs:**
- PRO: Massive performance improvement (milliseconds vs seconds)
- PRO: Reduces load on government APIs (avoid rate limits)
- PRO: Works offline during API outages
- CON: Stale data risk (mitigated by appropriate TTLs)
- CON: Cache invalidation complexity

**Example:**
```python
# services/cache_manager.py
from typing import Optional, Any
import redis
import json
from datetime import timedelta

class CacheManager:
    # Define TTLs based on data volatility
    TTL_CONFIG = {
        'bag': timedelta(days=30),      # Building data rarely changes
        'pdok': timedelta(days=7),      # Map data updates weekly
        'kadaster': timedelta(days=90), # Ownership data very stable
        'ruimtelijkeplannen': timedelta(days=180),  # Zoning plans change slowly
    }

    def __init__(self, redis_client: redis.Redis):
        self.redis = redis_client

    def get_cached_property_data(
        self,
        source: str,
        address: str,
        organization_id: str
    ) -> Optional[Dict[str, Any]]:
        """Cache-aside pattern: check cache first"""
        cache_key = f"{source}:{organization_id}:{address}"
        cached = self.redis.get(cache_key)

        if cached:
            return json.loads(cached)
        return None

    def cache_property_data(
        self,
        source: str,
        address: str,
        organization_id: str,
        data: Dict[str, Any]
    ) -> None:
        """Store in cache with source-specific TTL"""
        cache_key = f"{source}:{organization_id}:{address}"
        ttl = self.TTL_CONFIG.get(source, timedelta(days=1))

        self.redis.setex(
            cache_key,
            ttl,
            json.dumps(data)
        )

# services/government_apis/base.py
class BaseGovernmentAPIClient:
    def __init__(self, cache_manager: CacheManager):
        self.cache = cache_manager
        self.source_name = "base"  # Override in subclasses

    async def fetch_property_data(
        self,
        address: str,
        organization_id: str
    ) -> Dict[str, Any]:
        """Cache-aside wrapper for all API calls"""
        # 1. Try cache first
        cached = self.cache.get_cached_property_data(
            self.source_name,
            address,
            organization_id
        )
        if cached:
            logger.info(f"Cache hit: {self.source_name} - {address}")
            return cached

        # 2. Cache miss: call API
        logger.info(f"Cache miss: {self.source_name} - {address}, calling API")
        data = await self._fetch_from_api(address)

        # 3. Store in cache
        self.cache.cache_property_data(
            self.source_name,
            address,
            organization_id,
            data
        )

        return data

    async def _fetch_from_api(self, address: str) -> Dict[str, Any]:
        """Implemented by subclasses"""
        raise NotImplementedError
```

### Pattern 5: Async Job Queue for Heavy Processing

**What:** Long-running tasks (LLM parsing, multi-page PDF processing) run in background workers with job status tracking.

**When to use:** Any operation taking >3 seconds should be async to avoid HTTP request timeouts.

**Trade-offs:**
- PRO: Responsive API (return immediately with job ID)
- PRO: Scalable (add more workers under load)
- PRO: Retryable (workers can retry failed jobs)
- CON: More complex architecture (need Redis/job queue)
- CON: Client needs to poll or use websockets for status

**Example:**
```python
# app/workers/tasks.py
from celery import Celery
from app.services.orchestration.document_processing import DocumentProcessingOrchestrator

celery_app = Celery('propdex', broker='redis://localhost:6379/0')

@celery_app.task(bind=True, max_retries=3)
def process_bestemmingsplan_pdf(
    self,
    property_id: str,
    pdf_url: str,
    organization_id: str
):
    """
    Background task: download PDF, parse with AI, store results
    """
    try:
        orchestrator = DocumentProcessingOrchestrator()
        result = orchestrator.process_pdf_sync(  # Sync version for Celery
            pdf_url,
            organization_id
        )

        # Store result in database
        db = SessionLocal()
        property_obj = db.query(Property).filter(
            Property.id == property_id,
            Property.organization_id == organization_id
        ).first()
        property_obj.zoning_data = result
        property_obj.processing_status = 'completed'
        db.commit()

        return {'status': 'success', 'property_id': property_id}

    except Exception as e:
        logger.error(f"PDF processing failed: {e}")
        # Retry with exponential backoff
        raise self.retry(exc=e, countdown=60 * (2 ** self.request.retries))

# app/api/v1/reports.py
@router.post("/reports/{property_id}/process-pdf")
async def trigger_pdf_processing(
    property_id: str,
    pdf_url: str,
    organization_id: str = Depends(get_current_organization)
):
    """
    Trigger async PDF processing, return job ID immediately
    """
    job = process_bestemmingsplan_pdf.delay(
        property_id,
        pdf_url,
        organization_id
    )

    return {
        'job_id': job.id,
        'status': 'processing',
        'message': 'PDF processing started. Poll /jobs/{job_id} for status.'
    }

@router.get("/jobs/{job_id}")
async def get_job_status(job_id: str):
    """Poll endpoint for job status"""
    job = celery_app.AsyncResult(job_id)
    return {
        'job_id': job_id,
        'status': job.state,  # PENDING, STARTED, SUCCESS, FAILURE
        'result': job.result if job.ready() else None
    }
```

## Data Flow

### Property Intelligence Request Flow

```
1. User enters address in frontend
    ↓
2. Frontend calls POST /api/v1/properties/intelligence
    ↓
3. API Gateway: Validate JWT, extract organization_id
    ↓
4. Property Intelligence Orchestrator
    ├──→ Fan-out: Parallel API calls (async)
    │    ├──→ BAG Client → check cache → call API → cache result
    │    ├──→ PDOK Client → check cache → call API → cache result
    │    ├──→ Kadaster Client → check cache → call API → cache result
    │    └──→ RuimtelijkePlannen Client → check cache → call API
    │         └──→ If insufficient: trigger async PDF processing job
    │              └──→ Celery worker downloads PDF, calls LLM, stores result
    ↓
5. Fan-in: Aggregate results from all sources
    ├──→ Handle partial failures gracefully
    └──→ Mark data source for each field (API vs AI-parsed)
    ↓
6. Store property + report in PostgreSQL (with organization_id)
    ↓
7. Return report to frontend (JSON)
    ↓
8. Frontend renders report with data source indicators
```

### AI Document Processing Flow

```
1. Trigger: Zoning data not available via API
    ↓
2. Enqueue async job in Celery/Redis
    ↓
3. Worker picks up job:
    ├──→ Download PDF from ruimtelijkeplannen.nl
    ├──→ Store original PDF in blob storage (S3/MinIO)
    ├──→ Extract text with pdfplumber
    ├──→ Send to LLM with structured prompt:
    │    "Extract from this bestemmingsplan PDF:
    │     - Allowed uses (woongebied, bedrijventerrein, etc.)
    │     - Building restrictions (height, coverage)
    │     - Special conditions
    │     Return as JSON matching this schema..."
    ├──→ Parse LLM response (JSON)
    ├──→ Validate against pydantic schema
    └──→ Store in property.zoning_data (JSONB column)
    ↓
4. Update property.processing_status = 'completed'
    ↓
5. Frontend polls /jobs/{job_id} or receives webhook
    ↓
6. Display parsed zoning info with "AI-extracted" indicator
```

### State Management Flow

```
[User Action: Add Property to Pipeline]
    ↓
[Frontend: POST /api/v1/pipeline/properties]
    ↓
[Backend: Validate organization_id, create PipelineEntry]
    ↓
[Database: INSERT with organization_id, status='new']
    ↓
[Trigger: Property intelligence fetch if not cached]
    ↓
[Return: Property with current intelligence status]
    ↓
[Frontend: Update local state, render in pipeline board]
```

### Caching Strategy Flow

```
Request for property data
    ↓
Check Redis cache: "bag:{org_id}:{address}"
    ├──→ HIT: Return cached data (< 10ms)
    └──→ MISS:
         ├──→ Call government API (1-3s)
         ├──→ Store in Redis with TTL (30 days for BAG)
         └──→ Return fresh data

Cache invalidation triggers:
- Manual refresh button → delete cache key
- TTL expiration → natural expiry
- Known data change event → webhook invalidation (future)
```

## Build Order Dependencies

### Phase 1: Foundation (Week 1-2)
Build these components first as they are foundational:

1. **Database models + migrations** - Everything depends on data schema
2. **Authentication + multi-tenant middleware** - Security must be baked in from start
3. **Base API client with cache-aside pattern** - All government API clients inherit from this
4. **Address validation utilities** - Frontend and backend need to agree on valid addresses

### Phase 2: Core Data Pipeline (Week 3-4)
With foundation in place, build the data flow:

1. **Individual government API clients** (can be parallel):
   - BAG client (priority 1 - basic building data)
   - PDOK client (priority 2 - geospatial data)
   - Kadaster client (priority 3 - ownership)
   - RuimtelijkePlannen client (priority 4 - zoning)

2. **Property Intelligence Orchestrator** - Fan-out/fan-in pattern, depends on API clients

3. **Report Generator Service** - Aggregates orchestrator results

### Phase 3: AI Fallback (Week 5)
Once core API data flow works:

1. **Async job queue setup** (Celery + Redis)
2. **PDF download and storage** (blob storage integration)
3. **LLM client service** (OpenAI/Anthropic integration)
4. **Document Processing Orchestrator** - Combines PDF + LLM
5. **Integration with Property Intelligence Orchestrator** - Add fallback logic

### Phase 4: Frontend (Week 6-7)
Backend API working, now build UI:

1. **Address input component** - First user interaction
2. **Report viewer** - Display aggregated data
3. **Map integration** - Leaflet/Mapbox with PDOK layers
4. **Pipeline management** - Track multiple properties
5. **Job status polling** - For async PDF processing

### Phase 5: Polish (Week 8)
Everything works, now optimize:

1. **Error handling and retry logic refinement**
2. **Rate limiting and monitoring**
3. **Performance optimization (database indexes, query optimization)**
4. **Admin dashboard for monitoring API health**

**Key Dependency Rule:** Cannot build frontend property pages without backend API working. Cannot build orchestrator without individual API clients. Cannot add AI fallback without async job infrastructure.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| **0-100 users (MVP)** | Monolithic backend + frontend, single Postgres instance, Redis on same server. All government API clients in same FastAPI process. Celery workers on same machine (2-4 workers). This is sufficient for years if Dutch market only. |
| **100-1000 users** | Separate Celery workers to dedicated machines (scaling bottleneck will be LLM parsing). Add Redis replica for cache redundancy. Postgres still fine on single instance with proper indexes. Consider connection pooling (pgbouncer). Monitor government API rate limits more closely. |
| **1000-10000 users** | Split backend services: API server + worker fleet. Add Postgres read replicas for report queries. Implement CDN for blob storage (PDF downloads). Consider queue priorities (interactive requests > batch processing). Add monitoring/alerting for government API SLAs. Regional deployment if expanding beyond Netherlands. |

### Scaling Priorities

1. **First bottleneck: LLM processing** - AI parsing of PDFs is slowest operation (10-30s per document). Scale Celery workers horizontally. Consider batching if processing many properties. Cache AI-parsed results aggressively (180+ days TTL).

2. **Second bottleneck: Government API rate limits** - If hitting rate limits on BAG/PDOK APIs, implement request queuing with rate limiter. Consider applying for higher rate limit tier if available. Cache more aggressively (increase TTLs).

3. **Third bottleneck: Database writes** - Many concurrent property intelligence requests create write pressure. Optimize with batch inserts where possible. Add database connection pooling. Consider write-heavy vs read-heavy table separation.

## Anti-Patterns

### Anti-Pattern 1: Sequential API Calls

**What people do:** Call government APIs one after another sequentially:
```python
# BAD: Takes 10+ seconds
bag_data = await bag_client.fetch(address)
pdok_data = await pdok_client.fetch(address)
kadaster_data = await kadaster_client.fetch(address)
```

**Why it's wrong:** Each API call takes 1-3 seconds. Sequential = sum of all latencies. User waits 10+ seconds for response.

**Do this instead:** Use `asyncio.gather()` to call all APIs in parallel:
```python
# GOOD: Takes ~3 seconds (slowest API latency)
results = await asyncio.gather(
    bag_client.fetch(address),
    pdok_client.fetch(address),
    kadaster_client.fetch(address),
    return_exceptions=True
)
```

### Anti-Pattern 2: Synchronous LLM Calls in HTTP Handlers

**What people do:** Call OpenAI API directly in FastAPI endpoint:
```python
# BAD: HTTP request times out after 30s
@router.post("/parse-pdf")
async def parse_pdf(pdf_url: str):
    pdf = download_pdf(pdf_url)  # 5s
    result = openai.chat.completions.create(...)  # 15-30s
    return result
```

**Why it's wrong:** LLM calls are slow (10-30s). HTTP requests timeout. User sees error. No retry capability.

**Do this instead:** Use background job queue:
```python
# GOOD: Returns immediately with job ID
@router.post("/parse-pdf")
async def parse_pdf(pdf_url: str):
    job = parse_pdf_task.delay(pdf_url)
    return {'job_id': job.id, 'status': 'processing'}
```

### Anti-Pattern 3: Missing Multi-Tenant Filters

**What people do:** Forget to filter by `organization_id` in queries:
```python
# DANGEROUS: Returns properties from ALL organizations
properties = db.query(Property).filter(
    Property.address.like(f"%{search_term}%")
).all()
```

**Why it's wrong:** Data leak between tenants. Compliance violation. Security breach.

**Do this instead:** Always inject `organization_id` via dependency:
```python
# SAFE: Automatic tenant isolation
properties = db.query(Property).filter(
    Property.organization_id == organization_id,  # From JWT
    Property.address.like(f"%{search_term}%")
).all()
```

### Anti-Pattern 4: No Cache Invalidation Strategy

**What people do:** Cache government API responses forever or with no way to invalidate:
```python
# BAD: Stale data can persist indefinitely
cache_key = f"bag:{address}"
if not redis.exists(cache_key):
    data = fetch_from_api(address)
    redis.set(cache_key, data)  # No expiry
```

**Why it's wrong:** Building data can change (renovations, ownership transfers). Users see outdated info. No way to force refresh.

**Do this instead:** Set appropriate TTLs and provide manual refresh:
```python
# GOOD: Auto-expires + manual refresh capability
redis.setex(
    cache_key,
    timedelta(days=30),  # Auto-expire
    data
)

# Add refresh endpoint
@router.post("/properties/{id}/refresh")
async def refresh_property(id: str, org_id: str = Depends(get_org)):
    redis.delete(f"bag:{org_id}:{id}")  # Manual invalidation
    return await fetch_fresh_data(id)
```

### Anti-Pattern 5: Tight Coupling Between API Clients and Orchestrator

**What people do:** Put all government API logic directly in orchestrator:
```python
# BAD: Orchestrator knows API details
class PropertyIntelligenceOrchestrator:
    async def fetch_data(self, address):
        # Direct API calls mixed with business logic
        response = httpx.get(f"{BAG_URL}/address={address}")
        bag_data = response.json()
        # ... more API-specific code
```

**Why it's wrong:** Hard to test. Hard to swap APIs. Logic scattered across codebase.

**Do this instead:** Abstract each API behind a client interface:
```python
# GOOD: Clean separation of concerns
class BAGClient:
    async def fetch_property_data(self, address: str) -> PropertyData:
        # All BAG API specifics encapsulated here
        pass

class PropertyIntelligenceOrchestrator:
    def __init__(self, bag_client: BAGClient):
        self.bag_client = bag_client

    async def fetch_data(self, address):
        # Orchestrator only coordinates, doesn't know API details
        bag_data = await self.bag_client.fetch_property_data(address)
```

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| **BAG API** | REST API with API key, rate limited (exact limits TBD - check pdok.nl documentation) | Primary source for building data. Response format: GeoJSON. Requires WFS queries. |
| **PDOK API** | REST API, public access, WMS/WFS endpoints | Map tiles and geospatial data. Cache aggressively (geo data stable). |
| **Kadaster API** | REST API with OAuth2, paid service | Ownership and land registry. Requires account + API credentials. Check pricing model. |
| **ruimtelijkeplannen.nl API** | REST API, public, returns PDF URLs | Provides bestemmingsplan documents. API returns metadata + PDF link. PDFs require parsing. |
| **Rijksmonumentenregister API** | REST API, public | Heritage monument status. Simple key-value lookup by address. |
| **OpenAI/Anthropic API** | REST API with API key, token-based billing | LLM for PDF parsing. Use structured outputs (JSON mode). Implement retry with exponential backoff. |
| **Map Provider (Leaflet/Mapbox)** | JavaScript library + tile server API | Frontend map visualization. Consider self-hosting tiles from PDOK to reduce costs. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| **Frontend ↔ Backend API** | REST over HTTPS, JWT auth | Stateless. Frontend never directly calls government APIs (CORS issues, security). All data flows through backend. |
| **API Layer ↔ Orchestration Layer** | Direct function calls (same process) | No network hop. Orchestrators are Python classes imported into FastAPI app. |
| **Orchestration ↔ Data Services** | Direct function calls (same process initially) | Can be extracted to separate microservices later if needed. |
| **API Layer ↔ Celery Workers** | Redis message queue (async) | Workers are separate processes. Communication via Redis broker. Job results stored in Redis backend. |
| **Backend ↔ Cache (Redis)** | Direct connection via redis-py | Fast in-memory lookups. Use connection pooling. |
| **Backend ↔ Database (Postgres)** | SQLAlchemy ORM via asyncpg driver | Use connection pooling (pgbouncer or SQLAlchemy pool). Async queries where possible. |
| **Backend ↔ Blob Storage** | S3-compatible API (boto3) | MinIO locally, S3/Azure Blob in production. Store PDFs, processed documents, cached map tiles. |

### Multi-Source Data Prioritization

When multiple sources provide overlapping data (e.g., both BAG and Kadaster have building size):

**Priority order:**
1. **BAG** - Most authoritative for building physical data
2. **Kadaster** - Most authoritative for ownership/legal data
3. **PDOK** - Most authoritative for geospatial/map data
4. **AI-parsed PDF** - Use only when API data unavailable
5. **Manual entry** - Last resort, flag for verification

**Conflict resolution:**
- If BAG and Kadaster disagree on building size → prefer BAG, log discrepancy
- If API and AI-parsed disagree → prefer API, show both with confidence indicators
- Always track data source per field in report JSON for transparency

## Sources

### HIGH Confidence (Known Architecture Patterns)
- **Multi-tenant SaaS architecture:** Standard pattern with `organization_id` row-level security, documented in Klarifai global CLAUDE.md
- **Fan-out/fan-in pattern:** Established async pattern for parallel API calls, common in data aggregation systems
- **Cache-aside pattern:** Standard caching strategy, widely documented in Redis documentation
- **Async job queues:** Celery + Redis is proven pattern for Python background tasks

### MEDIUM Confidence (Dutch Government API Ecosystem)
- **BAG API structure:** Known to exist via PDOK, GeoJSON responses common pattern for government geo APIs
- **PDOK WMS/WFS:** Standard OGC protocols for Dutch geospatial data
- **ruimtelijkeplannen.nl:** Known to provide bestemmingsplan PDFs, API structure inferred from similar Dutch government services

### LOW Confidence (Needs Verification)
- **Exact rate limits for BAG/PDOK APIs:** Need to check current pdok.nl documentation for 2026 limits
- **Kadaster API authentication details:** Need to verify if still OAuth2, check current pricing
- **Rijksmonumentenregister API availability:** Verify current API status and authentication requirements

### Recommendations for Phase-Specific Research
- **Phase 2 (Core Data Pipeline):** Deep research into current BAG, PDOK, Kadaster API specifications, authentication, rate limits, response formats
- **Phase 3 (AI Fallback):** Research best LLM model for Dutch PDF parsing, prompt engineering for structured extraction, cost optimization strategies

---
*Architecture research for: Propdex (Dutch PropTech Property Intelligence Platform)*
*Researched: 2026-02-07*
