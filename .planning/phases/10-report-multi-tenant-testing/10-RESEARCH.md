# Phase 10: Report & Multi-Tenant Testing - Research

**Researched:** 2026-02-07
**Domain:** Integration testing for report CRUD, PDF export unit testing, multi-tenant security verification
**Confidence:** HIGH

## Summary

This research covers three testing domains required to complete Phase 10: (1) Report CRUD integration tests following established patterns from cache manager and aggregator tests; (2) PDF export unit tests for Jinja2 template rendering and WeasyPrint PDF generation; (3) Multi-tenant isolation integration tests verifying cross-organization data leaks are impossible across all system layers (auth, reports, cache, API calls).

The codebase already has 200 passing tests across auth, API clients, cache, and aggregators, establishing strong patterns for async integration tests with real database operations, mock-based unit tests, and multi-tenant isolation verification. Phase 10 extends these patterns to the report management subsystem and adds comprehensive cross-system isolation tests.

**Primary recommendation:** Follow existing test patterns exactly—AsyncClient for integration tests with real DB (test_cache_manager.py pattern), unittest.mock for unit tests (test_claude_client.py pattern), and multi-org fixtures for isolation tests (two_orgs fixture pattern). Test WeasyPrint synchronously with HTML string validation, avoid introducing new test dependencies.

## Standard Stack

The established testing stack from Phases 7-9 requires no new dependencies:

### Core Testing Libraries
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| pytest | 7.4.0+ | Test framework | Python community standard, native async support via pytest-asyncio |
| pytest-asyncio | 0.21.0+ | Async test support | Required for FastAPI/SQLAlchemy async testing, function-scoped event loop |
| httpx | 0.27.0+ | HTTP client for API tests | FastAPI's recommended test client, AsyncClient + ASGITransport pattern |
| unittest.mock | stdlib | Mocking framework | No new dependencies decision (Phase 8), MagicMock/AsyncMock proven sufficient |

### Supporting Libraries (Already in Project)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| WeasyPrint | 68.0+ | PDF generation (production) | Test PDF generation synchronously (CPU-bound) |
| Jinja2 | 3.1.0+ | Template rendering | Test template rendering with mock contexts |
| SQLAlchemy | 2.0.25+ | Database ORM | Direct DB assertions for integration tests |
| asyncpg | 0.29.0+ | Async PostgreSQL driver | Test database creation in conftest.py |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| pytest-asyncio | pytest-trio | Trio not used in production, pytest-asyncio matches FastAPI/SQLAlchemy patterns |
| unittest.mock | pytest-mock | No benefit, adds dependency, team prefers stdlib |
| Real DB tests | In-memory SQLite | SQLite doesn't support PostgreSQL features (JSONB, RLS, UUID), false confidence |

**Installation:**
No new dependencies required. All testing libraries already present in pyproject.toml.

## Architecture Patterns

### Recommended Test Structure (Existing Pattern)
```
backend/tests/
├── unit/                      # Fast, isolated, no DB
│   ├── test_jwt.py           # Crypto operations, mocked
│   ├── test_password.py      # Hash/verify, mocked
│   ├── test_*_client.py      # API clients with httpx mocks
│   ├── test_*_aggregator.py  # Business logic with API mocks
│   └── test_pdf_export.py    # NEW: Template + WeasyPrint unit tests
├── integration/               # Slow, real DB, full stack
│   ├── test_auth_flow.py     # Auth lifecycle (register → login → call)
│   ├── test_auth_errors.py   # Error cases, edge conditions
│   ├── test_cache_manager.py # Cache CRUD + multi-tenant isolation
│   ├── test_*_integration.py # Aggregator full pipeline tests
│   ├── test_report_crud.py   # NEW: Report save/list/search/delete
│   └── test_multi_tenant.py  # NEW: Cross-org leak prevention
├── conftest.py                # Shared fixtures (test_db, async_client, etc.)
└── api_mocks.py              # Shared mock helpers (make_mock_response, etc.)
```

### Pattern 1: Report CRUD Integration Tests (Real Database)

**What:** Test report service layer (save, list, get, search, delete) against real PostgreSQL database with multi-tenant isolation.

