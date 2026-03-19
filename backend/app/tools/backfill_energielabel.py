"""EP-Online energielabel backfill — fetch energy labels for all parcels with VBO IDs.

Requires EP_ONLINE_API_KEY in .env. Fetches by VBO ID (resolved during address
enrichment backfill), stores result in scan_results.flags['energielabel'], then
rescores all parcels.

Usage:
    python -m app.tools.backfill_energielabel --gemeente Venlo
"""

from __future__ import annotations

import argparse
import asyncio
import logging
import time
from dataclasses import asdict

import httpx
from sqlalchemy import func, select, text

from app.core.config import settings
from app.core.database import async_session_factory
from app.government_apis.ep_online import EPOnlineClient
from app.models.area_scan import AreaScan
from app.models.organization import Organization
from app.models.parcel_cache import ParcelCache
from app.models.scan_result import ScanResult
from app.services.parcel_addressing import reverse_geocode_rd_point_full
from app.services.score_v3 import compute_score_v3

logger = logging.getLogger(__name__)

_CONCURRENCY = 20  # EP-Online is generous but be polite
_COMMIT_BATCH = 500


def _build_parcel_data(pc: ParcelCache, flags: dict) -> dict:
    """Build parcel_data dict for score_v3."""
    parcel_data: dict = {}
    if pc:
        parcel_data["area_m2"] = pc.area_m2
        parcel_data["has_pand"] = pc.has_pand
        parcel_data["bouwjaar"] = pc.bouwjaar
        parcel_data["pand_status"] = pc.pand_status
        parcel_data["bestemmingen"] = pc.bestemmingen
    for key in (
        "vacancy_signal", "building_metrics", "market_signals", "bodem", "bodemtype",
        "funderingsrisico", "energielabel", "vergunningen", "natura2000",
        "overstromingsrisico", "geluid", "luchtkwaliteit", "woz",
    ):
        parcel_data[key] = flags.get(key, {} if key == "building_metrics" else None)
    return parcel_data


async def _resolve_vbo_ids(
    rows: list[tuple[ScanResult, ParcelCache]],
    client: httpx.AsyncClient,
) -> dict[str, str]:
    """Resolve VBO IDs for parcels that don't have one yet."""
    from geoalchemy2.shape import to_shape

    sem = asyncio.Semaphore(50)
    vbo_map: dict[str, str] = {}
    resolved = 0
    total = len(rows)

    async def _resolve(parcel_key: str, x: float, y: float) -> None:
        nonlocal resolved
        async with sem:
            try:
                result = await reverse_geocode_rd_point_full((x, y), client)
                if result.vbo_id:
                    vbo_map[parcel_key] = result.vbo_id
                resolved += 1
            except Exception:
                resolved += 1

            if resolved % 500 == 0 or resolved == total:
                logger.info("  VBO resolution: %d/%d — %d VBOs found", resolved, total, len(vbo_map))

    tasks = []
    for _sr, pc in rows:
        if pc.geometry is None:
            continue
        try:
            geom_shape = to_shape(pc.geometry)
            centroid = geom_shape.centroid
            tasks.append(_resolve(str(pc.parcel_id), float(centroid.x), float(centroid.y)))
        except Exception:
            continue

    if tasks:
        logger.info("  Resolving %d VBO IDs...", len(tasks))
        await asyncio.gather(*tasks, return_exceptions=True)
    return vbo_map


async def _fetch_energielabels(
    vbo_map: dict[str, str],
    client: httpx.AsyncClient,
) -> dict[str, dict]:
    """Fetch energy labels for all VBO IDs."""
    ep_client = EPOnlineClient()
    sem = asyncio.Semaphore(_CONCURRENCY)
    results: dict[str, dict] = {}
    done = 0
    found = 0
    not_found = 0
    errors = 0
    total = len(vbo_map)

    async def _fetch(parcel_key: str, vbo_id: str) -> None:
        nonlocal done, found, not_found, errors
        async with sem:
            try:
                label = await ep_client.get_by_vbo_id(vbo_id, client)
                if label is None:
                    errors += 1
                elif label.is_geregistreerd:
                    results[parcel_key] = label.model_dump()
                    found += 1
                else:
                    # Store "not registered" so we don't retry
                    results[parcel_key] = label.model_dump()
                    not_found += 1
            except Exception as e:
                logger.debug("EP-Online error for %s: %s", vbo_id, e)
                errors += 1
            finally:
                done += 1
                if done % 200 == 0 or done == total:
                    logger.info(
                        "  EP-Online: %d/%d (%.0f%%) — %d labels, %d not registered, %d errors",
                        done, total, 100 * done / total, found, not_found, errors,
                    )

    tasks = [_fetch(pk, vbo) for pk, vbo in vbo_map.items()]
    logger.info("  Fetching %d energy labels (concurrency=%d)...", len(tasks), _CONCURRENCY)
    await asyncio.gather(*tasks, return_exceptions=True)
    return results


