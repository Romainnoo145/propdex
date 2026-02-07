# Phase 9: Intelligence Testing - Research

**Researched:** 2026-02-07
**Domain:** Aggregator testing, AI parsing testing, ARQ worker lifecycle integration
**Confidence:** HIGH

## Summary

Phase 9 focuses on testing the intelligence layer of Propdex: zoning/monument aggregators (data transformation + spatial logic), AI document parsing (Claude API client + PDF processing), and ARQ worker lifecycle integration with FastAPI startup/shutdown. The project already has 134 passing tests (83 unit + 51 integration) with established patterns: httpx AsyncClient for async testing, unittest.mock for mocking, function-scoped table drop/recreate for isolation, and shared mock helpers in tests/api_mocks.py.

The standard approach for aggregator testing is to separate unit tests (data transformation, spatial filtering, error handling with mocked API responses) from integration tests (full API call → cache → aggregation → schema validation flows against real database). AI parsing tests use AsyncMock to mock anthropic.AsyncAnthropic.messages.create responses, validating both success and error paths (rate limits, connection failures, malformed JSON). ARQ worker lifecycle integration uses FastAPI's lifespan context manager with create_pool at startup and pool.close at shutdown.

**Primary recommendation:** Follow established project patterns (unittest.mock only, direct DB assertions, function-scoped fixtures) while adding spatial testing with shapely fixtures for GeoJSON geometries and comprehensive parametrize patterns for aggregator edge cases.

## Standard Stack

The established libraries/tools for this domain:

### Core Testing Framework
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| pytest | >=7.4.0 | Test framework | Async support, parametrize, fixtures |
| pytest-asyncio | >=0.21.0 | Async test support | Auto mode enabled in pyproject.toml |
| unittest.mock | stdlib | Mocking | AsyncMock for async methods, no new dependencies |
| httpx | >=0.27.0 | HTTP testing | AsyncClient with ASGITransport for FastAPI |

### Domain-Specific Libraries
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| shapely | >=2.0.0 | Spatial geometry | Point/Polygon containment, GeoJSON shape() |
| anthropic | >=0.40.0 | Claude API client | AsyncAnthropic for PDF parsing |
| arq | >=0.27.0 | Task queue | create_pool for worker lifecycle |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| unittest.mock.AsyncMock | pytest-mock | User decision: no new test dependencies (08-01) |
| Direct DB assertions | Mock-based | User decision: integration tests verify real DB behavior (08-02) |
| fakeredis | Real Redis | Production uses real Redis, tests can skip worker or use mock enqueue |

**Installation:**
All dependencies already present in pyproject.toml dev dependencies.

## Architecture Patterns

### Recommended Test Structure
```
backend/tests/
├── unit/
│   ├── test_zoning_aggregator.py        # Data transformation + spatial logic
│   ├── test_monument_aggregator.py      # Multi-source aggregation logic
│   ├── test_claude_client.py            # AI parsing with mocked Anthropic SDK
│   └── test_pdf_downloader.py           # PDF validation (already exists if needed)
├── integration/
│   ├── test_zoning_integration.py       # Full zoning flow: API → cache → schema
│   ├── test_monument_integration.py     # Full monument flow with conflict detection
│   └── test_arq_lifecycle.py            # FastAPI startup → pool creation → shutdown
└── conftest.py                           # Shared fixtures (already established)
```

### Pattern 1: Aggregator Unit Tests with Spatial Mocking
**What:** Test data transformation and spatial filtering with mocked API responses and synthetic GeoJSON
**When to use:** Zoning/monument aggregators with spatial logic

