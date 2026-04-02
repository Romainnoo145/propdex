"""PDOK Funderingsrisicogebieden WFS client for foundation risk area context. Phase 87.

Queries the Indicatieve Gebieden Funderingsproblematiek WFS at PDOK
using OGC XML Filter by 6-digit postcode. Returns postcode-level area context
including percentage of pre-1970 buildings, soil region, and risk label.

CRITICAL: This data is postcode-level (PC6), NOT per parcel. Always present
with appropriate disclaimer.

NOTE: CQL_FILTER is silently ignored by this WFS endpoint — always use
OGC XML Filter encoding. Bug discovered 2026-04-02.
"""

from __future__ import annotations

import logging
import re
from typing import Any

import httpx

from app.government_apis.base import GovernmentAPIError, retry_with_backoff
from app.government_apis.rate_limiter import pdok_funderingsrisico_limiter

logger = logging.getLogger(__name__)

# PDOK Indicatieve Gebieden Funderingsproblematiek WFS endpoint
BASE_URL = "https://service.pdok.nl/rvo/indgebfunderingsproblematiek/wfs/v1_0"

# Postcode validation: 4 digits + 2 uppercase letters
_PC6_RE = re.compile(r"^\d{4}[A-Z]{2}$")


class PDOKFunderingsrisicoClient:
    """WFS GetFeature client for PDOK Funderingsrisicogebieden.

    Queries by 6-digit postcode (PC6) and returns area-level context
    including percentage of pre-1970 buildings and risk classification.
    Returns None for postcodes without data.
    """

    async def get_by_postcode(
        self,
        pc6: str,
        client: httpx.AsyncClient,
    ) -> dict[str, Any] | None:
        """Query PDOK Funderingsrisicogebieden for a postcode.

        Args:
            pc6: 6-digit Dutch postcode (e.g., "5927NX"). Spaces are stripped.

        Returns:
            Parsed feature properties dict with numeric values converted,
            or None if no data for this postcode.

        Raises:
            ValueError: If pc6 is not valid Dutch postcode format
            GovernmentAPIError: On HTTP errors from the WFS endpoint
        """
        # Sanitize and validate postcode
        pc6_clean = pc6.strip().upper().replace(" ", "")
        if not _PC6_RE.match(pc6_clean):
            raise ValueError(f"Invalid postcode format: '{pc6}' (expected 4 digits + 2 uppercase letters)")

        # OGC XML Filter — CQL_FILTER is silently ignored by this WFS endpoint.
        ogc_filter = (
            f'<Filter xmlns="http://www.opengis.net/ogc">'
            f'<PropertyIsEqualTo><PropertyName>pc6</PropertyName>'
            f'<Literal>{pc6_clean}</Literal>'
            f'</PropertyIsEqualTo></Filter>'
        )

        params: dict[str, str] = {
            "request": "GetFeature",
            "service": "WFS",
            "version": "2.0.0",
            "typenames": "indgebfunderingsproblematiek:indgebfunderingsproblematiek",
            "outputFormat": "application/json",
            "Filter": ogc_filter,
        }

        logger.debug("PDOK Funderingsrisico query: pc6=%s", pc6_clean)

        async with pdok_funderingsrisico_limiter:
            response = await retry_with_backoff(
                lambda: client.get(BASE_URL, params=params, timeout=15.0),
                source="pdok_funderingsrisico",
            )

        if response.status_code != 200:
            raise GovernmentAPIError(
                "pdok_funderingsrisico",
                f"HTTP {response.status_code}",
                status_code=response.status_code,
            )

        data = response.json()
        features: list[dict[str, Any]] = data.get("features", [])

        if not features:
            logger.info("PDOK Funderingsrisico: no data for pc6=%s", pc6_clean)
            return None

        props = features[0].get("properties", {})

        # Parse string values to numeric types (WFS returns everything as strings)
        result: dict[str, Any] = {
            "pc6": props.get("pc6", pc6_clean),
            "gemeente": props.get("gemeente"),
            "fgr": props.get("fgr"),
            "legenda": props.get("legenda"),
        }

        # percvoor1970: string like "66.66666666666666" -> float
        percvoor1970_raw = props.get("percvoor1970")
        if percvoor1970_raw is not None:
            try:
                result["percvoor1970"] = round(float(percvoor1970_raw), 2)
            except (ValueError, TypeError):
                logger.warning("Could not parse percvoor1970: %s", percvoor1970_raw)
                result["percvoor1970"] = None
        else:
            result["percvoor1970"] = None

        # n_bag: string like "7" -> int
        n_bag_raw = props.get("n_bag")
        if n_bag_raw is not None:
            try:
                result["n_bag"] = int(n_bag_raw)
            except (ValueError, TypeError):
                logger.warning("Could not parse n_bag: %s", n_bag_raw)
                result["n_bag"] = None
        else:
            result["n_bag"] = None

        logger.info(
            "PDOK Funderingsrisico query complete: pc6=%s, fgr=%s, percvoor1970=%s",
            pc6_clean,
            result.get("fgr"),
            result.get("percvoor1970"),
        )

        return result


# Module-level singleton -- reuse across requests for connection efficiency
pdok_funderingsrisico_client = PDOKFunderingsrisicoClient()
