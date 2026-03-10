"""RIVM Luchtkwaliteit WMS client for air quality assessment. Phase 99.

Queries the RIVM Atlas Leefomgeving WMS for annual average NO2 and PM10
concentrations at an RD coordinate. Returns µg/m³ values for
development feasibility assessment near sensitive destinations
(scholen, woningen, zorglocaties).

EU grenswaarden: NO2 40 µg/m³, PM10 40 µg/m³ (jaargemiddelde).
"""

from __future__ import annotations

import logging
from typing import Any

import httpx

from app.government_apis.base import retry_with_backoff
from app.government_apis.rate_limiter import rivm_luchtkwaliteit_limiter

logger = logging.getLogger(__name__)

# RIVM Atlas Leefomgeving WMS endpoint (same server as geluid)
BASE_URL = "https://data.rivm.nl/geo/alo/wms"

# Layers: actual annual averages (most recent published)
LAYER_NO2 = "rivm_jaargemiddeld_NO2_actueel"
LAYER_PM10 = "rivm_jaargemiddeld_PM10_actueel"

# WMS GetFeatureInfo window
HALF_WINDOW_M: float = 500.0
GRID_SIZE: int = 100
CENTER_PIXEL: int = 50

# EU annual limit values (µg/m³)
LIMIT_NO2: float = 40.0
LIMIT_PM10: float = 40.0


class RIVMLuchtkwaliteitClient:
    """WMS GetFeatureInfo client for RIVM air quality maps.

    Queries two raster layers (NO2 and PM10 annual averages) in
    a single call. GRAY_INDEX = concentration in µg/m³.
    """

    async def get_air_quality_at_point(
        self,
        x: float,
        y: float,
        client: httpx.AsyncClient,
    ) -> dict[str, Any] | None:
        """Query NO2 and PM10 concentrations at an RD coordinate.

        Args:
            x: RD New X coordinate (EPSG:28992)
            y: RD New Y coordinate (EPSG:28992)
            client: httpx AsyncClient for connection pooling

        Returns:
            Dict with {no2_ugm3, pm10_ugm3, boven_grenswaarde}
            or None if no data at coordinate.
        """
        bbox = f"{x - HALF_WINDOW_M},{y - HALF_WINDOW_M},{x + HALF_WINDOW_M},{y + HALF_WINDOW_M}"
        base_params: dict[str, str] = {
            "service": "WMS",
            "version": "1.3.0",
            "request": "GetFeatureInfo",
            "info_format": "application/json",
            "crs": "EPSG:28992",
            "bbox": bbox,
            "width": str(GRID_SIZE),
            "height": str(GRID_SIZE),
            "i": str(CENTER_PIXEL),
            "j": str(CENTER_PIXEL),
        }

        logger.debug("RIVM Luchtkwaliteit query: x=%.0f, y=%.0f", x, y)

        no2_val: float | None = None
        pm10_val: float | None = None

        # Fetch NO2
        async with rivm_luchtkwaliteit_limiter:
            no2_params = {**base_params, "layers": LAYER_NO2, "query_layers": LAYER_NO2}
            resp_no2 = await retry_with_backoff(
                lambda: client.get(BASE_URL, params=no2_params, timeout=15.0),
                source="rivm_luchtkwaliteit_no2",
            )

        if resp_no2.status_code == 200:
            data = resp_no2.json()
            feats = data.get("features", [])
            if feats:
                gi = feats[0].get("properties", {}).get("GRAY_INDEX")
                if gi is not None and gi != 0:
                    no2_val = round(float(gi), 1)

        # Fetch PM10
        async with rivm_luchtkwaliteit_limiter:
            pm10_params = {**base_params, "layers": LAYER_PM10, "query_layers": LAYER_PM10}
            resp_pm10 = await retry_with_backoff(
                lambda: client.get(BASE_URL, params=pm10_params, timeout=15.0),
                source="rivm_luchtkwaliteit_pm10",
            )

        if resp_pm10.status_code == 200:
            data = resp_pm10.json()
            feats = data.get("features", [])
            if feats:
                gi = feats[0].get("properties", {}).get("GRAY_INDEX")
                if gi is not None and gi != 0:
                    pm10_val = round(float(gi), 1)

        if no2_val is None and pm10_val is None:
            logger.debug("RIVM Luchtkwaliteit: no data at x=%.0f, y=%.0f", x, y)
            return None

        boven_grenswaarde = False
        if no2_val is not None and no2_val >= LIMIT_NO2:
            boven_grenswaarde = True
        if pm10_val is not None and pm10_val >= LIMIT_PM10:
            boven_grenswaarde = True

        result = {
            "no2_ugm3": no2_val,
            "pm10_ugm3": pm10_val,
            "boven_grenswaarde": boven_grenswaarde,
        }

        logger.info(
            "RIVM Luchtkwaliteit: NO2=%.1f PM10=%.1f µg/m³ at x=%.0f, y=%.0f",
            no2_val or 0,
            pm10_val or 0,
            x,
            y,
        )
        return result


rivm_luchtkwaliteit_client = RIVMLuchtkwaliteitClient()
