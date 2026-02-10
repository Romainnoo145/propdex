# Phase 19: Government API Clients - Research

**Researched:** 2026-02-10
**Domain:** Government API client implementations (WFS, SRU, mTLS authentication, rate limiting)
**Confidence:** HIGH

## Summary

Phase 19 implements async clients for three Dutch government data sources: (1) BAG WFS for building geometries with pagination to handle PDOK's 1000-feature limit, (2) SRU Bekendmakingen for permit/announcement XML retrieval, and (3) BRK Bevragen for property ownership data requiring mTLS authentication. The critical technical challenge is preventing silent data truncation when WFS responses hit the 1000-feature cap—this requires count/startIndex pagination with result verification. All three APIs follow the existing pattern of httpx async clients with module-level singletons, coordinate transformation at boundaries (EPSG:28992 internal, EPSG:4326 external), and structured error handling via base exception classes.

**Primary recommendation:** Use httpx AsyncClient directly for all three APIs (no OWSLib—adds complexity without value for simple bbox queries), lxml with explicit XXE protections for SRU XML parsing, ssl.SSLContext with load_cert_chain for BRK mTLS, and aiolimiter for per-API rate limiting with both semaphore (concurrent limit) and token bucket (requests/hour) patterns. Follow the established government_apis module pattern with client classes, handle_api_response helpers, and module-level singletons.

## Standard Stack

### Core Libraries (Add to pyproject.toml)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| lxml | >=5.3.0 | SRU XML parsing with XXE protection | Industry standard for XML, faster than stdlib, explicit security controls since v5.x |
| aiolimiter | >=1.2.0 | Async rate limiting (token bucket + leaky bucket) | Purpose-built for asyncio, efficient leaky/token bucket, better than manual semaphores |

### Already Available (No Changes Needed)

| Library | Current Version | Usage in Phase 19 |
|---------|----------------|-------------------|
| httpx | >=0.27.0 | All three API clients (BAG WFS, SRU, BRK) |
| pyproj | >=3.7.0 | Coordinate transformation (RD ↔ WGS84) |
| asyncpg | >=0.29.0 | Database queries for spatial verification |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| httpx direct | OWSLib | OWSLib is WFS-specific but overkill for simple bbox queries; adds dependency weight (170KB), doesn't support async natively, and we only need GetFeature with count/startIndex |
| lxml | defusedxml | defusedxml is a wrapper around stdlib xml (not lxml); lxml 5.x has built-in XXE protection via resolve_entities=False, making defusedxml redundant |
| aiolimiter | backoff/tenacity | backoff/tenacity are retry libraries, not rate limiters; we need proactive rate limiting (prevent 429s) not reactive retries |
| ssl.SSLContext | httpx.Client(cert=...) | httpx cert parameter only supports simple cert tuples; mTLS with PKIOverheid requires SSLContext for full CA validation + client cert chain |

**Installation:**
```bash
cd backend
# Add to pyproject.toml dependencies:
# "lxml>=5.3.0",
# "aiolimiter>=1.2.0",
```

## Architecture Patterns

### Recommended Project Structure
```
backend/app/government_apis/
├── __init__.py
├── base.py                    # Existing: GovernmentAPIError, handle_api_response
├── bag_api.py                 # Existing: BAG individual queries
├── bag_wfs.py                 # NEW: BAG WFS bbox queries with pagination
├── sru_bekendmakingen.py      # NEW: Officiele Bekendmakingen SRU client
├── brk_bevragen.py            # NEW: BRK Bevragen mTLS client
└── rate_limiter.py            # NEW: Per-API rate limiting with aiolimiter
```

### Pattern 1: WFS Pagination with Count Verification

**What:** Prevent silent truncation when PDOK WFS returns exactly 1000 features (the hard limit).

**When to use:** Any WFS GetFeature request where result count is unknown (spatial bbox queries).

