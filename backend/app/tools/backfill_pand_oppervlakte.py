"""Backfill scan_results.flags.building_metrics.pand_oppervlakte_m2 from BAG WFS.

Re-queries BAG WFS for each AreaScan's bounding box, builds a spatial index,
and derives pand_oppervlakte_m2 for each scan result with has_pand=True.

Usage:
    python -m app.tools.backfill_pand_oppervlakte
    python -m app.tools.backfill_pand_oppervlakte --dry-run
    python -m app.tools.backfill_pand_oppervlakte --organization-id <uuid>
    python -m app.tools.backfill_pand_oppervlakte --scan-id <uuid>
"""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import uuid
from dataclasses import dataclass

import httpx
from geoalchemy2.shape import to_shape
from sqlalchemy import select, text

from app.core.database import async_session_factory
from app.government_apis.bag_wfs import bag_wfs_client
from app.jobs.area_scan import _build_bag_spatial_index, _derive_bag_attributes_for_parcel
from app.models.area_scan import AreaScan
from app.models.parcel_cache import ParcelCache
from app.models.scan_result import ScanResult

logger = logging.getLogger(__name__)


@dataclass(slots=True)
class BackfillStats:
    """Per-scan backfill counters."""

    scan_id: uuid.UUID
    processed: int = 0
    updated: int = 0
    skipped_no_pand: int = 0
    skipped_no_geometry: int = 0
    skipped_existing: int = 0
    skipped_no_match: int = 0
    errors: int = 0


@dataclass(slots=True)
class TotalStats:
    """Aggregate counters across all scans."""

    scans_processed: int = 0
    scans_skipped_bag: int = 0
    processed: int = 0
    updated: int = 0
    skipped_no_pand: int = 0
    skipped_no_geometry: int = 0
    skipped_existing: int = 0
    skipped_no_match: int = 0
    errors: int = 0


def _parse_uuid(value: str) -> uuid.UUID:
    try:
        return uuid.UUID(value)
    except ValueError as exc:
        raise argparse.ArgumentTypeError(f"Invalid UUID: {value}") from exc


async def _list_target_scans(
    organization_id: uuid.UUID | None,
    scan_id: uuid.UUID | None,
) -> list[tuple[uuid.UUID, float, float, float, float]]:
    """Return (scan_id, bbox_minx, bbox_miny, bbox_maxx, bbox_maxy) tuples."""
    async with async_session_factory() as session:
        stmt = select(
            AreaScan.id,
            AreaScan.bbox_minx,
            AreaScan.bbox_miny,
            AreaScan.bbox_maxx,
            AreaScan.bbox_maxy,
        ).where(AreaScan.status.in_(["completed", "completed_with_warnings"]))

        if scan_id is not None:
            stmt = stmt.where(AreaScan.id == scan_id)
        stmt = stmt.order_by(AreaScan.id)
        rows = (await session.execute(stmt)).all()
        return [(r[0], r[1], r[2], r[3], r[4], r[5]) for r in rows]


