# Phase 2: Core Data Pipeline - Research

**Researched:** 2026-02-07
**Domain:** Dutch government property data APIs (PDOK, BAG, Kadaster/BRK)
**Confidence:** MEDIUM (verified with official docs, limited by BRK API access restrictions)

## Summary

The Dutch government provides several interconnected APIs for property data retrieval. The recommended approach uses a three-API workflow: (1) PDOK Locatieserver for address resolution and autocomplete, (2) BAG API for official address and building data, (3) PDOK Cadastral Map OGC API for parcel geometry (note: ownership data via BRK API requires government authentication). All APIs support async access patterns and are free for reasonable usage. The standard stack for implementation is FastAPI + httpx (async HTTP client) + PostgreSQL JSONB columns for caching with source-specific TTLs.

**Primary recommendation:** Use PDOK Locatieserver suggest/lookup workflow for address input, BAG API for building data, PDOK OGC API for cadastral parcels, and httpx.AsyncClient with asyncio.gather() for parallel API calls. Cache responses in PostgreSQL JSONB columns with TTL metadata.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| httpx | 0.27+ | Async HTTP client | HTTP/2 support, type-annotated, sync+async, official FastAPI recommendation |
| asyncio | stdlib | Parallel API calls | Native Python async with gather() for concurrent requests |
| asyncpg | latest | PostgreSQL driver | Fastest async PostgreSQL driver for Python |
| SQLAlchemy | 2.0+ | ORM with async | Already in Phase 1, connection pooling, async session support |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| pydantic | 2.x | Response validation | Parse government API responses into type-safe models |
| orjson | latest | Fast JSON parsing | Optional optimization if JSON serialization is CPU-heavy |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| httpx | aiohttp | aiohttp is slightly faster but httpx has better typing, HTTP/2, and sync+async API |
| PostgreSQL JSONB | Redis | Redis is faster but adds infrastructure; PostgreSQL sufficient for this scale |
| asyncio.gather | TaskGroup (Python 3.11+) | TaskGroup provides structured concurrency but asyncio.gather is simpler |

**Installation:**
```bash
pip install httpx[http2] asyncpg sqlalchemy[asyncio] pydantic orjson
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── government_apis/         # External API clients
│   ├── pdok_locatieserver.py
│   ├── bag_api.py
│   ├── kadaster_brk.py
│   └── base.py              # Shared httpx client, retry logic
├── models/                  # SQLAlchemy models
│   ├── cached_response.py   # Generic cache table
│   └── property_report.py   # Aggregated property data
├── schemas/                 # Pydantic models
│   ├── pdok_schemas.py
│   ├── bag_schemas.py
│   └── property_schemas.py
└── services/                # Business logic
    ├── address_resolver.py  # Address input → BAG ID
    ├── property_aggregator.py  # Parallel API calls
    └── cache_manager.py     # Cache read/write/invalidation
```

### Pattern 1: Shared AsyncClient for Connection Pooling
**What:** Single long-lived httpx.AsyncClient instance shared across all government API calls
**When to use:** Always (connection pooling essential for performance)
**Example:**
```python
# src/government_apis/base.py
from httpx import AsyncClient, Limits, Timeout

class GovernmentAPIClient:
    _client: AsyncClient | None = None

    @classmethod
    async def get_client(cls) -> AsyncClient:
        if cls._client is None:
            limits = Limits(
                max_keepalive_connections=20,
                max_connections=100,
                keepalive_expiry=30.0
            )
            timeout = Timeout(
                connect=5.0,
                read=10.0,
                write=5.0,
                pool=5.0
            )
            cls._client = AsyncClient(limits=limits, timeout=timeout)
        return cls._client

    @classmethod
    async def close_client(cls):
        if cls._client:
            await cls._client.aclose()
```