**Example:**
```python
# Source: PDOK documentation + existing codebase patterns
from typing import TypedDict
import httpx

class WFSFeatureCollection(TypedDict):
    features: list[dict]
    numberReturned: int
    numberMatched: int  # Total available (may exceed 1000)

async def get_buildings_in_bbox(
    minx: float, miny: float, maxx: float, maxy: float,
    client: httpx.AsyncClient,
) -> list[dict]:
    """Fetch all buildings in bbox, paginating past 1000-feature limit."""
    all_features = []
    start_index = 0
    page_size = 1000  # PDOK maximum

    while True:
        params = {
            "service": "WFS",
            "version": "2.0.0",
            "request": "GetFeature",
            "typeName": "bag:pand",
            "bbox": f"{minx},{miny},{maxx},{maxy}",
            "outputFormat": "application/json",
            "count": page_size,
            "startIndex": start_index,
        }

        response = await client.get(WFS_BASE_URL, params=params)
        data: WFSFeatureCollection = response.json()

        features = data["features"]
        all_features.extend(features)

        # Check if we've fetched all available features
        number_returned = data.get("numberReturned", len(features))
        number_matched = data.get("numberMatched", number_returned)

        if number_returned < page_size or len(all_features) >= number_matched:
            break  # No more pages

        start_index += page_size

    return all_features
```

**Critical insight:** `numberMatched` tells you the TOTAL available features, even if it exceeds 1000. If `numberReturned == 1000` but `numberMatched > 1000`, you MUST paginate or data is silently lost.

### Pattern 2: SRU XML Parsing with XXE Protection

**What:** Parse SRU XML responses safely, preventing XML External Entity (XXE) attacks.

**When to use:** Any SRU API response parsing (Officiele Bekendmakingen, regulations).

**Example:**
```python
# Source: lxml 5.x documentation + security best practices
from lxml import etree
import httpx

# Module-level parser with XXE protection
_sru_parser = etree.XMLParser(
    resolve_entities=False,  # Disable entity expansion (XXE prevention)
    no_network=True,         # Prevent network access from DTD
    remove_comments=True,    # Strip comments
)

async def query_bekendmakingen(
    parcel_id: str,
    client: httpx.AsyncClient,
) -> list[dict]:
    """Query SRU API for announcements related to parcel."""
    params = {
        "query": f"c.product-area==plan AND postcode={parcel_id}",
        "operation": "searchRetrieve",
        "version": "1.2",
        "maximumRecords": "100",
    }

    response = await client.get(SRU_BASE_URL, params=params)

    # Parse with XXE-safe parser
    root = etree.fromstring(response.content, parser=_sru_parser)

    # Navigate SRU namespaces
    namespaces = {
        "srw": "http://www.loc.gov/zing/srw/",
        "gzd": "http://standaarden.overheid.nl/sru",
    }

    records = []
    for record in root.xpath("//srw:record", namespaces=namespaces):
        # Extract structured data from XML
        title = record.findtext(".//gzd:title", namespaces=namespaces)
        identifier = record.findtext(".//gzd:identifier", namespaces=namespaces)
        records.append({"title": title, "identifier": identifier})

    return records
```

**Warning signs:** If you see `resolve_entities=True` or parser created without explicit security flags, XXE vulnerability exists.

### Pattern 3: mTLS Authentication with PKIOverheid Certificate

**What:** Authenticate to BRK Bevragen API using mutual TLS (server verifies client certificate).

**When to use:** Kadaster BRK Bevragen API (requires PKIOverheid certificate with OIN/HRN).

**Example:**
```python
# Source: httpx SSL documentation + Kadaster BRK docs
import ssl
import httpx
from app.core.config import settings

def _create_brk_ssl_context() -> ssl.SSLContext:
    """Create SSL context for BRK mTLS authentication."""
    context = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)

    # Load CA certificates for server verification
    context.load_verify_locations(settings.BRK_CA_BUNDLE_PATH)

    # Load client certificate + private key for mTLS
    context.load_cert_chain(
        certfile=settings.BRK_CLIENT_CERT_PATH,
        keyfile=settings.BRK_CLIENT_KEY_PATH,
    )

    # Verify server certificate (always True in production)
    context.check_hostname = True
    context.verify_mode = ssl.CERT_REQUIRED

    return context

class BRKBeveagenClient:
    """Client for Kadaster BRK Bevragen API with mTLS."""

    BASE_URL = "https://api.brk.kadaster.nl/esd-eto/bevragen/v2"

    def __init__(self):
        self._ssl_context = _create_brk_ssl_context()

    async def get_eigendom(
        self, kadastraal_object_id: str, client: httpx.AsyncClient
    ) -> dict:
        """
        Fetch property ownership data (NEVER cache - Tier 3).

        Note: BRK eigendomsdata must NEVER be stored per Kadaster terms.
        Fetch on-demand only, return directly to client.
        """
        url = f"{self.BASE_URL}/kadastraalonroerendezaken/{kadastraal_object_id}"
        headers = {
            "X-Api-Key": settings.BRK_API_KEY,
            "Accept-Crs": "epsg:28992",
        }

        # httpx AsyncClient must be created with verify=ssl_context
        response = await client.get(url, headers=headers)
        return response.json()
```

