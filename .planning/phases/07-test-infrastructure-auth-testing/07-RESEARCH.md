# Phase 7: Test Infrastructure & Auth Testing - Research

**Researched:** 2026-02-07
**Domain:** FastAPI + SQLAlchemy 2.x async testing with pytest
**Confidence:** HIGH

## Summary

Phase 7 establishes comprehensive test infrastructure for the CRM Plus backend, focusing first on auth module coverage (Phase 1) while building reusable patterns for testing all future phases. The standard stack is pytest + pytest-asyncio + httpx AsyncClient + pytest-cov, following FastAPI's official async testing patterns. Tests must handle SQLAlchemy 2.x async sessions with proper transaction isolation, RLS context injection (critical for multi-tenant testing), and both unit tests (isolated logic) and integration tests (full HTTP request flows against a test database).

Key architectural insight: FastAPI's TestClient does NOT work with async code — you MUST use httpx AsyncClient with ASGITransport for all async route testing. Database fixtures use session-scoped event loops with function-scoped table recreation for proper isolation. RLS testing requires creating non-superuser test roles because superusers bypass RLS policies, creating false security confidence.

**Primary recommendation:** Use pytest-asyncio in auto mode with httpx AsyncClient for all endpoint tests, create test database with RLS-aware fixtures, write unit tests for pure functions (JWT, password hashing) separately from integration tests (full request flows), and establish fixture patterns in conftest.py that all future phases will reuse.

## Standard Stack

The established libraries/tools for FastAPI + SQLAlchemy 2.x async testing:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| pytest | >=7.4.0 | Test framework | Python testing standard, excellent async support, powerful fixture system |
| pytest-asyncio | >=0.21.0 | Async test support | Official pytest plugin for asyncio, handles event loops, enables `async def` tests |
| httpx | >=0.26.0 | Async HTTP client | FastAPI official recommendation for async testing (replaces TestClient for async) |
| pytest-cov | latest | Coverage reporting | Industry standard pytest plugin for measuring test coverage, integrates coverage.py |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| pytest-postgresql | latest | Isolated test DB | Creates temporary PostgreSQL databases per test session, clean slate testing |
| factory_boy | latest | Test data generation | Complex model fixtures with relationships, reduces boilerplate |
| pytest-factoryboy | latest | Factory → fixture integration | Auto-generates pytest fixtures from factory_boy factories |
| faker | latest | Fake data generation | Realistic test data (emails, names, addresses) via factory_boy integration |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| pytest-asyncio | anyio pytest plugin | anyio is more generic (trio/asyncio), but pytest-asyncio is FastAPI standard |
| httpx AsyncClient | TestClient | TestClient CANNOT handle async dependencies — always use AsyncClient for async apps |
| pytest-postgresql | Manual DB setup/teardown | pytest-postgresql automates isolation, prevents test pollution |

**Installation:**
```bash
# Add to pyproject.toml [project.optional-dependencies] dev section:
pytest>=7.4.0
pytest-asyncio>=0.21.0
pytest-cov>=4.1.0
pytest-postgresql>=5.0.0
factory-boy>=3.3.0
pytest-factoryboy>=2.6.0
faker>=20.0.0
```

## Architecture Patterns

### Recommended Project Structure
```
backend/
├── tests/
│   ├── conftest.py          # Shared fixtures (db, client, event_loop)
│   ├── factories.py         # factory_boy model factories
│   ├── unit/                # Pure function tests (no DB/HTTP)
│   │   ├── test_jwt.py
│   │   ├── test_password.py
│   │   └── test_validators.py
│   ├── integration/         # Full request flow tests (DB + HTTP)
│   │   ├── test_auth_flow.py
│   │   ├── test_property_lookup.py
│   │   └── test_rls_isolation.py
│   └── fixtures/            # Domain-specific fixtures (if many)
│       └── auth_fixtures.py
```

