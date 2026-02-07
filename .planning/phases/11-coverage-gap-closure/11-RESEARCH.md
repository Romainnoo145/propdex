# Phase 11: Coverage Gap Closure - Research

**Researched:** 2026-02-08
**Domain:** Integration testing for orchestrators, HTTP endpoint testing, freshness detection logic testing
**Confidence:** HIGH

## Summary

Phase 11 focuses on closing specific test coverage gaps identified by the v1.1 milestone audit: property aggregator orchestration (0 tests, 16% coverage), freshness detection logic (0 tests, 20% coverage), and router HTTP endpoints (properties router 0 tests, reports router 4 uncovered endpoints). The project has 233 passing tests across 10 phases with well-established patterns: httpx AsyncClient + ASGITransport for HTTP testing, unittest.mock for mocking, function-scoped table drop/recreate for isolation, and shared fixtures in conftest.py.

The standard approach for this gap closure is: (1) property aggregator integration tests using mocked internal fetch functions (NOT external APIs) to verify BAG→parallel fetch→merge orchestration flow, (2) freshness detection unit tests with mock organization thresholds and cache entries to validate threshold comparison and section mapping logic, (3) properties router HTTP tests verifying POST /api/properties/lookup through AsyncClient with auth headers and validation errors, and (4) reports router HTTP tests covering POST /api/reports, GET /api/reports/:id/pdf, GET /api/reports/:id/freshness, and DELETE /api/reports/:id with multi-tenant isolation verification.

**Primary recommendation:** Follow established project patterns (unittest.mock only, AsyncClient for HTTP, real DB for integration tests) while focusing on orchestration flow validation and HTTP-level contract testing to close coverage gaps without duplicating existing unit tests.

## Standard Stack

The established libraries/tools for this domain:

### Core Testing Framework
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| pytest | >=7.4.0 | Test framework | Async support, parametrize, established in project |
| pytest-asyncio | >=0.21.0 | Async test support | Auto mode enabled in pyproject.toml |
| unittest.mock | stdlib | Mocking | AsyncMock for async, MagicMock for sync, no new dependencies |
| httpx | >=0.27.0 | HTTP testing | AsyncClient with ASGITransport for FastAPI endpoint testing |

### Project-Specific Testing Infrastructure
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| sqlalchemy | >=2.0.0 | DB testing | Real database with function-scoped table recreation |
| asyncpg | >=0.29.0 | Test DB creation | Test database setup in conftest.py |
| fastapi | >=0.115.0 | App testing | Dependency overrides for test DB injection |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| unittest.mock.AsyncMock | pytest-mock | User decision: no new test dependencies (established in Phase 7) |
| Real database | Mock-based | User decision: integration tests verify real DB behavior (Phase 8 pattern) |
| AsyncClient | TestClient | AsyncClient required for async FastAPI apps (established in conftest.py) |

**Installation:**
All dependencies already present in pyproject.toml dev dependencies. No new packages required.

## Architecture Patterns

### Recommended Test Structure
```
backend/tests/
├── integration/
│   ├── test_property_aggregator.py    # NEW: Orchestration flow with mocked fetches
│   ├── test_properties_router.py      # NEW: POST /lookup HTTP-level tests
│   └── test_reports_router.py         # NEW: POST/GET/DELETE HTTP-level tests
├── unit/
│   └── test_freshness.py              # NEW: Threshold logic, section mapping
└── conftest.py                         # Existing: test_db, async_client, create_test_user
```

### Pattern 1: Property Aggregator Integration Tests (Mocked Internal Fetches)
**What:** Test orchestration flow (BAG→parallel fetch→merge) by mocking internal _fetch_* functions, NOT external API clients
**When to use:** Testing aggregate_property_data() end-to-end flow without hitting real APIs
**Why this pattern:** Phase 9 established this pattern for aggregator unit tests — patch internal functions, use real cache/database