**Example:**
```python
# Source: Established project pattern + Shapely docs
from unittest.mock import AsyncMock
from shapely.geometry import Point, shape
import pytest

@pytest.fixture
def mock_property_point():
    """Fixture for property location."""
    return Point(121687.0, 487484.0)  # Amsterdam Centraal RD coordinates

@pytest.fixture
def mock_bestemming_feature():
    """Fixture for GeoJSON bestemming containing property point."""
    return {
        "naam": "Wonen",
        "omschrijving": "Woondoeleinden",
        "geometrie": {
            "type": "Polygon",
            "coordinates": [[
                [121600, 487400], [121800, 487400],
                [121800, 487600], [121600, 487600],
                [121600, 487400]
            ]]
        }
    }

async def test_spatial_intersection_filters_correctly(
    mock_property_point, mock_bestemming_feature
):
    """Verify spatial filtering identifies containing features."""
    from app.services.zoning_aggregator import _find_containing_features

    features = [mock_bestemming_feature]
    result = _find_containing_features(mock_property_point, features)

    assert len(result) == 1
    assert result[0]["naam"] == "Wonen"

async def test_spatial_intersection_excludes_non_containing(mock_property_point):
    """Verify features NOT containing point are excluded."""
    from app.services.zoning_aggregator import _find_containing_features

    # Feature far from property point
    distant_feature = {
        "naam": "Distant",
        "geometrie": {
            "type": "Polygon",
            "coordinates": [[[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]]
        }
    }

    result = _find_containing_features(mock_property_point, [distant_feature])
    assert len(result) == 0
```

### Pattern 2: Aggregator Integration Tests with Cache
**What:** Full flow testing: API client → cache manager → aggregation → response schema validation
**When to use:** Verify complete aggregator behavior against real database

**Example:**
```python
# Source: test_cache_manager.py pattern + aggregator architecture
import uuid
import pytest
from sqlalchemy import select
from app.services.zoning_aggregator import fetch_zoning_data
from app.models.cached_response import CachedAPIResponse
from tests.api_mocks import make_mock_response, make_mock_client

@pytest.fixture
async def org_id(test_db):
    """Create test organization."""
    from app.models.organization import Organization
    org = Organization(name="Zoning Test Org")
    test_db.add(org)
    await test_db.flush()
    await test_db.commit()
    return org.id

async def test_zoning_aggregator_full_flow_cache_miss(test_db, org_id):
    """Test full zoning flow: API call → cache → aggregation → schema."""
    # Mock DSO API responses
    plans_response = make_mock_response(json_data={
        "features": [{
            "properties": {
                "identificatie": "NL.IMRO.0363.BP2024-VA01",
                "naam": "Bestemmingsplan Centrum 2024",
                "planType": "bestemmingsplan",
                "planStatus": "vastgesteld",
                "datum": "2024-01-15"
            }
        }]
    })

    bestemmingen_response = make_mock_response(json_data={
        "features": [{
            "properties": {"naam": "Wonen", "omschrijving": "Woondoeleinden"},
            "geometry": {
                "type": "Polygon",
                "coordinates": [[[121600, 487400], [121800, 487600]]]
            }
        }]
    })

    mock_client = make_mock_client(
        get=plans_response,
        post=bestemmingen_response
    )

    # Execute full flow
    result = await fetch_zoning_data(
        x=121687.0, y=487484.0,
        client=mock_client,
        organization_id=org_id,
        session=test_db,
        force_refresh=False
    )

    # Verify schema
    assert result is not None
    assert len(result.plans) > 0
    assert result.plans[0].plan_id == "NL.IMRO.0363.BP2024-VA01"
    assert result.source == "DSO Ruimtelijke Plannen API v4"

    # Verify cache storage
    stmt = select(CachedAPIResponse).where(
        CachedAPIResponse.organization_id == org_id,
        CachedAPIResponse.cache_key.like("dso:zoning:%")
    )
    cached = (await test_db.execute(stmt)).scalar_one()
    assert cached.source == "dso"
    assert "plans" in cached.response_data
```

### Pattern 3: AI Parsing Tests with Mocked Anthropic SDK
**What:** Mock AsyncAnthropic.messages.create to test Claude client success/error paths
**When to use:** Testing AI parsing without actual API calls

