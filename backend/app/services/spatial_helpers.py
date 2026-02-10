"""Spatial query helper functions for bounding box queries, coordinate transformation, and GeoJSON output."""

from __future__ import annotations

import json
import logging
import uuid

from pyproj import Transformer
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.parcel_cache import ParcelCache

logger = logging.getLogger(__name__)

# Module-level transformers (thread-safe, reusable)
_transformer_to_4326 = Transformer.from_crs("EPSG:28992", "EPSG:4326", always_xy=True)
_transformer_to_28992 = Transformer.from_crs("EPSG:4326", "EPSG:28992", always_xy=True)


async def find_parcels_in_bbox(
    minx: float,
    miny: float,
    maxx: float,
    maxy: float,
    db: AsyncSession,
    limit: int = 10000,
) -> list[ParcelCache]:
    """
    Find parcels within a bounding box using GIST-accelerated spatial query.

    Uses two-stage filtering for optimal performance:
    1. GIST index pre-filter with && operator (bounding box intersection)
    2. Precise ST_Intersects check

    Args:
        minx: Minimum X coordinate in EPSG:28992 (RD New)
        miny: Minimum Y coordinate in EPSG:28992 (RD New)
        maxx: Maximum X coordinate in EPSG:28992 (RD New)
        maxy: Maximum Y coordinate in EPSG:28992 (RD New)
        db: SQLAlchemy async session
        limit: Maximum number of parcels to return (default 10000)

    Returns:
        List of ParcelCache objects intersecting the bounding box
    """
    # Create envelope in EPSG:28992
    bbox = func.ST_MakeEnvelope(minx, miny, maxx, maxy, 28992)

    # Two-stage filter: && pre-filter (GIST index) + ST_Intersects (precise)
    stmt = (
        select(ParcelCache)
        .where(ParcelCache.geometry.op("&&")(bbox))  # Stage 1: GIST index scan
        .where(func.ST_Intersects(ParcelCache.geometry, bbox))  # Stage 2: precise check
        .limit(limit)
    )

    result = await db.execute(stmt)
    return result.scalars().all()


async def get_parcel_as_geojson(
    parcel_id: uuid.UUID,
    db: AsyncSession,
) -> dict | None:
    """
    Get single parcel as EPSG:4326 GeoJSON Feature.

    Returns parcel geometry transformed to WGS84 (EPSG:4326) for web map compatibility,
    with all Tier 1 properties needed for map rendering.

    Args:
        parcel_id: UUID of the parcel in parcel_cache table
        db: SQLAlchemy async session

    Returns:
        GeoJSON Feature dict with properties and geometry, or None if not found
    """
    # Select Tier 1 fields + transformed geometry as GeoJSON
    stmt = select(
        ParcelCache.id,
        ParcelCache.parcel_id,
        ParcelCache.address,
        ParcelCache.gemeente_code,
        ParcelCache.area_m2,
        ParcelCache.has_pand,
        ParcelCache.bestemmingen,
        func.ST_AsGeoJSON(func.ST_Transform(ParcelCache.geometry, 4326)).label("geojson"),
    ).where(ParcelCache.id == parcel_id)

    result = await db.execute(stmt)
    row = result.one_or_none()

    if not row:
        return None

    # Parse GeoJSON geometry string
    geometry = json.loads(row.geojson)

    # Build GeoJSON Feature
    return {
        "type": "Feature",
        "id": str(row.id),
        "properties": {
            "parcel_id": row.parcel_id,
            "address": row.address,
            "gemeente_code": row.gemeente_code,
            "area_m2": row.area_m2,
            "has_pand": row.has_pand,
            "bestemmingen": row.bestemmingen,
        },
        "geometry": geometry,
    }


async def get_parcels_as_feature_collection(
    parcel_ids: list[uuid.UUID],
    db: AsyncSession,
) -> dict:
    """
    Get multiple parcels as GeoJSON FeatureCollection.

    Batch query for efficient retrieval of multiple parcels with geometries
    transformed to EPSG:4326 for web map compatibility.

    Args:
        parcel_ids: List of parcel UUIDs
        db: SQLAlchemy async session

    Returns:
        GeoJSON FeatureCollection with features array
    """
    if not parcel_ids:
        return {"type": "FeatureCollection", "features": []}

    # Batch query with IN clause
    stmt = select(
        ParcelCache.id,
        ParcelCache.parcel_id,
        ParcelCache.address,
        ParcelCache.gemeente_code,
        ParcelCache.area_m2,
        ParcelCache.has_pand,
        ParcelCache.bestemmingen,
        func.ST_AsGeoJSON(func.ST_Transform(ParcelCache.geometry, 4326)).label("geojson"),
    ).where(ParcelCache.id.in_(parcel_ids))

    result = await db.execute(stmt)
    rows = result.all()

    # Transform rows to GeoJSON Features
    features = []
    for row in rows:
        geometry = json.loads(row.geojson)
        feature = {
            "type": "Feature",
            "id": str(row.id),
            "properties": {
                "parcel_id": row.parcel_id,
                "address": row.address,
                "gemeente_code": row.gemeente_code,
                "area_m2": row.area_m2,
                "has_pand": row.has_pand,
                "bestemmingen": row.bestemmingen,
            },
            "geometry": geometry,
        }
        features.append(feature)

    return {
        "type": "FeatureCollection",
        "features": features,
    }