**Example:**
```python
# Source: Phase 9 pattern (test_zoning_aggregator.py, test_monument_aggregator.py)
from unittest.mock import AsyncMock, patch
import pytest
import uuid
from app.services.property_aggregator import aggregate_property_data
from app.schemas.address import AddressInput

@pytest.fixture
async def org_id(test_db):
    """Create test organization."""
    from app.models.organization import Organization
    org = Organization(name="Aggregator Test Org")
    test_db.add(org)
    await test_db.flush()
    await test_db.commit()
    return org.id

async def test_aggregator_orchestration_full_flow(test_db, org_id):
    """Test BAG→parallel fetch→merge orchestration with mocked internal fetches."""
    # Mock internal resolve_address function (NOT external BAG client)
    mock_address_resolution = {
        "address": {
            "straat": "Keizersgracht",
            "huisnummer": 123,
            "postcode": "1015 CJ",
            "woonplaats": "Amsterdam"
        },
        "building": {
            "pand_id": "0363100012345678",
            "geometry": {
                "type": "Point",
                "coordinates": [121687.0, 487484.0]
            }
        }
    }

    with patch("app.services.property_aggregator.resolve_address") as mock_resolve, \
         patch("app.services.property_aggregator.fetch_zoning_data") as mock_zoning, \
         patch("app.services.property_aggregator.fetch_monument_status") as mock_monuments:

        mock_resolve.return_value = mock_address_resolution
        mock_zoning.return_value = None  # No zoning at location
        mock_monuments.return_value = None  # No monuments

        # Execute orchestrator
        client = AsyncMock()
        result = await aggregate_property_data(
            input_data=AddressInput(postcode="1015 CJ", huisnummer=123),
            client=client,
            organization_id=org_id,
            session=test_db,
            force_refresh=False,
            arq_pool=None
        )

        # Verify orchestration calls were made in correct order
        mock_resolve.assert_called_once()
        mock_zoning.assert_called_once()  # Parallel fetch happened
        mock_monuments.assert_called_once()  # Parallel fetch happened

        # Verify response schema
        assert result.address.straat == "Keizersgracht"
        assert result.completeness_score > 0.0
        assert "BAG API v2" in [s.source for s in result.data_sources]
```

### Pattern 2: Freshness Detection Unit Tests (Threshold Logic)
**What:** Test check_report_freshness() threshold comparison, section mapping, and edge cases with mocked org/cache
**When to use:** Testing freshness.py logic without real reports or API data
**Why this pattern:** Pure business logic testing — validate threshold math, section-to-cache-key mapping, ISO timestamp parsing

**Example:**
```python
# Source: Service-layer testing pattern (test_report_crud.py)
from unittest.mock import AsyncMock
import pytest
from datetime import datetime, timedelta
from app.reports.freshness import check_report_freshness
from app.models.organization import Organization
from app.models.report import SavedReport
from app.models.cached_response import CachedAPIResponse

@pytest.fixture
async def org_with_threshold(test_db):
    """Create organization with custom freshness threshold."""
    org = Organization(name="Freshness Test Org", freshness_threshold_hours=48)
    test_db.add(org)
    await test_db.flush()
    await test_db.commit()
    return org

@pytest.fixture
async def report_with_old_cache(test_db, org_with_threshold):
    """Create report with cached data from 72 hours ago."""
    old_timestamp = datetime.utcnow() - timedelta(hours=72)

    report_data = {
        "section_sources": [
            {
                "section": "zoning",
                "cached_at": old_timestamp.isoformat() + "Z",
                "sources": [{"source": "DSO API"}]
            }
        ]
    }

    report = SavedReport(
        organization_id=org_with_threshold.id,
        report_name="Test Report",
        postcode="1234 AB",
        city="Amsterdam",
        report_data=report_data
    )
    test_db.add(report)
    await test_db.flush()

    # Create newer cache entry
    cache_entry = CachedAPIResponse(
        organization_id=org_with_threshold.id,
        cache_key="dso:zoning:121687.0:487484.0",
        source="dso",
        response_data={"plans": []},
        fetched_at=datetime.utcnow()
    )
    test_db.add(cache_entry)
    await test_db.commit()

    return report

async def test_freshness_exceeds_threshold(test_db, report_with_old_cache, org_with_threshold):
    """Test that cache 72h newer than saved data (threshold 48h) flags update."""
    result = await check_report_freshness(
        report=report_with_old_cache,
        organization_id=org_with_threshold.id,
        session=test_db
    )

    assert result["has_updates"] is True
    assert len(result["updated_sections"]) == 1
    assert result["updated_sections"][0]["section"] == "zoning"
    assert result["updated_sections"][0]["age_hours"] >= 48

async def test_section_to_cache_mapping(test_db, org_with_threshold):
    """Test that section names correctly map to cache key patterns."""
    # Verify section_to_cache_pattern mapping
    section_mappings = {
        "address": ["bag", "pdok_locatieserver"],
        "building": ["bag"],
        "cadastral": ["pdok_cadastral"],
        "zoning": ["dso"],
        "monuments": ["rce"],
        "ai_parsing": ["ai_parsed"]
    }

    # This test validates the mapping logic is correct
    # (actual implementation test, not just documentation)
    from app.reports.freshness import check_report_freshness
    import inspect
    source = inspect.getsource(check_report_freshness)
    assert '"zoning": ["dso"]' in source or "'zoning': ['dso']" in source
```

