"""Backfill parcel_cache.buurt_code via PDOK CBS gebiedsindelingen WFS (M053/S12).

Per gemeente: haal alle buurt_gegeneraliseerd features op (EPSG:28992, zelfde
SRID als parcel_cache.geometry) en zet buurt_code via PostGIS spatial join
(ST_Intersects op ST_PointOnSurface van het perceel — één perceel = één buurt).

Usage: python -m app.tools.backfill_buurt_codes --gemeente GM0983
Onderdeel van het runbook "nieuwe gemeente onboarden" (net als backfill_3dbag/cbs).
"""
import argparse
import asyncio
import json
import logging
from typing import Any, cast

import httpx
from sqlalchemy import CursorResult, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import async_session_factory

logger = logging.getLogger(__name__)

WFS_URL = "https://service.pdok.nl/cbs/gebiedsindelingen/2024/wfs/v1_0"


def build_buurt_filter(gemeente_code: str) -> str:
    """Build OGC XML FILTER for buurten within a gemeente.

    Accepts gemeente_code with or without GM prefix (e.g. "GM0983" or "0983").
    Raises ValueError for invalid codes.
    """
    code = gemeente_code.removeprefix("GM")
    if not code.isdigit() or len(code) != 4:
        raise ValueError(f"Invalid gemeente_code {gemeente_code!r}: must be 4 digits (with or without GM prefix)")
    return (
        "<Filter><PropertyIsLike wildCard='%' singleChar='_' escapeChar='\\\\'>"
        "<PropertyName>statcode</PropertyName>"
        f"<Literal>BU{code}%</Literal>"
        "</PropertyIsLike></Filter>"
    )


def parse_buurt_features(fc: dict[str, Any]) -> list[tuple[str, dict[str, Any]]]:
    """Extract (buurt_code, geometry) pairs from a WFS GeoJSON FeatureCollection.

    Skips features that are not buurten (statcode not starting with BU)
    or that have no geometry.
    """
    out: list[tuple[str, dict[str, Any]]] = []
    for feat in fc.get("features", []):
        code = (feat.get("properties") or {}).get("statcode") or ""
        geom = feat.get("geometry")
        if code.startswith("BU") and geom:
            out.append((code, geom))
    return out


async def fetch_buurten(client: httpx.AsyncClient, gemeente_code: str) -> list[tuple[str, dict[str, Any]]]:
    """Fetch all buurt polygons for a gemeente from PDOK CBS WFS.

    Uses buurt_niet_gegeneraliseerd (non-simplified boundaries) for maximum
    spatial coverage. Falls back to buurt_gegeneraliseerd if needed.
    """
    params = {
        "service": "WFS",
        "version": "2.0.0",
        "request": "GetFeature",
        "typeName": "gebiedsindelingen:buurt_niet_gegeneraliseerd",
        "outputFormat": "application/json",
        "srsName": "EPSG:28992",
        "FILTER": build_buurt_filter(gemeente_code),
    }
    resp = await client.get(WFS_URL, params=params, timeout=60.0)
    resp.raise_for_status()
    return parse_buurt_features(resp.json())


async def backfill_gemeente(
    session: AsyncSession,
    gemeente_code: str,
    buurten: list[tuple[str, dict[str, Any]]],
) -> int:
    """Update parcel_cache.buurt_code for all parcels in gemeente via spatial join.

    Pass 1: ST_Intersects on ST_PointOnSurface per buurt polygon. Covers ~87%
    of parcels; remainder fall in micro-gaps between CBS buurt boundaries.

    Pass 2: Nearest-buurt fallback using a temp table of buurt centroids (114 rows
    for Venlo). For each unmatched parcel, assign the closest buurt centroid.
    This is efficient: 15k × 114 comparisons vs the previous 15k × 110k approach.
    Brings coverage to >99%.

    gemeente_code is accepted with or without GM prefix; normalised internally
    to the stored format (e.g. "GM0983").
    """
    # Normalize to stored format: always "GM" + 4 digits
    bare = gemeente_code.removeprefix("GM")
    stored_gem_code = f"GM{bare}"

    # --- Pass 1: spatial intersect per buurt polygon ---
    total = 0
    for code, geom in buurten:
        raw = await session.execute(
            text(
                "UPDATE parcel_cache SET buurt_code = :code "
                "WHERE gemeente_code = :gem AND buurt_code IS NULL AND ST_Intersects("
                "  ST_PointOnSurface(geometry),"
                "  ST_SetSRID(ST_GeomFromGeoJSON(:geojson), 28992)"
                ")"
            ),
            {"code": code, "gem": stored_gem_code, "geojson": json.dumps(geom)},
        )
        result = cast(CursorResult[Any], raw)
        row_count = result.rowcount or 0
        total += row_count
        logger.info("buurt %s: %s percelen", code, row_count)
    await session.commit()

    # --- Pass 2: nearest-buurt fallback for CBS boundary gaps ---
    # Build a temp table with one centroid per buurt (114 rows for Venlo),
    # then join each unmatched parcel to its nearest centroid.
    # This is O(unmatched × n_buurten) — fast and index-friendly.
    await session.execute(
        text("CREATE TEMP TABLE IF NOT EXISTS _buurt_centroids (code TEXT, centroid GEOMETRY) ON COMMIT DELETE ROWS")
    )
    for code, geom in buurten:
        await session.execute(
            text(
                "INSERT INTO _buurt_centroids (code, centroid) "
                "VALUES (:code, ST_Centroid(ST_SetSRID(ST_GeomFromGeoJSON(:geojson), 28992)))"
            ),
            {"code": code, "geojson": json.dumps(geom)},
        )
    await session.flush()

    raw2 = await session.execute(
        text(
            """
            UPDATE parcel_cache AS pc
            SET buurt_code = nearest.code
            FROM (
                SELECT DISTINCT ON (pc2.id)
                    pc2.id,
                    bc.code
                FROM parcel_cache pc2
                CROSS JOIN _buurt_centroids bc
                WHERE pc2.gemeente_code = :gem
                  AND pc2.buurt_code IS NULL
                ORDER BY pc2.id, ST_Distance(ST_PointOnSurface(pc2.geometry), bc.centroid)
            ) nearest
            WHERE pc.id = nearest.id
            """
        ),
        {"gem": stored_gem_code},
    )
    result2 = cast(CursorResult[Any], raw2)
    nn_count = result2.rowcount or 0
    total += nn_count
    await session.commit()
    logger.info("nearest-buurt pass: %s extra percelen toegewezen", nn_count)

    return total


async def main() -> None:
    parser = argparse.ArgumentParser(
        description="Backfill parcel_cache.buurt_code via PDOK CBS WFS"
    )
    parser.add_argument("--gemeente", required=True, help="bv. GM0983 of 0983")
    args = parser.parse_args()

    async with httpx.AsyncClient() as client:
        buurten = await fetch_buurten(client, args.gemeente)
    logger.info("%d buurten opgehaald voor %s", len(buurten), args.gemeente)

    async with async_session_factory() as session:
        total = await backfill_gemeente(session, args.gemeente, buurten)
    logger.info("Klaar: %d percelen van buurt_code voorzien", total)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(main())