async def validate_and_fix_geometry(
    geom_wkt: str,
    db: AsyncSession,
    srid: int = 28992,
) -> str:
    """
    Validate geometry and auto-repair if invalid.

    Checks geometry validity using ST_IsValid. If invalid, logs the reason
    via ST_IsValidReason and repairs using ST_MakeValid. Returns WKT of the
    validated or repaired geometry.

    Args:
        geom_wkt: Well-Known Text representation of geometry
        srid: Spatial Reference System ID (default 28992 for RD New)
        db: SQLAlchemy async session

    Returns:
        WKT string of validated/repaired geometry
    """
    # Parse WKT to geometry
    geom = func.ST_GeomFromText(geom_wkt, srid)

    # Check validity
    validity_stmt = select(func.ST_IsValid(geom))
    validity_result = await db.execute(validity_stmt)
    is_valid = validity_result.scalar()

    if not is_valid:
        # Log reason for invalidity
        reason_stmt = select(func.ST_IsValidReason(geom))
        reason_result = await db.execute(reason_stmt)
        reason = reason_result.scalar()
        logger.warning(f"Invalid geometry detected: {reason}. Auto-repairing with ST_MakeValid.")

        # Repair geometry
        geom = func.ST_MakeValid(geom)

    # Return WKT of validated/repaired geometry
    wkt_stmt = select(func.ST_AsText(geom))
    wkt_result = await db.execute(wkt_stmt)
    return wkt_result.scalar()


# --- Python-side coordinate transformation helpers (no DB needed) ---


def transform_point_to_wgs84(x: float, y: float) -> tuple[float, float]:
    """
    Transform EPSG:28992 (RD New) point to EPSG:4326 (WGS84).

    Args:
        x: X coordinate in EPSG:28992 (RD New)
        y: Y coordinate in EPSG:28992 (RD New)

    Returns:
        Tuple of (longitude, latitude) in EPSG:4326
    """
    lon, lat = _transformer_to_4326.transform(x, y)
    return lon, lat


def transform_point_to_rd(lon: float, lat: float) -> tuple[float, float]:
    """
    Transform EPSG:4326 (WGS84) point to EPSG:28992 (RD New).

    Args:
        lon: Longitude in EPSG:4326
        lat: Latitude in EPSG:4326

    Returns:
        Tuple of (x, y) in EPSG:28992 (RD New)
    """
    x, y = _transformer_to_28992.transform(lon, lat)
    return x, y


def transform_bbox_to_wgs84(
    minx: float,
    miny: float,
    maxx: float,
    maxy: float,
) -> tuple[float, float, float, float]:
    """
    Transform EPSG:28992 bounding box to EPSG:4326.

    Args:
        minx: Minimum X in EPSG:28992
        miny: Minimum Y in EPSG:28992
        maxx: Maximum X in EPSG:28992
        maxy: Maximum Y in EPSG:28992

    Returns:
        Tuple of (min_lon, min_lat, max_lon, max_lat) in EPSG:4326
    """
    min_lon, min_lat = _transformer_to_4326.transform(minx, miny)
    max_lon, max_lat = _transformer_to_4326.transform(maxx, maxy)
    return min_lon, min_lat, max_lon, max_lat


def transform_bbox_to_rd(
    min_lon: float,
    min_lat: float,
    max_lon: float,
    max_lat: float,
) -> tuple[float, float, float, float]:
    """
    Transform EPSG:4326 bounding box to EPSG:28992.

    Args:
        min_lon: Minimum longitude in EPSG:4326
        min_lat: Minimum latitude in EPSG:4326
        max_lon: Maximum longitude in EPSG:4326
        max_lat: Maximum latitude in EPSG:4326

    Returns:
        Tuple of (minx, miny, maxx, maxy) in EPSG:28992 (RD New)
    """
    minx, miny = _transformer_to_28992.transform(min_lon, min_lat)
    maxx, maxy = _transformer_to_28992.transform(max_lon, max_lat)
    return minx, miny, maxx, maxy
