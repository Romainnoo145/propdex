"""BRO Bodemkaart WMS client for soil type classification. Phase 87.

Queries the BRO Bodemkaart 1:50.000 via WMS GetFeatureInfo at PDOK
using EPSG:28992 (RD New) coordinates. Returns structured soil properties
including soil code and profile name for classification.

Verified live (87-RESEARCH.md, 2026-03-09):
- BASE_URL confirmed via live test against PDOK WMS endpoint
- soilarea layer returns soilcode + normal_soilprofile_name
- 1km window (500m half-width) with 100x100 grid, center pixel (50,50)
"""

from __future__ import annotations

import logging
from typing import Any

import httpx

from app.government_apis.base import GovernmentAPIError, retry_with_backoff
from app.government_apis.rate_limiter import bro_bodemkaart_limiter

logger = logging.getLogger(__name__)

# PDOK BRO Bodemkaart WMS endpoint (versioned, CC0 licensed)
BASE_URL = "https://service.pdok.nl/bzk/bro-bodemkaart/wms/v1_0"

# WMS GetFeatureInfo window: 1km (500m half-width in RD meters)
HALF_WINDOW_M: float = 500.0

# Pixel grid and center for GetFeatureInfo
GRID_SIZE: int = 100
CENTER_PIXEL: int = 50


class BROBodemkaartClient:
    """WMS GetFeatureInfo client for BRO Bodemkaart soil classification.

    Queries the soilarea layer at a point using a 1km window and returns
    the first feature's properties (soilcode, normal_soilprofile_name).
    Returns None for coordinates outside bodemkaart coverage.
    """

    async def get_soil_at_point(
        self,
        x: float,
        y: float,
        client: httpx.AsyncClient,
    ) -> dict[str, Any] | None:
        """Query BRO Bodemkaart for soil properties at an RD coordinate.

        Args:
            x: RD New X coordinate (EPSG:28992)
            y: RD New Y coordinate (EPSG:28992)
            client: httpx AsyncClient for connection pooling

        Returns:
            Feature properties dict (soilcode, normal_soilprofile_name, etc.)
            or None if no coverage at this coordinate.

        Raises:
            GovernmentAPIError: On HTTP errors from the WMS endpoint
        """
        params: dict[str, str] = {
            "service": "WMS",
            "version": "1.3.0",
            "request": "GetFeatureInfo",
            "layers": "soilarea",
            "query_layers": "soilarea",
            "info_format": "application/json",
            "crs": "EPSG:28992",
            "bbox": f"{x - HALF_WINDOW_M},{y - HALF_WINDOW_M},{x + HALF_WINDOW_M},{y + HALF_WINDOW_M}",
            "width": str(GRID_SIZE),
            "height": str(GRID_SIZE),
            "i": str(CENTER_PIXEL),
            "j": str(CENTER_PIXEL),
        }

        logger.debug("BRO Bodemkaart query: x=%.0f, y=%.0f", x, y)

        async with bro_bodemkaart_limiter:
            response = await retry_with_backoff(
                lambda: client.get(BASE_URL, params=params, timeout=15.0),
                source="bro_bodemkaart",
            )

        if response.status_code != 200:
            raise GovernmentAPIError(
                "bro_bodemkaart",
                f"HTTP {response.status_code}",
                status_code=response.status_code,
            )

        data = response.json()
        features: list[dict[str, Any]] = data.get("features", [])

        if not features:
            logger.info("BRO Bodemkaart: no coverage at x=%.0f, y=%.0f", x, y)
            return None

        logger.info(
            "BRO Bodemkaart query complete: x=%.0f, y=%.0f, features=%d",
            x,
            y,
            len(features),
        )

        return features[0].get("properties", {})


# Module-level singleton -- reuse across requests for connection efficiency
bro_bodemkaart_client = BROBodemkaartClient()