### Pattern 1: Session-Scoped Event Loop with Function-Scoped DB
**What:** Event loop lives for entire test session, but database tables are recreated per test function
**When to use:** Always — provides maximum test isolation while avoiding event loop overhead
**Example:**
```python
# Source: https://praciano.com.br/fastapi-and-async-sqlalchemy-20-with-pytest-done-right.html
import pytest
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

@pytest.fixture(scope="session")
def event_loop():
    """Session-scoped event loop for all async fixtures and tests."""
    policy = asyncio.get_event_loop_policy()
    loop = policy.new_event_loop()
    yield loop
    loop.close()

@pytest.fixture(scope="session")
async def test_engine(event_loop):
    """Session-scoped test database engine."""
    engine = create_async_engine(
        "postgresql+asyncpg://user:pass@localhost/test_db",
        pool_size=5,
        echo=False,
    )
    yield engine
    await engine.dispose()

@pytest.fixture(scope="function")
async def test_db(test_engine):
    """Function-scoped DB session with table recreation for isolation."""
    # Create all tables
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Create session factory
    session_factory = async_sessionmaker(test_engine, expire_on_commit=False)
    async with session_factory() as session:
        yield session

    # Drop all tables after test
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
```

### Pattern 2: AsyncClient for FastAPI Testing
**What:** Use httpx AsyncClient with ASGITransport instead of TestClient
**When to use:** All endpoint tests in async FastAPI apps
**Example:**
```python
# Source: https://fastapi.tiangolo.com/advanced/async-tests/
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app

@pytest.fixture
async def async_client(test_db):
    """Async HTTP client for testing FastAPI endpoints."""
    # Override get_db dependency to use test_db
    async def override_get_db():
        yield test_db

    app.dependency_overrides[get_db] = override_get_db

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test"
    ) as client:
        yield client

    app.dependency_overrides.clear()

@pytest.mark.asyncio
async def test_register(async_client):
    """Test user registration endpoint."""
    response = await async_client.post("/auth/register", json={
        "email": "test@example.com",
        "password": "SecurePass123!",
        "full_name": "Test User",
        "organization_name": "Test Org"
    })
    assert response.status_code == 201
    assert "access_token" in response.json()
```

### Pattern 3: Dependency Override for Authentication
**What:** Override get_current_user dependency to skip JWT validation in tests
**When to use:** Testing protected endpoints without full registration flow
**Example:**
```python
# Source: https://plainenglish.io/blog/how-to-mock-fastapi-dependencies-in-pytest
@pytest.fixture
async def authenticated_client(async_client, test_user, test_db):
    """Client with authentication bypassed for protected endpoint testing."""
    async def override_get_current_user():
        return test_user

    app.dependency_overrides[get_current_active_user] = override_get_current_user
    yield async_client
    app.dependency_overrides.clear()

@pytest.mark.asyncio
async def test_get_me(authenticated_client):
    """Test /auth/me endpoint with pre-authenticated client."""
    response = await authenticated_client.get("/auth/me")
    assert response.status_code == 200
    assert response.json()["email"] == "test@example.com"
```