**Example:**
```python
# Source: unittest.mock AsyncMock + anthropic SDK structure
from unittest.mock import AsyncMock, MagicMock
import pytest
from anthropic import AsyncAnthropic
from anthropic.types import Message, TextBlock

@pytest.fixture
def mock_claude_client():
    """Mock AsyncAnthropic client with messages.create method."""
    client = MagicMock(spec=AsyncAnthropic)
    client.messages = MagicMock()
    client.messages.create = AsyncMock()
    return client

@pytest.fixture
def mock_parsed_response():
    """Mock Claude API response with parsed bestemmingsplan."""
    content_block = TextBlock(
        type="text",
        text='{"plan_naam": "Test Plan", "plan_idn": "NL.IMRO.0363.BP2024-VA01", '
             '"regels": [{"artikel": "Art 3.1", "bestemming": "Wonen", '
             '"toegestane_gebruiken": ["wonen"], "confidence": "HIGH"}], '
             '"overall_confidence": "HIGH", "samenvatting": "Test summary"}'
    )
    response = Message(
        id="msg_123",
        content=[content_block],
        model="claude-sonnet-4-5-20250929",
        role="assistant",
        type="message"
    )
    return response

async def test_parse_bestemmingsplan_success(mock_claude_client, mock_parsed_response):
    """Test successful PDF parsing with mocked Claude response."""
    from app.ai.claude_client import ClaudeClient

    # Setup mock
    mock_claude_client.messages.create.return_value = mock_parsed_response

    # Create client with mocked SDK
    client = ClaudeClient(api_key="test_key")
    client.client = mock_claude_client

    # Execute
    pdf_data = b"%PDF-1.4\n%test content"
    result = await client.parse_bestemmingsplan(pdf_data, "NL.IMRO.0363.BP2024-VA01")

    # Verify
    assert result.plan_idn == "NL.IMRO.0363.BP2024-VA01"
    assert result.overall_confidence == "HIGH"
    assert len(result.regels) == 1
    mock_claude_client.messages.create.assert_called_once()

async def test_parse_bestemmingsplan_rate_limit(mock_claude_client):
    """Test rate limit error handling."""
    from anthropic import RateLimitError
    from app.ai.claude_client import ClaudeClient, AIParsingError

    # Mock rate limit error
    mock_claude_client.messages.create.side_effect = RateLimitError(
        "Rate limit exceeded",
        response=MagicMock(status_code=429),
        body={}
    )

    client = ClaudeClient(api_key="test_key")
    client.client = mock_claude_client

    with pytest.raises(AIParsingError) as exc_info:
        await client.parse_bestemmingsplan(b"%PDF-1.4", "NL.IMRO.0363.BP2024-VA01")

    assert exc_info.value.retriable is True
    assert "rate limit" in exc_info.value.message.lower()
```

### Pattern 4: ARQ Lifecycle Integration Test
**What:** Verify ARQ pool creation on startup and clean shutdown
**When to use:** Testing worker lifecycle integration with FastAPI

**Example:**
```python
# Source: ARQ docs + FastAPI lifespan pattern
import pytest
from httpx import AsyncClient, ASGITransport

async def test_arq_pool_created_on_startup():
    """Verify ARQ pool is created during FastAPI startup."""
    from app.main import app

    # Trigger lifespan startup
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Verify pool exists
        assert hasattr(app.state, "arq_pool")
        assert app.state.arq_pool is not None

        # Verify pool is functional (can enqueue)
        job = await app.state.arq_pool.enqueue_job("pdf_parsing_job", "test_plan_idn")
        assert job is not None

    # After context exit, pool should be closed
    # (No direct assertion - just verify no errors during shutdown)

async def test_http_client_created_on_startup():
    """Verify shared httpx client is created during FastAPI startup."""
    from app.main import app

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        assert hasattr(app.state, "http_client")
        assert app.state.http_client is not None

        # Verify client is httpx AsyncClient
        from httpx import AsyncClient as HttpxAsyncClient
        assert isinstance(app.state.http_client, HttpxAsyncClient)
```

### Anti-Patterns to Avoid
- **Mock internal helpers when testing integration flows:** Integration tests should only mock external API calls, not internal aggregation logic
- **Test spatial logic without real shapely geometries:** Always use shapely.geometry.shape() to convert GeoJSON to geometries for accurate spatial testing
- **Skip error path testing for AI parsing:** Claude API has multiple error types (rate limit, connection, malformed JSON) that all need test coverage
- **Assume ARQ pool exists without lifespan trigger:** Tests using app.state.arq_pool must trigger FastAPI lifespan via AsyncClient context manager

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Mocking async functions | Custom async mock wrapper | unittest.mock.AsyncMock | Handles await, return_value, side_effect, assert_awaited_once |
| Spatial point-in-polygon testing | Manual coordinate math | shapely.contains() / intersects() | GEOS library handles edge cases, prepared geometries for performance |
| GeoJSON to geometry conversion | Custom coordinate parser | shapely.geometry.shape() | Handles all GeoJSON types, MultiPolygon, coordinate validation |
| ARQ Redis pool mocking for tests | Custom Redis mock | Skip worker tests OR use dependency override | Production uses real Redis, unit tests mock enqueue_job |
| Parametrized test data generation | Manual test function duplication | pytest.mark.parametrize | Generates test IDs, clear failure reports, DRY principle |

