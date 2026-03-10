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
from app.government_apis.ep_online import ep_online_client
from app.government_apis.pdok_funderingsrisico import pdok_funderingsrisico_client
from app.government_apis.sru_bekendmakingen import sru_client
from app.government_apis.woz_waardeloket import woz_waardeloket_client

logger = logging.getLogger(__name__)

# Bodemloket: meter-rounded coords (RD is in meters, 1m precision is sufficient)
_BODEM_ROUND_M: int = 1
# BRO Bodemkaart 1:50000 scale: 50m rounding avoids redundant WMS queries
_BRO_ROUND_M: int = 50
# Concurrency limits per external service
_BODEM_CONCURRENCY: int = 3
_BRO_CONCURRENCY: int = 5
_FUNDER_CONCURRENCY: int = 5
_SRU_CONCURRENCY: int = 3
_EP_ONLINE_CONCURRENCY: int = 5
_WOZ_CONCURRENCY: int = 5

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


async def batch_fetch_postcode_enrichment(
    postcodes_by_parcel: dict[str, str],
    client: httpx.AsyncClient,
) -> dict[str, dict[str, Any]]:
    """Batch-fetch postcode-level enrichment: vergunningen (SRU) + funderingsrisico.

    Deduplicates by unique postcode so a wijk with 500 parcels but 30 unique
    postcodes only makes ~30 SRU + 30 funderingsrisico requests.

    Args:
        postcodes_by_parcel: Dict mapping parcel_id -> PC6 postcode string.
        client: Shared httpx AsyncClient for connection pooling.

    Returns:
        Dict mapping parcel_id -> {"vergunningen": {...}, "funderingsrisico": {...}}.
        Missing sub-keys indicate no data or API error (non-fatal).
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
        "Postcode enrichment batch: %d parcels -> %d unique postcodes",
        len(postcodes_by_parcel),
        len(pc6_to_parcels),
    )

    # -- SRU Bekendmakingen per unique postcode --
    sru_sem = asyncio.Semaphore(_SRU_CONCURRENCY)
    sru_results: dict[str, dict[str, Any] | None] = {}

    async def _fetch_sru(pc6: str) -> None:
        async with sru_sem:
            try:
                records = await sru_client.query_by_postcode(pc6, client, max_records=100)
                sru_results[pc6] = {
                    "records": [
                        {
                            "title": r.get("title", ""),
                            "type": r.get("type", ""),
                            "date": r.get("date", ""),
                            "identifier": r.get("identifier", ""),
                        }
                        for r in records
                    ],
                    "total_postcode_count": len(records),
                }
            except Exception as exc:
                logger.warning("SRU bekendmakingen error for pc6=%s: %s", pc6, exc)
                sru_results[pc6] = None

    # -- Funderingsrisico per unique postcode --
    funder_sem = asyncio.Semaphore(_FUNDER_CONCURRENCY)
    funder_results: dict[str, dict[str, Any] | None] = {}

    async def _fetch_funder(pc6: str) -> None:
        async with funder_sem:
            try:
                data = await pdok_funderingsrisico_client.get_by_postcode(pc6, client)
                if data is None:
                    funder_results[pc6] = None
                else:
                    funder_results[pc6] = {
                        "fgr": data.get("fgr"),
                        "legenda": data.get("legenda"),
                        "percvoor1970": data.get("percvoor1970"),
                    }
            except Exception as exc:
                logger.warning("Funderingsrisico error for pc6=%s: %s", pc6, exc)
                funder_results[pc6] = None

    # Run SRU and funderingsrisico in parallel
    await asyncio.gather(
        asyncio.gather(*[_fetch_sru(pc6) for pc6 in pc6_to_parcels], return_exceptions=True),
        asyncio.gather(*[_fetch_funder(pc6) for pc6 in pc6_to_parcels], return_exceptions=True),
    )

    # Fan out to all parcels sharing same postcode
    results: dict[str, dict[str, Any]] = {}
    for pc6, parcel_ids in pc6_to_parcels.items():
        entry: dict[str, Any] = {}
        sru_val = sru_results.get(pc6)
        if sru_val is not None:
            entry["vergunningen"] = sru_val
        funder_val = funder_results.get(pc6)
        if funder_val is not None:
            entry["funderingsrisico"] = funder_val
        if entry:
            for parcel_id in parcel_ids:
                results[parcel_id] = entry

    logger.info(
        "Postcode enrichment complete: %d/%d parcels enriched",
        len(results),
        len(postcodes_by_parcel),
    )
    return results


async def batch_fetch_address_enrichment(
    vbo_ids_by_parcel: dict[str, str],
    nummeraanduiding_ids_by_parcel: dict[str, str],
    client: httpx.AsyncClient,
) -> dict[str, dict[str, Any]]:
    """Batch-fetch address-level enrichment: EP-Online energielabel + WOZ waarde.

    Skips parcels with no VBO ID (EP-Online) or no nummeraanduiding ID (WOZ).
    These are typically empty parcels without buildings.

    Args:
        vbo_ids_by_parcel: Dict mapping parcel_id -> BAG VBO ID string.
        nummeraanduiding_ids_by_parcel: Dict mapping parcel_id -> BAG nummeraanduiding ID.
        client: Shared httpx AsyncClient for connection pooling.

    Returns:
        Dict mapping parcel_id -> {"energielabel": {...}, "woz": {...}}.
        Missing sub-keys indicate no data, API error, or unconfigured service.
    """
    # Union of parcel IDs that have at least one ID
    all_parcel_ids = set(vbo_ids_by_parcel) | set(nummeraanduiding_ids_by_parcel)
    if not all_parcel_ids:
        return {}

    logger.info(
        "Address enrichment batch: %d parcels with VBO ID, %d with nummeraanduiding ID",
        len(vbo_ids_by_parcel),
        len(nummeraanduiding_ids_by_parcel),
    )

    # -- EP-Online energielabel per VBO ID --
    ep_sem = asyncio.Semaphore(_EP_ONLINE_CONCURRENCY)
    ep_results: dict[str, dict[str, Any] | None] = {}

    async def _fetch_ep(parcel_id: str, vbo_id: str) -> None:
        async with ep_sem:
            try:
                label = await ep_online_client.get_by_vbo_id(vbo_id, client)
                if label is None:
                    # EP-Online not configured
                    ep_results[parcel_id] = None
                else:
                    ep_results[parcel_id] = {
                        "energieklasse": label.energieklasse,
                        "is_geregistreerd": label.is_geregistreerd,
                        "registratie_datum": label.registratie_datum,
                        "geldig_tot": label.geldig_tot,
                    }
            except Exception as exc:
                logger.warning("EP-Online error for parcel=%s vbo=%s: %s", parcel_id, vbo_id, exc)
                ep_results[parcel_id] = None

    # -- WOZ waarde per nummeraanduiding ID --
    woz_sem = asyncio.Semaphore(_WOZ_CONCURRENCY)
    woz_results: dict[str, dict[str, Any] | None] = {}

    async def _fetch_woz(parcel_id: str, na_id: str) -> None:
        async with woz_sem:
            try:
                woz_data = await woz_waardeloket_client.get_by_nummeraanduiding_id(na_id, client)
                if woz_data is None:
                    woz_results[parcel_id] = None
                else:
                    woz_results[parcel_id] = {
                        "meest_recente_waarde": woz_data.meest_recente_waarde,
                        "meest_recente_peildatum": woz_data.meest_recente_peildatum,
                        "low_confidence": woz_data.low_confidence,
                    }
            except Exception as exc:
                logger.warning("WOZ error for parcel=%s na_id=%s: %s", parcel_id, na_id, exc)
                woz_results[parcel_id] = None

    # Run EP-Online and WOZ in parallel
    await asyncio.gather(
        asyncio.gather(
            *[_fetch_ep(pid, vid) for pid, vid in vbo_ids_by_parcel.items()],
            return_exceptions=True,
        ),
        asyncio.gather(
            *[_fetch_woz(pid, nid) for pid, nid in nummeraanduiding_ids_by_parcel.items()],
            return_exceptions=True,
        ),
    )

    # Merge results per parcel
    results: dict[str, dict[str, Any]] = {}
    for parcel_id in all_parcel_ids:
        entry: dict[str, Any] = {}
        ep_val = ep_results.get(parcel_id)
        if ep_val is not None:
            entry["energielabel"] = ep_val
        woz_val = woz_results.get(parcel_id)
        if woz_val is not None:
            entry["woz"] = woz_val
        if entry:
            results[parcel_id] = entry

    logger.info(
        "Address enrichment complete: %d/%d parcels enriched "
        "(EP-Online: %d, WOZ: %d)",
        len(results),
        len(all_parcel_ids),
        sum(1 for v in ep_results.values() if v is not None),
        sum(1 for v in woz_results.values() if v is not None),
    )
    return results
