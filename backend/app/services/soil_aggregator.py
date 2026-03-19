"""Soil aggregation service -- BRO Bodemkaart WMS with 365-day JSONB cache. Phase 87."""

from __future__ import annotations

import logging

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.government_apis.bro_bodemkaart import bro_bodemkaart_client
from app.schemas.fysiek_risico import SoilProfile
from app.services.cache_manager import get_cached_or_fetch
from app.services.soil_classifier import GRONDSOORT_LABELS, classify_soil_code

logger = logging.getLogger(__name__)


async def fetch_soil_profile(
    x: float,
    y: float,
    client: httpx.AsyncClient,
    session: AsyncSession,
    force_refresh: bool = False,
) -> SoilProfile:
    """Fetch soil profile from BRO Bodemkaart with 365-day JSONB cache.

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
        SoilProfile with dominant_type classification. Returns "onbekend"
        for coordinates without BRO coverage (never raises for coverage gaps).
    """
    cache_key = f"bro_bodemkaart:rd:{round(x)}:{round(y)}"

    async def fetch_fn() -> dict:
        props = await bro_bodemkaart_client.get_soil_at_point(x, y, client)
        if props is None:
            return {
                "soilcode": None,
                "soilname": None,
                "dominant_type": "onbekend",
                "dominant_type_label": "Onbekend (geen BRO dekking)",
            }
        soilcode = props.get("soilcode", "")
        grondsoort = classify_soil_code(soilcode)
        return {
            "soilcode": soilcode,
            "soilname": props.get("normal_soilprofile_name", ""),
            "dominant_type": grondsoort,
            "dominant_type_label": GRONDSOORT_LABELS[grondsoort],
        }

    cached = await get_cached_or_fetch(
        cache_key=cache_key,
        source="bro_bodemkaart",
        fetch_fn=fetch_fn,
        session=session,
        force_refresh=force_refresh,
    )
    return SoilProfile.model_validate(cached.data)
