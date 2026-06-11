"""Recompute scan_results score_breakdown with cascade factors (woonvisie_match, beleidsalignement).

Delegates the per-gemeente recompute loop to the shared
``app.services.cascade_scoring.recompute_gemeente_cascade`` service so
the manual backfill and the automatic paths (scan, rescore job) can
never drift.

NOTE: Only recomputes score-v3.0 rows.  Pre-v3.0 rows are skipped by
``recompute_gemeente_cascade`` — use ``backfill_scan_scores_v3`` to
upgrade those first, then re-run this tool.

At least one of woonvisie or omgevingsvisie must be present in the
extraction cache; both are optional individually.

Usage:
    python -m app.tools.backfill_cascade_scores --gemeente GM0983
    python -m app.tools.backfill_cascade_scores --gemeente GM0983 --dry-run
    python -m app.tools.backfill_cascade_scores --gemeente GM0983 --organization-id <uuid>
"""

from __future__ import annotations

import argparse
import asyncio
import logging
import uuid

from sqlalchemy import select, text

from app.core.database import async_session_factory
from app.models.organization import Organization
from app.services.cascade_scoring import recompute_gemeente_cascade

logger = logging.getLogger(__name__)


def _parse_uuid(value: str) -> uuid.UUID:
    try:
        return uuid.UUID(value)
    except ValueError as exc:
        raise argparse.ArgumentTypeError(f"Invalid UUID: {value}") from exc


async def _resolve_org_id(target_org_id: uuid.UUID | None) -> uuid.UUID | None:
    async with async_session_factory() as session:
        if target_org_id is not None:
            row = await session.execute(
                select(Organization.id).where(Organization.id == target_org_id)
            )
            return row.scalar_one_or_none()

        rows = (await session.execute(select(Organization.id))).scalars().all()
        if len(rows) == 1:
            return rows[0]
        logger.error(
            "Multiple organizations found — pass --organization-id explicitly. Found: %s", rows
        )
        return None


async def _backfill_gemeente(
    gemeente_code: str,
    org_id: uuid.UUID,
    *,
    batch_size: int,
    dry_run: bool,
) -> tuple[int, int]:
    """Backfill scan_results for a gemeente via the shared cascade service.

    Only recomputes score-v3.0 rows (pre-v3.0 rows are skipped —
    use backfill_scan_scores_v3 to upgrade those first).

    Returns (processed, updated).
    """
    async with async_session_factory() as session:
        await session.execute(text(f"SET app.current_tenant_id = '{org_id}'"))
        processed, updated = await recompute_gemeente_cascade(
            session,
            gemeente_code=gemeente_code,
            organization_id=org_id,
            batch_size=batch_size,
            dry_run=dry_run,
        )
        if not dry_run:
            await session.commit()
    return processed, updated


async def _run(
    *,
    gemeente_code: str,
    organization_id: uuid.UUID | None,
    batch_size: int,
    dry_run: bool,
) -> int:
    org_id = await _resolve_org_id(organization_id)
    if org_id is None:
        return 1

    mode = "DRY RUN" if dry_run else "LIVE"
    logger.info(
        "Starting cascade score backfill (%s): gemeente=%s org=%s batch_size=%d — 0 Claude calls",
        mode, gemeente_code, org_id, batch_size,
    )

    processed, updated = await _backfill_gemeente(
        gemeente_code,
        org_id,
        batch_size=batch_size,
        dry_run=dry_run,
    )

    logger.info(
        "Cascade backfill complete: processed=%d updated=%d",
        processed, updated,
    )
    return 0


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Backfill scan_results score_breakdown with woonvisie_match (zero Claude calls).",
    )
    parser.add_argument(
        "--gemeente",
        default="GM0983",
        help="Gemeente code to backfill (default: GM0983 = Venlo)",
    )
    parser.add_argument(
        "--organization-id",
        type=_parse_uuid,
        help="Optional organization UUID (required when multiple orgs exist)",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=200,
        help="Batch size for pagination (default: 200)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Compute and log without writing to database",
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
            gemeente_code=args.gemeente,
            organization_id=args.organization_id,
            batch_size=args.batch_size,
            dry_run=args.dry_run,
        )
    )
    raise SystemExit(exit_code)


if __name__ == "__main__":
    main()