async def _backfill_scan(
    scan_id: uuid.UUID,
    org_id: uuid.UUID,
    bbox_minx: float,
    bbox_miny: float,
    bbox_maxx: float,
    bbox_maxy: float,
    http_client: httpx.AsyncClient,
    *,
    batch_size: int,
    only_missing: bool,
    dry_run: bool,
) -> BackfillStats | None:
    """Backfill pand_oppervlakte_m2 for one scan by re-querying BAG WFS."""
    stats = BackfillStats(scan_id=scan_id)

    # Fetch BAG building footprints for this scan's bbox
    try:
        bag_features = await bag_wfs_client.get_panden_in_bbox(
            bbox_minx, bbox_miny, bbox_maxx, bbox_maxy, http_client,
        )
    except Exception as e:
        logger.warning("Scan %s: BAG WFS fetch failed: %s", scan_id, e)
        return None

    bag_index = _build_bag_spatial_index(bag_features)
    if bag_index is None:
        logger.info("Scan %s: no BAG buildings in bbox, skipping", scan_id)
        return None

    async with async_session_factory() as session:
        await session.execute(text(f"SET app.current_tenant_id = '{org_id}'"))

        update_stmt = text(
            "UPDATE scan_results SET flags = :new_flags"
            " WHERE id = :scan_result_id"
        )

        last_id: uuid.UUID | None = None
        while True:
            stmt = (
                select(
                    ScanResult.id,
                    ScanResult.flags,
                    ParcelCache.geometry,
                    ParcelCache.has_pand,
                )
                .join(ParcelCache, ParcelCache.id == ScanResult.parcel_id)
                .where(
                    ScanResult.scan_id == scan_id,
                )
                .order_by(ScanResult.id)
                .limit(batch_size)
            )
            if last_id is not None:
                stmt = stmt.where(ScanResult.id > last_id)

            rows = (await session.execute(stmt)).all()
            if not rows:
                break

            updates: list[dict[str, object]] = []
            for scan_result_id, raw_flags, geom_wkb, has_pand in rows:
                stats.processed += 1

                if not has_pand:
                    stats.skipped_no_pand += 1
                    last_id = scan_result_id
                    continue

                flags = raw_flags if isinstance(raw_flags, dict) else {}
                bm = flags.get("building_metrics")
                existing_bm = bm if isinstance(bm, dict) else {}

                if only_missing and existing_bm.get("pand_oppervlakte_m2") is not None:
                    stats.skipped_existing += 1
                    last_id = scan_result_id
                    continue

                if geom_wkb is None:
                    stats.skipped_no_geometry += 1
                    last_id = scan_result_id
                    continue

                try:
                    parcel_shape = to_shape(geom_wkb)
                except Exception:
                    stats.errors += 1
                    last_id = scan_result_id
                    continue

                _has_pand, _bouwjaar, _status, _addr, pand_oppervlakte_m2 = (
                    _derive_bag_attributes_for_parcel(parcel_shape, bag_index)
                )

                if pand_oppervlakte_m2 is None:
                    stats.skipped_no_match += 1
                    last_id = scan_result_id
                    continue

                next_flags = dict(flags)
                next_bm = dict(existing_bm)
                next_bm["pand_oppervlakte_m2"] = pand_oppervlakte_m2
                next_flags["building_metrics"] = next_bm
                updates.append({
                    "scan_result_id": str(scan_result_id),
                    "new_flags": json.dumps(next_flags),
                })
                last_id = scan_result_id

            if updates:
                if dry_run:
                    stats.updated += len(updates)
                else:
                    await session.execute(update_stmt, updates)
                    await session.commit()
                    stats.updated += len(updates)

    return stats


async def _run(
    *,
    organization_id: uuid.UUID | None,
    scan_id: uuid.UUID | None,
    batch_size: int,
    only_missing: bool,
    dry_run: bool,
) -> int:
    scans = await _list_target_scans(organization_id, scan_id)
    if not scans:
        print("No matching scans found")
        return 1

    print(
        f"Starting pand_oppervlakte backfill: scans={len(scans)}, "
        f"batch_size={batch_size}, only_missing={only_missing}, dry_run={dry_run}"
    )

    totals = TotalStats()

    async with httpx.AsyncClient(timeout=httpx.Timeout(60.0)) as http_client:
        for index, (sid, oid, minx, miny, maxx, maxy) in enumerate(scans, start=1):
            print(f"[{index}/{len(scans)}] scan={sid} org={oid} ...")
            stats = await _backfill_scan(
                sid, oid, minx, miny, maxx, maxy, http_client,
                batch_size=batch_size,
                only_missing=only_missing,
                dry_run=dry_run,
            )
            totals.scans_processed += 1

            if stats is None:
                totals.scans_skipped_bag += 1
                print("  skipped (BAG WFS failed or no buildings)")
                continue

            totals.processed += stats.processed
            totals.updated += stats.updated
            totals.skipped_no_pand += stats.skipped_no_pand
            totals.skipped_no_geometry += stats.skipped_no_geometry
            totals.skipped_existing += stats.skipped_existing
            totals.skipped_no_match += stats.skipped_no_match
            totals.errors += stats.errors

            print(
                f"  processed={stats.processed}, updated={stats.updated}, "
                f"no_pand={stats.skipped_no_pand}, existing={stats.skipped_existing}, "
                f"no_match={stats.skipped_no_match}, errors={stats.errors}"
            )

    print("Backfill completed")
    print(
        f"Totals: scans={totals.scans_processed} (skipped_bag={totals.scans_skipped_bag}), "
        f"processed={totals.processed}, updated={totals.updated}, "
        f"no_pand={totals.skipped_no_pand}, existing={totals.skipped_existing}, "
        f"no_match={totals.skipped_no_match}, errors={totals.errors}"
    )

    return 0


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=(
            "Backfill scan_results.flags.building_metrics.pand_oppervlakte_m2 "
            "by re-querying BAG WFS for each scan's bounding box."
        )
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
        "--overwrite",
        action="store_true",
        help="Overwrite existing pand_oppervlakte_m2 values too",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Calculate updates without writing to the database",
    )
    return parser


def main() -> None:
    parser = _build_parser()
    args = parser.parse_args()

    if args.batch_size < 1:
        parser.error("--batch-size must be >= 1")

    exit_code = asyncio.run(
        _run(
            organization_id=args.organization_id,
            scan_id=args.scan_id,
            batch_size=args.batch_size,
            only_missing=not args.overwrite,
            dry_run=args.dry_run,
        )
    )
    raise SystemExit(exit_code)


if __name__ == "__main__":
    main()
