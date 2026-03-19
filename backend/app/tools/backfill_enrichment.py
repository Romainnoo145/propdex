"""Backfill enrichment data for existing parcels and re-score with v3.0.

Retroactively fetches all 10 Phase 99 enrichment data sources for parcels
that were scanned before enrichment was integrated. Merges results into
scan_results.flags JSONB without overwriting existing keys, then re-scores
with compute_score_v3().

Usage:
    python -m app.tools.backfill_enrichment --gemeente Venlo
    python -m app.tools.backfill_enrichment --gemeente Venlo --dry-run
    python -m app.tools.backfill_enrichment --scan-id <uuid>
    python -m app.tools.backfill_enrichment --gemeente Venlo --skip-coordinate --skip-rescore
    python -m app.tools.backfill_enrichment --gemeente Venlo --turbo
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
from app.services.parcel_addressing import (
    AddressResolution,
    reverse_geocode_rd_point_full,
)
from app.services.scan_enrichment import (
    batch_fetch_address_enrichment,
    batch_fetch_bodem_data,
    batch_fetch_environmental_data,
    batch_fetch_postcode_enrichment,
)
from app.services.score_v3 import compute_score_v3

logger = logging.getLogger(__name__)

# All 10 enrichment keys that should be present in flags after backfill
_ALL_ENRICHMENT_KEYS = frozenset({
    # Coordinate-based (6)
    "bodem",
    "bodemtype",
    "natura2000",
    "overstromingsrisico",
    "geluid",
    "luchtkwaliteit",
    # Address-based (4)
    "energielabel",
    "woz",
    "vergunningen",
    "funderingsrisico",
})

# Concurrency for PDOK Locatieserver address resolution
_ADDRESS_RESOLUTION_CONCURRENCY = 10

# Turbo mode rate limits for one-time bulk backfill
_TURBO_LIMITS: dict[str, tuple[int, int]] = {
    # (max_concurrent, max_per_hour)
    "bodemloket": (10, 5000),
    "bro_bodemkaart": (10, 5000),
    "pdok_natura2000": (10, 5000),
    "rws_overstromingen": (10, 5000),
    "rivm_geluid": (10, 5000),
    "rivm_luchtkwaliteit": (10, 5000),
    "pdok_locatieserver": (20, 100000),
    "sru": (5, 2000),
    "pdok_funderingsrisico": (10, 5000),
    "ep_online": (5, 2000),
    "woz_waardeloket": (5, 2000),
}


def _apply_turbo_mode() -> dict[str, tuple[int, int]]:
    """Override rate limiters for bulk backfill. Returns original values for restore."""
    from app.government_apis import rate_limiter

    originals: dict[str, tuple[int, int]] = {}
    for name, (conc, per_hr) in _TURBO_LIMITS.items():
        limiter_name = f"{name}_limiter"
        limiter = getattr(rate_limiter, limiter_name, None)
        if limiter is None:
            continue
        originals[limiter_name] = (limiter.max_concurrent, limiter.max_per_hour)
        limiter.max_concurrent = conc
        limiter.max_per_hour = per_hr
        limiter._semaphore = asyncio.Semaphore(conc)
        from aiolimiter import AsyncLimiter
        limiter._limiter = AsyncLimiter(max_rate=per_hr, time_period=3600)
    logger.info("TURBO MODE: rate limits overridden for bulk backfill")
    return originals


def _restore_rate_limits(originals: dict[str, tuple[int, int]]) -> None:
    """Restore original rate limiter settings."""
    from app.government_apis import rate_limiter

    for limiter_name, (conc, per_hr) in originals.items():
        limiter = getattr(rate_limiter, limiter_name, None)
        if limiter is None:
            continue
        limiter.max_concurrent = conc
        limiter.max_per_hour = per_hr
        limiter._semaphore = asyncio.Semaphore(conc)
        from aiolimiter import AsyncLimiter
        limiter._limiter = AsyncLimiter(max_rate=per_hr, time_period=3600)
    logger.info("Rate limits restored to original values")


def _parse_uuid(value: str) -> uuid.UUID:
    try:
        return uuid.UUID(value)
    except ValueError as exc:
        raise argparse.ArgumentTypeError(f"Invalid UUID: {value}") from exc


async def _list_target_orgs(target_org_id: uuid.UUID | None) -> list[uuid.UUID]:
    """Return list of organization IDs to process."""
    async with async_session_factory() as session:
        if target_org_id is not None:
            found = await session.execute(
                select(Organization.id).where(Organization.id == target_org_id)
            )
            org_id = found.scalar_one_or_none()
            return [org_id] if org_id else []

        result = await session.execute(select(Organization.id).order_by(Organization.id))
        return list(result.scalars())


async def _load_neighborhood_metrics(
    session: object,
    scan_ids: set[uuid.UUID],
) -> dict[uuid.UUID, dict]:
    """Load neighborhood_metrics for a set of scan_ids from AreaScan table."""
    if not scan_ids:
        return {}

    stmt = select(AreaScan.id, AreaScan.neighborhood_metrics).where(
        AreaScan.id.in_(scan_ids)
    )
    rows = (await session.execute(stmt)).all()
    return {row[0]: row[1] for row in rows if row[1] is not None}


def _build_parcel_data(pc: ParcelCache, flags: dict) -> dict:
    """Build parcel_data dict matching area_scan.py Phase 6 assembly exactly."""
    parcel_data: dict = {}

    if pc:
        parcel_data["area_m2"] = pc.area_m2
        parcel_data["has_pand"] = pc.has_pand
        parcel_data["bouwjaar"] = pc.bouwjaar
        parcel_data["pand_status"] = pc.pand_status
        parcel_data["bestemmingen"] = pc.bestemmingen

    parcel_data["vacancy_signal"] = flags.get("vacancy_signal")
    parcel_data["building_metrics"] = flags.get("building_metrics", {})
    parcel_data["market_signals"] = flags.get("market_signals")
    parcel_data["bodem"] = flags.get("bodem")
    parcel_data["bodemtype"] = flags.get("bodemtype")
    parcel_data["funderingsrisico"] = flags.get("funderingsrisico")
    parcel_data["energielabel"] = flags.get("energielabel")
    parcel_data["vergunningen"] = flags.get("vergunningen")
    parcel_data["natura2000"] = flags.get("natura2000")
    parcel_data["overstromingsrisico"] = flags.get("overstromingsrisico")
    parcel_data["geluid"] = flags.get("geluid")
    parcel_data["luchtkwaliteit"] = flags.get("luchtkwaliteit")
    parcel_data["woz"] = flags.get("woz")

    return parcel_data


def _is_fully_enriched(flags: dict) -> bool:
    """Check if all 10 enrichment keys are already present in flags."""
    return all(key in flags for key in _ALL_ENRICHMENT_KEYS)


def _merge_enrichment(existing_flags: dict, new_data: dict) -> bool:
    """Merge new enrichment keys into existing flags (skip existing).

    Returns True if any key was actually added.
    """
    changed = False
    for key, value in new_data.items():
        if key not in existing_flags and value is not None:
            existing_flags[key] = value
            changed = True
    return changed


async def _get_wijk_scans(
    session: object,
    org_id: uuid.UUID,
    gemeente: str | None,
    scan_id: uuid.UUID | None,
) -> list[tuple[uuid.UUID, str]]:
    """Return list of (scan_id, wijk_naam) tuples for completed scans."""
    stmt = (
        select(AreaScan.id, AreaScan.wijk_naam)
        .where(
            AreaScan.status == "completed",
        )
        .order_by(AreaScan.id)
    )

    if scan_id is not None:
        stmt = stmt.where(AreaScan.id == scan_id)
    elif gemeente is not None:
        stmt = stmt.where(func.lower(AreaScan.gemeente_naam) == gemeente.lower())

    rows = (await session.execute(stmt)).all()
    return [(row[0], row[1] or "unknown") for row in rows]


async def _load_scan_parcels(
    session: object,
    org_id: uuid.UUID,
    wijk_scan_id: uuid.UUID,
    batch_size: int,
) -> list[tuple[ScanResult, ParcelCache]]:
    """Load all ScanResult + ParcelCache rows for a wijk scan."""
    all_rows = []
    last_id: uuid.UUID | None = None

    while True:
        stmt = (
            select(ScanResult, ParcelCache)
            .join(ParcelCache, ParcelCache.id == ScanResult.parcel_id)
            .where(
                ScanResult.scan_id == wijk_scan_id,
            )
            .order_by(ScanResult.id)
            .limit(batch_size)
        )
        if last_id is not None:
            stmt = stmt.where(ScanResult.id > last_id)

        rows = (await session.execute(stmt)).all()
        if not rows:
            break

        all_rows.extend(rows)
        last_id = rows[-1][0].id

    return all_rows


async def _enrich_coordinate_batch(
    rows: list[tuple[ScanResult, ParcelCache]],
    client: httpx.AsyncClient,
    dry_run: bool,
    session: object,
) -> tuple[int, int]:
    """Run coordinate-based enrichment for a batch of parcels.

    Returns (enriched_count, skipped_count).
    """
    # Extract centroids from parcels with geometry
    centroids: list[tuple[str, float, float]] = []
    sr_by_parcel_id: dict[str, ScanResult] = {}

    for sr, pc in rows:
        flags = dict(sr.flags) if sr.flags else {}

        # Check if coordinate enrichment keys already present
        coord_keys = {"bodem", "bodemtype", "natura2000", "overstromingsrisico", "geluid", "luchtkwaliteit"}
        if coord_keys.issubset(flags.keys()):
            continue

        if pc.geometry is None:
            continue

        try:
            geom_shape = to_shape(pc.geometry)
            centroid = geom_shape.centroid
            parcel_key = str(pc.parcel_id)
            centroids.append((parcel_key, float(centroid.x), float(centroid.y)))
            sr_by_parcel_id[parcel_key] = sr
        except Exception as exc:
            logger.warning("Failed to extract centroid for parcel %s: %s", pc.parcel_id, exc)

    if not centroids:
        return 0, len(rows)

    # Fetch coordinate-based enrichment
    bodem_data = await batch_fetch_bodem_data(centroids, client)
    env_data = await batch_fetch_environmental_data(centroids, client)

    # Merge results into flags
    enriched = 0
    for parcel_key, sr in sr_by_parcel_id.items():
        flags = dict(sr.flags) if sr.flags else {}
        changed = False

        bodem_entry = bodem_data.get(parcel_key, {})
        if _merge_enrichment(flags, bodem_entry):
            changed = True

        env_entry = env_data.get(parcel_key, {})
        if _merge_enrichment(flags, env_entry):
            changed = True

        if changed and not dry_run:
            sr.flags = flags
            session.add(sr)
            enriched += 1
        elif changed:
            enriched += 1

    if not dry_run and enriched > 0:
        await session.flush()
        await session.commit()

    skipped = len(rows) - enriched
    return enriched, skipped


async def _resolve_addresses_batch(
    rows: list[tuple[ScanResult, ParcelCache]],
    client: httpx.AsyncClient,
) -> tuple[dict[str, str], dict[str, str], dict[str, str]]:
    """Resolve addresses for parcels via PDOK Locatieserver.

    Returns (postcodes_by_parcel, vbo_ids_by_parcel, nummeraanduiding_ids_by_parcel).
    """
    sem = asyncio.Semaphore(_ADDRESS_RESOLUTION_CONCURRENCY)
    postcodes: dict[str, str] = {}
    vbo_ids: dict[str, str] = {}
    na_ids: dict[str, str] = {}

    async def _resolve(parcel_key: str, x: float, y: float) -> None:
        async with sem:
            try:
                result: AddressResolution = await reverse_geocode_rd_point_full(
                    (x, y), client
                )
                if result.postcode:
                    postcodes[parcel_key] = result.postcode
                if result.vbo_id:
                    vbo_ids[parcel_key] = result.vbo_id
                if result.nummeraanduiding_id:
                    na_ids[parcel_key] = result.nummeraanduiding_id
            except Exception as exc:
                logger.warning("Address resolution failed for %s: %s", parcel_key, exc)

    tasks = []
    for _sr, pc in rows:
        if pc.geometry is None:
            continue
        try:
            geom_shape = to_shape(pc.geometry)
            centroid = geom_shape.centroid
            parcel_key = str(pc.parcel_id)
            tasks.append(_resolve(parcel_key, float(centroid.x), float(centroid.y)))
        except Exception:
            continue

    if tasks:
        await asyncio.gather(*tasks, return_exceptions=True)

    return postcodes, vbo_ids, na_ids


async def _enrich_address_batch(
    rows: list[tuple[ScanResult, ParcelCache]],
    client: httpx.AsyncClient,
    dry_run: bool,
    session: object,
) -> tuple[int, int]:
    """Run address-based enrichment for a batch of parcels.

    Returns (enriched_count, skipped_count).
    """
    # Filter to parcels that still need address enrichment
    needs_address: list[tuple[ScanResult, ParcelCache]] = []
    for sr, pc in rows:
        flags = dict(sr.flags) if sr.flags else {}
        addr_keys = {"energielabel", "woz", "vergunningen", "funderingsrisico"}
        if addr_keys.issubset(flags.keys()):
            continue
        needs_address.append((sr, pc))

    if not needs_address:
        return 0, len(rows)

    # Step 1: Resolve addresses to get VBO/nummeraanduiding/postcode IDs
    postcodes, vbo_ids, na_ids = await _resolve_addresses_batch(needs_address, client)

    logger.info(
        "Address resolution: %d postcodes, %d VBO IDs, %d nummeraanduiding IDs",
        len(postcodes),
        len(vbo_ids),
        len(na_ids),
    )

    # Step 2: Fetch postcode-based enrichment (vergunningen + funderingsrisico)
    postcode_data = await batch_fetch_postcode_enrichment(postcodes, client)

    # Step 3: Fetch address-based enrichment (energielabel + woz)
    address_data = await batch_fetch_address_enrichment(vbo_ids, na_ids, client)

    # Step 4: Merge results into flags
    sr_by_parcel: dict[str, ScanResult] = {}
    for sr, pc in needs_address:
        sr_by_parcel[str(pc.parcel_id)] = sr

    enriched = 0
    for parcel_key, sr in sr_by_parcel.items():
        flags = dict(sr.flags) if sr.flags else {}
        changed = False

        pc_entry = postcode_data.get(parcel_key, {})
        if _merge_enrichment(flags, pc_entry):
            changed = True

        addr_entry = address_data.get(parcel_key, {})
        if _merge_enrichment(flags, addr_entry):
            changed = True

        if changed and not dry_run:
            sr.flags = flags
            session.add(sr)
            enriched += 1
        elif changed:
            enriched += 1

    if not dry_run and enriched > 0:
        await session.flush()
        await session.commit()

    skipped = len(rows) - enriched
    return enriched, skipped


async def _rescore_batch(
    rows: list[tuple[ScanResult, ParcelCache]],
    session: object,
    dry_run: bool,
    batch_size: int,
) -> tuple[int, int]:
    """Re-score all parcels with compute_score_v3 using enriched flags.

    Returns (rescored_count, skipped_count).
    """
    # Load neighborhood metrics for all scans in this batch
    unique_scan_ids = {sr.scan_id for sr, _pc in rows}
    nbhd_map = await _load_neighborhood_metrics(session, unique_scan_ids)

    rescored = 0
    batch_count = 0

    for sr, pc in rows:
        flags = dict(sr.flags) if sr.flags else {}
        parcel_data = _build_parcel_data(pc, flags)
        nbhd = nbhd_map.get(sr.scan_id)

        v3_result = compute_score_v3(parcel_data, nbhd)
        overall_clamped = max(0.0, min(100.0, v3_result.overall))

        # Merge v3.0 score data into flags
        flags["scores"] = {
            "potentie": v3_result.potentie_score,
            "risico": v3_result.risico_score,
            "overall": v3_result.overall,
        }
        flags["score_breakdown"] = {
            name: asdict(factor)
            for name, factor in v3_result.score_breakdown.items()
        }
        flags["score_model_version"] = "score-v3.0"
        flags["category"] = v3_result.category

        # Remove old v2.1 score keys
        flags.pop("factors", None)
        flags.pop("subscores", None)

        if not dry_run:
            sr.score = overall_clamped
            sr.flags = flags
            session.add(sr)

        rescored += 1
        batch_count += 1

        # Flush periodically
        if not dry_run and batch_count >= batch_size:
            await session.flush()
            await session.commit()
            batch_count = 0

    # Final flush
    if not dry_run and batch_count > 0:
        await session.flush()
        await session.commit()

    return rescored, len(rows) - rescored


async def _run(
    *,
    gemeente: str | None,
    scan_id: uuid.UUID | None,
    organization_id: uuid.UUID | None,
    batch_size: int,
    dry_run: bool,
    skip_coordinate: bool,
    skip_address: bool,
    skip_rescore: bool,
    inter_wijk_delay: float,
    turbo: bool = False,
) -> int:
    """Main backfill entry point."""
    # Apply turbo mode if requested
    original_limits: dict[str, tuple[int, int]] = {}
    if turbo:
        original_limits = _apply_turbo_mode()

    try:
        return await _run_inner(
            gemeente=gemeente,
            scan_id=scan_id,
            organization_id=organization_id,
            batch_size=batch_size,
            dry_run=dry_run,
            skip_coordinate=skip_coordinate,
            skip_address=skip_address,
            skip_rescore=skip_rescore,
            inter_wijk_delay=inter_wijk_delay,
        )
    finally:
        if original_limits:
            _restore_rate_limits(original_limits)


async def _run_inner(
    *,
    gemeente: str | None,
    scan_id: uuid.UUID | None,
    organization_id: uuid.UUID | None,
    batch_size: int,
    dry_run: bool,
    skip_coordinate: bool,
    skip_address: bool,
    skip_rescore: bool,
    inter_wijk_delay: float,
) -> int:
    """Inner backfill logic."""
    # EP-Online API key check
    try:
        from app.core.config import settings
        if not getattr(settings, "EP_ONLINE_API_KEY", None):
            logger.warning(
                "EP_ONLINE_API_KEY not configured -- energielabel enrichment will be skipped"
            )
    except Exception:
        logger.warning("Could not check EP_ONLINE_API_KEY setting")

    org_ids = await _list_target_orgs(organization_id)
    if not org_ids:
        logger.error("No organizations found")
        return 1

    mode = "DRY RUN" if dry_run else "LIVE"
    logger.info(
        "Starting enrichment backfill (%s): orgs=%d, gemeente=%s, scan_id=%s, "
        "skip_coordinate=%s, skip_address=%s, skip_rescore=%s",
        mode,
        len(org_ids),
        gemeente,
        scan_id,
        skip_coordinate,
        skip_address,
        skip_rescore,
    )

    total_enriched_coord = 0
    total_enriched_addr = 0
    total_rescored = 0
    total_skipped = 0
    total_errors = 0

    for org_index, org_id in enumerate(org_ids, start=1):
        logger.info("[Org %d/%d] org=%s", org_index, len(org_ids), org_id)

        async with async_session_factory() as session:
            await session.execute(text(f"SET app.current_tenant_id = '{org_id}'"))

            wijk_scans = await _get_wijk_scans(session, org_id, gemeente, scan_id)
            if not wijk_scans:
                logger.info("  No completed scans found for org=%s", org_id)
                continue

            logger.info("  Found %d completed wijk scans", len(wijk_scans))

        for wijk_index, (wijk_scan_id, wijk_naam) in enumerate(wijk_scans, start=1):
            wijk_start = time.monotonic()
            logger.info(
                "  [Wijk %d/%d] %s (scan=%s)",
                wijk_index,
                len(wijk_scans),
                wijk_naam,
                wijk_scan_id,
            )

            try:
                async with async_session_factory() as session:
                    await session.execute(text(f"SET app.current_tenant_id = '{org_id}'"))

                    # Load all parcels for this wijk
                    rows = await _load_scan_parcels(session, org_id, wijk_scan_id, batch_size)
                    if not rows:
                        logger.info("    No parcels found")
                        continue

                    # Count already-enriched
                    fully_enriched = sum(
                        1 for sr, _pc in rows
                        if sr.flags and _is_fully_enriched(dict(sr.flags))
                    )
                    logger.info(
                        "    %d parcels loaded, %d already fully enriched",
                        len(rows),
                        fully_enriched,
                    )

                    # Coordinate-based enrichment
                    if not skip_coordinate:
                        async with httpx.AsyncClient(timeout=30.0) as client:
                            coord_enriched, coord_skipped = await _enrich_coordinate_batch(
                                rows, client, dry_run, session
                            )
                            total_enriched_coord += coord_enriched
                            logger.info(
                                "    Coordinate enrichment: %d enriched, %d skipped",
                                coord_enriched,
                                coord_skipped,
                            )

                    # Reload rows after coordinate enrichment (flags may have changed)
                    if not skip_coordinate and not skip_address:
                        rows = await _load_scan_parcels(session, org_id, wijk_scan_id, batch_size)

                    # Address-based enrichment
                    if not skip_address:
                        async with httpx.AsyncClient(timeout=30.0) as client:
                            addr_enriched, addr_skipped = await _enrich_address_batch(
                                rows, client, dry_run, session
                            )
                            total_enriched_addr += addr_enriched
                            logger.info(
                                "    Address enrichment: %d enriched, %d skipped",
                                addr_enriched,
                                addr_skipped,
                            )

                    # Reload rows before re-scoring (flags may have changed)
                    if not skip_rescore and (not skip_coordinate or not skip_address):
                        rows = await _load_scan_parcels(session, org_id, wijk_scan_id, batch_size)

                    # V3.0 re-scoring
                    if not skip_rescore:
                        rescored, _reskipped = await _rescore_batch(
                            rows, session, dry_run, batch_size
                        )
                        total_rescored += rescored
                        logger.info("    Re-scored: %d parcels", rescored)

            except Exception as exc:
                logger.error(
                    "    Error processing wijk %s (scan=%s): %s",
                    wijk_naam,
                    wijk_scan_id,
                    exc,
                    exc_info=True,
                )
                total_errors += 1
                continue

            elapsed = time.monotonic() - wijk_start
            logger.info("    Wijk complete in %.1fs", elapsed)

            # Inter-wijk delay (skip after last wijk)
            if wijk_index < len(wijk_scans) and inter_wijk_delay > 0:
                logger.info("    Waiting %.1fs before next wijk...", inter_wijk_delay)
                await asyncio.sleep(inter_wijk_delay)

    logger.info(
        "Enrichment backfill complete. "
        "Coordinate enriched=%d, Address enriched=%d, Re-scored=%d, Errors=%d",
        total_enriched_coord,
        total_enriched_addr,
        total_rescored,
        total_errors,
    )
    return 0


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=(
            "Backfill enrichment data (10 sources) for existing parcels "
            "and re-score with Score v3.0."
        ),
    )
    parser.add_argument(
        "--gemeente",
        type=str,
        help="Filter scans by gemeente name (case-insensitive)",
    )
    parser.add_argument(
        "--scan-id",
        type=_parse_uuid,
        help="Process a single scan by UUID",
    )
    parser.add_argument(
        "--organization-id",
        type=_parse_uuid,
        help="Optional organization UUID scope",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=500,
        help="Pagination batch size (default: 500)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Log changes without writing to the database",
    )
    parser.add_argument(
        "--skip-coordinate",
        action="store_true",
        help="Skip coordinate-based enrichment (6 sources)",
    )
    parser.add_argument(
        "--skip-address",
        action="store_true",
        help="Skip address-based enrichment (4 sources)",
    )
    parser.add_argument(
        "--skip-rescore",
        action="store_true",
        help="Skip v3.0 re-scoring pass",
    )
    parser.add_argument(
        "--inter-wijk-delay",
        type=float,
        default=5.0,
        help="Seconds to pause between wijk batches (default: 5.0)",
    )
    parser.add_argument(
        "--turbo",
        action="store_true",
        help="Override rate limits for bulk backfill (~15x faster, use for one-time runs only)",
    )
    return parser


def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)-8s %(name)s: %(message)s",
    )

    parser = _build_parser()
    args = parser.parse_args()

    if args.batch_size < 1:
        parser.error("--batch-size must be >= 1")

    exit_code = asyncio.run(
        _run(
            gemeente=args.gemeente,
            scan_id=args.scan_id,
            organization_id=args.organization_id,
            batch_size=args.batch_size,
            dry_run=args.dry_run,
            skip_coordinate=args.skip_coordinate,
            skip_address=args.skip_address,
            skip_rescore=args.skip_rescore,
            inter_wijk_delay=args.inter_wijk_delay,
            turbo=args.turbo,
        )
    )
    raise SystemExit(exit_code)


if __name__ == "__main__":
    main()
