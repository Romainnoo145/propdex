"""Service for wijk-related operations."""

import logging

import httpx

logger = logging.getLogger(__name__)


async def get_wijken_in_gemeente(
    gemeente_code: str,
    client: httpx.AsyncClient,
) -> dict:
    """
    Fetch wijk boundaries from CBS gebiedsindelingen WFS for a gemeente.

    Queries the CBS WFS service to retrieve all wijken (districts) within
    a given gemeente identified by its CBS gemeentecode. Returns GeoJSON
    FeatureCollection with wijk polygons in EPSG:4326 (WGS84) for direct
    MapLibre consumption.

    Args:
        gemeente_code: CBS gemeentecode (e.g., "0983" for Venlo)
        client: Shared httpx AsyncClient for HTTP requests

    Returns:
        dict: GeoJSON FeatureCollection with wijk features (EPSG:4326)
              Each feature has statcode (WK prefix) and statnaam properties

    Raises:
        ValueError: If no wijken found for gemeente
        httpx.HTTPError: If WFS request fails
    """
    # CBS gebiedsindelingen WFS 2024 (use 2024, NOT 2026 -- 2026 has incomplete wijk data)
    wfs_url = "https://service.pdok.nl/cbs/gebiedsindelingen/2024/wfs/v1_0"

    # Strip GM prefix if present: "GM0983" -> "0983"
    gemeente_statcode = gemeente_code.replace("GM", "")

    # Use OGC XML FILTER with PropertyIsLike wildcard pattern
    # Pattern: WK0983% matches WK098301, WK098302, etc.
    # CRITICAL: Use OGC XML FILTER (not CQL_FILTER -- silently ignored by PDOK CBS WFS)
    ogc_filter = (
        f"<Filter><PropertyIsLike wildCard='%' singleChar='_' escapeChar='\\\\'>"
        f"<PropertyName>statcode</PropertyName>"
        f"<Literal>WK{gemeente_statcode}%</Literal>"
        f"</PropertyIsLike></Filter>"
    )

    params = {
        "service": "WFS",
        "version": "2.0.0",
        "request": "GetFeature",
        "typeName": "gebiedsindelingen:wijk_gegeneraliseerd",
        "outputFormat": "application/json",
        "srsName": "EPSG:4326",  # WGS84 for direct MapLibre consumption
        "FILTER": ogc_filter,
        # No count parameter -- fetch ALL wijken (typically 5-100 per gemeente)
    }

    response = await client.get(wfs_url, params=params, timeout=30.0)
    response.raise_for_status()

    data = response.json()

    # Check if any features returned
    features = data.get("features", [])
    if not features:
        raise ValueError(f"No wijken found for gemeente {gemeente_code}")

    logger.info(f"Found {len(features)} wijken for gemeente {gemeente_code}")

    # Return full GeoJSON FeatureCollection (frontend needs the wrapper)
    return data
