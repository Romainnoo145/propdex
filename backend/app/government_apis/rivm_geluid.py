"""RIVM Geluidkaart WMS client for noise zone analysis. Phase 99.

Queries the RIVM Atlas Leefomgeving WMS for Lden noise levels
from all sources (weg/spoor/industrie/vlieg/wind) at an RD coordinate.
Returns dB level for development feasibility assessment.

Veel woningen mogen niet gebouwd worden vanwege geluidnormen.
Wettelijke grenswaarden: 48 dB Lden buitenruimte (Omgevingswet).
"""

from __future__ import annotations

import logging
from typing import Any

import httpx

from app.government_apis.base import GovernmentAPIError, retry_with_backoff
from app.government_apis.rate_limiter import rivm_geluid_limiter

logger = logging.getLogger(__name__)

# RIVM Atlas Leefomgeving WMS endpoint
BASE_URL = "https://data.rivm.nl/geo/alo/wms"

# Layer: all noise sources combined, 2020 data (most recent available)
LAYER_LDEN_ALL = "rivm_20220601_Geluid_lden_allebronnen_2020"

# WMS GetFeatureInfo window
HALF_WINDOW_M: float = 500.0
GRID_SIZE: int = 100
CENTER_PIXEL: int = 50


class RIVMGeluidClient:
    """WMS GetFeatureInfo client for RIVM noise level maps.

    Queries the Lden (day-evening-night) noise map combining all sources.
    Returns noise level in dB. GRAY_INDEX in the raster = dB Lden.
    """

    async def get_noise_at_point(
        self,
        x: float,
        y: float,
        client: httpx.AsyncClient,
    ) -> dict[str, Any] | None:
        """Query Lden noise level at an RD coordinate.

        Args:
            x: RD New X coordinate (EPSG:28992)
            y: RD New Y coordinate (EPSG:28992)
            client: httpx AsyncClient for connection pooling

        Returns:
            Dict with {lden_db, classification, boven_grenswaarde}
            or None if no data at coordinate.
        """
        params: dict[str, str] = {
            "service": "WMS",
            "version": "1.3.0",
            "request": "GetFeatureInfo",
            "layers": LAYER_LDEN_ALL,
            "query_layers": LAYER_LDEN_ALL,
            "info_format": "application/json",
            "crs": "EPSG:28992",
            "bbox": f"{x - HALF_WINDOW_M},{y - HALF_WINDOW_M},{x + HALF_WINDOW_M},{y + HALF_WINDOW_M}",
            "width": str(GRID_SIZE),
            "height": str(GRID_SIZE),
            "i": str(CENTER_PIXEL),
            "j": str(CENTER_PIXEL),
        }

        logger.debug("RIVM Geluid query: x=%.0f, y=%.0f", x, y)

        async with rivm_geluid_limiter:
            response = await retry_with_backoff(
                lambda: client.get(BASE_URL, params=params, timeout=15.0),
                source="rivm_geluid",
            )

        if response.status_code != 200:
            raise GovernmentAPIError(
                "rivm_geluid",
                f"HTTP {response.status_code}",
                status_code=response.status_code,
            )

        data = response.json()
        features: list[dict[str, Any]] = data.get("features", [])

        if not features:
            logger.debug("RIVM Geluid: no data at x=%.0f, y=%.0f", x, y)
            return None

        props = features[0].get("properties", {})
        gray_index = props.get("GRAY_INDEX")

        if gray_index is None or gray_index == 0:
            return None

        db_lden = round(float(gray_index))

        # Omgevingswet grenswaarde wonen: 50 dB Lden (buitenruimte)
        if db_lden >= 65:
            classification = "zeer_hoog"
        elif db_lden >= 55:
            classification = "hoog"
        elif db_lden >= 50:
            classification = "verhoogd"
        else:
            classification = "acceptabel"

        result = {
            "lden_db": db_lden,
            "classification": classification,
            "boven_grenswaarde": db_lden >= 50,
        }

        logger.info("RIVM Geluid: %d dB Lden (%s) at x=%.0f, y=%.0f", db_lden, classification, x, y)
        return result


rivm_geluid_client = RIVMGeluidClient()