### Pattern 4: RLS Testing with Non-Superuser Role
**What:** Create dedicated test database role WITHOUT superuser privilege to enforce RLS
**When to use:** All multi-tenant isolation tests — CRITICAL for security validation
**Example:**
```python
# Source: https://blair-devmode.medium.com/testing-row-level-security-rls-policies-in-postgresql-with-pgtap-a-supabase-example-b435c1852602
# https://www.bytebase.com/blog/postgres-row-level-security-footguns/
@pytest.fixture(scope="session")
async def rls_test_engine():
    """Engine connected as non-superuser to enforce RLS policies."""
    # Admin connection to create role
    admin_engine = create_async_engine("postgresql+asyncpg://postgres:pass@localhost/test_db")
    async with admin_engine.begin() as conn:
        await conn.execute(text("CREATE ROLE test_app_role WITH LOGIN PASSWORD 'test'"))
        await conn.execute(text("GRANT USAGE ON SCHEMA public TO test_app_role"))
        await conn.execute(text("GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO test_app_role"))

    # App role connection (RLS enforced)
    app_engine = create_async_engine("postgresql+asyncpg://test_app_role:test@localhost/test_db")
    yield app_engine

    await app_engine.dispose()
    async with admin_engine.begin() as conn:
        await conn.execute(text("DROP ROLE test_app_role"))
    await admin_engine.dispose()

@pytest.mark.asyncio
async def test_rls_isolation(rls_test_engine):
    """Verify users cannot access other organizations' data."""
    async with rls_test_engine.begin() as conn:
        # Set tenant context (mimics middleware behavior)
        await conn.execute(text("SET LOCAL app.current_tenant_id = :org_id"), {"org_id": "org-1"})

        # Query should only return org-1 data
        result = await conn.execute(text("SELECT * FROM users"))
        users = result.fetchall()
        assert all(user.organization_id == "org-1" for user in users)
```

### Pattern 5: Parametrized Tests for Error Cases
**What:** Use pytest.mark.parametrize to test multiple error scenarios efficiently
**When to use:** Testing authentication (invalid credentials, expired tokens, missing fields)
**Example:**
```python
# Source: https://oneuptime.com/blog/post/2026-02-02-pytest-parametrize-guide/view
@pytest.mark.parametrize("email,password,expected_status,expected_detail", [
    ("valid@example.com", "WrongPass123!", 401, "Incorrect email or password"),
    ("unknown@example.com", "AnyPass123!", 401, "Incorrect email or password"),
    ("valid@example.com", "", 422, None),  # Validation error
    ("", "ValidPass123!", 422, None),
])
@pytest.mark.asyncio
async def test_login_errors(async_client, email, password, expected_status, expected_detail):
    """Test login with various invalid inputs."""
    response = await async_client.post("/auth/login", json={
        "email": email,
        "password": password
    })
    assert response.status_code == expected_status
    if expected_detail:
        assert expected_detail in response.json()["detail"]
```

### Anti-Patterns to Avoid

- **Using TestClient with async dependencies:** TestClient runs sync and cannot await async dependencies — ALWAYS use AsyncClient for async FastAPI apps
- **Testing with superuser connections:** Superusers bypass RLS, creating false security confidence — use dedicated app_role for RLS tests
- **Sharing DB sessions across tests:** Leads to transaction conflicts and test pollution — use function-scoped fixtures
- **Not clearing dependency_overrides:** Overrides leak between tests — always clear in fixture teardown
- **Hardcoding test data:** Makes tests brittle and hard to maintain — use factory_boy for flexible test data
- **Mixing unit and integration tests:** Slows down test suite — separate pure logic tests from DB/HTTP tests

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Test database isolation | Custom setup/teardown scripts | pytest-postgresql | Handles temp DB creation, cleanup, parallel test isolation, connection lifecycle |
| Async event loop management | Manual event_loop fixtures per test | pytest-asyncio auto mode | Handles scope conflicts, prevents "attached to different loop" errors |
| Test data generation | Hardcoded fixture dictionaries | factory_boy + pytest-factoryboy | Faker integration, relationship handling, reduces 100+ line fixtures to 10-line factories |
| HTTP request testing | Manual httpx AsyncClient setup per test | Shared async_client fixture | Dependency override management, base_url configuration, session lifecycle |
| Coverage measurement | Manual coverage.py commands | pytest-cov plugin | Automatic .coverage file merging, integrated reporting, excludes test files |
| JWT token creation in tests | Copying production JWT logic | Shared test_token_factory fixture | Consistent token structure, easy claim customization, no duplication |

**Key insight:** FastAPI testing has well-established patterns from 2023-2026. Don't reinvent fixtures — the community has solved async SQLAlchemy testing thoroughly. Focus effort on domain-specific test cases, not infrastructure.