async def _run(gemeente: str) -> int:
    if not settings.EP_ONLINE_API_KEY:
        logger.error("EP_ONLINE_API_KEY not set in .env")
        return 1

    async with async_session_factory() as session:
        org_row = await session.execute(select(Organization.id).limit(1))
        org_id = org_row.scalar_one_or_none()
        if not org_id:
            logger.error("No organization found")
            return 1

        scans = (
            await session.execute(
                select(AreaScan.id, AreaScan.wijk_naam)
                .where(
                    AreaScan.status == "completed",
                    func.lower(AreaScan.gemeente_naam) == gemeente.lower(),
                )
                .order_by(AreaScan.id)
            )
        ).all()

    logger.info("Found %d completed wijk scans for %s", len(scans), gemeente)
    total_labels = 0
    total_rescored = 0

    async with httpx.AsyncClient(
        timeout=30.0,
        limits=httpx.Limits(max_connections=50, max_keepalive_connections=25),
    ) as client:
        for i, (scan_id, wijk_naam) in enumerate(scans, 1):
            wijk_start = time.monotonic()
            logger.info("[Wijk %d/%d] %s", i, len(scans), wijk_naam)

            async with async_session_factory() as session:
                await session.execute(text(f"SET app.current_tenant_id = '{org_id}'"))

                # Load all parcels for this scan
                rows: list[tuple[ScanResult, ParcelCache]] = []
                last_id = None
                while True:
                    stmt = (
                        select(ScanResult, ParcelCache)
                        .join(ParcelCache, ParcelCache.id == ScanResult.parcel_id)
                        .where(
                            ScanResult.scan_id == scan_id,
                        )
                        .order_by(ScanResult.id)
                        .limit(1000)
                    )
                    if last_id is not None:
                        stmt = stmt.where(ScanResult.id > last_id)
                    batch = (await session.execute(stmt)).all()
                    if not batch:
                        break
                    rows.extend(batch)
                    last_id = batch[-1][0].id

                if not rows:
                    logger.info("  No parcels")
                    continue

                # Filter: skip parcels that already have energielabel data
                needs_label = [
                    (sr, pc) for sr, pc in rows
                    if not (sr.flags and sr.flags.get("energielabel"))
                ]
                logger.info("  %d parcels, %d need energielabel", len(rows), len(needs_label))

                if needs_label:
                    # Step 1: Get VBO IDs (from flags or resolve)
                    vbo_map: dict[str, str] = {}
                    needs_resolve: list[tuple[ScanResult, ParcelCache]] = []

                    for sr, pc in needs_label:
                        flags = dict(sr.flags) if sr.flags else {}
                        vbo_id = flags.get("vbo_id")
                        if vbo_id:
                            vbo_map[str(pc.parcel_id)] = vbo_id
                        else:
                            needs_resolve.append((sr, pc))

                    logger.info("  %d VBO IDs from flags, %d need resolution", len(vbo_map), len(needs_resolve))

                    if needs_resolve:
                        resolved_vbos = await _resolve_vbo_ids(needs_resolve, client)
                        vbo_map.update(resolved_vbos)

                    logger.info("  Total VBO IDs: %d / %d parcels", len(vbo_map), len(needs_label))

                    # Step 2: Fetch energy labels
                    if vbo_map:
                        label_data = await _fetch_energielabels(vbo_map, client)

                        # Step 3: Merge into flags
                        sr_map = {str(pc.parcel_id): sr for sr, pc in needs_label}
                        enriched = 0
                        for parcel_key, label_dict in label_data.items():
                            sr = sr_map.get(parcel_key)
                            if not sr:
                                continue
                            flags = dict(sr.flags) if sr.flags else {}
                            flags["energielabel"] = label_dict
                            sr.flags = flags
                            session.add(sr)
                            enriched += 1

                            if enriched % _COMMIT_BATCH == 0:
                                await session.flush()
                                await session.commit()

                        if enriched > 0:
                            await session.flush()
                            await session.commit()

                        total_labels += enriched
                        logger.info("  Energielabels stored: %d", enriched)

                # Rescore all parcels
                rows = []
                last_id = None
                while True:
                    stmt = (
                        select(ScanResult, ParcelCache)
                        .join(ParcelCache, ParcelCache.id == ScanResult.parcel_id)
                        .where(
                            ScanResult.scan_id == scan_id,
                        )
                        .order_by(ScanResult.id)
                        .limit(1000)
                    )
                    if last_id is not None:
                        stmt = stmt.where(ScanResult.id > last_id)
                    batch = (await session.execute(stmt)).all()
                    if not batch:
                        break
                    rows.extend(batch)
                    last_id = batch[-1][0].id

                nbhd_row = (
                    await session.execute(
                        select(AreaScan.neighborhood_metrics).where(AreaScan.id == scan_id)
                    )
                ).scalar_one_or_none()

                rescored = 0
                for sr, pc in rows:
                    flags = dict(sr.flags) if sr.flags else {}
                    parcel_data = _build_parcel_data(pc, flags)
                    v3 = compute_score_v3(parcel_data, nbhd_row)
                    overall = max(0.0, min(100.0, v3.overall))

                    flags["scores"] = {
                        "potentie": v3.potentie_score,
                        "risico": v3.risico_score,
                        "overall": v3.overall,
                    }
                    flags["score_breakdown"] = {
                        name: asdict(factor) for name, factor in v3.score_breakdown.items()
                    }
                    flags["score_model_version"] = "score-v3.0"
                    flags["category"] = v3.category

                    sr.score = overall
                    sr.flags = flags
                    session.add(sr)
                    rescored += 1

                    if rescored % _COMMIT_BATCH == 0:
                        await session.flush()
                        await session.commit()

                if rescored > 0:
                    await session.flush()
                    await session.commit()

                total_rescored += rescored

            elapsed = time.monotonic() - wijk_start
            logger.info(
                "[Wijk %d/%d] Done in %.1fs — labels=%d, rescored=%d",
                i, len(scans), elapsed, total_labels, rescored,
            )

    logger.info(
        "EP-ONLINE COMPLETE: %d labels stored, %d rescored across %d wijken",
        total_labels, total_rescored, len(scans),
    )
    return 0


def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)-8s %(message)s",
    )
    logging.getLogger("httpx").setLevel(logging.WARNING)

    parser = argparse.ArgumentParser(description="EP-Online energielabel backfill")
    parser.add_argument("--gemeente", required=True)
    args = parser.parse_args()

    exit_code = asyncio.run(_run(args.gemeente))
    raise SystemExit(exit_code)


if __name__ == "__main__":
    main()