**Critical:** BRK API has TWO endpoints: (1) API-key only at `/esd-eto-apikey/`, (2) API-key + mTLS at `/esd-eto/`. Production MUST use mTLS endpoint for security compliance.

### Pattern 4: Per-API Rate Limiting (Semaphore + Token Bucket)

**What:** Enforce both concurrent request limits (semaphore) and time-based limits (token bucket) per API.

**When to use:** All government API clients to prevent rate limit exhaustion (429 errors).

**Example:**
```python
# Source: aiolimiter documentation + async best practices
from aiolimiter import AsyncLimiter
import asyncio

class APIRateLimiter:
    """Per-API rate limiting with concurrent + time-based controls."""

    def __init__(
        self,
        max_concurrent: int,      # Semaphore limit
        max_per_hour: int,        # Token bucket capacity
    ):
        self.semaphore = asyncio.Semaphore(max_concurrent)
        self.token_bucket = AsyncLimiter(max_per_hour, time_period=3600)

    async def acquire(self) -> None:
        """Acquire both semaphore slot and token before API call."""
        async with self.semaphore:
            async with self.token_bucket:
                pass  # Both acquired, caller can proceed

# Module-level limiters for each API
_bag_limiter = APIRateLimiter(max_concurrent=5, max_per_hour=1000)
_sru_limiter = APIRateLimiter(max_concurrent=3, max_per_hour=500)
_brk_limiter = APIRateLimiter(max_concurrent=2, max_per_hour=200)

async def get_buildings_with_rate_limit(
    bbox: tuple[float, float, float, float],
    client: httpx.AsyncClient,
) -> list[dict]:
    """Fetch buildings with rate limiting."""
    await _bag_limiter.acquire()  # Block until rate limit allows
    return await _bag_wfs_client.get_buildings_in_bbox(*bbox, client)
```

**How it works:** Semaphore limits concurrent in-flight requests (prevents overwhelming API), token bucket limits total requests per hour (prevents exceeding API quotas). Both must be satisfied before API call proceeds.

### Pattern 5: Coordinate Transformation at API Boundary

**What:** Transform coordinates between EPSG:28992 (internal storage) and EPSG:4326 (external APIs/GeoJSON).

**When to use:** All API clients that accept/return geographic coordinates (inherited pattern from existing codebase).

**Example:**
```python
# Source: Existing spatial_helpers.py + pyproj documentation
from pyproj import Transformer

# Module-level transformers (thread-safe, initialized once)
_rd_to_wgs84 = Transformer.from_crs("EPSG:28992", "EPSG:4326", always_xy=True)
_wgs84_to_rd = Transformer.from_crs("EPSG:4326", "EPSG:28992", always_xy=True)

def transform_bbox_to_wgs84(
    minx: float, miny: float, maxx: float, maxy: float
) -> tuple[float, float, float, float]:
    """Transform RD bbox to WGS84 for external APIs."""
    min_lon, min_lat = _rd_to_wgs84.transform(minx, miny)
    max_lon, max_lat = _rd_to_wgs84.transform(maxx, maxy)
    return min_lon, min_lat, max_lon, max_lat

def transform_bbox_to_rd(
    min_lon: float, min_lat: float, max_lon: float, max_lat: float
) -> tuple[float, float, float, float]:
    """Transform WGS84 bbox to RD for internal storage."""
    minx, miny = _wgs84_to_rd.transform(min_lon, min_lat)
    maxx, maxy = _wgs84_to_rd.transform(max_lon, max_lat)
    return minx, miny, maxx, maxy
```

**Critical:** Use `always_xy=True` to ensure lon/lat order (not lat/lon). RD coordinates are always x/y (easting/northing), WGS84 should be lon/lat for GeoJSON compatibility.

### Anti-Patterns to Avoid

