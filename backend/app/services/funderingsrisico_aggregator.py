"""Funderingsrisico aggregation service -- PDOK WFS with 180-day JSONB cache. Phase 87."""

from __future__ import annotations

import logging
import uuid

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.government_apis.pdok_funderingsrisico import pdok_funderingsrisico_client
from app.schemas.fysiek_risico import FunderingsrisicogebiedData
from app.services.cache_manager import get_cached_or_fetch

logger = logging.getLogger(__name__)


async def fetch_funderingsrisico_data(
    pc6: str | None,
    client: httpx.AsyncClient,
    organization_id: uuid.UUID,
    session: AsyncSession,
    force_refresh: bool = False,
) -> FunderingsrisicogebiedData | None:
    """Fetch funderingsrisico area context from PDOK with 180-day JSONB cache.

    Returns None for parcels without a postcode (e.g., bouwkavels) or
    postcodes without funderingsrisico data in the PDOK dataset.

    Args:
        pc6: 6-digit Dutch postcode (e.g., "5927NX"). None to skip.
        client: httpx AsyncClient for connection pooling
        organization_id: Tenant ID for multi-tenant cache isolation
        session: SQLAlchemy async session for cache operations
        force_refresh: If True, bypass cache and fetch fresh data

    Returns:
        FunderingsrisicogebiedData with area context, or None if no data.
    """
    if not pc6:
        return None

    cache_key = f"pdok_funderingsrisico:pc6:{pc6.strip().upper().replace(' ', '')}"

    async def fetch_fn() -> dict:
        result = await pdok_funderingsrisico_client.get_by_postcode(pc6, client)
        if result is None:
            # Return empty dict to signal "no data" in cache
            return {}
        return result

    cached = await get_cached_or_fetch(
        cache_key=cache_key,
        source="pdok_funderingsrisico",
        organization_id=organization_id,
        fetch_fn=fetch_fn,
        session=session,
        force_refresh=force_refresh,
    )

    # Empty dict means no data for this postcode (cached as "no data")
    if not cached.data:
        return None

    return FunderingsrisicogebiedData.model_validate(cached.data)