### Pattern 3: HTTP Endpoint Tests with AsyncClient
**What:** Test router endpoints via AsyncClient with auth headers, validation, multi-tenant isolation
**When to use:** Testing POST /api/properties/lookup, POST /api/reports, GET /api/reports/:id/pdf, etc.
**Why this pattern:** Established in test_auth_flow.py — AsyncClient + ASGITransport for HTTP contract testing

**Example:**
```python
# Source: test_auth_flow.py, test_multi_tenant.py patterns
import pytest
from httpx import AsyncClient

async def test_lookup_property_success(async_client: AsyncClient, create_test_user):
    """Test POST /api/properties/lookup returns PropertyReportResponse."""
    user, org = await create_test_user()

    # Get access token
    login_response = await async_client.post(
        "/auth/login",
        json={"email": user.email, "password": "TestPass123!"}
    )
    token = login_response.json()["access_token"]

    # Lookup property
    response = await async_client.post(
        "/api/properties/lookup",
        json={"postcode": "1015 CJ", "huisnummer": 123},
        headers={"Authorization": f"Bearer {token}"}
    )

    assert response.status_code == 200
    data = response.json()
    assert "address" in data
    assert "completeness_score" in data
    assert "data_sources" in data

async def test_lookup_property_without_auth_returns_401(async_client: AsyncClient):
    """Test POST /api/properties/lookup requires authentication."""
    response = await async_client.post(
        "/api/properties/lookup",
        json={"postcode": "1015 CJ", "huisnummer": 123}
    )

    assert response.status_code == 401

async def test_save_report_creates_report(async_client: AsyncClient, create_test_user):
    """Test POST /api/reports saves report and returns detail."""
    user, org = await create_test_user()
    login_response = await async_client.post(
        "/auth/login",
        json={"email": user.email, "password": "TestPass123!"}
    )
    token = login_response.json()["access_token"]

    report_data = {
        "report_data": {
            "address": {"straat": "Test", "huisnummer": 1, "postcode": "1234 AB", "woonplaats": "Amsterdam"},
            "completeness_score": 0.8,
            "resolved_at": "2026-02-08T12:00:00Z"
        },
        "notes": "Test report"
    }

    response = await async_client.post(
        "/api/reports",
        json=report_data,
        headers={"Authorization": f"Bearer {token}"}
    )

    assert response.status_code == 201
    data = response.json()
    assert "id" in data
    assert data["report_name"] == "Test 1, Amsterdam"

async def test_export_pdf_returns_pdf(async_client: AsyncClient, create_test_user, test_db):
    """Test GET /api/reports/:id/export/pdf returns PDF file."""
    user, org = await create_test_user()

    # Create report first (via service layer for setup)
    from app.reports import service
    report = await service.save_report(
        report_data={"address": {"straat": "Test", "huisnummer": 1, "postcode": "1234 AB", "woonplaats": "City"}},
        notes=None,
        project_id=None,
        organization_id=org.id,
        session=test_db
    )

    # Get token
    login_response = await async_client.post(
        "/auth/login",
        json={"email": user.email, "password": "TestPass123!"}
    )
    token = login_response.json()["access_token"]

    # Export PDF
    response = await async_client.get(
        f"/api/reports/{report.id}/export/pdf",
        headers={"Authorization": f"Bearer {token}"}
    )

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert len(response.content) > 0  # PDF bytes returned
```