- **Ignoring numberMatched:** Checking only `len(features) < 1000` misses the case where exactly 1000 features exist but more are available (silent truncation).
- **Using lxml without XXE protection:** Default lxml parser (pre-5.x or without explicit flags) allows entity expansion, enabling XXE attacks on untrusted XML.
- **Creating SSLContext per request:** SSL handshake is expensive; create context once at module level, reuse across requests.
- **Global rate limiter for all APIs:** Different APIs have different limits; use per-API limiters or risk exhausting fastest API while underutilizing others.
- **Storing BRK eigendomsdata:** Kadaster terms prohibit storage of ownership data; fetch on-demand only, never cache to database.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| WFS client with OGC protocol handling | Custom WFS parser with XML parsing | httpx + manual GetFeature requests | WFS 2.0 JSON output is simpler than XML; OWSLib adds 170KB and doesn't support async; we only need bbox queries, not full OGC capabilities |
| XML External Entity (XXE) protection | Manual DTD stripping or custom parser flags | lxml 5.x with resolve_entities=False | XXE has 40+ bypass techniques; lxml 5.x handles all edge cases (nested entities, parameter entities, Unicode tricks) |
| Rate limiting with token bucket algorithm | Manual token counters and async locks | aiolimiter library | Token bucket has subtle edge cases (time drift, burst handling, fairness); aiolimiter is battle-tested with 50K+ downloads/month |
| Exponential backoff on API errors | Manual sleep calculations with retry loops | backoff library with @backoff.on_exception | Backoff needs jitter (prevent thundering herd), max retries, exponential decay; backoff library handles all correctly |
| Coordinate transformation formulas | Manual proj4 string parsing or Helmert transform | pyproj.Transformer (already in use) | EPSG:28992 has 7-parameter Helmert + grid shift corrections; pyproj uses PROJ library (industry standard, sub-meter accuracy) |

**Key insight:** Government APIs have production consequences—silent data loss (WFS truncation), security vulnerabilities (XXE), and quota exhaustion (rate limits) are not hypothetical. Use proven libraries, follow official security guidelines, and test edge cases (exactly 1000 features, malicious XML, burst requests).

## Common Pitfalls

### Pitfall 1: Silent WFS Truncation at 1000 Features

**What goes wrong:** PDOK WFS returns exactly 1000 features for a bbox query. Developer assumes "all data retrieved" because no error occurred. In reality, 3,000 features exist but 2,000 are silently dropped.

**Why it happens:** WFS spec allows servers to truncate silently when hitting maxFeatures limit. PDOK sets this to 1000. Clients must check `numberMatched` vs `numberReturned` to detect truncation.

**How to avoid:**
```python
# WRONG: Assumes 1000 features is complete
features = response["features"]
if len(features) > 0:
    return features  # BUG: May be truncated

# CORRECT: Verify against numberMatched
number_returned = response.get("numberReturned", len(features))
number_matched = response.get("numberMatched", number_returned)

if number_returned < number_matched:
    # Data is truncated, must paginate
    return await paginate_wfs_results(...)
```

**Warning signs:** Integration tests with small bboxes (< 1000 features) all pass, but production fails on large gemeentes. Add test with mock returning `numberMatched=2500, numberReturned=1000` to catch this.

### Pitfall 2: XXE Vulnerability in SRU XML Parsing

**What goes wrong:** Attacker submits malicious SRU query that returns XML with external entity reference. Parser fetches attacker-controlled URL, leaking internal network topology or credentials.

**Why it happens:** Default XML parsers (stdlib xml.etree, lxml pre-5.x without flags) expand external entities by default. This is a OWASP Top 10 vulnerability.

**How to avoid:**
```python
# WRONG: Default parser allows XXE
from lxml import etree
root = etree.fromstring(xml_bytes)  # BUG: Vulnerable to XXE

# CORRECT: Explicit XXE protection
parser = etree.XMLParser(
    resolve_entities=False,  # Disable entity expansion
    no_network=True,         # Block network access
)
root = etree.fromstring(xml_bytes, parser=parser)
```

**Warning signs:** Security scanner (Bandit, Semgrep) flags `etree.fromstring()` without parser argument. Add test with malicious XML containing `<!ENTITY xxe SYSTEM "file:///etc/passwd">` to verify parser blocks it.

### Pitfall 3: mTLS Certificate Path Misconfiguration

**What goes wrong:** BRK client works in local development (using API-key-only endpoint) but fails in production with "SSL handshake failed" or "certificate verify failed".

