"""Batch enrichment functions for coordinate-based and postcode-based data sources.

Used by area_scan.py to batch-fetch bodem contamination, soil type, and
funderingsrisico data during scan processing. Deduplicates API calls by
rounding coordinates/postcodes so nearby parcels share a single request.

Phase 99: Scan Pipeline Enrichment.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any

import httpx

from app.government_apis.bodemloket_arcgis import bodemloket_client
from app.government_apis.bro_bodemkaart import bro_bodemkaart_client
from app.government_apis.pdok_funderingsrisico import pdok_funderingsrisico_client

logger = logging.getLogger(__name__)

# Bodemloket: meter-rounded coords (RD is in meters, 1m precision is sufficient)
_BODEM_ROUND_M: int = 1
# BRO Bodemkaart 1:50000 scale: 50m rounding avoids redundant WMS queries
_BRO_ROUND_M: int = 50
# Concurrency limits per external service
_BODEM_CONCURRENCY: int = 3
_BRO_CONCURRENCY: int = 5
_FUNDER_CONCURRENCY: int = 5

# Minimal fields stored in scan_results.flags to keep JSONB lean
_BODEMLOKET_DISCLAIMER = (
    "Bodemloket bevat niet alle locaties in Nederland. "
    "Afwezigheid van een dossier is geen bodemkwaliteitsverklaring."
)


def _round_coord(val: float, precision: int) -> int:
    """Round a coordinate to the nearest multiple of `precision` meters."""
    return int(round(val / precision) * precision)


async def batch_fetch_bodem_data(
    centroids: list[tuple[str, float, float]],
    client: httpx.AsyncClient,
) -> dict[str, dict[str, Any]]:
    """Batch-fetch Bodemloket contamination and BRO soil type for parcel centroids.

    Args:
        centroids: List of (parcel_id, rd_x, rd_y) tuples in EPSG:28992.
        client: Shared httpx AsyncClient for connection pooling.

    Returns:
        Dict mapping parcel_id -> {"bodem": {...}, "bodemtype": {...}}.
        Missing keys indicate no data or API error (non-fatal).
    """
    if not centroids:
        return {}

    results: dict[str, dict[str, Any]] = {}

    # -- Deduplicate coordinates for Bodemloket (1m rounding) --
    bodem_key_to_parcels: dict[tuple[int, int], list[str]] = {}
    bodem_key_to_coord: dict[tuple[int, int], tuple[float, float]] = {}
    for parcel_id, x, y in centroids:
        key = (_round_coord(x, _BODEM_ROUND_M), _round_coord(y, _BODEM_ROUND_M))
        bodem_key_to_parcels.setdefault(key, []).append(parcel_id)
        bodem_key_to_coord.setdefault(key, (x, y))

    # -- Deduplicate coordinates for BRO (50m rounding) --
    bro_key_to_parcels: dict[tuple[int, int], list[str]] = {}
    bro_key_to_coord: dict[tuple[int, int], tuple[float, float]] = {}
    for parcel_id, x, y in centroids:
        key = (_round_coord(x, _BRO_ROUND_M), _round_coord(y, _BRO_ROUND_M))
        bro_key_to_parcels.setdefault(key, []).append(parcel_id)
        bro_key_to_coord.setdefault(key, (x, y))

    logger.info(
        "Bodem batch: %d parcels -> %d bodemloket queries, %d BRO queries",
        len(centroids),
        len(bodem_key_to_parcels),
        len(bro_key_to_parcels),
    )

    # -- Fetch Bodemloket contamination data --
    bodem_sem = asyncio.Semaphore(_BODEM_CONCURRENCY)
    bodem_results: dict[tuple[int, int], dict[str, Any] | None] = {}

    async def _fetch_bodem(key: tuple[int, int], x: float, y: float) -> None:
        async with bodem_sem:
            try:
                data = await bodemloket_client.query_by_point(x, y, client)
                bodem_results[key] = {
                    "dossiers_count": len(data.dossiers),
                    "has_known_contamination": len(data.dossiers) > 0,
                    "disclaimer": _BODEMLOKET_DISCLAIMER,
                }
            except Exception as exc:
                logger.warning("Bodemloket error at (%.0f, %.0f): %s", x, y, exc)
                bodem_results[key] = None

    await asyncio.gather(
        *[_fetch_bodem(k, *bodem_key_to_coord[k]) for k in bodem_key_to_parcels],
        return_exceptions=True,
    )

    # -- Fetch BRO Bodemkaart soil type --
    bro_sem = asyncio.Semaphore(_BRO_CONCURRENCY)
    bro_results: dict[tuple[int, int], dict[str, Any] | None] = {}

    async def _fetch_bro(key: tuple[int, int], x: float, y: float) -> None:
        async with bro_sem:
            try:
                props = await bro_bodemkaart_client.get_soil_at_point(x, y, client)
                if props is None:
                    bro_results[key] = None
                else:
                    bro_results[key] = {
                        "dominant_type": props.get("maparea_soilarea_geomorphological_feature_name"),
                        "dominant_type_label": props.get("normal_soilprofile_name"),
                        "soilcode": props.get("soilcode"),
                    }
            except Exception as exc:
                logger.warning("BRO Bodemkaart error at (%.0f, %.0f): %s", x, y, exc)
                bro_results[key] = None

    await asyncio.gather(
        *[_fetch_bro(k, *bro_key_to_coord[k]) for k in bro_key_to_parcels],
        return_exceptions=True,
    )

    # -- Fan out results to parcels --
    for parcel_id, x, y in centroids:
        entry: dict[str, Any] = {}
        bodem_key = (_round_coord(x, _BODEM_ROUND_M), _round_coord(y, _BODEM_ROUND_M))
        bodem_val = bodem_results.get(bodem_key)
        if bodem_val is not None:
            entry["bodem"] = bodem_val

        bro_key = (_round_coord(x, _BRO_ROUND_M), _round_coord(y, _BRO_ROUND_M))
        bro_val = bro_results.get(bro_key)
        if bro_val is not None:
            entry["bodemtype"] = bro_val

        if entry:
            results[parcel_id] = entry

    logger.info(
        "Bodem batch complete: %d/%d parcels enriched",
        len(results),
        len(centroids),
    )
    return results


async def batch_fetch_funderingsrisico_data(
    postcodes_by_parcel: dict[str, str],
    client: httpx.AsyncClient,
) -> dict[str, dict[str, Any]]:
    """Batch-fetch PDOK funderingsrisico data by unique postcode.

    Called after address resolution when postcodes are available.

    Args:
        postcodes_by_parcel: Dict mapping parcel_id -> PC6 postcode string.
        client: Shared httpx AsyncClient for connection pooling.

    Returns:
        Dict mapping parcel_id -> {"funderingsrisico": {fgr, legenda, percvoor1970}}.
        Missing keys indicate no data or invalid/missing postcode.
    """
    if not postcodes_by_parcel:
        return {}

    # Deduplicate by unique postcode
    pc6_to_parcels: dict[str, list[str]] = {}
    for parcel_id, pc6 in postcodes_by_parcel.items():
        if not pc6 or not isinstance(pc6, str):
            continue
        pc6_clean = pc6.strip().upper().replace(" ", "")
        if len(pc6_clean) == 6:
            pc6_to_parcels.setdefault(pc6_clean, []).append(parcel_id)

    logger.info(
        "Funderingsrisico batch: %d parcels -> %d unique postcodes",
        len(postcodes_by_parcel),
        len(pc6_to_parcels),
    )

    funder_sem = asyncio.Semaphore(_FUNDER_CONCURRENCY)
    pc6_results: dict[str, dict[str, Any] | None] = {}

    async def _fetch_funder(pc6: str) -> None:
        async with funder_sem:
            try:
                data = await pdok_funderingsrisico_client.get_by_postcode(pc6, client)
                if data is None:
                    pc6_results[pc6] = None
                else:
                    pc6_results[pc6] = {
                        "fgr": data.get("fgr"),
                        "legenda": data.get("legenda"),
                        "percvoor1970": data.get("percvoor1970"),
                    }
            except Exception as exc:
                logger.warning("PDOK Funderingsrisico error for pc6=%s: %s", pc6, exc)
                pc6_results[pc6] = None

    await asyncio.gather(
        *[_fetch_funder(pc6) for pc6 in pc6_to_parcels],
        return_exceptions=True,
    )

    # Fan out to all parcels sharing the same postcode
    results: dict[str, dict[str, Any]] = {}
    for pc6, parcel_ids in pc6_to_parcels.items():
        funder_val = pc6_results.get(pc6)
        if funder_val is not None:
            for parcel_id in parcel_ids:
                results[parcel_id] = {"funderingsrisico": funder_val}

    logger.info(
        "Funderingsrisico batch complete: %d/%d parcels enriched",
        len(results),
        len(postcodes_by_parcel),
    )
    return results