### Pattern 4: Multi-Tenant Isolation in HTTP Tests
**What:** Verify cross-org access returns 404 (not 403) at HTTP level, preventing resource enumeration
**When to use:** Testing multi-tenant isolation for all report endpoints
**Why this pattern:** Established in test_multi_tenant.py — 404 prevents enumeration, tests via HTTP not just service layer

**Example:**
```python
# Source: test_multi_tenant.py pattern
async def test_get_report_cross_org_returns_404(async_client: AsyncClient, create_test_user, test_db):
    """Test org B cannot access org A's report via HTTP (returns 404)."""
    # Create two orgs with users
    user_a, org_a = await create_test_user(email="a@test.com", org_name="Org A")
    user_b, org_b = await create_test_user(email="b@test.com", org_name="Org B")

    # Org A creates report
    from app.reports import service
    report_a = await service.save_report(
        report_data={"address": {"straat": "A", "huisnummer": 1, "postcode": "1000 AA", "woonplaats": "City"}},
        notes=None,
        project_id=None,
        organization_id=org_a.id,
        session=test_db
    )

    # Org B tries to access via HTTP
    login_b = await async_client.post("/auth/login", json={"email": "b@test.com", "password": "TestPass123!"})
    token_b = login_b.json()["access_token"]

    response = await async_client.get(
        f"/api/reports/{report_a.id}",
        headers={"Authorization": f"Bearer {token_b}"}
    )

    # Should be 404 (not 403) to prevent resource enumeration
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()
```

### Anti-Patterns to Avoid

**Anti-pattern 1: Mocking external API clients in integration tests**
- **Bad:** `with patch("httpx.AsyncClient.get")`
- **Good:** `with patch("app.services.property_aggregator.resolve_address")` (internal function)
- **Why:** Phase 9 established pattern — mock internal orchestration functions, not external HTTP clients

**Anti-pattern 2: Duplicating existing unit tests**
- **Bad:** Re-testing individual API clients (already covered in Phase 8)
- **Good:** Focus on orchestration flow gaps (aggregate_property_data coordination)
- **Why:** Property aggregator has 16% coverage because orchestration (not components) is untested

**Anti-pattern 3: Using TestClient for async apps**
- **Bad:** `from fastapi.testclient import TestClient`
- **Good:** `from httpx import AsyncClient` with `ASGITransport(app=app)`
- **Why:** Established in conftest.py — TestClient blocks on async, causing hangs

**Anti-pattern 4: Synchronous test functions for I/O operations**
- **Bad:** `def test_lookup_property()` with database access
- **Good:** `async def test_lookup_property()` with await
- **Why:** All async functions must be awaited (database, HTTP client, service layer)

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Mock HTTP responses | Custom response objects | tests/api_mocks.py `make_mock_response()` | Already established, handles status codes + raise_for_status |
| Test database setup | Manual CREATE DATABASE | conftest.py `test_engine` fixture | Already handles asyncpg connection, pg_trgm extension |
| Auth token generation | Manual JWT creation in tests | `create_test_user` fixture + login flow | Ensures real auth flow, validates token structure |
| Report data factories | Hardcoded dicts in each test | `_make_report_data()` helper | Established in test_report_crud.py, ensures valid schema |