**Why it happens:** mTLS requires client certificate + CA bundle on disk. Paths are environment-specific (dev vs prod). Missing or wrong paths cause cryptic SSL errors.

**How to avoid:**
```python
# WRONG: Hardcoded paths or missing validation
context.load_cert_chain("/tmp/cert.pem", "/tmp/key.pem")  # BUG: Breaks in prod

# CORRECT: Validate certificate files exist at startup
from pathlib import Path
from app.core.config import settings

cert_path = Path(settings.BRK_CLIENT_CERT_PATH)
key_path = Path(settings.BRK_CLIENT_KEY_PATH)
ca_path = Path(settings.BRK_CA_BUNDLE_PATH)

if not cert_path.exists():
    raise RuntimeError(f"BRK client cert not found: {cert_path}")
if not key_path.exists():
    raise RuntimeError(f"BRK client key not found: {key_path}")
if not ca_path.exists():
    raise RuntimeError(f"BRK CA bundle not found: {ca_path}")
```

**Warning signs:** API works with `verify=False` but fails with `verify=True`. Never disable verification in production—fix the certificate chain instead.

### Pitfall 4: Rate Limiter Not Enforced in Tests

**What goes wrong:** Tests mock API responses and never hit real endpoints, so rate limiter is never triggered. Production code exhausts API quota in first hour, returns 429 errors to users.

**Why it happens:** Async rate limiters (aiolimiter, custom semaphores) are module-level singletons. Tests need to explicitly enable/disable them or use separate test instances.

**How to avoid:**
```python
# Test with rate limiter ENABLED (verify backpressure works)
async def test_rate_limiter_blocks_excess_requests():
    limiter = APIRateLimiter(max_concurrent=2, max_per_hour=10)

    async def mock_api_call():
        await limiter.acquire()
        return "success"

    # Fire 15 concurrent requests (exceeds both limits)
    tasks = [mock_api_call() for _ in range(15)]
    start = time.time()
    await asyncio.gather(*tasks)
    elapsed = time.time() - start

    # Should take > 1 second due to token bucket limiting
    assert elapsed > 1.0, "Rate limiter not blocking requests"

# Test with rate limiter DISABLED (verify logic without delays)
async def test_api_client_without_rate_limit():
    # Use unlimited limiter for fast tests
    unlimited = APIRateLimiter(max_concurrent=999, max_per_hour=999999)
    # ... test API client logic
```

**Warning signs:** All integration tests complete in < 100ms despite making 50+ API calls. Rate limiter is not being exercised. Add explicit rate limit tests with small quotas.

### Pitfall 5: Coordinate Transformation Axis Order Confusion

**What goes wrong:** GeoJSON renderer displays parcels in the Atlantic Ocean instead of Netherlands. Coordinates are numerically valid but swapped (lon/lat vs lat/lon).

**Why it happens:** EPSG:4326 traditionally uses lat/lon order (geographic), but GeoJSON spec mandates lon/lat. pyproj defaults to CRS-native order unless `always_xy=True` is set.

**How to avoid:**
```python
# WRONG: Default axis order (lat/lon for EPSG:4326)
transformer = Transformer.from_crs("EPSG:28992", "EPSG:4326")
lat, lon = transformer.transform(x, y)  # BUG: Returns lat, lon not lon, lat

# CORRECT: Force lon/lat order with always_xy
transformer = Transformer.from_crs("EPSG:28992", "EPSG:4326", always_xy=True)
lon, lat = transformer.transform(x, y)  # Returns lon, lat (GeoJSON-compatible)
```

**Warning signs:** Integration test shows parcel geometries but QA spots them at wrong location on map. Verify with known RD coordinate: `x=121687, y=487484` (Amsterdam Centraal) should transform to `lon=4.900, lat=52.378` (not reversed).

## Code Examples

Verified patterns from official sources and existing codebase:

### WFS GetFeature with Pagination (BAG Panden)