**When to use:** Testing business logic that involves database queries, JSONB storage, filtering, sorting, pagination.

**Example:**
```python
# Follow test_cache_manager.py pattern
import uuid
import pytest
from sqlalchemy import select
from app.models.report import SavedReport
from app.reports import service

@pytest.fixture
async def org_id(test_db):
    """Create test organization and return ID."""
    org = Organization(name="Report Test Org")
    test_db.add(org)
    await test_db.flush()
    await test_db.commit()
    return org.id

class TestReportCRUD:
    async def test_save_report(self, test_db, org_id):
        """Test saving a report stores JSONB and denormalized fields."""
        report_data = {
            "address": {
                "straatnaam": "Teststraat",
                "huisnummer": "123",
                "postcode": "1234 AB",
                "woonplaats": "Amsterdam"
            },
            "completeness_score": 0.85,
            # ... full PropertyReportResponse
        }

        report = await service.save_report(
            report_data=report_data,
            notes="Test notes",
            project_id=None,
            organization_id=org_id,
            session=test_db,
        )

        # Direct DB assertion
        stmt = select(SavedReport).where(SavedReport.id == report.id)
        row = (await test_db.execute(stmt)).scalar_one()
        assert row.postcode == "1234 AB"
        assert row.city == "Amsterdam"
        assert row.report_data["completeness_score"] == 0.85
```

**Source:** Existing test_cache_manager.py pattern (Phase 8)

### Pattern 2: PDF Export Unit Tests (Synchronous, Mocked)

**What:** Test Jinja2 template rendering produces valid HTML and WeasyPrint generates valid PDF bytes. No real file I/O, validate structure only.

**When to use:** Testing CPU-bound synchronous PDF generation without async overhead.

**Example:**
```python
# Unit test for PDF export (synchronous)
from unittest.mock import patch, MagicMock
from app.reports.pdf_export import generate_report_pdf

class TestPDFExport:
    def test_template_renders_valid_html(self):
        """Test Jinja2 template rendering with mock data."""
        report_data = {
            "address": {"straatnaam": "Test", "huisnummer": "1", "postcode": "1234 AB", "woonplaats": "City"},
            "completeness_score": 0.9,
        }

        # Call synchronous function directly (no await)
        with patch('app.reports.pdf_export.HTML') as mock_html:
            mock_html.return_value.write_pdf.return_value = b'%PDF-1.4 fake pdf bytes'

            pdf_bytes = generate_report_pdf(report_data, "Test Report")

            # Verify HTML was created from string
            mock_html.assert_called_once()
            call_kwargs = mock_html.call_args.kwargs
            assert 'string' in call_kwargs
            html_string = call_kwargs['string']

            # Validate HTML structure
            assert '<!DOCTYPE html>' in html_string
            assert 'Test Report' in html_string
            assert '1234 AB' in html_string
            assert 'weasyprint' not in html_string.lower()  # No imports in HTML

    def test_weasyprint_generates_pdf_bytes(self):
        """Test WeasyPrint PDF generation produces valid PDF output."""
        report_data = {"address": {...}, "completeness_score": 0.8}

        pdf_bytes = generate_report_pdf(report_data, "Real Test")

        # Validate PDF magic bytes
        assert pdf_bytes.startswith(b'%PDF')
        assert len(pdf_bytes) > 100  # Non-trivial PDF
```