**Key insight:** Phase 7-10 established comprehensive testing infrastructure. Phase 11 should extend existing patterns (api_mocks.py, conftest.py fixtures, service-layer helpers) rather than creating parallel infrastructure.

## Common Pitfalls

### Pitfall 1: Rate Limiter Interfering with Tests
**What goes wrong:** Tests fail with 429 Too Many Requests despite valid requests
**Why it happens:** Rate limiter decorators bind at import time, so replacing `app.state.limiter` has no effect
**How to avoid:** Use `limiter.enabled = False` on module-level limiter in conftest.py
**Warning signs:** Intermittent 429 errors in endpoint tests, especially when running multiple tests in sequence

**Example prevention:**
```python
# Source: conftest.py existing pattern
from app.middleware.rate_limit import limiter as app_limiter
app_limiter.enabled = False  # Before AsyncClient creation
```

### Pitfall 2: Transaction Rollback Pattern Incompatible with Project
**What goes wrong:** Tests fail because changes aren't visible or tests interfere with each other
**Why it happens:** Project uses direct `db.commit()` pattern (not `async with db.begin()`), so transaction rollback doesn't work
**How to avoid:** Use function-scoped table drop/recreate pattern established in conftest.py
**Warning signs:** Tests pass individually but fail when run together, or "transaction already begun" errors

**Example prevention:**
```python
# Source: conftest.py established pattern
@pytest.fixture(scope="function")
async def test_db(test_engine):
    # Create tables before test
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with session_factory() as session:
        yield session

    # Drop tables after test for clean slate
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
```

### Pitfall 3: Mocking at Wrong Abstraction Layer
**What goes wrong:** Tests pass but don't exercise real code paths (false positives)
**Why it happens:** Mocking external HTTP clients instead of internal service functions
**How to avoid:** Mock internal _fetch_* functions in property_aggregator.py, NOT httpx.AsyncClient methods
**Warning signs:** 100% test coverage but production bugs still occur, tests don't catch regressions

**Example of correct mocking:**
```python
# GOOD: Mock internal orchestration function
with patch("app.services.property_aggregator.fetch_zoning_data") as mock_zoning:
    mock_zoning.return_value = None
    result = await aggregate_property_data(...)

# BAD: Mock external HTTP client
with patch("httpx.AsyncClient.get") as mock_get:
    mock_get.return_value = {...}
    result = await aggregate_property_data(...)  # Bypasses cache, internal logic
```

### Pitfall 4: Missing Multi-Tenant Isolation in HTTP Tests
**What goes wrong:** Service-layer tests pass but HTTP endpoints leak cross-org data
**Why it happens:** Dependency injection may not filter by organization_id at router level
**How to avoid:** Test cross-org access via HTTP (not just service layer) to verify auth + filtering together
**Warning signs:** Service layer has org_id filtering but router doesn't pass it through, or JWT doesn't include org_id

**Example verification:**
```python
# Test both service layer AND HTTP level
async def test_cross_org_isolation_http_level(async_client, create_test_user):
    """Verify HTTP endpoint enforces org isolation (not just service layer)."""
    user_a, org_a = await create_test_user(email="a@test.com")
    user_b, org_b = await create_test_user(email="b@test.com")

    # Create resource via service (setup)
    resource = await service.create_resource(org_id=org_a.id, ...)

    # Try to access via HTTP with org B token
    token_b = await get_token_for_user(user_b)
    response = await async_client.get(
        f"/api/resources/{resource.id}",
        headers={"Authorization": f"Bearer {token_b}"}
    )

    assert response.status_code == 404  # Not 403, prevents enumeration
```

### Pitfall 5: Datetime Timezone Mismatch
**What goes wrong:** Tests fail with SQLAlchemy type errors or timestamp comparison failures
**Why it happens:** Database uses TIMESTAMP WITHOUT TIME ZONE, but datetime.now(timezone.utc) creates aware datetimes
**How to avoid:** Use `datetime.utcnow()` (naive UTC) everywhere, NOT `datetime.now(timezone.utc)` (aware)
**Warning signs:** SQLAlchemy errors about "can't compare offset-naive and offset-aware datetimes"

