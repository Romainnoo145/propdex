"""Rijkswaterstaat Overstromingsrisico WMS client. Phase 99.

Queries the PDOK Overstromingen Risicogebied WMS via GetFeatureInfo
to determine if an RD coordinate falls within a flood risk zone.
Returns zone description for development risk assessment.

Gemeenten letten steeds meer op waterberging en overstromingsrisico.
"""

from __future__ import annotations

import logging
from typing import Any

import httpx

from app.government_apis.base import GovernmentAPIError, retry_with_backoff
from app.government_apis.rate_limiter import rws_overstromingen_limiter

logger = logging.getLogger(__name__)

# PDOK Rijkswaterstaat Overstromingen Risicogebied WMS
BASE_URL = "https://service.pdok.nl/rws/overstromingen-risicogebied/wms/v1_0"

# WMS GetFeatureInfo window: 1km (500m half-width in RD meters)
HALF_WINDOW_M: float = 500.0
GRID_SIZE: int = 100
CENTER_PIXEL: int = 50


class RWSOverstromingenClient:
    """WMS GetFeatureInfo client for flood risk zones.

    Queries the NZ.RiskZone layer at a point. Returns zone
    description or None if point is outside any flood risk zone.
    """

    async def get_risk_at_point(
        self,
        x: float,
        y: float,
        client: httpx.AsyncClient,
    ) -> dict[str, Any] | None:
        """Query flood risk zone at an RD coordinate.

        Args:
            x: RD New X coordinate (EPSG:28992)
            y: RD New Y coordinate (EPSG:28992)
            client: httpx AsyncClient for connection pooling

        Returns:
            Dict with {description, qualitative_value, in_risk_zone: True}
            or None if not in a flood risk zone.
        """
        params: dict[str, str] = {
            "service": "WMS",
            "version": "1.3.0",
            "request": "GetFeatureInfo",
            "layers": "NZ.RiskZone",
            "query_layers": "NZ.RiskZone",
            "info_format": "application/json",
            "crs": "EPSG:28992",
            "bbox": f"{x - HALF_WINDOW_M},{y - HALF_WINDOW_M},{x + HALF_WINDOW_M},{y + HALF_WINDOW_M}",
            "width": str(GRID_SIZE),
            "height": str(GRID_SIZE),
            "i": str(CENTER_PIXEL),
            "j": str(CENTER_PIXEL),
        }

        logger.debug("Overstromingsrisico query: x=%.0f, y=%.0f", x, y)

        async with rws_overstromingen_limiter:
            response = await retry_with_backoff(
                lambda: client.get(BASE_URL, params=params, timeout=15.0),
                source="rws_overstromingen",
            )

        if response.status_code != 200:
            raise GovernmentAPIError(
                "rws_overstromingen",
                f"HTTP {response.status_code}",
                status_code=response.status_code,
            )

        data = response.json()
        features: list[dict[str, Any]] = data.get("features", [])

        if not features:
            logger.debug("Overstromingsrisico: no risk zone at x=%.0f, y=%.0f", x, y)
            return None

        props = features[0].get("properties", {})
        result = {
            "description": props.get("description", ""),
            "qualitative_value": props.get("qualitativeValue", ""),
            "in_risk_zone": True,
        }

        logger.info("Overstromingsrisico: %s at x=%.0f, y=%.0f", result["description"], x, y)
        return result


rws_overstromingen_client = RWSOverstromingenClient()