## Common Pitfalls

### Pitfall 1: Event Loop Scope Mismatch
**What goes wrong:** RuntimeError: "Task attached to a different loop" or "Event loop is closed"
**Why it happens:** Async fixtures with broader scope (session/module) try to use function-scoped event loop, or Windows event loop handling differs from Linux
**How to avoid:**
- Always define session-scoped event_loop fixture explicitly
- Configure pytest-asyncio: `asyncio_mode = "auto"` in pytest.ini or pyproject.toml
- On Windows, use `WindowsSelectorEventLoopPolicy` in event_loop fixture
**Warning signs:** Tests pass individually but fail when run together, intermittent event loop errors

### Pitfall 2: RLS Bypass in Tests
**What goes wrong:** RLS tests pass but RLS policies are actually broken — security vulnerability shipped to production
**Why it happens:** Test database connection uses superuser or table owner role, which bypasses RLS by default (PostgreSQL behavior)
**How to avoid:**
- Create dedicated test_app_role WITHOUT superuser privilege
- Use FORCE ROW LEVEL SECURITY on tables to enforce even on owner
- Verify with EXPLAIN that RLS filters appear in query plans
- Test with SET LOCAL app.current_tenant_id like production middleware
**Warning signs:** RLS tests pass but real app allows cross-tenant access, EXPLAIN shows no Filter node

### Pitfall 3: Async Context Manager Misuse
**What goes wrong:** Database connection hangs, transactions don't commit/rollback, "connection already closed" errors
**Why it happens:** Mixing sync and async context managers, not awaiting async with statements, closing connections before transaction completes
**How to avoid:**
- Always use `async with` for AsyncSession, AsyncEngine.begin()
- Never mix `with` (sync) and `async with` (async) in same fixture
- Yield session before closing connection in fixtures
- Use expire_on_commit=False in async_sessionmaker to avoid lazy loading errors
**Warning signs:** Tests hang indefinitely, connection pool exhaustion, "greenlet_spawn has not been called"

### Pitfall 4: Dependency Override Leakage
**What goes wrong:** Tests fail unpredictably when run in different orders, authentication state leaks between tests
**Why it happens:** app.dependency_overrides not cleared after test, overrides accumulate across test functions
**How to avoid:**
- Always clear dependency_overrides in fixture teardown (after yield)
- Use pytest fixture with try/finally or ensure cleanup in finally block
- Consider autouse fixture that clears overrides before each test
**Warning signs:** Test passes alone but fails in suite, order-dependent failures, "why is this user already authenticated?"

### Pitfall 5: Transaction Handling with Direct db.commit()
**What goes wrong:** Test database changes persist across tests, test isolation broken
**Why it happens:** Project uses direct `db.add()/db.commit()` pattern (not `async with db.begin()`), standard transaction rollback fixtures don't work
**How to avoid:**
- For this project: Use table drop/recreate per test (function-scoped fixture)
- Alternative: Wrap each test in savepoint and rollback (more complex with direct commit pattern)
- Document that this project's transaction pattern requires full table reset
**Warning signs:** Second test sees data from first test, "unique constraint violation" on previously used emails

### Pitfall 6: Missing RLS Context in Tests
**What goes wrong:** Tests query database but return empty results, or fail with "cannot access data"
**Why it happens:** Tests don't set `app.current_tenant_id` session variable that RLS policies expect
**How to avoid:**
- Set `SET LOCAL app.current_tenant_id` in test fixtures before queries
- Create test middleware override that sets request.state.organization_id
- Document that all DB tests need RLS context
**Warning signs:** Queries return 0 rows unexpectedly, RLS policy denies access in tests but works in manual testing

## Code Examples

Verified patterns from official sources:

