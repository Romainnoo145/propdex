"""Recompute scan_results score + score flags using opportunity-score-v2.1.

Usage:
    python -m app.tools.backfill_scan_scores_v2
    python -m app.tools.backfill_scan_scores_v2 --dry-run
    python -m app.tools.backfill_scan_scores_v2 --organization-id <uuid>
    python -m app.tools.backfill_scan_scores_v2 --scan-id <uuid>
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
from app.services.parcel_scoring import (
    compute_opportunity_score,
    derive_opportunity_insights,
)


@dataclass(slots=True)
class BackfillStats:
    """Per-organization backfill counters."""

    organization_id: uuid.UUID
    processed: int = 0
    updated: int = 0
    skipped_unchanged: int = 0


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
    dry_run: bool,
) -> BackfillStats:
    stats = BackfillStats(organization_id=org_id)

    async with async_session_factory() as session:
        await session.execute(text(f"SET app.current_tenant_id = '{org_id}'"))

        scan_results_table = ScanResult.__table__
        update_stmt = (
            sa_update(scan_results_table)
            .where(scan_results_table.c.id == bindparam("scan_result_pk"))
            .values(
                score=bindparam("new_score"),
                flags=bindparam("new_flags"),
            )
            .execution_options(synchronize_session=False)
        )

        last_id: uuid.UUID | None = None
        while True:
            stmt = (
                select(ScanResult.id, ScanResult.score, ScanResult.flags, ParcelCache)
                .join(ParcelCache, ParcelCache.id == ScanResult.parcel_id)
                .where(
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
            for scan_result_id, raw_score, raw_flags, parcel in rows:
                stats.processed += 1

                score_breakdown = compute_opportunity_score(parcel)
                insights = derive_opportunity_insights(parcel)

                flags = raw_flags if isinstance(raw_flags, dict) else {}
                next_flags = dict(flags)
                next_flags.update(
                    {
                        "category": score_breakdown.category,
                        "factors": score_breakdown.factors,
                        "subscores": {
                            "vacancy": score_breakdown.vacancy_subscore,
                            "buildability": score_breakdown.buildability_subscore,
                        },
                        "score_model_version": score_breakdown.model_version,
                        "vacancy_signal": insights.vacancy_signal,
                        "opportunity_signals": insights.signals,
                        "building_metrics": insights.building_metrics,
                    }
                )

                next_score = round(float(score_breakdown.total_score), 3)
                current_score = (
                    round(float(raw_score), 3)
                    if isinstance(raw_score, (int, float)) and not isinstance(raw_score, bool)
                    else None
                )
                if current_score == next_score and flags == next_flags:
                    stats.skipped_unchanged += 1
                    continue

                updates.append(
                    {
                        "scan_result_pk": scan_result_id,
                        "new_score": next_score,
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
        "Starting score-v2.1 backfill: "
        f"orgs={len(org_ids)}, scan_id={scan_id}, batch_size={batch_size}, dry_run={dry_run}"
    )

    total_processed = 0
    total_updated = 0
    total_skipped_unchanged = 0

    for index, org_id in enumerate(org_ids, start=1):
        print(f"[{index}/{len(org_ids)}] org={org_id} ...")
        stats = await _backfill_org(
            org_id,
            scan_id=scan_id,
            batch_size=batch_size,
            dry_run=dry_run,
        )
        total_processed += stats.processed
        total_updated += stats.updated
        total_skipped_unchanged += stats.skipped_unchanged
        print(
            f"  processed={stats.processed}, updated={stats.updated}, "
            f"skipped_unchanged={stats.skipped_unchanged}"
        )

    print("Score-v2.1 backfill completed")
    print(
        "Totals: "
        f"processed={total_processed}, updated={total_updated}, "
        f"skipped_unchanged={total_skipped_unchanged}"
    )
    return 0


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Backfill scan_results.score and score flags with opportunity-score-v2.1."
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
        default=1000,
        help="Batch size for scan_results pagination (default: 1000)",
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
            dry_run=args.dry_run,
        )
    )
    raise SystemExit(exit_code)


if __name__ == "__main__":
    main()