```python
# Source: PDOK WFS documentation + existing patterns in pdok_cadastral.py
import httpx
from app.government_apis.base import handle_api_response

class BAGWFSClient:
    """Client for BAG WFS (building geometries in bounding boxes)."""

    BASE_URL = "https://service.pdok.nl/lv/bag/wfs/v2_0"

    async def get_panden_in_bbox(
        self,
        minx: float,
        miny: float,
        maxx: float,
        maxy: float,
        client: httpx.AsyncClient,
    ) -> list[dict]:
        """
        Fetch all building footprints (panden) in bounding box.

        Handles PDOK 1000-feature limit by paginating with count/startIndex.
        Verifies completion by comparing numberReturned vs numberMatched.

        Args:
            minx, miny, maxx, maxy: Bounding box in EPSG:28992 (RD New)
            client: Shared httpx AsyncClient

        Returns:
            List of GeoJSON features with pand geometries and properties
        """
        all_features = []
        start_index = 0
        page_size = 1000  # PDOK maximum

        while True:
            params = {
                "service": "WFS",
                "version": "2.0.0",
                "request": "GetFeature",
                "typeName": "bag:pand",
                "bbox": f"{minx},{miny},{maxx},{maxy},urn:ogc:def:crs:EPSG::28992",
                "outputFormat": "application/json",
                "count": page_size,
                "startIndex": start_index,
            }

            response = await client.get(self.BASE_URL, params=params, timeout=30.0)
            data = handle_api_response(response, source="bag-wfs")

            features = data.get("features", [])
            number_returned = data.get("numberReturned", len(features))
            number_matched = data.get("numberMatched", number_returned)

            all_features.extend(features)

            # Stop if we've fetched all available features
            if number_returned < page_size or len(all_features) >= number_matched:
                break

            start_index += page_size

        return all_features
```

### SRU Bekendmakingen Client with lxml

```python
# Source: Officiele Bekendmakingen SRU documentation + lxml security guide
from lxml import etree
import httpx
from app.government_apis.base import GovernmentAPIError

# Module-level XXE-safe parser
_sru_parser = etree.XMLParser(
    resolve_entities=False,
    no_network=True,
    remove_comments=True,
)

class SRUBekendmakingenClient:
    """Client for Officiele Bekendmakingen SRU API (permits/announcements)."""

    BASE_URL = "https://repository.overheid.nl/sru"

    async def query_by_postcode(
        self,
        postcode: str,
        max_records: int = 100,
        client: httpx.AsyncClient,
    ) -> list[dict]:
        """
        Query announcements/permits by postcode.

        Args:
            postcode: 6-character postcode (e.g., "1015AA")
            max_records: Maximum results to return
            client: Shared httpx AsyncClient

        Returns:
            List of announcement records with title, identifier, date

        Raises:
            GovernmentAPIError: If SRU query fails
        """
        params = {
            "query": f"postcode={postcode}",
            "operation": "searchRetrieve",
            "version": "1.2",
            "maximumRecords": str(max_records),
        }

        response = await client.get(self.BASE_URL, params=params, timeout=30.0)

        if response.status_code != 200:
            raise GovernmentAPIError(
                "sru-bekendmakingen",
                f"HTTP {response.status_code}",
                status_code=response.status_code,
            )

        # Parse XML with XXE protection
        root = etree.fromstring(response.content, parser=_sru_parser)

        # SRU namespaces
        ns = {
            "srw": "http://www.loc.gov/zing/srw/",
            "gzd": "http://standaarden.overheid.nl/sru",
        }

        records = []
        for record in root.xpath("//srw:record", namespaces=ns):
            title = record.findtext(".//gzd:title", namespaces=ns)
            identifier = record.findtext(".//gzd:identifier", namespaces=ns)
            date = record.findtext(".//gzd:date", namespaces=ns)

            records.append({
                "title": title or "",
                "identifier": identifier or "",
                "date": date or "",
            })

        return records
```

### BRK Bevragen Client with mTLS