**Example prevention:**
```python
# GOOD: Naive UTC (matches TIMESTAMP WITHOUT TIME ZONE)
from datetime import datetime
timestamp = datetime.utcnow()

# BAD: Aware UTC (type error with TIMESTAMP WITHOUT TIME ZONE)
from datetime import datetime, timezone
timestamp = datetime.now(timezone.utc)  # TypeError
```

## Code Examples

Verified patterns from established project test files:

### Example 1: Property Aggregator Integration Test (Full Orchestration)
```python
# Source: Phase 9 aggregator pattern + property_aggregator.py structure
from unittest.mock import AsyncMock, patch
import pytest
from app.services.property_aggregator import aggregate_property_data
from app.schemas.address import AddressInput

async def test_property_aggregator_parallel_fetch_flow(test_db, org_id):
    """Test orchestration: BAG resolves → parallel fetch (zoning, monuments, cadastral) → merge."""
    # Mock address resolution (sequential step)
    mock_address_data = MagicMock()
    mock_address_data.address = MagicMock(
        straat="Keizersgracht", huisnummer=123, postcode="1015 CJ",
        woonplaats="Amsterdam", verblijfsobject_id="0363010000123456"
    )
    mock_address_data.building = MagicMock(
        pand_id="0363100012345678",
        geometry={"type": "Point", "coordinates": [121687.0, 487484.0]}
    )

    # Mock parallel fetches
    mock_zoning = MagicMock(plans=[], primary_bestemming="Wonen")
    mock_monuments = MagicMock(is_monument=False)

    with patch("app.services.property_aggregator.resolve_address") as m_resolve, \
         patch("app.services.property_aggregator.fetch_zoning_data") as m_zoning, \
         patch("app.services.property_aggregator.fetch_monument_status") as m_monuments, \
         patch("app.services.property_aggregator._cadastral_client.get_parcels_by_point") as m_cadastral:

        m_resolve.return_value = mock_address_data
        m_zoning.return_value = mock_zoning
        m_monuments.return_value = mock_monuments
        m_cadastral.return_value = []

        # Execute
        client = AsyncMock()
        result = await aggregate_property_data(
            input_data=AddressInput(postcode="1015 CJ", huisnummer=123),
            client=client,
            organization_id=org_id,
            session=test_db,
            force_refresh=False,
            arq_pool=None
        )

        # Verify parallel calls were made
        assert m_zoning.called
        assert m_monuments.called
        assert m_cadastral.called

        # Verify response schema
        assert result.address.straat == "Keizersgracht"
        assert result.zoning == mock_zoning
        assert result.monuments == mock_monuments
        assert result.completeness_score > 0.0
```

### Example 2: Freshness Detection Threshold Test
```python
# Source: Service-layer testing pattern (test_report_crud.py) + freshness.py logic
from datetime import datetime, timedelta
import pytest
from app.reports.freshness import check_report_freshness
from app.models.organization import Organization
from app.models.report import SavedReport
from app.models.cached_response import CachedAPIResponse

async def test_freshness_respects_org_threshold(test_db):
    """Test that organization threshold_hours determines update flag."""
    # Create org with 24h threshold
    org = Organization(name="Test Org", freshness_threshold_hours=24)
    test_db.add(org)
    await test_db.flush()
    await test_db.commit()

    # Create report with old cached_at timestamp
    old_time = datetime.utcnow() - timedelta(hours=30)
    report_data = {
        "section_sources": [{
            "section": "zoning",
            "cached_at": old_time.isoformat() + "Z"
        }]
    }
    report = SavedReport(
        organization_id=org.id, report_name="Test", postcode="1234 AB",
        city="City", report_data=report_data
    )
    test_db.add(report)
    await test_db.flush()

    # Create newer cache entry (26h newer, exceeds 24h threshold)
    new_time = datetime.utcnow()
    cache = CachedAPIResponse(
        organization_id=org.id, cache_key="dso:zoning:test",
        source="dso", response_data={}, fetched_at=new_time
    )
    test_db.add(cache)
    await test_db.commit()

    # Check freshness
    result = await check_report_freshness(report, org.id, test_db)

    # 26h age > 24h threshold → should flag update
    assert result["has_updates"] is True
    assert len(result["updated_sections"]) == 1
```

