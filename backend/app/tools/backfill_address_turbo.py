"""Turbo address enrichment backfill — high concurrency, progress logging.

Focuses on address resolution + postcode enrichment only.
Skips EP-Online (no API key) and WOZ (slow, low priority).

Usage:
    python -m app.tools.backfill_address_turbo --gemeente Venlo
"""

from __future__ import annotations

import argparse
import asyncio
import logging
import time
import uuid
from dataclasses import asdict

import httpx
from geoalchemy2.shape import to_shape
from sqlalchemy import func, select, text

from app.core.database import async_session_factory
from app.models.area_scan import AreaScan
from app.models.organization import Organization
from app.models.parcel_cache import ParcelCache
from app.models.scan_result import ScanResult
from app.services.parcel_addressing import AddressResolution, reverse_geocode_rd_point_full
from app.services.scan_enrichment import (
    batch_fetch_postcode_enrichment,
)
from app.services.score_v3 import compute_score_v3

logger = logging.getLogger(__name__)

# High concurrency for PDOK Locatieserver (free, no auth, generous limits)
_RESOLVE_CONCURRENCY = 50
# Commit every N parcels
_COMMIT_BATCH = 500


def _override_rate_limiters() -> None:
    """Set generous rate limits for bulk backfill."""
    from app.government_apis import rate_limiter

    for name in ("pdok_locatieserver_limiter", "sru_limiter", "pdok_funderingsrisico_limiter"):
        limiter = getattr(rate_limiter, name, None)
        if limiter is None:
            continue
        limiter.max_concurrent = 50
        limiter._semaphore = asyncio.Semaphore(50)
        from aiolimiter import AsyncLimiter
        limiter._limiter = AsyncLimiter(max_rate=100000, time_period=3600)


async def _resolve_addresses(
    rows: list[tuple[ScanResult, ParcelCache]],
    client: httpx.AsyncClient,
) -> tuple[dict[str, str], dict[str, str], dict[str, str]]:
    """Resolve addresses with high concurrency and progress logging."""
    sem = asyncio.Semaphore(_RESOLVE_CONCURRENCY)
    postcodes: dict[str, str] = {}
    vbo_ids: dict[str, str] = {}
    na_ids: dict[str, str] = {}
    resolved = 0
    failed = 0
    total = len(rows)

    async def _resolve(parcel_key: str, x: float, y: float) -> None:
        nonlocal resolved, failed
        async with sem:
            try:
                result: AddressResolution = await reverse_geocode_rd_point_full((x, y), client)
                if result.postcode:
                    postcodes[parcel_key] = result.postcode
                if result.vbo_id:
                    vbo_ids[parcel_key] = result.vbo_id
                if result.nummeraanduiding_id:
                    na_ids[parcel_key] = result.nummeraanduiding_id
                resolved += 1
            except Exception:
                failed += 1

            done = resolved + failed
            if done % 500 == 0 or done == total:
                logger.info(
                    "  Address resolution: %d/%d (%.0f%%) — %d postcodes, %d VBOs",
                    done, total, 100 * done / total, len(postcodes), len(vbo_ids),
                )

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

    logger.info("  Resolving %d parcel addresses (concurrency=%d)...", len(tasks), _RESOLVE_CONCURRENCY)
    await asyncio.gather(*tasks, return_exceptions=True)
    return postcodes, vbo_ids, na_ids


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


async def _run(gemeente: str) -> int:
    _override_rate_limiters()

    # Find org + scans
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
    total_enriched = 0
    total_rescored = 0

    async with httpx.AsyncClient(
        timeout=30.0,
        limits=httpx.Limits(max_connections=100, max_keepalive_connections=50),
    ) as client:
        for i, (scan_id, wijk_naam) in enumerate(scans, 1):
            wijk_start = time.monotonic()
            logger.info("[Wijk %d/%d] %s", i, len(scans), wijk_naam)

            async with async_session_factory() as session:
                await session.execute(text(f"SET app.current_tenant_id = '{org_id}'"))

                # Load parcels
                rows = []
                last_id: uuid.UUID | None = None
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

                # Filter to parcels needing address enrichment
                needs_addr = [
                    (sr, pc) for sr, pc in rows
                    if not (sr.flags and {"vergunningen", "funderingsrisico"}.issubset(dict(sr.flags).keys()))
                ]
                logger.info("  %d parcels, %d need address enrichment", len(rows), len(needs_addr))

                if not needs_addr:
                    # Still rescore all
                    pass
                else:
                    # Step 1: Resolve addresses
                    postcodes, vbo_ids, na_ids = await _resolve_addresses(needs_addr, client)

                    # Step 2: Postcode enrichment (vergunningen + funderingsrisico)
                    if postcodes:
                        postcode_data = await batch_fetch_postcode_enrichment(postcodes, client)
                        logger.info("  Postcode enrichment: %d parcels got data", len(postcode_data))
                    else:
                        postcode_data = {}

                    # Step 3: Merge into flags + commit
                    enriched = 0
                    sr_map = {str(pc.parcel_id): sr for sr, pc in needs_addr}
                    for parcel_key, sr in sr_map.items():
                        flags = dict(sr.flags) if sr.flags else {}
                        changed = False

                        pc_entry = postcode_data.get(parcel_key, {})
                        for k, v in pc_entry.items():
                            if k not in flags and v is not None:
                                flags[k] = v
                                changed = True

                        if changed:
                            sr.flags = flags
                            session.add(sr)
                            enriched += 1

                        if enriched > 0 and enriched % _COMMIT_BATCH == 0:
                            await session.flush()
                            await session.commit()

                    if enriched > 0:
                        await session.flush()
                        await session.commit()

                    total_enriched += enriched
                    logger.info("  Enriched: %d parcels", enriched)

                # Step 4: Reload and rescore ALL parcels
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

                # Load neighborhood metrics
                nbhd_stmt = select(AreaScan.id, AreaScan.neighborhood_metrics).where(
                    AreaScan.id == scan_id
                )
                nbhd_row = (await session.execute(nbhd_stmt)).first()
                nbhd = nbhd_row[1] if nbhd_row and nbhd_row[1] else None

                rescored = 0
                for sr, pc in rows:
                    flags = dict(sr.flags) if sr.flags else {}
                    parcel_data = _build_parcel_data(pc, flags)
                    v3 = compute_score_v3(parcel_data, nbhd)
                    overall = max(0.0, min(100.0, v3.overall))

                    flags["scores"] = {
                        "potentie": v3.potentie_score,
                        "risico": v3.risico_score,
                        "overall": v3.overall,
                    }
                    flags["score_breakdown"] = {
                        name: asdict(factor)
                        for name, factor in v3.score_breakdown.items()
                    }
                    flags["score_model_version"] = "score-v3.0"
                    flags["category"] = v3.category
                    flags.pop("factors", None)
                    flags.pop("subscores", None)

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
                "[Wijk %d/%d] Done in %.1fs — enriched=%d, rescored=%d",
                i, len(scans), elapsed, total_enriched, rescored,
            )

    logger.info(
        "TURBO COMPLETE: %d enriched, %d rescored across %d wijken",
        total_enriched, total_rescored, len(scans),
    )
    return 0


def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)-8s %(message)s",
    )
    # Suppress noisy httpx request logging
    logging.getLogger("httpx").setLevel(logging.WARNING)

    parser = argparse.ArgumentParser(description="Turbo address enrichment backfill")
    parser.add_argument("--gemeente", required=True)
    args = parser.parse_args()

    exit_code = asyncio.run(_run(args.gemeente))
    raise SystemExit(exit_code)


if __name__ == "__main__":
    main()