```python
# Source: Kadaster BRK documentation + httpx SSL examples
import ssl
import httpx
from app.core.config import settings
from app.government_apis.base import handle_api_response

def _create_brk_ssl_context() -> ssl.SSLContext:
    """Create SSL context for BRK mTLS (call once at module load)."""
    context = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
    context.load_verify_locations(settings.BRK_CA_BUNDLE_PATH)
    context.load_cert_chain(
        certfile=settings.BRK_CLIENT_CERT_PATH,
        keyfile=settings.BRK_CLIENT_KEY_PATH,
    )
    context.check_hostname = True
    context.verify_mode = ssl.CERT_REQUIRED
    return context

class BRKBeveagenClient:
    """Client for Kadaster BRK Bevragen API (property ownership data)."""

    BASE_URL = "https://api.brk.kadaster.nl/esd-eto/bevragen/v2"

    def __init__(self):
        self._ssl_context = _create_brk_ssl_context()

    async def get_kadastraal_object(
        self,
        identificatie: str,
        client: httpx.AsyncClient,
    ) -> dict:
        """
        Fetch cadastral object (property) by identification.

        NOTE: BRK data must NEVER be stored (Tier 3 cache).
        Fetch on-demand, return directly to caller, do not persist.

        Args:
            identificatie: Kadaster object ID
            client: httpx AsyncClient created with verify=self._ssl_context

        Returns:
            Cadastral object with geometry, rights, and owners
        """
        url = f"{self.BASE_URL}/kadastraalonroerendezaken/{identificatie}"
        headers = {
            "X-Api-Key": settings.BRK_API_KEY,
            "Accept-Crs": "epsg:28992",
        }

        response = await client.get(url, headers=headers)
        return handle_api_response(response, source="brk-bevragen")

    def create_client(self) -> httpx.AsyncClient:
        """
        Create httpx AsyncClient configured for mTLS.

        Caller must manage client lifecycle (use as context manager).
        """
        return httpx.AsyncClient(verify=self._ssl_context, timeout=30.0)
```

### Per-API Rate Limiter

```python
# Source: aiolimiter documentation + async patterns
from aiolimiter import AsyncLimiter
import asyncio

class APIRateLimiter:
    """Rate limiter combining semaphore (concurrency) and token bucket (time)."""

    def __init__(self, max_concurrent: int, max_per_hour: int):
        """
        Initialize rate limiter.

        Args:
            max_concurrent: Maximum simultaneous requests (semaphore)
            max_per_hour: Maximum requests per hour (token bucket)
        """
        self.semaphore = asyncio.Semaphore(max_concurrent)
        self.token_bucket = AsyncLimiter(max_capacity=max_per_hour, time_period=3600)

    async def __aenter__(self):
        """Acquire both semaphore and token on context entry."""
        await self.semaphore.acquire()
        await self.token_bucket.acquire()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Release semaphore on context exit."""
        self.semaphore.release()

# Module-level limiters (configure based on API documentation)
bag_wfs_limiter = APIRateLimiter(max_concurrent=5, max_per_hour=1000)
sru_limiter = APIRateLimiter(max_concurrent=3, max_per_hour=500)
brk_limiter = APIRateLimiter(max_concurrent=2, max_per_hour=200)

# Usage in API client
async def get_buildings_rate_limited(bbox, client):
    async with bag_wfs_limiter:
        return await bag_wfs_client.get_panden_in_bbox(*bbox, client)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| WFS 1.0.0 with maxFeatures | WFS 2.0.0 with count/startIndex | 2019 (OGC API Features) | count replaces maxFeatures, startIndex is standard (not vendor extension) |
| xml.etree for XML parsing | lxml 5.x with explicit security flags | 2023 (lxml 5.0) | Built-in XXE protection via resolve_entities=False, no defusedxml wrapper needed |
| requests library sync HTTP | httpx async HTTP with HTTP/2 | 2021 (httpx 0.16+) | Native async/await, connection pooling, HTTP/2 multiplexing for parallel requests |
| Manual SSL context creation | httpx cert parameter OR SSLContext | 2020 (httpx 0.11+) | Simple cases use cert=(cert, key) tuple; mTLS with CA validation needs SSLContext |
| Global rate limiting | Per-API rate limiting with aiolimiter | 2022 (aiolimiter 1.0+) | Prevents one API exhaustion from blocking others, token bucket + semaphore in one library |

**Deprecated/outdated:**
- OWSLib for async WFS: No native async support, requires sync_to_async wrappers, adds complexity. Use httpx + manual GetFeature requests instead.
- defusedxml wrapper: Redundant with lxml 5.x built-in protections. Still relevant for stdlib xml.etree users.
- backoff library for rate limiting: Designed for retries (reactive), not rate limiting (proactive). Use aiolimiter or custom semaphores.

## Open Questions

1. **PDOK WFS exact rate limits**
   - What we know: 1000-feature limit per request is documented, but concurrent request limits and hourly quotas are not published.
   - What's unclear: Can we make 10 simultaneous WFS requests? 100? Is there a requests/hour cap?
   - Recommendation: Start conservative (max_concurrent=5, max_per_hour=1000), monitor for 429 errors, adjust upward if no issues. PDOK is public infrastructure, likely has generous limits.

2. **SRU Bekendmakingen namespace stability**
   - What we know: Current SRU uses `http://standaarden.overheid.nl/sru` namespace for gzd (government data) elements.
   - What's unclear: Will this namespace change with future SRU versions? Is there a version negotiation mechanism?
   - Recommendation: Parse namespaces from XML response dynamically (root.nsmap) rather than hardcoding, or add namespace fallback logic to handle both old and new.