### Example 3: Properties Router HTTP Endpoint Test
```python
# Source: test_auth_flow.py HTTP testing pattern
from httpx import AsyncClient
import pytest

async def test_properties_lookup_http_success(async_client: AsyncClient, create_test_user):
    """Test POST /api/properties/lookup via HTTP with auth."""
    user, org = await create_test_user()

    # Login to get token
    login_resp = await async_client.post(
        "/auth/login",
        json={"email": user.email, "password": "TestPass123!"}
    )
    token = login_resp.json()["access_token"]

    # Call endpoint
    response = await async_client.post(
        "/api/properties/lookup",
        json={"postcode": "1015 CJ", "huisnummer": 123},
        headers={"Authorization": f"Bearer {token}"}
    )

    assert response.status_code == 200
    data = response.json()
    assert "address" in data
    assert "completeness_score" in data

async def test_properties_lookup_validation_error(async_client: AsyncClient, create_test_user):
    """Test POST /api/properties/lookup validates input."""
    user, org = await create_test_user()
    login_resp = await async_client.post(
        "/auth/login",
        json={"email": user.email, "password": "TestPass123!"}
    )
    token = login_resp.json()["access_token"]

    # Invalid postcode format
    response = await async_client.post(
        "/api/properties/lookup",
        json={"postcode": "invalid", "huisnummer": 123},
        headers={"Authorization": f"Bearer {token}"}
    )

    assert response.status_code == 422  # Validation error
```

