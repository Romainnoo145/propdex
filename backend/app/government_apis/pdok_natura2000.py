"""PDOK Natura2000 WFS client for proximity analysis. Phase 99.

Queries the PDOK Natura2000 WFS to find areas within a search radius
of an RD coordinate (EPSG:28992). Returns the nearest Natura2000 area
name and distance indicator for development risk assessment.

Many projects fail due to nitrogen deposition (stikstof) near Natura2000.
"""

from __future__ import annotations

import logging
from typing import Any

import httpx

from app.government_apis.base import GovernmentAPIError, retry_with_backoff
from app.government_apis.rate_limiter import pdok_natura2000_limiter

logger = logging.getLogger(__name__)

# PDOK Natura2000 WFS endpoint (RVO, public, CC0)
BASE_URL = "https://service.pdok.nl/rvo/natura2000/wfs/v1_0"

# Search radius in meters — 5km is the typical AERIUS screening distance
SEARCH_RADIUS_M: int = 5000


class PDOKNatura2000Client:
    """WFS client for Natura2000 proximity queries.

    Given an RD coordinate, searches for Natura2000 areas within
    SEARCH_RADIUS_M using a bbox query. Returns the nearest area
    or None if no areas within range.
    """

    async def get_nearest(
        self,
        x: float,
        y: float,
        client: httpx.AsyncClient,
    ) -> dict[str, Any] | None:
        """Find nearest Natura2000 area to an RD coordinate.

        Args:
            x: RD New X coordinate (EPSG:28992)
            y: RD New Y coordinate (EPSG:28992)
            client: httpx AsyncClient for connection pooling

        Returns:
            Dict with {naam, nr, bescherming, binnen_5km: True} or None.
        """
        bbox = (
            f"{x - SEARCH_RADIUS_M},{y - SEARCH_RADIUS_M},"
            f"{x + SEARCH_RADIUS_M},{y + SEARCH_RADIUS_M},EPSG:28992"
        )
        params: dict[str, str] = {
            "service": "wfs",
            "version": "2.0.0",
            "request": "GetFeature",
            "typeName": "natura2000:natura2000",
            "outputFormat": "application/json",
            "count": "1",
            "bbox": bbox,
        }

        logger.debug("Natura2000 query: x=%.0f, y=%.0f, radius=%dm", x, y, SEARCH_RADIUS_M)

        async with pdok_natura2000_limiter:
            response = await retry_with_backoff(
                lambda: client.get(BASE_URL, params=params, timeout=15.0),
                source="pdok_natura2000",
            )

        if response.status_code != 200:
            raise GovernmentAPIError(
                "pdok_natura2000",
                f"HTTP {response.status_code}",
                status_code=response.status_code,
            )

        data = response.json()
        features: list[dict[str, Any]] = data.get("features", [])

        if not features:
            logger.debug("Natura2000: no areas within %dm of x=%.0f, y=%.0f", SEARCH_RADIUS_M, x, y)
            return None

        props = features[0].get("properties", {})
        result = {
            "naam": props.get("naamN2K"),
            "nr": props.get("nr"),
            "bescherming": props.get("beschermin"),
            "binnen_5km": True,
        }

        logger.info(
            "Natura2000 found: %s within %dm of x=%.0f, y=%.0f",
            result["naam"],
            SEARCH_RADIUS_M,
            x,
            y,
        )
        return result


pdok_natura2000_client = PDOKNatura2000Client()
