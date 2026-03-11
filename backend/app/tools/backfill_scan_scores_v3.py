"""Recompute scan_results scores using Score v3.0 engine (Potentie + Risico).

Replaces v2.1 score keys (factors, subscores) with v3.0 keys
(scores, score_breakdown, score_model_version, category).

Usage:
    python -m app.tools.backfill_scan_scores_v3
    python -m app.tools.backfill_scan_scores_v3 --dry-run
    python -m app.tools.backfill_scan_scores_v3 --organization-id <uuid>
    python -m app.tools.backfill_scan_scores_v3 --scan-id <uuid>
"""

from __future__ import annotations

import argparse
import asyncio
import logging
import time
import uuid
from dataclasses import asdict

from sqlalchemy import select, text

from app.core.database import async_session_factory
from app.models.area_scan import AreaScan
from app.models.organization import Organization
from app.models.parcel_cache import ParcelCache
from app.models.scan_result import ScanResult
from app.services.score_v3 import compute_score_v3

logger = logging.getLogger(__name__)


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

    # From ParcelCache columns
    if pc:
        parcel_data["area_m2"] = pc.area_m2
        parcel_data["has_pand"] = pc.has_pand
        parcel_data["bouwjaar"] = pc.bouwjaar
        parcel_data["pand_status"] = pc.pand_status
        parcel_data["bestemmingen"] = pc.bestemmingen

    # Overlay enrichment flags from scan_results
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


async def _backfill_org(
    org_id: uuid.UUID,
    *,
    scan_id: uuid.UUID | None,
    batch_size: int,
    dry_run: bool,
) -> tuple[int, int, int]:
    """Backfill a single organization. Returns (processed, updated, skipped)."""
    processed = 0
    updated = 0
    skipped = 0

    async with async_session_factory() as session:
        await session.execute(text(f"SET app.current_tenant_id = '{org_id}'"))

        last_id: uuid.UUID | None = None
        batch_num = 0

        while True:
            batch_start = time.monotonic()
            batch_num += 1

            stmt = (
                select(ScanResult, ParcelCache)
                .join(ParcelCache, ParcelCache.id == ScanResult.parcel_id)
                .where(
                    ScanResult.organization_id == org_id,
                    ParcelCache.organization_id == org_id,
                )
                .order_by(ScanResult.id)
                .limit(batch_size)
            )
            if scan_id is not None:
                stmt = stmt.where(ScanResult.scan_id == scan_id)
            if last_id is not None:
                stmt = stmt.where(ScanResult.id > last_id)

            rows = (await session.execute(stmt)).all()
            if not rows:
                break

            # Load neighborhood_metrics for unique scan_ids in this batch
            unique_scan_ids = {sr.scan_id for sr, _pc in rows}
            nbhd_map = await _load_neighborhood_metrics(session, unique_scan_ids)

            batch_updated = 0
            for sr, pc in rows:
                processed += 1
                flags = dict(sr.flags) if sr.flags else {}

                parcel_data = _build_parcel_data(pc, flags)
                nbhd = nbhd_map.get(sr.scan_id)

                v3_result = compute_score_v3(parcel_data, nbhd)

                # Clamp overall to 0-100 for tile proxy compat
                overall_clamped = max(0.0, min(100.0, v3_result.overall))

                # Check if score actually changed
                old_score = round(float(sr.score), 3) if sr.score is not None else None
                new_score = round(overall_clamped, 3)

                if old_score == new_score and flags.get("score_model_version") == "score-v3.0":
                    skipped += 1
                    continue

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

                batch_updated += 1
                updated += 1

            if not dry_run and batch_updated > 0:
                await session.flush()
                await session.commit()

            elapsed = time.monotonic() - batch_start
            last_id = rows[-1][0].id

            logger.info(
                "Batch %d: %d rows, %d updated, %.1fs elapsed",
                batch_num,
                len(rows),
                batch_updated,
                elapsed,
            )

    return processed, updated, skipped


async def _run(
    *,
    organization_id: uuid.UUID | None,
    scan_id: uuid.UUID | None,
    batch_size: int,
    dry_run: bool,
) -> int:
    """Main backfill entry point."""
    org_ids = await _list_target_orgs(organization_id)
    if not org_ids:
        if organization_id is not None:
            logger.error("No organization found for id=%s", organization_id)
            return 1
        logger.error("No organizations found")
        return 1

    mode = "DRY RUN" if dry_run else "LIVE"
    logger.info(
        "Starting score-v3.0 backfill (%s): orgs=%d, scan_id=%s, batch_size=%d",
        mode,
        len(org_ids),
        scan_id,
        batch_size,
    )

    total_processed = 0
    total_updated = 0
    total_skipped = 0

    for index, org_id in enumerate(org_ids, start=1):
        logger.info("[%d/%d] org=%s ...", index, len(org_ids), org_id)
        processed, updated, skipped = await _backfill_org(
            org_id,
            scan_id=scan_id,
            batch_size=batch_size,
            dry_run=dry_run,
        )
        total_processed += processed
        total_updated += updated
        total_skipped += skipped
        logger.info(
            "  processed=%d, updated=%d, skipped_unchanged=%d",
            processed,
            updated,
            skipped,
        )

    logger.info(
        "Score-v3.0 backfill complete. Totals: processed=%d, updated=%d, skipped=%d",
        total_processed,
        total_updated,
        total_skipped,
    )
    return 0


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Backfill scan_results with Score v3.0 (Potentie + Risico).",
    )
    parser.add_argument(
        "--organization-id",
        type=_parse_uuid,
        help="Optional organization UUID scope",
    )
    parser.add_argument(
        "--scan-id",
        type=_parse_uuid,
        help="Optional scan UUID scope",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=500,
        help="Batch size for scan_results pagination (default: 500)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Compute scores and log changes without writing to the database",
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
            organization_id=args.organization_id,
            scan_id=args.scan_id,
            batch_size=args.batch_size,
            dry_run=args.dry_run,
        )
    )
    raise SystemExit(exit_code)


if __name__ == "__main__":
    main()