### pytest.ini Configuration
```ini
# Source: https://pytest-asyncio.readthedocs.io/en/latest/concepts.html
[pytest]
asyncio_mode = auto
testpaths = tests
python_files = test_*.py
python_classes = Test*
python_functions = test_*

# Coverage configuration
addopts =
    --cov=app
    --cov-report=html
    --cov-report=term-missing
    --cov-fail-under=80
```

### conftest.py - Core Fixtures
```python
# Source: Synthesized from https://praciano.com.br/fastapi-and-async-sqlalchemy-20-with-pytest-done-right.html
# and https://fastapi.tiangolo.com/advanced/async-tests/
import pytest
import asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from app.main import app
from app.core.database import get_db, Base
from app.core.config import settings

@pytest.fixture(scope="session")
def event_loop():
    """Session-scoped event loop for all async fixtures and tests."""
    policy = asyncio.get_event_loop_policy()
    loop = policy.new_event_loop()
    yield loop
    loop.close()

@pytest.fixture(scope="session")
async def test_engine():
    """Session-scoped test database engine."""
    # Use separate test database
    test_db_url = settings.DATABASE_URL.replace("/crmplus", "/crmplus_test")
    engine = create_async_engine(test_db_url, echo=False, pool_pre_ping=True)
    yield engine
    await engine.dispose()

@pytest.fixture(scope="function")
async def test_db(test_engine):
    """Function-scoped database session with table recreation."""
    # Create all tables
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Create session
    session_factory = async_sessionmaker(
        test_engine,
        expire_on_commit=False,
        autocommit=False,
        autoflush=False,
    )
    async with session_factory() as session:
        yield session

    # Drop all tables for clean slate
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

@pytest.fixture
async def async_client(test_db):
    """Async HTTP client with database dependency override."""
    async def override_get_db():
        yield test_db

    app.dependency_overrides[get_db] = override_get_db

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test"
    ) as client:
        yield client

    # Clear overrides to prevent leakage
    app.dependency_overrides.clear()
```

### Unit Test Example - JWT Token Creation
```python
# Source: Direct implementation based on project patterns
import pytest
from datetime import datetime, timedelta
from app.auth.jwt import create_access_token, create_refresh_token, decode_token
from jwt.exceptions import ExpiredSignatureError

def test_create_access_token():
    """Test access token creation with correct claims."""
    user_id = "123e4567-e89b-12d3-a456-426614174000"
    org_id = "org-123"

    token = create_access_token(user_id, org_id)
    payload = decode_token(token)

    assert payload["sub"] == user_id
    assert payload["organization_id"] == org_id
    assert payload["type"] == "access"
    assert "exp" in payload

def test_create_refresh_token():
    """Test refresh token creation returns token and JTI."""
    user_id = "123e4567-e89b-12d3-a456-426614174000"
    org_id = "org-123"

    token, jti = create_refresh_token(user_id, org_id)
    payload = decode_token(token)

    assert payload["sub"] == user_id
    assert payload["organization_id"] == org_id
    assert payload["type"] == "refresh"
    assert payload["jti"] == jti
    assert len(jti) > 20  # UUID string

def test_decode_expired_token():
    """Test that expired tokens raise ExpiredSignatureError."""
    # Create token that expired 1 hour ago
    from app.auth.jwt import jwt, settings
    payload = {
        "sub": "user-123",
        "type": "access",
        "exp": datetime.utcnow() - timedelta(hours=1)
    }
    expired_token = jwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")

    with pytest.raises(ExpiredSignatureError):
        decode_token(expired_token)
```

