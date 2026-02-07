"""Cache manager for government API responses with TTL-based invalidation."""

import uuid
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import CACHE_TTL
from app.models.cached_response import CachedAPIResponse


@dataclass
class CacheResult:
    """
    Result from cache lookup or fetch operation.

    Attributes:
        data: The API response data (from cache or fresh fetch)
        cached_at: ISO 8601 timestamp when data was originally fetched
        age_seconds: How long ago the data was fetched (in seconds)
        is_cached: True if data came from cache, False if freshly fetched
    """

    data: dict
    cached_at: str
    age_seconds: int
    is_cached: bool


async def get_cached_or_fetch(
    cache_key: str,
    source: str,
    organization_id: uuid.UUID,
    fetch_fn: Callable[[], Awaitable[dict]],
    session: AsyncSession,
    force_refresh: bool = False,
) -> CacheResult:
    """
    Get cached API response or fetch fresh data if stale/missing.

    Checks cache for unexpired data. If found and fresh (age < TTL), returns cached data.
    If stale or missing, calls fetch_fn to get fresh data, upserts to cache, and returns it.

    Args:
        cache_key: Unique cache key (e.g., "bag:nummeraanduiding:0363200000469854")
        source: API source name (must exist in CACHE_TTL dict)
        organization_id: Tenant ID for multi-tenant isolation
        fetch_fn: Async function to fetch fresh data from external API
        session: SQLAlchemy async session
        force_refresh: If True, bypass cache and fetch fresh data (default: False)

    Returns:
        CacheResult with data, metadata, and cache hit status

    Raises:
        KeyError: If source not found in CACHE_TTL configuration
    """
    ttl_seconds = CACHE_TTL[source]
    now = datetime.utcnow()

    # If force_refresh is True, skip cache lookup entirely
    if not force_refresh:
        # Look up cached entry
        stmt = select(CachedAPIResponse).where(
            CachedAPIResponse.organization_id == organization_id,
            CachedAPIResponse.cache_key == cache_key,
        )
        result = await session.execute(stmt)
        cached_entry = result.scalar_one_or_none()

        # Check if cache is fresh
        if cached_entry:
            age_seconds = int((now - cached_entry.fetched_at).total_seconds())
            if age_seconds < cached_entry.ttl_seconds:
                # Cache hit - fresh data
                return CacheResult(
                    data=cached_entry.response_data,
                    cached_at=cached_entry.fetched_at.isoformat() + "Z",
                    age_seconds=age_seconds,
                    is_cached=True,
                )
    else:
        # Force refresh: look up entry for upsert, but don't return it
        stmt = select(CachedAPIResponse).where(
            CachedAPIResponse.organization_id == organization_id,
            CachedAPIResponse.cache_key == cache_key,
        )
        result = await session.execute(stmt)
        cached_entry = result.scalar_one_or_none()

    # Cache miss or stale - fetch fresh data
    fresh_data = await fetch_fn()

    # Upsert to cache
    if cached_entry:
        # Update existing entry
        cached_entry.response_data = fresh_data
        cached_entry.fetched_at = now
        cached_entry.ttl_seconds = ttl_seconds
        cached_entry.updated_at = now
    else:
        # Create new entry
        cached_entry = CachedAPIResponse(
            organization_id=organization_id,
            cache_key=cache_key,
            source=source,
            response_data=fresh_data,
            fetched_at=now,
            ttl_seconds=ttl_seconds,
        )
        session.add(cached_entry)

    await session.flush()
    await session.commit()

    return CacheResult(
        data=fresh_data,
        cached_at=now.isoformat() + "Z",
        age_seconds=0,
        is_cached=False,
    )


async def invalidate_cache(
    cache_key: str,
    organization_id: uuid.UUID,
    session: AsyncSession,
) -> None:
    """
    Manually invalidate a cached API response.

    Deletes the cache entry, forcing the next request to fetch fresh data.

    Args:
        cache_key: Cache key to invalidate
        organization_id: Tenant ID for multi-tenant isolation
        session: SQLAlchemy async session
    """
    stmt = select(CachedAPIResponse).where(
        CachedAPIResponse.organization_id == organization_id,
        CachedAPIResponse.cache_key == cache_key,
    )
    result = await session.execute(stmt)
    cached_entry = result.scalar_one_or_none()

    if cached_entry:
        await session.delete(cached_entry)
        await session.flush()
        await session.commit()