**Key insight:** Spatial testing requires shapely's GEOS-backed algorithms — manual coordinate math will miss edge cases (polygon holes, multi-geometries, coordinate system issues). AsyncMock from stdlib is sufficient for all async mocking needs.

## Common Pitfalls

### Pitfall 1: Spatial Intersection Testing Without Valid Geometries
**What goes wrong:** Test uses raw coordinate lists instead of shapely geometries, causing failures when aggregator uses shape() function
**Why it happens:** Forgetting that aggregators call shape(geometry_data) to convert GeoJSON to shapely objects
**How to avoid:** Always construct test GeoJSON with valid structure and use shape() in tests to match production behavior
**Warning signs:** TypeError about coordinates not being iterable, or intersection logic returning unexpected results

### Pitfall 2: AsyncMock Not Awaited in Test Assertions
**What goes wrong:** Test fails with "coroutine was never awaited" when asserting async mock calls
**Why it happens:** Using assert_called_once() on AsyncMock without await
**How to avoid:** Use assert_awaited_once() for AsyncMock (not assert_called_once())
**Warning signs:** RuntimeWarning about coroutine never awaited, test passes but mock assertions don't work

### Pitfall 3: Integration Tests Mock Internal Aggregation Logic
**What goes wrong:** Test mocks _find_containing_features() defeating the purpose of integration testing
**Why it happens:** Confusion about what to mock — only external dependencies (API clients) should be mocked
**How to avoid:** Integration tests mock httpx.AsyncClient responses, NOT internal helpers
**Warning signs:** Integration test doesn't actually test spatial intersection logic

### Pitfall 4: ARQ Pool Tests Without Lifespan Context
**What goes wrong:** Test expects app.state.arq_pool to exist but gets AttributeError
**Why it happens:** FastAPI lifespan only runs when AsyncClient context manager is entered
**How to avoid:** Wrap test in `async with AsyncClient(transport=ASGITransport(app=app)) as client:` block
**Warning signs:** AttributeError: 'State' object has no attribute 'arq_pool'

### Pitfall 5: Forgetting Function-Scoped Table Recreation
**What goes wrong:** Test fails with "constraint violation" or sees data from previous test
**Why it happens:** Project uses direct db.commit() pattern (not transaction rollback), requires explicit table drop/recreate
**How to avoid:** Always use test_db fixture (function-scoped) from conftest.py, which handles table lifecycle
**Warning signs:** Test passes in isolation but fails when run with other tests

### Pitfall 6: AI Parsing Tests Don't Cover Malformed JSON
**What goes wrong:** Production code fails when Claude returns JSON wrapped in markdown code blocks
**Why it happens:** Test only validates happy path with perfect JSON
**How to avoid:** Test with JSON wrapped in ```json\n{...}\n``` and ```{...}```
**Warning signs:** AIParsingError in production with "Invalid JSON structure"

## Code Examples

Verified patterns from project codebase:

### Parametrize Pattern for Aggregator Edge Cases
```python
# Source: Established pytest patterns + zoning aggregator logic
import pytest
from app.services.zoning_aggregator import _extract_building_dimensions
from shapely.geometry import Point

@pytest.mark.parametrize("naam,waarde,expected_field,expected_value", [
    ("bouwhoogte", "12.5", "max_bouwhoogte", 12.5),
    ("max bouwhoogte", "10 meter", "max_bouwhoogte", 10.0),
    ("goothoogte", "8.0", "max_goothoogte", 8.0),
    ("bebouwingspercentage", "60", "max_bebouwingspercentage", 60.0),
    ("bebouwingspercentage", "45%", "max_bebouwingspercentage", 45.0),
])
async def test_extract_building_dimensions_parametrized(
    naam, waarde, expected_field, expected_value
):
    """Test dimension extraction with various Dutch field names and formats."""
    maatvoeringen = [{
        "naam": naam,
        "waarde": waarde,
        "geometrie": {
            "type": "Polygon",
            "coordinates": [[[0, 0], [100, 0], [100, 100], [0, 100], [0, 0]]]
        }
    }]
    property_point = Point(50, 50)

    result = _extract_building_dimensions(maatvoeringen, property_point)

    assert getattr(result, expected_field) == expected_value
```