### Integration Test Example - Full Auth Flow
```python
# Source: Synthesized from https://pytest-with-eric.com/pytest-advanced/pytest-fastapi-testing/
import pytest

@pytest.mark.asyncio
async def test_full_auth_flow(async_client, test_db):
    """Test complete auth flow: register → login → me → logout."""
    # Step 1: Register
    register_data = {
        "email": "flow@example.com",
        "password": "SecurePass123!",
        "full_name": "Flow Test User",
        "organization_name": "Flow Test Org"
    }
    register_response = await async_client.post("/auth/register", json=register_data)
    assert register_response.status_code == 201
    tokens = register_response.json()
    assert "access_token" in tokens
    assert "refresh_token" in tokens

    # Step 2: Access protected endpoint with access token
    headers = {"Authorization": f"Bearer {tokens['access_token']}"}
    me_response = await async_client.get("/auth/me", headers=headers)
    assert me_response.status_code == 200
    user_data = me_response.json()
    assert user_data["email"] == "flow@example.com"
    assert user_data["full_name"] == "Flow Test User"

    # Step 3: Refresh tokens
    refresh_response = await async_client.post(
        "/auth/refresh",
        json={"refresh_token": tokens["refresh_token"]}
    )
    assert refresh_response.status_code == 200
    new_tokens = refresh_response.json()
    assert new_tokens["access_token"] != tokens["access_token"]  # New token

    # Step 4: Logout
    logout_response = await async_client.post(
        "/auth/logout",
        json={"refresh_token": new_tokens["refresh_token"]}
    )
    assert logout_response.status_code == 200

    # Step 5: Verify refresh token is revoked
    reuse_response = await async_client.post(
        "/auth/refresh",
        json={"refresh_token": new_tokens["refresh_token"]}
    )
    assert reuse_response.status_code == 401  # Token revoked
```