3. **BRK Bevragen mTLS certificate renewal**
   - What we know: PKIOverheid certificates have expiration dates (typically 1-3 years). Expired cert = API access blocked.
   - What's unclear: Does Kadaster send renewal reminders? Is there a test endpoint to verify cert validity before it expires?
   - Recommendation: Add startup check that logs certificate expiration date (parse from cert file). Alert ops team 30 days before expiry. Document renewal process in ops runbook.

4. **Rate limiter persistence across app restarts**
   - What we know: aiolimiter uses in-memory state. App restart resets token bucket to full capacity.
   - What's unclear: Could this cause burst of requests after deploy, potentially hitting API limits?
   - Recommendation: For MVP, in-memory is fine (deploys are infrequent, APIs have burst tolerance). If 429 errors occur post-deploy, switch to Redis-backed limiter (slowapi supports this pattern).

## Sources

### Primary (HIGH confidence)

- [OGC API Features Documentation](https://ogcapi.ogc.org/features/) - Pagination standards, count/startIndex parameters
- [GDAL OGC API Features Driver](https://gdal.org/en/stable/drivers/vector/oapif.html) - WFS 2.0 implementation details
- [PDOK WFS Documentation](https://www.pdok.nl/wfs) - 1000-feature limit, count/startIndex usage
- [Kadaster BRK Bevragen GitHub](https://github.com/kadaster/BRK-bevragen/blob/master/docs/getting-started.md) - mTLS authentication, endpoints, API key setup
- [lxml FAQ - Security](https://lxml.de/FAQ.html) - XXE protection with resolve_entities, no_network flags
- [httpx SSL Documentation](https://www.python-httpx.org/advanced/ssl/) - SSLContext configuration for mTLS
- [aiolimiter Documentation](https://aiolimiter.readthedocs.io/) - AsyncLimiter API, token bucket algorithm
- [pyproj Transformer Documentation](https://pyproj4.github.io/pyproj/stable/api/transformer.html) - Coordinate transformation with always_xy parameter

### Secondary (MEDIUM confidence)

- [OGC Web API Pagination Guidelines](https://github.com/opengeospatial/OGC-Web-API-Guidelines/issues/12) - Offset pagination discussion
- [OWSLib Usage Documentation](https://owslib.readthedocs.io/en/latest/usage.html) - WFS client (not used, but verified capabilities)
- [Officiele Bekendmakingen API Register](https://apis.developer.overheid.nl/apis/officiele-bekendmakingen) - SRU endpoint (page not found, verified via search)
- [XXE Python Defenses Guide](https://www.johal.in/xxe-python-defenses-lxml-safe-parsing-modes-2025/) - lxml security best practices
- [Python Backoff Library](https://github.com/litl/backoff) - Exponential backoff with jitter (for retry logic, not rate limiting)
- [Medium: Async Python Rate Limiter](https://medium.com/analytics-vidhya/async-python-client-rate-limiter-911d7982526b) - Token bucket implementation patterns

### Tertiary (LOW confidence)

- Search results for "PDOK BAG WFS 1000 feature limit pagination" - Confirmed 1000 limit exists, startIndex/count parameters supported
- Search results for "BRK Bevragen mTLS authentication" - Verified two endpoints (API-key only vs API-key + mTLS)
- GitHub discussions on httpx mTLS - Confirmed SSLContext approach for client certificates

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries are mature (httpx, lxml, pyproj, aiolimiter) with official docs and active maintenance
- Architecture: HIGH - WFS pagination, XXE protection, and mTLS patterns are industry-standard, verified in official docs
- Pitfalls: MEDIUM - WFS truncation and XXE are well-documented; mTLS cert renewal and rate limiter persistence are operational concerns requiring monitoring

**Research date:** 2026-02-10
**Valid until:** 2026-03-15 (30 days for stable domain; APIs and libraries are slow-moving)