### Monument Aggregator Multi-Source Testing
```python
# Source: monument_aggregator.py pattern
import pytest
from unittest.mock import AsyncMock
from app.services.monument_aggregator import fetch_monument_status
from app.schemas.monument import MonumentSourceResult

@pytest.fixture
def mock_rce_monument_result():
    """Fixture for RCE monument found."""
    return MonumentSourceResult(
        source="RCE",
        is_monument=True,
        monument_type="rijksmonument",
        monument_nummer="12345",
        monument_naam="Test Monument"
    )

@pytest.fixture
def mock_bag_no_data():
    """Fixture for BAG with no monument data."""
    return MonumentSourceResult(
        source="BAG",
        error="Monument status niet beschikbaar via BAG API"
    )

async def test_monument_status_conflict_detection(
    test_db, org_id, mock_rce_monument_result
):
    """Test conflict detection when sources disagree."""
    # Mock _fetch_rce, _fetch_bag_monument, _fetch_kadaster_monument
    # to return conflicting results
    from unittest.mock import patch

    with patch("app.services.monument_aggregator._fetch_rce") as mock_rce, \
         patch("app.services.monument_aggregator._fetch_bag_monument") as mock_bag, \
         patch("app.services.monument_aggregator._fetch_kadaster_monument") as mock_kadaster:

        # RCE says monument, BAG says not monument
        mock_rce.return_value = MonumentSourceResult(
            source="RCE", is_monument=True, monument_type="rijksmonument"
        )
        mock_bag.return_value = MonumentSourceResult(
            source="BAG", is_monument=False
        )
        mock_kadaster.return_value = MonumentSourceResult(
            source="Kadaster", error="Not available"
        )

        result = await fetch_monument_status(
            x=121687.0, y=487484.0,
            pand_id=None, verblijfsobject_id=None,
            client=AsyncMock(), organization_id=org_id,
            session=test_db
        )

        assert result.has_conflict is True
        assert "niet eens" in result.conflict_note
        assert result.consensus_status is None
```

