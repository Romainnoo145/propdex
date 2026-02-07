"""Shared test fixtures for CRM Plus test suite."""

import asyncio
from typing import AsyncGenerator

import asyncpg
import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings
from app.core.database import get_db
from app.main import app
from app.models import Base


@pytest.fixture(scope="function")
async def test_engine():
    """
    Session-scoped test database engine.

    Creates a separate test database (crmplus_test) to avoid polluting the
    development database. The test database is created if it doesn't exist.
    """
    # Derive test database URL from settings
    test_db_url = settings.DATABASE_URL.replace("/crmplus", "/crmplus_test")

    # Create test database if it doesn't exist
    # Connect to default 'crmplus' database to create 'crmplus_test'
    try:
        # Extract connection parts from DATABASE_URL
        # Format: postgresql+asyncpg://user:pass@host:port/dbname
        base_url = settings.DATABASE_URL.replace("/crmplus", "/postgres")
        conn_url = base_url.replace("postgresql+asyncpg://", "")

        if "@" in conn_url:
            user_pass, host_db = conn_url.split("@", 1)
            if ":" in user_pass:
                user, password = user_pass.split(":", 1)
            else:
                user = user_pass
                password = ""

            if "/" in host_db:
                host_port, _ = host_db.split("/", 1)
            else:
                host_port = host_db

            if ":" in host_port:
                host, port_str = host_port.split(":", 1)
                port = int(port_str)
            else:
                host = host_port
                port = 5432

            # Connect to postgres database to create test database
            conn = await asyncpg.connect(
                host=host,
                port=port,
                user=user,
                password=password,
                database="postgres",
            )

            try:
                # Check if test database exists
                exists = await conn.fetchval(
                    "SELECT 1 FROM pg_database WHERE datname = 'crmplus_test'"
                )

                if not exists:
                    # Create test database
                    await conn.execute("CREATE DATABASE crmplus_test")
            finally:
                await conn.close()

            # Install pg_trgm extension in test database
            test_conn = await asyncpg.connect(
                host=host,
                port=port,
                user=user,
                password=password,
                database="crmplus_test",
            )
            try:
                await test_conn.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")
            finally:
                await test_conn.close()
    except Exception as e:
        # If database already exists or creation fails, continue
        # (test engine creation will fail if database truly doesn't exist)
        print(f"Note: Test database setup: {e}")

    # Create async engine for test database
    engine = create_async_engine(
        test_db_url,
        echo=False,
        pool_pre_ping=True,
    )

    yield engine

    # Cleanup: dispose engine
    await engine.dispose()


@pytest.fixture(scope="function")
async def test_db(test_engine) -> AsyncGenerator[AsyncSession, None]:
    """
    Function-scoped database session with table recreation for isolation.

    Each test gets a clean database by:
    1. Creating all tables before the test
    2. Yielding a session for the test to use
    3. Dropping all tables after the test

    This ensures complete test isolation without relying on transaction rollback
    (which doesn't work well with the project's direct db.commit() pattern).
    """
    # Create all tables
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Create session factory
    session_factory = async_sessionmaker(
        test_engine,
        expire_on_commit=False,
        autocommit=False,
        autoflush=False,
    )

    # Create and yield session
    async with session_factory() as session:
        yield session

    # Drop all tables for clean slate
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest.fixture
async def async_client(test_db: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """
    Async HTTP client with database dependency override.

    This fixture:
    1. Overrides the get_db dependency to use test_db
    2. Overrides the rate limiter to disable rate limiting in tests
    3. Creates an AsyncClient for making test requests
    4. Clears overrides after the test to prevent leakage

    Note: Must use AsyncClient (not TestClient) for async FastAPI apps.
    """
    # Override get_db to use test database
    async def override_get_db():
        yield test_db

    app.dependency_overrides[get_db] = override_get_db

    # Disable rate limiting in tests by setting enabled=False on the actual limiter
    # The route decorators reference the module-level limiter object directly,
    # so replacing app.state.limiter has no effect on decorator-level limits.
    from app.middleware.rate_limit import limiter as app_limiter
    app_limiter.enabled = False

    # Create async client
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        yield client

    # Clear overrides and re-enable rate limiter
    app.dependency_overrides.clear()
    from app.middleware.rate_limit import limiter as app_limiter
    app_limiter.enabled = True


@pytest.fixture
async def create_test_user(test_db: AsyncSession):
    """
    Factory fixture for creating test users with organizations.

    Returns a function that creates a user + organization with customizable fields.
    This avoids hardcoding test data and makes tests more flexible.

    Usage:
        user, org = await create_test_user(email="custom@example.com")
    """
    async def _create(
        email: str = "test@example.com",
        password: str = "TestPass123!",
        org_name: str = "Test Org",
        **kwargs
    ):
        from app.auth.password import hash_password
        from app.models.organization import Organization
        from app.models.user import User

        # Create organization
        org = Organization(name=org_name)
        test_db.add(org)
        await test_db.flush()

        # Create user
        user = User(
            email=email,
            hashed_password=hash_password(password),
            full_name=kwargs.get("full_name", "Test User"),
            organization_id=org.id,
            email_verified=kwargs.get("email_verified", True),
            auth_provider=kwargs.get("auth_provider", "email"),
            is_active=kwargs.get("is_active", True),
        )
        test_db.add(user)
        await test_db.commit()

        return user, org

    return _create