### Pattern 2: Address Resolution Workflow
**What:** Two-step process using PDOK Locatieserver suggest → lookup → BAG API
**When to use:** Converting user address input to structured BAG data
**Example:**
```python
# src/services/address_resolver.py
async def resolve_address(user_input: str, postcode: str, huisnummer: str) -> BAGAddress:
    # Step 1: Use PDOK suggest for autocomplete (optional, for UI)
    suggest_url = "https://api.pdok.nl/bzk/locatieserver/search/v3_1/suggest"
    suggest_response = await client.get(suggest_url, params={"q": user_input})

    # Step 2: Use BAG API directly with postcode + huisnummer (more reliable)
    bag_url = "https://api.bag.kadaster.nl/lvbag/individuelebevragingen/v2/adressen"
    bag_response = await client.get(
        bag_url,
        params={"postcode": postcode, "huisnummer": huisnummer},
        headers={"X-Api-Key": settings.BAG_API_KEY}
    )

    # Returns nummeraanduidingId, verblijfsobjectId for further queries
    return BAGAddress.model_validate(bag_response.json())
```

### Pattern 3: Parallel API Calls with asyncio.gather
**What:** Fetch kadaster, BAG building data, and other sources concurrently
**When to use:** When generating property reports (multiple independent API calls)
**Example:**
```python
# src/services/property_aggregator.py
async def fetch_property_data(address_id: str) -> PropertyData:
    async with httpx.AsyncClient() as client:
        # Fire all requests in parallel
        bag_task = fetch_bag_data(client, address_id)
        parcel_task = fetch_cadastral_parcel(client, address_id)
        woz_task = fetch_woz_value(client, address_id)

        # Wait for all to complete
        bag_data, parcel_data, woz_data = await asyncio.gather(
            bag_task, parcel_task, woz_task,
            return_exceptions=True  # Don't fail entire request if one API fails
        )

        return PropertyData(
            bag=bag_data if not isinstance(bag_data, Exception) else None,
            parcel=parcel_data if not isinstance(parcel_data, Exception) else None,
            woz=woz_data if not isinstance(woz_data, Exception) else None,
        )
```

### Pattern 4: PostgreSQL JSONB Cache with TTL Metadata
**What:** Store government API responses in JSONB column with metadata (fetched_at, ttl, source)
**When to use:** All government API responses (avoid repeated calls, respect rate limits)
**Example:**
```python
# src/models/cached_response.py
from sqlalchemy import Column, String, Integer, DateTime, Index
from sqlalchemy.dialects.postgresql import JSONB

class CachedAPIResponse(Base):
    __tablename__ = "cached_api_responses"

    cache_key = Column(String, primary_key=True)  # e.g., "bag:1234ABC567890"
    source = Column(String, nullable=False)  # "bag", "kadaster", "pdok"
    response_data = Column(JSONB, nullable=False)
    fetched_at = Column(DateTime, nullable=False)
    ttl_seconds = Column(Integer, nullable=False)  # 86400 for BAG, 604800 for Kadaster
    organization_id = Column(String, nullable=False)  # Multi-tenant isolation

    __table_args__ = (
        Index("ix_cached_responses_org_source", "organization_id", "source"),
    )

# src/services/cache_manager.py
from datetime import datetime, timedelta

async def get_cached_or_fetch(
    cache_key: str,
    source: str,
    ttl_seconds: int,
    fetch_fn: Callable,
    organization_id: str,
    session: AsyncSession
) -> dict:
    # Check cache
    result = await session.execute(
        select(CachedAPIResponse).where(
            CachedAPIResponse.cache_key == cache_key,
            CachedAPIResponse.organization_id == organization_id
        )
    )
    cached = result.scalar_one_or_none()

    # Return cached if fresh
    if cached:
        age = (datetime.utcnow() - cached.fetched_at).total_seconds()
        if age < cached.ttl_seconds:
            return cached.response_data

    # Fetch fresh data
    fresh_data = await fetch_fn()

    # Update cache
    cache_entry = CachedAPIResponse(
        cache_key=cache_key,
        source=source,
        response_data=fresh_data,
        fetched_at=datetime.utcnow(),
        ttl_seconds=ttl_seconds,
        organization_id=organization_id
    )
    await session.merge(cache_entry)  # Upsert
    await session.commit()

    return fresh_data
```

