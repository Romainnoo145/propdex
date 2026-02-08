"""Async SQLAlchemy database setup and session management."""

from collections.abc import AsyncGenerator

from fastapi import Request
from sqlalchemy import text
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.config import settings

# Create async engine with connection pooling
engine: AsyncEngine = create_async_engine(
    settings.DATABASE_URL,
    pool_size=5,
    max_overflow=10,
    echo=False,  # Set to True for SQL query logging during development
)

# Create async session factory
async_session_factory = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


async def get_db(request: Request) -> AsyncGenerator[AsyncSession, None]:
    """
    FastAPI dependency that provides database session with RLS context.

    Extracts organization_id from request.state (set by TenantContextMiddleware)
    and sets PostgreSQL session variable for RLS policies.

    For authenticated requests: SET LOCAL app.current_tenant_id = org_id
    For unauthenticated requests: session variable is NOT set, RLS denies access (fail-closed)
    """
    async with async_session_factory() as session:
        # Get organization_id from middleware (if authenticated request)
        org_id = getattr(request.state, "organization_id", None)

        if org_id:
            # Set session variable for RLS policies (transaction-scoped via SET LOCAL)
            # SET LOCAL is safe with connection pooling — scoped to current transaction only
            # Note: SET LOCAL does not support parameterized queries in asyncpg,
            # so we use string formatting after UUID validation (org_id is already a uuid.UUID)
            safe_org_id = str(org_id)
            await session.execute(
                text(f"SET LOCAL app.current_tenant_id = '{safe_org_id}'"),
            )

        try:
            yield session
        finally:
            await session.close()


async def init_db() -> None:
    """
    Initialize database connection.

    Verifies that the database is accessible.
    Can be called during application startup.
    """
    async with engine.begin() as conn:
        # Test the connection
        await conn.execute(text("SELECT 1"))
