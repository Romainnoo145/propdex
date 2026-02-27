"""Backfill scan_results.flags.building_metrics from parcel bestemmingen.

Usage:
    python -m app.tools.backfill_scan_building_metrics
    python -m app.tools.backfill_scan_building_metrics --dry-run
    python -m app.tools.backfill_scan_building_metrics --organization-id <uuid>
    python -m app.tools.backfill_scan_building_metrics --scan-id <uuid>
"""

from __future__ import annotations

import argparse
import asyncio
import uuid
from dataclasses import dataclass

from sqlalchemy import bindparam, select, text
from sqlalchemy import update as sa_update

from app.core.database import async_session_factory
from app.models.organization import Organization
from app.models.parcel_cache import ParcelCache
from app.models.scan_result import ScanResult
from app.services.parcel_scoring import extract_building_metrics


@dataclass(slots=True)
class BackfillStats:
    """Per-organization backfill counters."""

    organization_id: uuid.UUID
    processed: int = 0
    updated: int = 0
    skipped_existing: int = 0
    skipped_no_metrics: int = 0
    skipped_unchanged: int = 0


def _has_any_metric(metrics: dict | None) -> bool:
    if not isinstance(metrics, dict):
        return False
    return any(
        metrics.get(key) is not None
        for key in ("max_bebouwingspercentage", "max_floor_area_ratio")
    )


def _parse_uuid(value: str) -> uuid.UUID:
    try:
        return uuid.UUID(value)
    except ValueError as exc:
        raise argparse.ArgumentTypeError(f"Invalid UUID: {value}") from exc


async def _list_target_orgs(target_org_id: uuid.UUID | None) -> list[uuid.UUID]:
    async with async_session_factory() as session:
        if target_org_id is not None:
            found = await session.execute(
                select(Organization.id).where(Organization.id == target_org_id)
            )
            org_id = found.scalar_one_or_none()
            return [org_id] if org_id else []

        result = await session.execute(select(Organization.id).order_by(Organization.id))
        return list(result.scalars())


async def _backfill_org(
    org_id: uuid.UUID,
    *,
    scan_id: uuid.UUID | None,
    batch_size: int,
    only_missing: bool,
    dry_run: bool,
) -> BackfillStats:
    stats = BackfillStats(organization_id=org_id)

    async with async_session_factory() as session:
        # Set tenant context for RLS-protected tables in this maintenance session.
        await session.execute(text(f"SET app.current_tenant_id = '{org_id}'"))

        update_stmt = (
            sa_update(ScanResult)
            .where(ScanResult.id == bindparam("scan_result_id"))
            .values(flags=bindparam("new_flags"))
        )

        last_id: uuid.UUID | None = None
        while True:
            stmt = (
                select(ScanResult.id, ScanResult.flags, ParcelCache.bestemmingen)
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

            updates: list[dict[str, object]] = []
            for scan_result_id, raw_flags, raw_bestemmingen in rows:
                stats.processed += 1

                flags = raw_flags if isinstance(raw_flags, dict) else {}
                existing_metrics_raw = flags.get("building_metrics")
                existing_metrics = (
                    existing_metrics_raw if isinstance(existing_metrics_raw, dict) else None
                )

                if only_missing and _has_any_metric(existing_metrics):
                    stats.skipped_existing += 1
                    continue

                bestemmingen = raw_bestemmingen if isinstance(raw_bestemmingen, list) else None
                derived_metrics = extract_building_metrics(bestemmingen)
                if not _has_any_metric(derived_metrics):
                    stats.skipped_no_metrics += 1
                    continue

                if existing_metrics == derived_metrics:
                    stats.skipped_unchanged += 1
                    continue

                next_flags = dict(flags)
                next_flags["building_metrics"] = derived_metrics
                updates.append(
                    {
                        "scan_result_id": scan_result_id,
                        "new_flags": next_flags,
                    }
                )

            if updates:
                if dry_run:
                    stats.updated += len(updates)
                else:
                    await session.execute(update_stmt, updates)
                    await session.commit()
                    stats.updated += len(updates)

            last_id = rows[-1][0]

    return stats


async def _run(
    *,
    organization_id: uuid.UUID | None,
    scan_id: uuid.UUID | None,
    batch_size: int,
    only_missing: bool,
    dry_run: bool,
) -> int:
    org_ids = await _list_target_orgs(organization_id)
    if not org_ids:
        if organization_id is not None:
            print(f"No organization found for id={organization_id}")
            return 1
        print("No organizations found")
        return 1

    print(
        "Starting backfill: "
        f"orgs={len(org_ids)}, scan_id={scan_id}, batch_size={batch_size}, "
        f"only_missing={only_missing}, dry_run={dry_run}"
    )

    total_processed = 0
    total_updated = 0
    total_skipped_existing = 0
    total_skipped_no_metrics = 0
    total_skipped_unchanged = 0

    for index, org_id in enumerate(org_ids, start=1):
        print(f"[{index}/{len(org_ids)}] org={org_id} ...")
        stats = await _backfill_org(
            org_id,
            scan_id=scan_id,
            batch_size=batch_size,
            only_missing=only_missing,
            dry_run=dry_run,
        )
        total_processed += stats.processed
        total_updated += stats.updated
        total_skipped_existing += stats.skipped_existing
        total_skipped_no_metrics += stats.skipped_no_metrics
        total_skipped_unchanged += stats.skipped_unchanged

        print(
            f"  processed={stats.processed}, updated={stats.updated}, "
            f"skipped_existing={stats.skipped_existing}, "
            f"skipped_no_metrics={stats.skipped_no_metrics}, "
            f"skipped_unchanged={stats.skipped_unchanged}"
        )

    print("Backfill completed")
    print(
        "Totals: "
        f"processed={total_processed}, updated={total_updated}, "
        f"skipped_existing={total_skipped_existing}, "
        f"skipped_no_metrics={total_skipped_no_metrics}, "
        f"skipped_unchanged={total_skipped_unchanged}"
    )

    return 0


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=(
            "Backfill scan_results.flags.building_metrics from "
            "parcel_cache.bestemmingen."
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
        help="Optional scan UUID scope (requires matching organization context)",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=1000,
        help="Batch size for scan_results pagination (default: 1000)",
    )
    parser.add_argument(
        "--overwrite",
        action="store_true",
        help="Overwrite existing non-empty building_metrics values too",
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

