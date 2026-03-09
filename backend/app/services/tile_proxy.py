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
        -- Pick the best scan result per parcel: prefer the given scan_id,
        -- otherwise fall back to the most recent completed scan that has it.
        best_sr AS (
            SELECT DISTINCT ON (sr.parcel_id)
                sr.parcel_id,
                sr.score,
                sr.flags
            FROM scan_results sr
            JOIN area_scans a ON a.id = sr.scan_id
            WHERE sr.organization_id = :org_id
            AND a.status = 'completed'
            ORDER BY sr.parcel_id,
                     CASE WHEN sr.scan_id = :scan_id THEN 0 ELSE 1 END,
                     a.completed_at DESC
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
                (sr.flags->>'vacancy_confidence')::float AS vacancy_confidence,
                sr.flags->>'vacancy_model_version' AS vacancy_model_version,
                (sr.flags->'market_signals'->>'listing_duration_days')::int
                    AS listing_duration_days,
                (sr.flags->'market_signals'->>'price_change_count')::int
                    AS price_change_count,
                (sr.flags->'market_signals'->>'listing_snapshots_count')::int
                    AS listing_snapshots_count,
                (sr.flags->'market_signals'->>'days_since_last_seen')::int
                    AS days_since_last_seen,
                (sr.flags->'building_metrics'->>'max_bebouwingspercentage')::float
                    AS max_bebouwingspercentage,
                (sr.flags->'building_metrics'->>'max_floor_area_ratio')::float
                    AS max_floor_area_ratio,
                (rep.id IS NOT NULL) AS has_report
            FROM parcel_cache pc
            JOIN best_sr sr ON sr.parcel_id = pc.id
            LEFT JOIN saved_reports rep
              ON rep.organization_id = pc.organization_id
             AND rep.source_parcel_id = pc.id
             AND rep.deleted_at IS NULL
            CROSS JOIN bounds
            WHERE pc.organization_id = :org_id
            AND ST_Intersects(pc.geometry, bounds.geom)
            -- Hide non-developable parcels (infrastructure + protected land)
            AND NOT (pc.bestemmingen::text ILIKE '%%"type": "verkeer"%%')
            AND NOT (pc.bestemmingen::text ILIKE '%%"type": "water"%%')
            AND NOT (pc.bestemmingen::text ILIKE '%%"type": "natuur"%%')
            AND NOT (pc.bestemmingen::text ILIKE '%%"type": "bos"%%')
            AND NOT (pc.bestemmingen::text ILIKE '%%"type": "agrarisch"%%')
            AND NOT (pc.bestemmingen::text ILIKE '%%"type": "agrarisch met waarden"%%')
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
