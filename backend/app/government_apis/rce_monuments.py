"""RCE Rijksmonument API client with coordinate transformation."""

from __future__ import annotations

import httpx
from pyproj import Transformer

# Module-level coordinate transformers (initialized once)
_rd_to_wgs84 = Transformer.from_crs("EPSG:28992", "EPSG:4326", always_xy=True)
_wgs84_to_rd = Transformer.from_crs("EPSG:4326", "EPSG:28992", always_xy=True)


def rd_to_wgs84(x: float, y: float) -> tuple[float, float]:
    """
    Convert RD coordinates (EPSG:28992) to WGS84 (EPSG:4326).

    Args:
        x: RD X coordinate (meters)
        y: RD Y coordinate (meters)

    Returns:
        Tuple of (longitude, latitude) in WGS84
    """
    lon, lat = _rd_to_wgs84.transform(x, y)
    return lon, lat


def wgs84_to_rd(lon: float, lat: float) -> tuple[float, float]:
    """
    Convert WGS84 coordinates to RD (EPSG:28992).

    Args:
        lon: Longitude in WGS84
        lat: Latitude in WGS84

    Returns:
        Tuple of (x, y) in RD coordinates (meters)
    """
    x, y = _wgs84_to_rd.transform(lon, lat)
    return x, y


class RCEMonumentClient:
    """
    Client for RCE Rijksmonument API using Solr geospatial search.

    The RCE API uses Solr's geofilt for spatial queries, requiring WGS84 coordinates.
    Dutch building coordinates are typically in RD (EPSG:28992), so coordinate
    transformation via pyproj is required.
    """

    BASE_URL = "https://api.rijksmonumenten.info/select/"

    async def query_by_location(
        self,
        x: float,
        y: float,
        client: httpx.AsyncClient,
        distance_km: float = 0.05,
    ) -> list[dict]:
        """
        Query monuments by RD coordinates using Solr geofilt.

        Args:
            x: RD X coordinate (meters)
            y: RD Y coordinate (meters)
            client: httpx AsyncClient for connection pooling
            distance_km: Search radius in kilometers (default: 0.05 = 50 meters)

        Returns:
            List of monument documents from Solr response

        Note:
            RCE API may not use standard HTTP error codes. Errors are parsed from
            response structure rather than status codes.
        """
        # Convert RD to WGS84 for Solr geofilt query
        lon, lat = rd_to_wgs84(x, y)

        # Build Solr geospatial filter query
        # NOTE: Solr geofilt expects lat,lon order in the pt parameter
        params = {
            "q": "*:*",  # Match all documents
            "fq": "{!geofilt}",  # Geospatial filter
            "sfield": "abc_locatie",  # Field containing location data
            "pt": f"{lat},{lon}",  # Point in lat,lon format
            "d": str(distance_km),  # Distance in kilometers
            "wt": "json",  # Response format
            "rows": "10",  # Maximum results
        }

        response = await client.get(
            self.BASE_URL,
            params=params,
            timeout=30.0,
        )

        # RCE API may return 200 with error in response body
        # Parse response structure for results
        data = response.json()
        docs = data.get("response", {}).get("docs", [])

        return docs

    async def get_by_monument_number(
        self,
        monument_number: str,
        client: httpx.AsyncClient,
    ) -> dict | None:
        """
        Query monument by RCE monument number.

        Args:
            monument_number: RCE monument registration number
            client: httpx AsyncClient for connection pooling

        Returns:
            Monument document if found, None otherwise
        """
        params = {
            "q": f"rce_objrijksnr:{monument_number}",
            "wt": "json",
            "rows": "1",
        }

        response = await client.get(
            self.BASE_URL,
            params=params,
            timeout=30.0,
        )

        data = response.json()
        docs = data.get("response", {}).get("docs", [])

        return docs[0] if docs else None


# Module-level singleton for reuse across requests
_rce_client = RCEMonumentClient()