**Sources:**
- [Python PDF Generation from HTML with WeasyPrint](https://dev.to/bowmanjd/python-pdf-generation-from-html-with-weasyprint-538h)
- [An Exploration into Jinja2 Unit Tests With Pytest](https://pwan.org/blog/an-exploration-into-jinja2-unit-tests-wth-pytest.html)

### Pattern 3: Multi-Tenant Isolation Tests (Real Database, Multiple Organizations)

**What:** Verify cross-organization data leaks are impossible by creating two orgs, attempting to access org A's data with org B's credentials, and asserting 404 responses (not 403, prevents enumeration).

**When to use:** Security-critical features where tenant isolation must be verified end-to-end.

**Example:**
```python
# Follow test_cache_manager.py two_orgs fixture pattern
@pytest.fixture
async def two_orgs_with_users(test_db, create_test_user):
    """Create two orgs with users and return auth context."""
    user_a, org_a = await create_test_user(email="a@test.com", org_name="Org A")
    user_b, org_b = await create_test_user(email="b@test.com", org_name="Org B")
    return (user_a, org_a), (user_b, org_b)

class TestMultiTenantIsolation:
    async def test_report_access_cross_org_returns_404(
        self, async_client, test_db, two_orgs_with_users
    ):
        """Test org B cannot access org A's saved report (404 not 403)."""
        (user_a, org_a), (user_b, org_b) = two_orgs_with_users

        # Org A saves a report
        report_a = await service.save_report(
            report_data={...},
            organization_id=org_a.id,
            session=test_db,
        )

        # Org B tries to access it (with valid JWT for org B)
        token_b = create_jwt_token(user_b.id, org_b.id)
        response = await async_client.get(
            f"/api/reports/{report_a.id}",
            headers={"Authorization": f"Bearer {token_b}"}
        )

        # Should be 404 (not 403) to prevent resource enumeration
        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()
```

**Source:** Existing test_cache_manager.py TestMultiTenantIsolation class

### Anti-Patterns to Avoid

- **Mocking the database in integration tests:** Defeats the purpose—use real DB to catch SQL errors, RLS violations, JSONB issues
- **Using TestClient for async endpoints:** TestClient is synchronous, use AsyncClient + ASGITransport (established in Phase 7)
- **Testing PDF visual rendering:** Out of scope, validate structure/content only (no Selenium, no screenshot comparison)
- **New test dependencies for mocking:** Use unittest.mock only (Phase 8 decision)
- **Hard-coding organization IDs in tests:** Use fixtures to create orgs dynamically (prevents test pollution)

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Async test event loop | Custom event loop fixture | pytest-asyncio with asyncio_mode="auto" | Handles loop lifecycle, cleanup, function vs session scope |
| Test database isolation | Manual table truncation | Function-scoped table drop/recreate | Direct commit pattern prevents transaction rollback isolation |
| PDF validation | Custom PDF parser | Check magic bytes (b'%PDF') + length | WeasyPrint PDF structure is implementation detail |
| Multi-org test data | Hardcoded UUIDs | Fixtures with Organization creation | Prevents conflicts, tests RLS enforcement |
| Mock HTTP responses | Custom mock classes | api_mocks.py helpers (MagicMock(spec=httpx.Response)) | Consistent with Phase 8 patterns |

**Key insight:** The codebase has 200 tests establishing robust patterns. Don't reinvent—copy existing test structure for consistency and maintainability.

## Common Pitfalls

### Pitfall 1: Forgetting to Disable Rate Limiter in Tests
**What goes wrong:** Tests hit rate limits and fail intermittently with 429 errors.

**Why it happens:** Route decorators bind to module-level `limiter` object at import time, replacing `app.state.limiter` has no effect.

**How to avoid:** Use `limiter.enabled = False` on the module-level limiter in conftest.py async_client fixture:
```python
from app.middleware.rate_limit import limiter as app_limiter
app_limiter.enabled = False
```

**Warning signs:** Tests fail with "Rate limit exceeded" or 429 status codes.

**Source:** Phase 7 decision (07-01 TEST-04)

### Pitfall 2: Testing WeasyPrint with Async Patterns
**What goes wrong:** PDF generation tests have unnecessary `await` calls or async fixtures, adding complexity without benefit.

**Why it happens:** All other tests are async, developers assume PDF tests should be too.

**How to avoid:** WeasyPrint is CPU-bound and synchronous. Test `generate_report_pdf()` as a regular function, not async. Use `def test_*` not `async def test_*`:
```python
def test_pdf_generation():  # NOT async def
    pdf_bytes = generate_report_pdf(data, name)  # NOT await
    assert pdf_bytes.startswith(b'%PDF')
```

**Warning signs:** `TypeError: object bytes can't be used in 'await' expression`

**Source:** WeasyPrint documentation (synchronous API)

### Pitfall 3: Insufficient Multi-Tenant Test Coverage
**What goes wrong:** Tests only verify "happy path" isolation (different orgs, different data) but miss edge cases like UUID enumeration attacks, deleted reports leaking via other org's queries.

**Why it happens:** Developers test what they expect to work, not what attackers will try.

**How to avoid:** Test matrix approach:
- Cross-org access (org B reads org A's report → 404)
- Cross-org cache (same cache key, different orgs → independent entries)
- Cross-org API calls (org B's JWT can't trigger org A's API calls)
- Soft-deleted reports (org A deletes, org B can't see it existed)
- Same-user different-org (user switches orgs, data stays isolated)

**Warning signs:** Security tests only check "org A vs org B" but not edge cases.

**Source:** [Multi-Tenant Leakage: When "Row-Level Security" Fails in SaaS](https://medium.com/@instatunnel/multi-tenant-leakage-when-row-level-security-fails-in-saas-da25f40c788c)

### Pitfall 4: Direct Commit Pattern in Test DB Setup
**What goes wrong:** Tests create organizations with `test_db.add(org)` but forget `await test_db.flush()` before accessing `org.id`, causing `None` IDs.

**Why it happens:** SQLAlchemy doesn't assign IDs until flush/commit (server-default UUID generation).

**How to avoid:** Always follow the pattern from conftest.py:
```python
org = Organization(name="Test Org")
test_db.add(org)
await test_db.flush()  # REQUIRED to get org.id
await test_db.commit()
return org.id  # Now safe to use
```

**Warning signs:** `TypeError: 'NoneType' object is not subscriptable` when using org.id

**Source:** Existing conftest.py org_id fixture (Phase 8)

### Pitfall 5: Testing RLS Policies Without RLS Context
**What goes wrong:** Multi-tenant tests query the database directly without setting `app.current_tenant_id`, RLS policies fail-closed and return 0 rows, tests fail.

**Why it happens:** Direct DB queries bypass FastAPI's `get_db()` which sets RLS context via `SET LOCAL`.

**How to avoid:** Use service layer functions (which use get_db()) OR manually set session variable in test fixtures:
```python
# Option 1: Use service layer (recommended)
report = await service.save_report(..., session=test_db)

# Option 2: Manual RLS context (if direct DB needed)
await test_db.execute(
    text("SET LOCAL app.current_tenant_id = :org_id"),
    {"org_id": str(org_id)},
)
```

**Warning signs:** Queries return empty results even though data exists in database.

**Source:** Phase 6 RLS enforcement implementation (06-03)

## Code Examples

Verified patterns from existing test suite:

### Example 1: Report List Integration Test (Filtering, Pagination)
```python
# Source: Adapted from test_cache_manager.py patterns
class TestReportList:
    async def test_filter_by_city(self, test_db, org_id):
        """Test city filter returns only matching reports."""
        # Save reports in different cities
        await service.save_report(
            report_data={"address": {..., "woonplaats": "Amsterdam"}},
            organization_id=org_id,
            session=test_db,
        )
        await service.save_report(
            report_data={"address": {..., "woonplaats": "Rotterdam"}},
            organization_id=org_id,
            session=test_db,
        )

        # List with city filter
        reports, total = await service.list_reports(
            organization_id=org_id,
            city="Amsterdam",
            project_id=None,
            search_query=None,
            sort_by="created",
            sort_order="desc",
            offset=0,
            limit=50,
            session=test_db,
        )

        assert total == 1
        assert reports[0].city == "Amsterdam"

    async def test_search_by_address(self, test_db, org_id):
        """Test ILIKE search on report_name (address)."""
        await service.save_report(
            report_data={"address": {"straatnaam": "Keizersgracht", ...}},
            organization_id=org_id,
            session=test_db,
        )

        reports, total = await service.list_reports(
            organization_id=org_id,
            city=None,
            project_id=None,
            search_query="keizer",  # Case-insensitive
            sort_by="created",
            sort_order="desc",
            offset=0,
            limit=50,
            session=test_db,
        )

        assert total == 1
        assert "Keizersgracht" in reports[0].report_name
```

### Example 2: PDF Template Rendering Test
```python
# Source: Jinja2 testing patterns
from jinja2 import Environment, FileSystemLoader
from pathlib import Path

def test_report_template_has_required_sections():
    """Test Jinja2 template contains all required report sections."""
    template_dir = Path("backend/app/reports/templates")
    env = Environment(loader=FileSystemLoader(str(template_dir)))
    template = env.get_template("report.html")

    # Mock report data
    context = {
        "report": type('obj', (object,), {'report_name': 'Test Address'})(),
        "report_data": {
            "address": {"straatnaam": "Test", "postcode": "1234 AB"},
            "building": {"bouwjaar": "1990"},
            "completeness_score": 0.85,
        },
        "generated_at": "2026-02-07 12:00 UTC",
    }

    html = template.render(context)

    # Validate sections
    assert "1. Adresgegevens" in html
    assert "2. Gebouwgegevens" in html
    assert "3. Kadastrale Gegevens" in html
    assert "1234 AB" in html
    assert "1990" in html
    assert "85%" in html  # Completeness percentage
```

### Example 3: Multi-Tenant Cache Isolation
```python
# Source: test_cache_manager.py TestMultiTenantIsolation
class TestMultiTenantCacheIsolation:
    async def test_same_cache_key_different_orgs_independent(
        self, test_db, two_orgs
    ):
        """Test same cache key for different orgs stores independent data."""
        org_a, org_b = two_orgs

        # Both orgs query same address (same cache key)
        cache_key = "bag:nummeraanduiding:0363200000406628"

        fetch_a = AsyncMock(return_value={"org": "A", "data": "org_a_specific"})
        fetch_b = AsyncMock(return_value={"org": "B", "data": "org_b_specific"})

        result_a = await get_cached_or_fetch(
            cache_key=cache_key,
            source="bag",
            organization_id=org_a,
            fetch_fn=fetch_a,
            session=test_db,
        )
        result_b = await get_cached_or_fetch(
            cache_key=cache_key,
            source="bag",
            organization_id=org_b,
            fetch_fn=fetch_b,
            session=test_db,
        )

        # Both fetched (not shared cache)
        fetch_a.assert_called_once()
        fetch_b.assert_called_once()

        # Data is organization-specific
        assert result_a.data["org"] == "A"
        assert result_b.data["org"] == "B"
```

### Example 4: Soft Delete Multi-Tenant Test
```python
# Source: New pattern for report deletion isolation
class TestReportDeletion:
    async def test_deleted_report_invisible_to_all_orgs(
        self, test_db, two_orgs_with_users, async_client
    ):
        """Test soft-deleted report is invisible even with valid auth."""
        (user_a, org_a), (user_b, org_b) = two_orgs_with_users

        # Org A creates and deletes a report
        report_a = await service.save_report(
            report_data={...},
            organization_id=org_a.id,
            session=test_db,
        )
        await service.soft_delete_report(
            report_id=report_a.id,
            organization_id=org_a.id,
            session=test_db,
        )

        # Org A can't see it in list
        token_a = create_jwt_token(user_a.id, org_a.id)
        response = await async_client.get(
            "/api/reports",
            headers={"Authorization": f"Bearer {token_a}"}
        )
        assert response.status_code == 200
        assert response.json()["total"] == 0

        # Org B can't see it either (even with UUID)
        token_b = create_jwt_token(user_b.id, org_b.id)
        response = await async_client.get(
            f"/api/reports/{report_a.id}",
            headers={"Authorization": f"Bearer {token_b}"}
        )
        assert response.status_code == 404
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| TestClient for async APIs | AsyncClient + ASGITransport | Phase 7 (2026-02) | Proper async support, no event loop blocking |
| Transaction rollback isolation | Function-scoped table drop/recreate | Phase 7 (2026-02) | Works with direct commit pattern (not async with db.begin()) |
| Manual mock classes | api_mocks.py helpers (MagicMock spec) | Phase 8 (2026-02) | Consistent mocking, no new dependencies |
| Superuser DB connection | app_role with RLS enforcement | Phase 6 (2026-02) | Defense-in-depth, catches application bugs at DB layer |
| WeasyPrint visual testing | Magic bytes + structure validation | Current (2026) | CPU-bound testing, no browser automation needed |

**Deprecated/outdated:**
- **TestClient:** Use AsyncClient for all FastAPI async endpoint tests (Phase 7 established)
- **Transaction-based test isolation:** Use function-scoped create_all/drop_all (required for direct commit pattern)
- **Custom mock utilities:** Use api_mocks.py make_mock_response/make_mock_client (Phase 8 decision)

## Open Questions

1. **Coverage threshold enforcement**
   - What we know: Phase 10 success criteria requires 80%+ backend coverage
   - What's unclear: Whether this is enforced via pytest-cov --cov-fail-under or manual check
   - Recommendation: Add `--cov=app --cov-report=term-missing --cov-fail-under=80` to test command, blocks merge if not met

2. **PDF export error handling tests**
   - What we know: WeasyPrint can raise exceptions on invalid CSS or missing fonts
   - What's unclear: Whether to test error recovery (fallback to basic template) or fail-fast
   - Recommendation: Test that exceptions propagate to caller (fail-fast), let endpoint return 500 with error detail

3. **Report CRUD transaction scope**
   - What we know: Service layer uses direct db.commit() pattern (not async with db.begin())
   - What's unclear: Whether report operations should be wrapped in try/except with rollback
   - Recommendation: Follow existing pattern—service functions commit directly, endpoint catches exceptions and returns HTTPException

## Sources

### Primary (HIGH confidence)
- **Existing test suite** - backend/tests/ (200 tests, 4,178 LOC establishing patterns)
- **conftest.py fixtures** - test_db, async_client, create_test_user, two_orgs patterns
- **api_mocks.py** - Shared mock helpers (Phase 8 established)
- **Phase 6-9 implementation** - RLS enforcement, cache patterns, aggregator tests
- **pyproject.toml** - Current test dependencies (pytest, pytest-asyncio, httpx)

### Secondary (MEDIUM confidence)
- [Python PDF Generation from HTML with WeasyPrint](https://dev.to/bowmanjd/python-pdf-generation-from-html-with-weasyprint-538h) - PDF testing basics
- [An Exploration into Jinja2 Unit Tests With Pytest](https://pwan.org/blog/an-exploration-into-jinja2-unit-tests-wth-pytest.html) - Template testing patterns
- [Multi-Tenant Leakage: When "Row-Level Security" Fails in SaaS](https://medium.com/@instatunnel/multi-tenant-leakage-when-row-level-security-fails-in-saas-da25f40c788c) - Security testing considerations
- [5 FastAPI Multi-Tenant Isolation Strategies That Scale](https://medium.com/@Praxen/5-fastapi-multi-tenant-isolation-strategies-that-scale-fd536fef5f88) - Multi-tenancy patterns

### Tertiary (LOW confidence)
- WebSearch results on WeasyPrint testing - General testing approaches, no Propdex specific context
- WebSearch results on Jinja2 mocking - General patterns, not validated against project patterns

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All dependencies already in project, 200 tests establish patterns
- Architecture patterns: HIGH - Direct examples from existing test suite (test_cache_manager.py, test_auth_flow.py)
- Pitfalls: HIGH - All derived from actual Phase 6-9 decisions and implementation issues encountered
- Multi-tenant testing: HIGH - RLS implementation from Phase 6, isolation tests from Phase 8 provide proven patterns

**Research date:** 2026-02-07
**Valid until:** 60 days (stable stack, no new dependencies, established patterns unlikely to change)

**Key constraints:**
- No new test dependencies (Phase 8 decision: unittest.mock only)
- Follow direct commit pattern (no async with db.begin(), Phase 6 established)
- Real database for integration tests (Phase 7 decision: function-scoped table drop/recreate)
- AsyncClient + ASGITransport for API tests (Phase 7 decision: not TestClient)
- Rate limiter disabled via `limiter.enabled = False` (Phase 7 decision: decorator-level binding)

**Test count target:** Phase 10 should add approximately 25-35 tests:
- Report CRUD integration: 12-15 tests (save, list, get, search, delete, filters, pagination, soft delete)
- PDF export unit: 8-10 tests (template rendering, WeasyPrint generation, error handling, edge cases)
- Multi-tenant isolation: 8-10 tests (auth tokens, reports, cache, API calls, soft delete, cross-org access)
- **Total estimated:** 225-235 tests (200 current + 25-35 new)
