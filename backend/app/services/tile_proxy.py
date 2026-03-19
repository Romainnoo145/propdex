"""MVT tile generation for scan results.

Generates Mapbox Vector Tiles (MVT) directly from PostGIS using ST_AsMVT.
All scan data is shared — no org-scoped filtering.

This approach bypasses Martin for security -- no external service has full
table access. Per research pitfall #3: NEVER expose Martin directly to frontend.

Benefits over Martin proxy:
1. Score data included via JOIN (Martin only serves parcel_cache columns)
2. No additional infrastructure dependency
3. Filtering logic (infrastructure, roads, parks) applied at tile level
"""

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
    scan_id: int | None,
    db: AsyncSession,
) -> bytes | None:
    """Generate MVT tile directly from PostGIS.

    Uses ST_AsMVT + ST_AsMVTGeom for server-side tile generation.
    Scan data is shared — no org-scoped filtering.

    The query joins parcel_cache (geometry) with scan_results (score)
    and transforms coordinates from storage EPSG:28992 to tile bounds
    derived from EPSG:4326.

    Args:
        z: Tile zoom level
        x: Tile column
        y: Tile row
        scan_id: Scan UUID to scope results (unused currently, kept for API compat)
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
        -- One scan_result per parcel (unique constraint on parcel_id).
        best_sr AS (
            SELECT sr.parcel_id,
                   sr.score,
                   sr.flags
            FROM scan_results sr
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
                (sr.flags->'scores'->>'potentie')::float AS potentie_score,
                (sr.flags->'scores'->>'risico')::float AS risico_score,
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
                CASE
                    WHEN pc.bouwjaar IS NULL THEN 'onbekend'
                    WHEN pc.bouwjaar < 1970 THEN 'hoog'
                    WHEN pc.bouwjaar < 1990 THEN 'middel'
                    ELSE 'laag'
                END AS foundation_risk_level,
                (rep.id IS NOT NULL) AS has_report
            FROM parcel_cache pc
            JOIN best_sr sr ON sr.parcel_id = pc.id
            LEFT JOIN saved_reports rep
              ON rep.source_parcel_id = pc.id
             AND rep.deleted_at IS NULL
            CROSS JOIN bounds
            WHERE ST_Intersects(pc.geometry, bounds.geom)
            -- Hide non-developable parcels (infrastructure + protected land)
            AND NOT (pc.bestemmingen::text ILIKE '%%"type": "verkeer"%%')
            AND NOT (pc.bestemmingen::text ILIKE '%%"type": "water"%%')
            AND NOT (pc.bestemmingen::text ILIKE '%%"type": "natuur"%%')
            AND NOT (pc.bestemmingen::text ILIKE '%%"type": "bos"%%')
            AND NOT (pc.bestemmingen::text ILIKE '%%"type": "agrarisch"%%')
            AND NOT (pc.bestemmingen::text ILIKE '%%"type": "agrarisch met waarden"%%')
            -- Hide large green zones (>2000m2 = parks, not development opportunities)
            AND NOT (
                pc.bestemmingen::text ILIKE '%%"type": "groen"%%'
                AND COALESCE(pc.area_m2, 0) > 2000
            )
            -- Hide obvious road/strip parcels (shape ratio > 10 = roads)
            AND NOT (
                pc.area_m2 > 0
                AND ST_Perimeter(pc.geometry) / SQRT(pc.area_m2) > 10
            )
            -- Hide elongated parcels without a real building on them
            -- (shape 8-10 is suspicious; only keep if building covers >5% of area)
            AND NOT (
                pc.area_m2 > 0
                AND ST_Perimeter(pc.geometry) / SQRT(pc.area_m2) > 8
                AND (
                    NOT pc.has_pand
                    OR (sr.flags->'building_metrics'->>'pand_oppervlakte_m2') IS NULL
                    OR (sr.flags->'building_metrics'->>'pand_oppervlakte_m2')::float
                       / pc.area_m2 < 0.05
                )
            )
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
        },
    )

    row = result.scalar()
    if not row or len(row) == 0:
        return None
    return bytes(row)