### Anti-Patterns to Avoid
- **Creating httpx client per request:** Kills connection pooling and TLS reuse. Use single long-lived AsyncClient.
- **Sequential API calls:** Don't await each API call one by one. Use asyncio.gather() for parallel execution.
- **Caching without TTL metadata:** Store fetched_at timestamp and ttl_seconds to show data staleness to users.
- **Ignoring exceptions in gather():** Use return_exceptions=True to handle partial failures gracefully.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Address autocomplete | Custom fuzzy search | PDOK Locatieserver suggest endpoint | Edge ngram indexing, handles abbreviations, synonyms (Den Haag = 's-Gravenhage) |
| Address validation | Regex for postcode format | BAG API with postcode+huisnummer | Official source, validates existence, returns canonical format |
| Retry logic with backoff | Custom retry loops | httpx-retry or tenacity library | Handles transient failures, configurable backoff strategies |
| Connection pooling | Manual socket management | httpx.AsyncClient with Limits | HTTP/2, keep-alive management, automatic connection reuse |
| Geocoding (address → lat/lng) | External geocoding service | PDOK Locatieserver free endpoint | Free, authoritative, includes RD coordinates (EPSG:28992) |
| Cadastral parcel lookup | Screen scraping | PDOK OGC API Features (kadaster/brk-kadastrale-kaart) | Free, standardized, includes geometry |

**Key insight:** Dutch government APIs are comprehensive, well-maintained, and free. Don't build custom scrapers or approximations—use official APIs.

## Common Pitfalls

### Pitfall 1: Confusing BAG Object Hierarchy
**What goes wrong:** Developers query the wrong BAG endpoint and can't traverse address → building → parcel relationships.
**Why it happens:** BAG has nested object types: nummeraanduiding (address designation) → verblijfsobject (residential object) → pand (building). Each has separate IDs and endpoints.
**How to avoid:**
- Start with `/adressen` endpoint using postcode + huisnummer (returns nummeraanduidingId)
- Use nummeraanduidingId to get verblijfsobject (includes pandId)
- Use pandId to get building details (construction year, surface area, geometry)
**Warning signs:** Getting incomplete data or unable to link address to building polygon.

### Pitfall 2: BRK API Authentication Barrier
**What goes wrong:** Assuming BRK ownership data is freely accessible like BAG data. It's not—requires PKIOverheid certificate + OIN (government) or HRN (commercial).
**Why it happens:** PDOK offers free cadastral map data, but ownership/transaction data is restricted.
**How to avoid:**
- Use PDOK OGC API (kadaster/brk-kadastrale-kaart) for free parcel geometry and cadastral designation
- Accept that ownership data requires paid Kadaster BRK API access
- For MVP, show parcel boundaries without ownership (still valuable)
**Warning signs:** Documentation mentions "authentication required" or "PKIOverheid certificate."

### Pitfall 3: Ignoring Dutch Postcode Format Validation
**What goes wrong:** Accepting invalid postcodes like "1234" or "1234 AAA" leads to failed API calls.
**Why it happens:** Dutch postcodes have strict format: 4 digits + space + 2 uppercase letters (e.g., "1234 AB").
**How to avoid:**
- Validate format: `^\d{4}\s?[A-Z]{2}$` (allow optional space)
- Normalize before API call: strip spaces, uppercase letters
- Use Pydantic validator to reject invalid input early
**Warning signs:** BAG API returns 400 errors for address lookups.

### Pitfall 4: Connection Pool Exhaustion with Parallel Calls
**What goes wrong:** Making 50+ concurrent API calls causes httpx.PoolTimeout exceptions.
**Why it happens:** Default httpx limits are max_connections=100, but you also need to respect government API rate limits.
**How to avoid:**
- Set appropriate Limits (max_connections=100, max_keepalive_connections=20)
- Use asyncio.Semaphore to limit concurrent requests (e.g., 10 at a time)
- Monitor pool timeout errors and adjust limits
**Warning signs:** Intermittent PoolTimeout exceptions under load.

### Pitfall 5: Caching Without Staleness Indicators
**What goes wrong:** Users see outdated data without knowing it's cached, lose trust in reports.
**Why it happens:** Developers cache API responses but don't expose cache age to UI.
**How to avoid:**
- Store fetched_at timestamp in cache table
- Calculate age: `(now - fetched_at).total_seconds()`
- Return cache metadata in API response: `{"data": {...}, "cached_at": "2026-02-07T10:30:00Z", "ttl": 86400}`
- Show staleness indicator in UI: "Updated 2 hours ago" or "Data from yesterday"
**Warning signs:** User confusion about data freshness, requests to "refresh" data.

### Pitfall 6: Forgetting Multi-Tenant Isolation in Cache
**What goes wrong:** Organization A sees cached data from Organization B.
**Why it happens:** Cache key doesn't include organization_id.
**How to avoid:**
- ALWAYS include organization_id in cache key and WHERE clauses
- Add compound index on (organization_id, cache_key)
- Add test case verifying cross-org isolation
**Warning signs:** Data leakage between organizations (CRITICAL security issue).

### Pitfall 7: BAG API Key Registration Confusion
**What goes wrong:** Assuming BAG API is completely open like PDOK Locatieserver.
**Why it happens:** BAG API Individuele Bevragingen requires registration and API key (though free up to 50k calls/day).
**How to avoid:**
- Register for BAG API key at https://lvbag.github.io/BAG-API/
- Store API key in settings (environment variable)
- Include in request headers: `X-Api-Key: {api_key}`
- Plan for rate limit (50k/day is generous but finite)
**Warning signs:** 401/403 errors from BAG API endpoints.

## API Reference

### PDOK Locatieserver
**Base URL:** `https://api.pdok.nl/bzk/locatieserver/search/v3_1/`
**Authentication:** None required
**Rate Limits:** Not documented (reasonable use expected)

**Key Endpoints:**
- `GET /suggest?q={query}` - Autocomplete suggestions (returns IDs for lookup)
- `GET /lookup?id={object-id}` - Detailed object information
- `GET /free?q={query}` - Traditional geocoding (less structured)
- `GET /reverse?lat={lat}&lon={lon}` - Reverse geocoding

**Response Format:** JSON with `response.docs[]` array
**Confidence:** HIGH (official PDOK documentation verified)

### BAG API Individuele Bevragingen
**Base URL:** `https://api.bag.kadaster.nl/lvbag/individuelebevragingen/v2/`
**Authentication:** X-Api-Key header (register at lvbag.github.io)
**Rate Limits:** 50,000 calls/day (free tier)

**Key Endpoints:**
- `GET /adressen?postcode={pc}&huisnummer={nr}` - Address lookup
- `GET /nummeraanduidingen/{id}` - Address designation details
- `GET /verblijfsobjecten/{id}` - Residential object (links to pand)
- `GET /panden/{id}` - Building details (geometry, construction year)

**Response Format:** JSON with HAL+JSON links for related objects
**Confidence:** MEDIUM (documentation verified, API key required)

### PDOK Cadastral Map OGC API
**Base URL:** `https://api.pdok.nl/kadaster/brk-kadastrale-kaart/ogc/v1/`
**Authentication:** None required (CC BY 4.0 license)
**Rate Limits:** Not documented
**Update Frequency:** Daily

**Key Collections:**
- `/collections/perceel/items` - Cadastral parcels with geometry
- `/collections/kadastralegrens/items` - Cadastral boundaries
- `/collections/nummeraanduidingreeks/items` - Address ranges

**Response Format:** GeoJSON or JSON (OGC API Features standard)
**Confidence:** HIGH (official PDOK OGC API verified)

**What's Available:** Parcel geometry, cadastral designation, area
**What's NOT Available:** Ownership data, transaction history (requires BRK API with PKIOverheid)

## Code Examples

Verified patterns from official sources and best practices:

### Address Input to BAG Data
```python
# Two-step workflow: suggest for autocomplete, direct BAG lookup for submission
from httpx import AsyncClient
from pydantic import BaseModel

class BAGAddress(BaseModel):
    nummeraanduidingId: str
    verblijfsobjectId: str | None
    straat: str
    huisnummer: int
    postcode: str
    woonplaats: str

async def get_address_from_postcode(
    postcode: str,
    huisnummer: str,
    client: AsyncClient
) -> BAGAddress:
    # Normalize postcode: remove space, uppercase
    postcode = postcode.replace(" ", "").upper()
    postcode_formatted = f"{postcode[:4]} {postcode[4:]}"

    response = await client.get(
        "https://api.bag.kadaster.nl/lvbag/individuelebevragingen/v2/adressen",
        params={"postcode": postcode_formatted, "huisnummer": huisnummer},
        headers={"X-Api-Key": settings.BAG_API_KEY}
    )
    response.raise_for_status()

    data = response.json()
    # BAG returns _embedded.adressen array
    address = data["_embedded"]["adressen"][0]

    return BAGAddress(
        nummeraanduidingId=address["nummeraanduidingIdentificatie"],
        verblijfsobjectId=address.get("adresseerbaarObjectIdentificatie"),
        straat=address["korteNaam"],
        huisnummer=address["huisnummer"],
        postcode=address["postcode"],
        woonplaats=address["woonplaats"]
    )
```

### Parallel API Calls with Error Handling
```python
import asyncio
from typing import TypeVar, Callable

T = TypeVar('T')

async def fetch_with_fallback(
    fetch_fn: Callable[[], T],
    fallback_value: T | None = None,
    source_name: str = "API"
) -> T | None:
    """Wrapper for graceful degradation in asyncio.gather"""
    try:
        return await fetch_fn()
    except Exception as e:
        logger.warning(f"{source_name} fetch failed: {e}")
        return fallback_value

async def aggregate_property_data(address_id: str) -> PropertyReport:
    # All calls fire simultaneously
    bag_task = fetch_with_fallback(
        lambda: fetch_bag_building(address_id),
        fallback_value=None,
        source_name="BAG"
    )
    parcel_task = fetch_with_fallback(
        lambda: fetch_cadastral_parcel(address_id),
        fallback_value=None,
        source_name="Kadaster"
    )

    # Wait for all (no exception raised even if some fail)
    bag_data, parcel_data = await asyncio.gather(bag_task, parcel_task)

    return PropertyReport(
        address_id=address_id,
        building_data=bag_data,
        parcel_data=parcel_data,
        completeness_score=calculate_completeness(bag_data, parcel_data)
    )
```

### Cached API Call with TTL
```python
from datetime import datetime, timedelta

# Source-specific TTL from STATE.md Decision 4
TTL_CONFIG = {
    "bag": 86400,        # 24 hours
    "kadaster": 604800,  # 7 days
    "bestemmingsplan": 7776000  # 90 days
}

async def get_bag_data_cached(
    cache_key: str,
    organization_id: str,
    fetch_fn: Callable,
    session: AsyncSession
) -> dict:
    # Try cache first
    result = await session.execute(
        select(CachedAPIResponse).where(
            CachedAPIResponse.cache_key == cache_key,
            CachedAPIResponse.organization_id == organization_id,
            CachedAPIResponse.source == "bag"
        )
    )
    cached = result.scalar_one_or_none()

    # Check freshness
    if cached:
        age_seconds = (datetime.utcnow() - cached.fetched_at).total_seconds()
        if age_seconds < cached.ttl_seconds:
            logger.info(f"Cache HIT: {cache_key} (age: {age_seconds:.0f}s)")
            return {
                "data": cached.response_data,
                "cached_at": cached.fetched_at.isoformat(),
                "age_seconds": int(age_seconds)
            }

    # Cache miss or stale
    logger.info(f"Cache MISS: {cache_key}")
    fresh_data = await fetch_fn()

    # Store in cache
    cache_entry = CachedAPIResponse(
        cache_key=cache_key,
        source="bag",
        response_data=fresh_data,
        fetched_at=datetime.utcnow(),
        ttl_seconds=TTL_CONFIG["bag"],
        organization_id=organization_id
    )
    await session.merge(cache_entry)
    await session.commit()

    return {
        "data": fresh_data,
        "cached_at": datetime.utcnow().isoformat(),
        "age_seconds": 0
    }
```

### httpx Client Configuration for Production
```python
from httpx import AsyncClient, Limits, Timeout

def create_government_api_client() -> AsyncClient:
    """Shared client for all government API calls"""
    # Connection pool settings
    limits = Limits(
        max_keepalive_connections=20,  # Keep 20 connections alive
        max_connections=100,            # Max 100 total connections
        keepalive_expiry=30.0           # Keep-alive for 30 seconds
    )

    # Timeout configuration (be generous for government APIs)
    timeout = Timeout(
        connect=5.0,   # 5s to establish connection
        read=10.0,     # 10s to receive data
        write=5.0,     # 5s to send data
        pool=5.0       # 5s to get connection from pool
    )

    return AsyncClient(
        limits=limits,
        timeout=timeout,
        http2=True,  # Enable HTTP/2
        follow_redirects=True
    )

# Usage in FastAPI lifespan
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create shared client
    app.state.http_client = create_government_api_client()
    yield
    # Shutdown: close client
    await app.state.http_client.aclose()
```

### Postcode Validation with Pydantic
```python
from pydantic import BaseModel, field_validator
import re

class AddressInput(BaseModel):
    postcode: str
    huisnummer: int
    huisletter: str | None = None
    toevoeging: str | None = None

    @field_validator("postcode")
    @classmethod
    def validate_dutch_postcode(cls, v: str) -> str:
        # Remove spaces, uppercase
        normalized = v.replace(" ", "").upper()

        # Must be 4 digits + 2 letters
        if not re.match(r"^\d{4}[A-Z]{2}$", normalized):
            raise ValueError(
                "Invalid Dutch postcode format. Expected: 1234AB or 1234 AB"
            )

        # Return with space for consistency
        return f"{normalized[:4]} {normalized[4:]}"

# Usage
try:
    address = AddressInput(postcode="1234ab", huisnummer=42)
    print(address.postcode)  # "1234 AB"
except ValidationError as e:
    print(e)
```

## Data Flow Diagram

```
User Input (address string or postcode+huisnummer)
    ↓
[OPTIONAL: PDOK Locatieserver /suggest for autocomplete]
    ↓
[BAG API /adressen] → nummeraanduidingId + verblijfsobjectId
    ↓
    ├─→ [Check Cache: bag:{nummeraanduidingId}] → HIT? Return cached
    │                                           → MISS? Continue ↓
    ├─→ [Parallel Call 1: BAG API /verblijfsobjecten/{id}] → building details
    ├─→ [Parallel Call 2: BAG API /panden/{pandId}] → geometry, construction year
    ├─→ [Parallel Call 3: PDOK OGC API /perceel] → cadastral parcel geometry
    └─→ asyncio.gather() waits for all
    ↓
[Store each response in PostgreSQL cache with TTL metadata]
    ↓
[Aggregate into PropertyReport schema]
    ↓
[Return to user with data source attribution + staleness indicators]
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| BAG API v1 | BAG API v2 (Individuele Bevragingen) | ~2020 | v2 requires API key but provides richer data model |
| WFS for all queries | OGC API Features for vector data | 2021+ | OGC API is RESTful, supports GeoJSON directly |
| aiohttp | httpx for async HTTP | 2023+ | httpx has better typing, HTTP/2, sync+async API |
| SQLAlchemy 1.4 | SQLAlchemy 2.0+ | 2023 | Improved async support, better typing |
| requests | httpx/aiohttp | 2020+ | async/await required for parallel API calls |
| Screen scraping | Official APIs | Always | Government APIs are comprehensive and maintained |

**Deprecated/outdated:**
- BAG API v1: Replaced by v2 with better data model and authentication
- PDOK WMS for attribute data: Use OGC API Features instead (WMS is for raster tiles)
- Synchronous HTTP clients (requests): Use httpx for async FastAPI compatibility

## Open Questions

Things that couldn't be fully resolved:

1. **BRK Ownership Data Access for Commercial Use**
   - What we know: Requires PKIOverheid certificate + HRN (Trade Register Number)
   - What's unclear: Exact cost, registration process timeline, whether it's viable for this project
   - Recommendation: Start without ownership data (use free PDOK cadastral map for parcels), evaluate BRK API later if ownership becomes critical requirement

2. **PDOK API Rate Limits**
   - What we know: Not documented publicly for Locatieserver or OGC APIs
   - What's unclear: Actual throttling thresholds, whether caching is sufficient
   - Recommendation: Implement aggressive caching (24h-7d TTLs), monitor for 429 errors, add exponential backoff

3. **BAG API Key Approval Time**
   - What we know: Registration required via form
   - What's unclear: How long approval takes (hours? days?)
   - Recommendation: Register API key immediately in Phase 2 start, use PDOK Locatieserver as fallback during approval

4. **Best Way to Link BAG Address to Cadastral Parcel**
   - What we know: Both systems exist but direct linkage isn't obvious in docs
   - What's unclear: Is there a nummeraanduiding → perceelId mapping in any API?
   - Recommendation: Use geometry overlap (get BAG building polygon, query PDOK OGC API for parcels intersecting that polygon)

## Sources

### Primary (HIGH confidence)
- [PDOK Locatieserver API Documentation](https://github.com/PDOK/locatieserver/wiki/API-Locatieserver) - Official API reference
- [BAG API Documentation](https://lvbag.github.io/BAG-API/) - Official BAG API landing page
- [PDOK OGC API Cadastral Map](https://api.pdok.nl/kadaster/brk-kadastrale-kaart/ogc/v1?f=html&lang=en) - Free cadastral parcel data
- [httpx AsyncClient Documentation](https://www.python-httpx.org/async/) - Official httpx docs
- [httpx Timeouts](https://www.python-httpx.org/advanced/timeouts/) - Official timeout configuration guide
- [httpx Resource Limits](https://www.python-httpx.org/advanced/resource-limits/) - Official connection pooling guide

### Secondary (MEDIUM confidence)
- [FastAPI Performance Tuning & Caching (2026-02-03)](https://blog.greeden.me/en/2026/02/03/fastapi-performance-tuning-caching-strategy-101-a-practical-recipe-for-growing-a-slow-api-into-a-lightweight-fast-api/) - Recent FastAPI caching patterns with PostgreSQL
- [httpx vs aiohttp Comparison](https://miguel-mendez-ai.com/2024/10/20/aiohttp-vs-httpx) - Performance benchmarks and use case recommendations
- [8 httpx + asyncio Patterns (2025-12)](https://medium.com/@sparknp1/8-httpx-asyncio-patterns-for-safer-faster-clients-f27bc82e93e6) - Best practices for async httpx
- [Dutch Postcode Format Reference](https://berthub.eu/articles/posts/dutch-postcode-and-building-database/) - BAG database and address format explanation
- [PDOK WFS Documentation](https://www.pdok.nl/wfs) - PDOK WFS overview (deprecated for attribute queries, use OGC API)

### Tertiary (LOW confidence - for validation)
- [FastAPI Async SQLAlchemy PostgreSQL Integration Examples](https://github.com/grillazz/fastapi-sqlalchemy-asyncpg) - Community examples
- [PostgreSQL JSON Best Practices](https://aws.amazon.com/blogs/database/postgresql-as-a-json-database-advanced-patterns-and-best-practices/) - JSONB indexing and querying

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - httpx and asyncio are well-established, verified with official docs
- Architecture patterns: MEDIUM - Patterns are based on best practices but not Dutch-government-API-specific
- API endpoints: MEDIUM - PDOK/BAG endpoints verified, but BRK ownership API inaccessible without auth
- Pitfalls: MEDIUM - Based on common async HTTP and Dutch address validation issues, not project-specific experience
- Caching strategy: HIGH - PostgreSQL JSONB with TTL is well-documented pattern

**Research date:** 2026-02-07
**Valid until:** 2026-03-07 (30 days - Dutch government APIs are stable)

**Gaps requiring validation during implementation:**
- BAG API key registration and approval process
- Actual PDOK rate limits (monitor in production)
- Best method for linking BAG addresses to cadastral parcels (may require geometry overlap)
- BRK API access feasibility for commercial use (ownership data)
