"""MVT tile generation with multi-tenant filtering.

Generates Mapbox Vector Tiles (MVT) directly from PostGIS using ST_AsMVT,
filtered by organization_id for multi-tenant isolation.

This approach bypasses Martin for security -- no external service has full
table access. Per research pitfall #3: NEVER expose Martin directly to frontend.

Benefits over Martin proxy:
1. Built-in multi-tenant filtering via SQL WHERE clause
2. No risk of cross-tenant data leakage
3. Score data included via JOIN (Martin only serves parcel_cache columns)
4. No additional infrastructure dependency
"""

import uuid
from math import atan, pi, sinh

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


def _tile_to_bbox(z: int, x: int, y: int) -> tuple[float, float, float, float]:
    """Convert tile coordinates to EPSG:4326 bounding box.

    Uses standard slippy map tile formula to calculate the geographic
    extent of a single map tile.

    Args:
        z: Zoom level
        x: Tile column
        y: Tile row

    Returns:
        Tuple of (lon_min, lat_min, lon_max, lat_max) in EPSG:4326
    """
    n = 2**z
    lon_min = x / n * 360 - 180
    lon_max = (x + 1) / n * 360 - 180
    lat_max = atan(sinh(pi * (1 - 2 * y / n))) * 180 / pi
    lat_min = atan(sinh(pi * (1 - 2 * (y + 1) / n))) * 180 / pi
    return lon_min, lat_min, lon_max, lat_max


async def generate_mvt_tile(
    z: int,
    x: int,
    y: int,
    organization_id: uuid.UUID,
    scan_id: uuid.UUID,
    db: AsyncSession,
) -> bytes | None:
    """Generate MVT tile directly from PostGIS with tenant filtering.

    Uses ST_AsMVT + ST_AsMVTGeom for server-side tile generation,
    filtered by organization_id for multi-tenant isolation and by
    scan_id to scope to the active scan's results.

    The query joins parcel_cache (geometry) with scan_results (score)
    and transforms coordinates from storage EPSG:28992 to tile bounds
    derived from EPSG:4326.

    Args:
        z: Tile zoom level
        x: Tile column
        y: Tile row
        organization_id: Tenant UUID for data isolation
        scan_id: Scan UUID to scope results
        db: Async database session

    Returns:
        MVT binary data or None if no data for tile
    """
    lon_min, lat_min, lon_max, lat_max = _tile_to_bbox(z, x, y)

    query = text("""
        WITH
        bounds AS (
            SELECT ST_Transform(
                ST_MakeEnvelope(:lon_min, :lat_min, :lon_max, :lat_max, 4326),
                28992
            ) AS geom
        ),
        mvt_data AS (
            SELECT
                ST_AsMVTGeom(
                    pc.geometry,
                    bounds.geom,
                    4096, 256, true
                ) AS geom,
                pc.id::text AS parcel_id,
                pc.parcel_id AS parcel_code,
                pc.address,
                pc.gemeente_code,
                pc.area_m2,
                pc.has_pand,
                pc.bouwjaar,
                pc.pand_status,
                sr.score,
                sr.flags->>'category' AS score_category,
                sr.flags->>'vacancy_signal' AS vacancy_signal,
                (sr.flags->'building_metrics'->>'max_bebouwingspercentage')::float
                    AS max_bebouwingspercentage,
                (sr.flags->'building_metrics'->>'max_floor_area_ratio')::float
                    AS max_floor_area_ratio
            FROM parcel_cache pc
            JOIN scan_results sr ON sr.parcel_id = pc.id
            CROSS JOIN bounds
            WHERE pc.organization_id = :org_id
            AND sr.scan_id = :scan_id
            AND sr.organization_id = :org_id
            AND ST_Intersects(pc.geometry, bounds.geom)
        )
        SELECT ST_AsMVT(mvt_data, 'parcel_scores', 4096, 'geom')
        FROM mvt_data
    """)

    result = await db.execute(
        query,
        {
            "lon_min": lon_min,
            "lat_min": lat_min,
            "lon_max": lon_max,
            "lat_max": lat_max,
            "org_id": str(organization_id),
            "scan_id": str(scan_id),
        },
    )

    row = result.scalar()
    if not row or len(row) == 0:
        return None
    return bytes(row)
