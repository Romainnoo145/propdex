"""Shared parcel address resolution helpers.

These helpers keep address assignment tied to actual BAG building overlap,
instead of parcel centroids. That avoids assigning a neighbor's house address
to an empty parcel.
"""

from __future__ import annotations

import logging
from typing import Any

import httpx
from shapely.geometry import shape

from app.government_apis.bag_wfs import bag_wfs_client
from app.government_apis.pdok_locatieserver import PDOKLocatieserver

logger = logging.getLogger(__name__)

# Ignore pure boundary touches; require measurable overlap with the parcel.
MIN_BUILDING_OVERLAP_M2 = 0.01
# Building must cover at least 5% of parcel area to count as "on" the parcel.
# Prevents tiny boundary overlaps (neighbor's wall overhang) from assigning
# has_pand=true and a borrowed address to road/sidewalk parcels.
MIN_BUILDING_OVERLAP_RATIO = 0.05


async def find_bag_building_lookup_point(
    parcel_geometry: dict[str, Any],
    client: httpx.AsyncClient,
) -> tuple[float, float] | None:
    """Return a representative RD point for the best-overlapping BAG building.

    Args:
        parcel_geometry: Parcel geometry in EPSG:28992 GeoJSON
        client: Shared HTTP client

    Returns:
        (x, y) RD coordinate tuple for reverse geocoding, or None when the
        parcel has no BAG building with actual overlapping area.
    """
    try:
        parcel_shape = shape(parcel_geometry)
    except Exception as e:
        logger.debug("Failed to parse parcel geometry for address lookup: %s", e)
        return None

    if parcel_shape.is_empty:
        return None

    minx, miny, maxx, maxy = parcel_shape.bounds
    pad = 5.0
    try:
        bag_features = await bag_wfs_client.get_panden_in_bbox(
            minx - pad,
            miny - pad,
            maxx + pad,
            maxy + pad,
            client,
        )
    except Exception as e:
        logger.debug("BAG lookup failed for parcel address resolution: %s", e)
        return None

    best_overlap_area = 0.0
    best_point: tuple[float, float] | None = None

    for feature in bag_features:
        geometry = feature.get("geometry")
        if not isinstance(geometry, dict):
            continue
        try:
            building_shape = shape(geometry)
        except Exception:
            continue
        if building_shape.is_empty:
            continue
        overlap_area = building_shape.intersection(parcel_shape).area
        if overlap_area < MIN_BUILDING_OVERLAP_M2:
            continue
        parcel_area = parcel_shape.area
        if parcel_area > 0 and overlap_area / parcel_area < MIN_BUILDING_OVERLAP_RATIO:
            continue
        if overlap_area > best_overlap_area:
            point = building_shape.representative_point()
            best_overlap_area = overlap_area
            best_point = (float(point.x), float(point.y))

    return best_point


async def reverse_geocode_rd_point(
    point_rd: tuple[float, float],
    client: httpx.AsyncClient,
) -> str | None:
    """Reverse geocode an RD point to a display address."""
    locatieserver = PDOKLocatieserver()
    try:
        result = await locatieserver.reverse(point_rd[0], point_rd[1], client)
    except Exception as e:
        logger.debug("Reverse geocode failed for RD point %s: %s", point_rd, e)
        return None
    if not isinstance(result, str):
        return None
    normalized = result.strip()
    return normalized or None