### Example 4: Reports Router Multi-Tenant Isolation HTTP Test
```python
# Source: test_multi_tenant.py cross-org pattern
from httpx import AsyncClient
import pytest

async def test_reports_pdf_export_cross_org_returns_404(
    async_client: AsyncClient, create_test_user, test_db
):
    """Test GET /api/reports/:id/export/pdf enforces org isolation via HTTP."""
    # Create two orgs
    user_a, org_a = await create_test_user(email="a@test.com", org_name="Org A")
    user_b, org_b = await create_test_user(email="b@test.com", org_name="Org B")

    # Org A creates report
    from app.reports import service
    report_a = await service.save_report(
        report_data={
            "address": {"straat": "A", "huisnummer": 1, "postcode": "1000 AA", "woonplaats": "City"},
            "completeness_score": 0.8, "resolved_at": "2026-02-08T12:00:00Z"
        },
        notes=None, project_id=None, organization_id=org_a.id, session=test_db
    )

    # Org B tries to export PDF
    login_b = await async_client.post(
        "/auth/login",
        json={"email": "b@test.com", "password": "TestPass123!"}
    )
    token_b = login_b.json()["access_token"]

    response = await async_client.get(
        f"/api/reports/{report_a.id}/export/pdf",
        headers={"Authorization": f"Bearer {token_b}"}
    )

    # Should return 404 (not 403) to prevent enumeration
    assert response.status_code == 404
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| TestClient for async apps | AsyncClient + ASGITransport | Phase 7 (conftest.py) | Prevents blocking on async operations |
| pytest-mock library | unittest.mock (stdlib) | Phase 7 (user decision) | No new dependencies, AsyncMock sufficient |
| Transaction rollback for isolation | Function-scoped table drop/recreate | Phase 7 (project pattern) | Works with direct db.commit() pattern |
| Mocking external API clients | Mocking internal orchestration functions | Phase 9 (aggregator tests) | Tests real cache, error handling, DB queries |
| Manual test data creation | Factory functions (_make_report_data) | Phase 10 (report tests) | Consistent schema, reduces duplication |

**Deprecated/outdated:**
- **TestClient:** Use AsyncClient (conftest.py established pattern)
- **Transaction rollback:** Use table drop/recreate (project uses direct commit)
- **pytest-mock:** Use unittest.mock (user decision: no new test dependencies)

## Open Questions

Things that couldn't be fully resolved:

1. **Property aggregator ARQ pool dependency**
   - What we know: aggregate_property_data accepts optional arq_pool parameter for AI parsing trigger
   - What's unclear: Whether integration tests should mock arq_pool or use None (skips AI parsing)
   - Recommendation: Use arq_pool=None in integration tests (AI parsing trigger is tested separately in Phase 9 test_arq_lifecycle.py). Focus on orchestration flow, not AI parsing trigger.

2. **Cadastral client as module-level singleton**
   - What we know: property_aggregator.py has `_cadastral_client = PDOKCadastralClient()` at module level
   - What's unclear: Whether to patch _cadastral_client or internal fetch_cadastral_parcels nested function
   - Recommendation: Patch nested `fetch_cadastral_parcels` function inside aggregate_property_data (not module-level client). Consistent with zoning/monument fetch mocking pattern.

3. **Coverage target verification**
   - What we know: Phase 10 VERIFICATION.md shows 67% coverage, target is 80%
   - What's unclear: Exact coverage increase from Phase 11 tests (depends on line counts)
   - Recommendation: Run `pytest --cov=app --cov-report=term-missing` after Phase 11 implementation to verify 80%+ target met. Focus on high-impact gaps: property_aggregator (126 uncovered lines), reports/router (74 uncovered), freshness (37 uncovered).

## Sources

### Primary (HIGH confidence)
- **Project codebase:** backend/app/services/property_aggregator.py (orchestration flow, nested async functions, parallel asyncio.gather pattern)
- **Project codebase:** backend/app/reports/freshness.py (threshold logic, section-to-cache mapping, organization query)
- **Project codebase:** backend/app/properties/router.py (POST /lookup endpoint, auth dependencies, force_refresh parameter)
- **Project codebase:** backend/app/reports/router.py (POST /reports, GET /export/pdf, GET /freshness, DELETE endpoints)
- **Project test patterns:** backend/tests/conftest.py (test_db, async_client, create_test_user fixtures, rate limiter disable)
- **Project test patterns:** backend/tests/integration/test_zoning_integration.py (aggregator integration test pattern with real DB)
- **Project test patterns:** backend/tests/integration/test_report_crud.py (_make_report_data factory, service-layer testing)
- **Project test patterns:** backend/tests/integration/test_auth_flow.py (AsyncClient HTTP testing pattern)
- **Project test patterns:** backend/tests/integration/test_multi_tenant.py (cross-org 404 pattern)
- **Project test patterns:** backend/tests/api_mocks.py (make_mock_response, make_mock_client helpers)
- **.planning/phases/10-report-multi-tenant-testing/10-VERIFICATION.md:** Coverage gaps (property_aggregator 16%, reports/router 44%, freshness 20%)
- **.planning/v1.1-MILESTONE-AUDIT.md:** Gap analysis (5 specific gaps, 80% coverage target)

### Secondary (MEDIUM confidence)
- **Phase 9 research:** .planning/phases/09-intelligence-testing/09-RESEARCH.md (aggregator testing patterns, AsyncMock usage)
- **pytest-asyncio docs:** Auto mode configuration (verified in pyproject.toml)
- **httpx docs:** AsyncClient usage with FastAPI (ASGITransport pattern)

### Tertiary (LOW confidence)
- None — all research based on project codebase and established patterns

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — All libraries already in pyproject.toml, no new dependencies
- Architecture: HIGH — Patterns established in Phase 7-10 tests (conftest.py, api_mocks.py, existing integration tests)
- Pitfalls: HIGH — Based on actual project patterns (rate limiter disable, table drop/recreate, datetime.utcnow())

**Research date:** 2026-02-08
**Valid until:** 2026-03-08 (30 days — testing patterns stable, project-specific context unlikely to change)