### Direct Database Assertions Pattern
```python
# Source: test_cache_manager.py (08-02 decision)
from sqlalchemy import select
from app.models.cached_response import CachedAPIResponse

async def test_zoning_data_stored_in_cache(test_db, org_id):
    """Verify aggregator stores result in cache table."""
    from app.services.zoning_aggregator import fetch_zoning_data
    from tests.api_mocks import make_mock_client, make_mock_response

    # Mock API responses
    mock_client = make_mock_client(get=make_mock_response(json_data={"features": []}))

    # Execute aggregator
    await fetch_zoning_data(
        x=121687.0, y=487484.0,
        client=mock_client,
        organization_id=org_id,
        session=test_db
    )

    # Direct DB assertion (NOT mock-based)
    stmt = select(CachedAPIResponse).where(
        CachedAPIResponse.organization_id == org_id,
        CachedAPIResponse.source == "dso"
    )
    cached_entry = (await test_db.execute(stmt)).scalar_one_or_none()

    assert cached_entry is not None
    assert cached_entry.cache_key.startswith("dso:zoning:")
    assert "plans" in cached_entry.response_data
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| unittest.mock.Mock for async | unittest.mock.AsyncMock | Python 3.8+ | Proper await support, assert_awaited methods |
| shapely 1.x with __geo_interface__ | shapely 2.0+ with shape() | Shapely 2.0 (2022) | Faster GEOS bindings, better typing |
| pytest-asyncio fixture mode | pytest-asyncio auto mode | 0.23.8+ | No @pytest.mark.asyncio needed on tests |
| on_event("startup") decorator | lifespan context manager | FastAPI 0.93+ | Proper async context management, cleanup |

**Deprecated/outdated:**
- **pytest.fixture(scope="session") for async DB:** Project uses function-scoped fixtures for isolation due to direct commit pattern (established in Phase 7)
- **TestClient for FastAPI:** AsyncClient with ASGITransport required for async endpoint testing (07-01 decision)
- **app.state.limiter replacement:** Must set limiter.enabled=False (decorators bind at import time) (07-01 decision)

## Open Questions

Things that couldn't be fully resolved:

1. **ARQ worker testing strategy (unit vs integration)**
   - What we know: Production uses real Redis, FastAPI lifespan creates pool via create_pool(get_redis_settings())
   - What's unclear: Should tests (a) skip ARQ integration entirely, (b) use fakeredis, or (c) require Redis running for integration tests
   - Recommendation: For Phase 9, test lifespan integration (pool creation/shutdown) but skip actual job execution tests — defer worker execution testing to Phase 10 or mark as requiring Redis

2. **Shapely prepared geometries for performance**
   - What we know: shapely.prepared.prep() optimizes repeated contains/intersects checks
   - What's unclear: Whether aggregators should use prepared geometries given they process 1-3 plans per request
   - Recommendation: Skip prepared geometries for now (premature optimization), revisit if performance testing shows bottleneck

3. **AI parsing integration tests (real Claude API calls)**
   - What we know: Unit tests mock AsyncAnthropic.messages.create, integration tests need real API validation
   - What's unclear: Whether Phase 9 should include live Claude API tests or defer to manual testing
   - Recommendation: Defer live Claude API integration tests (require API key, slow, cost) — Phase 9 focuses on mocked unit tests only

## Sources

### Primary (HIGH confidence)
- [pytest documentation - How to use fixtures](https://docs.pytest.org/en/stable/how-to/fixtures.html) - Fixture scopes, parametrize patterns
- [pytest documentation - How to parametrize](https://docs.pytest.org/en/stable/how-to/parametrize.html) - Parametrize decorator usage
- [Python unittest.mock documentation](https://docs.python.org/3/library/unittest.mock.html) - AsyncMock, MagicMock, spec usage
- [Shapely 2.1.2 User Manual](https://shapely.readthedocs.io/en/stable/manual.html) - Geometry operations, shape() function
- [shapely.intersects documentation](https://shapely.readthedocs.io/en/2.1.2/reference/shapely.intersects.html) - Spatial intersection API
- [arq documentation v0.27.0](https://arq-docs.helpmanual.io/) - WorkerSettings, create_pool, lifecycle hooks
- [Anthropic Python SDK](https://github.com/anthropics/anthropic-sdk-python) - AsyncAnthropic usage

### Secondary (MEDIUM confidence)
- [async test patterns for Pytest](https://tonybaloney.github.io/posts/async-test-patterns-for-pytest-and-unittest.html) - AsyncMock patterns verified with official docs
- [ARQ + SQLAlchemy - Async done right](https://wazaari.dev/blog/arq-sqlalchemy-done-right) - Lifecycle integration patterns
- [FastAPI Application Lifecycle Management 2025](https://craftyourstartup.com/cys-docs/fastapi-startup-and-shutdown-events-guide/) - Lifespan context manager patterns
- [Point in Polygon & Intersect](https://automating-gis-processes.github.io/CSC18/lessons/L4/point-in-polygon.html) - Shapely spatial testing examples
- [Using the arq Redis queue client - Safir](https://safir.lsst.io/user-guide/arq.html) - ARQ testing with mock mode

### Tertiary (LOW confidence)
- [How to Use pytest Parametrize](https://oneuptime.com/blog/post/2026-02-02-pytest-parametrize-guide/view) - Recent 2026 content but general patterns
- [A Complete Guide to Data Engineering Testing with Python: Best Practices for 2024](https://medium.com/@datainsights17/a-complete-guide-to-data-engineering-testing-with-python-best-practices-for-2024-bd0d9be2d9ca) - Aggregation testing principles

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in project, established patterns from Phases 7-8
- Architecture: HIGH - Test structure follows existing unit/integration split, conftest.py patterns
- Pitfalls: HIGH - Identified from project code review and established decisions
- ARQ testing strategy: MEDIUM - Multiple valid approaches, project needs to choose (unit vs integration)
- AI parsing integration tests: LOW - Unclear if live Claude API tests are in scope for Phase 9

**Research date:** 2026-02-07
**Valid until:** 30 days (stable testing patterns, libraries mature)