### RLS Isolation Test Example
```python
# Source: https://www.techbuddies.io/2026/01/01/how-to-implement-postgresql-row-level-security-for-multi-tenant-saas/
import pytest
from sqlalchemy import text

@pytest.mark.asyncio
async def test_rls_prevents_cross_tenant_access(test_db):
    """Verify RLS policies prevent cross-organization data access."""
    from app.models.user import User
    from app.models.organization import Organization

    # Create two organizations
    org1 = Organization(name="Org 1")
    org2 = Organization(name="Org 2")
    test_db.add_all([org1, org2])
    await test_db.flush()

    # Create users in different orgs
    user1 = User(
        email="user1@org1.com",
        hashed_password="hashed",
        full_name="User 1",
        organization_id=org1.id,
        auth_provider="email",
        is_active=True,
    )
    user2 = User(
        email="user2@org2.com",
        hashed_password="hashed",
        full_name="User 2",
        organization_id=org2.id,
        auth_provider="email",
        is_active=True,
    )
    test_db.add_all([user1, user2])
    await test_db.commit()

    # Set RLS context to org1
    await test_db.execute(
        text("SET LOCAL app.current_tenant_id = :org_id"),
        {"org_id": str(org1.id)}
    )

    # Query users - should only see org1 user
    from sqlalchemy import select
    result = await test_db.execute(select(User))
    users = result.scalars().all()

    assert len(users) == 1
    assert users[0].email == "user1@org1.com"
    assert users[0].organization_id == org1.id
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| TestClient for all tests | AsyncClient for async apps | FastAPI 0.68+ (2021) | TestClient blocks on async dependencies, AsyncClient required |
| Manual event loop per test | pytest-asyncio auto mode | pytest-asyncio 0.21+ (2023) | Automatic scope handling, fewer boilerplate fixtures |
| Transaction rollback fixtures | Table drop/recreate | SQLAlchemy 2.0 (2023) | Safer with direct commit pattern, better isolation |
| Mocking database calls | Real test database | 2020+ best practice | Integration tests catch real SQL errors, type mismatches |
| coverage.py manual commands | pytest-cov plugin | Established 2015+ | One command for test + coverage, automatic merging |
| Hardcoded test data | factory_boy + faker | Established 2018+ | Flexible, realistic, reduces fixture maintenance |

**Deprecated/outdated:**
- **unittest.TestCase async support**: Use native pytest async tests instead, better fixture integration
- **TestClient for async FastAPI**: Replaced by AsyncClient with ASGITransport for proper async handling
- **pytest-asyncio strict mode**: Replaced by auto mode in 0.21+, less configuration needed
- **Sync SQLAlchemy test patterns**: SQLAlchemy 2.0 async requires different session handling

## Open Questions

Things that couldn't be fully resolved:

1. **Project-specific transaction pattern compatibility**
   - What we know: Project uses direct `db.add()/db.commit()` (not `async with db.begin()`), which is non-standard
   - What's unclear: Whether savepoint-based transaction rollback fixtures will work, or if full table recreation is required
   - Recommendation: Start with table drop/recreate per test (safer), evaluate savepoint approach if performance becomes issue

2. **RLS context injection for background tasks**
   - What we know: ARQ worker tasks run outside HTTP request context
   - What's unclear: How to set RLS context for testing background PDF parsing jobs
   - Recommendation: Create test_background_task_db fixture that sets organization_id before job execution, verify in Phase 9 tests

3. **Optimal coverage threshold**
   - What we know: Industry standard is 80-90% for production code
   - What's unclear: Appropriate threshold for FastAPI apps (routers are thin, logic in services)
   - Recommendation: Start with 80% overall, 90% for services/auth modules, 60% for routers (Pydantic handles much validation)

## Sources

### Primary (HIGH confidence)
- [FastAPI Async Tests (Official)](https://fastapi.tiangolo.com/advanced/async-tests/) - Official async testing documentation
- [pytest-asyncio Concepts](https://pytest-asyncio.readthedocs.io/en/latest/concepts.html) - Event loop scopes, fixture compatibility
- [FastAPI + SQLAlchemy 2.0 with pytest done right](https://praciano.com.br/fastapi-and-async-sqlalchemy-20-with-pytest-done-right.html) - Complete async testing pattern
- [PostgreSQL RLS Testing with pgTAP](https://blair-devmode.medium.com/testing-row-level-security-rls-policies-in-postgresql-with-pgtap-a-supabase-example-b435c1852602) - RLS testing methodology
- [Postgres RLS Footguns](https://www.bytebase.com/blog/postgres-row-level-security-footguns/) - Superuser bypass pitfall

### Secondary (MEDIUM confidence)
- [pytest-cov Documentation](https://pytest-cov.readthedocs.io/en/latest/config.html) - Coverage configuration
- [pytest Fixtures Best Practices](https://pytest-with-eric.com/pytest-best-practices/pytest-conftest/) - conftest.py organization
- [How to Mock FastAPI Dependencies](https://plainenglish.io/blog/how-to-mock-fastapi-dependencies-in-pytest) - Dependency override patterns
- [pytest Parametrize Guide 2026](https://oneuptime.com/blog/post/2026-02-02-pytest-parametrize-guide/view) - Error case testing
- [Multi-Tenant RLS Testing](https://www.techbuddies.io/2026/01/01/how-to-implement-postgresql-row-level-security-for-multi-tenant-saas/) - Multi-tenant isolation patterns

### Tertiary (LOW confidence)
- [FastAPI Best Practices 2026](https://fastlaunchapi.dev/blog/fastapi-best-practices-production-2026) - General testing recommendations
- [Building And Testing FastAPI CRUD APIs](https://pytest-with-eric.com/pytest-advanced/pytest-fastapi-testing/) - Tutorial examples

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - pytest + pytest-asyncio + httpx AsyncClient is FastAPI official pattern, well-documented
- Architecture: HIGH - Patterns verified across official docs and 2023-2026 production implementations
- Pitfalls: HIGH - All pitfalls documented in official sources or project-specific patterns (direct commit)
- RLS testing: MEDIUM - PostgreSQL RLS testing is established but pytest-specific patterns are synthesized from general RLS testing principles

**Research date:** 2026-02-07
**Valid until:** 60 days (testing patterns are stable, SQLAlchemy 2.x and FastAPI async patterns well-established)
