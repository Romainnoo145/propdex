"""Bodem aggregation service — Bodemloket ArcGIS REST with 30-day JSONB cache."""

from __future__ import annotations

import logging

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.government_apis.bodemloket_arcgis import bodemloket_client
from app.schemas.bodem import BodemData
from app.services.cache_manager import get_cached_or_fetch

logger = logging.getLogger(__name__)


async def fetch_bodem_data(
    x: float,
    y: float,
    client: httpx.AsyncClient,
    session: AsyncSession,
    force_refresh: bool = False,
) -> BodemData:
    """Fetch bodem (soil contamination) data from Bodemloket with 30-day JSONB cache.

    Cache key rounds coordinates to nearest meter to ensure nearby addresses
    (< 1m apart) share the same cache entry. RD coordinates are in meters so
    rounding to integer is meter-level precision.

    Args:
        x: RD New X coordinate (EPSG:28992)
        y: RD New Y coordinate (EPSG:28992)
        client: httpx AsyncClient for connection pooling
        session: SQLAlchemy async session for cache operations
        force_refresh: If True, bypass cache and fetch fresh data

    Returns:
        BodemData with dossiers list and mandatory disclaimer.
        Empty dossiers = no WBB registrations found (not a clean-ground certificate).
    """
    # Round to nearest meter for cache key stability across address variants
    cache_key = f"bodemloket:rd:{round(x)}:{round(y)}"

    async def fetch_fn() -> dict[str, object]:
        result = await bodemloket_client.query_by_point(x, y, client)
        return result.model_dump()

    cached = await get_cached_or_fetch(
        cache_key=cache_key,
        source="bodemloket",
        fetch_fn=fetch_fn,
        session=session,
        force_refresh=force_refresh,
    )
    return BodemData.model_validate(cached.data)
