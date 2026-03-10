"""Shared parcel address resolution helpers.

These helpers keep address assignment tied to actual BAG building overlap,
instead of parcel centroids. That avoids assigning a neighbor's house address
to an empty parcel.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any

import httpx
from shapely.geometry import shape

from app.government_apis.bag_wfs import bag_wfs_client
from app.government_apis.pdok_locatieserver import PDOKLocatieserver

logger = logging.getLogger(__name__)


@dataclass(slots=True)
class AddressResolution:
    """Result of a full reverse geocode including BAG identifiers."""

    address: str | None
    postcode: str | None
    nummeraanduiding_id: str | None
    vbo_id: str | None  # adresseerbaarobject_id from PDOK

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


async def reverse_geocode_rd_point_full(
    point_rd: tuple[float, float],
    client: httpx.AsyncClient,
) -> AddressResolution:
    """Reverse geocode an RD point and return full address resolution with BAG IDs.

    Uses PDOKLocatieserver.reverse_full() to get the complete doc dict, then
    extracts address, postcode, nummeraanduiding_id, and adresseerbaarobject_id
    (VBO ID).

    Args:
        point_rd: (x, y) RD coordinate tuple in EPSG:28992
        client: Shared HTTP client

    Returns:
        AddressResolution with all available fields (None for missing ones).
    """
    locatieserver = PDOKLocatieserver()
    try:
        doc = await locatieserver.reverse_full(point_rd[0], point_rd[1], client)
    except Exception as e:
        logger.debug("Reverse geocode full failed for RD point %s: %s", point_rd, e)
        return AddressResolution(address=None, postcode=None, nummeraanduiding_id=None, vbo_id=None)

    if not isinstance(doc, dict):
        return AddressResolution(address=None, postcode=None, nummeraanduiding_id=None, vbo_id=None)

    weergavenaam = doc.get("weergavenaam")
    address = weergavenaam.strip() if isinstance(weergavenaam, str) and weergavenaam.strip() else None

    postcode = doc.get("postcode")
    postcode = postcode.strip() if isinstance(postcode, str) and postcode.strip() else None

    nummeraanduiding_id = doc.get("nummeraanduiding_id")
    nummeraanduiding_id = (
        nummeraanduiding_id.strip()
        if isinstance(nummeraanduiding_id, str) and nummeraanduiding_id.strip()
        else None
    )

    vbo_id = doc.get("adresseerbaarobject_id")
    vbo_id = vbo_id.strip() if isinstance(vbo_id, str) and vbo_id.strip() else None

    return AddressResolution(
        address=address,
        postcode=postcode,
        nummeraanduiding_id=nummeraanduiding_id,
        vbo_id=vbo_id,
    )
