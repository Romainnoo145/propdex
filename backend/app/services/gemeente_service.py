"""Service for gemeente-related operations."""

import logging

import httpx
from shapely.geometry import shape

logger = logging.getLogger(__name__)


async def get_gemeente_bbox(
    gemeente_code: str,
    client: httpx.AsyncClient,
) -> dict:
    """
    Fetch gemeente bounding box from CBS gebiedsindelingen WFS.

    Queries the CBS WFS service to retrieve the bounding box for a given
    gemeente identified by its CBS gemeentecode. Returns coordinates in
    EPSG:28992 (RD New).

    Args:
        gemeente_code: CBS gemeentecode (e.g., "0363" for Amsterdam)
        client: Shared httpx AsyncClient for HTTP requests

    Returns:
        dict: Bounding box with keys: minx, miny, maxx, maxy (EPSG:28992)

    Raises:
        ValueError: If gemeente not found in CBS data
        httpx.HTTPError: If WFS request fails
    """
    # CBS gebiedsindelingen WFS 2024 (latest stable year)
    wfs_url = "https://service.pdok.nl/cbs/gebiedsindelingen/2024/wfs/v1_0"

    params = {
        "service": "WFS",
        "version": "2.0.0",
        "request": "GetFeature",
        "typeName": "gemeenten",
        "outputFormat": "application/json",  # Request GeoJSON for easy parsing
        "CQL_FILTER": f"gemeentecode='{gemeente_code}'",  # CQL filter syntax
    }

    response = await client.get(wfs_url, params=params, timeout=30.0)
    response.raise_for_status()

    data = response.json()

    # Check if any features returned
    features = data.get("features", [])
    if not features:
        raise ValueError(f"Gemeente {gemeente_code} not found in CBS data")

    # Extract geometry from first feature
    feature = features[0]
    geometry = feature.get("geometry")

    if not geometry:
        raise ValueError(f"Gemeente {gemeente_code} has no geometry")

    # Use shapely to compute bounds from GeoJSON geometry
    geom = shape(geometry)
    minx, miny, maxx, maxy = geom.bounds

    logger.info(f"Gemeente {gemeente_code} bbox: {minx},{miny},{maxx},{maxy}")

    return {
        "minx": minx,
        "miny": miny,
        "maxx": maxx,
        "maxy": maxy,
    }
