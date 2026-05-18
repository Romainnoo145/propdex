"""Daily ARQ cron: BRK retention cleanup (M050/S01).

Per ENG-PLAN locked 2026-05-18:
- hard_delete_expired() — DELETE rows where hard_delete_after < NOW() AND soft_deleted_at IS NOT NULL
- soft_delete_orphans() — D3 safety-net: stamp records without matching parcel_favorites
- alert_if_anomaly() — D6 observability: Sentry alert if deleted_count > ANOMALY_THRESHOLD

Schedule: daily 03:00 UTC (matches existing daily_change_monitor pattern).
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Any, cast

from sqlalchemy import CursorResult, delete, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import async_session_factory
from app.models.brk_ownership_record import BrkOwnershipRecord
from app.services.brk_persistence_service import (
    ANOMALY_THRESHOLD,
    HARD_DELETE_OFFSET_DAYS,
    find_orphaned_records,
)

logger = logging.getLogger(__name__)


async def hard_delete_expired(db: AsyncSession) -> int:
    """Hard-delete rows where hard_delete_after < NOW() AND soft_deleted_at IS NOT NULL.

    Returns deleted row count. Backed by partial index idx_brk_hard_delete.
    """
    now = datetime.utcnow()
    result = cast(
        "CursorResult[Any]",
        await db.execute(
            delete(BrkOwnershipRecord).where(
                BrkOwnershipRecord.hard_delete_after < now,
                BrkOwnershipRecord.soft_deleted_at.is_not(None),
            )
        ),
    )
    return result.rowcount or 0


async def soft_delete_orphans(db: AsyncSession) -> int:
    """D3 safety-net: stamp orphaned brk_ownership_records (no matching parcel_favorites).

    Picks up rows missed by the primary trigger in favorites_service.delete_favorite()
    (e.g. when favorites were removed via raw SQL or future bulk-delete pad).
    """
    orphan_ids = await find_orphaned_records(db)
    if not orphan_ids:
        return 0
    now = datetime.utcnow()
    hard_delete_after = now + timedelta(days=HARD_DELETE_OFFSET_DAYS)
    result = cast(
        "CursorResult[Any]",
        await db.execute(
            update(BrkOwnershipRecord)
            .where(BrkOwnershipRecord.id.in_(orphan_ids))
            .values(soft_deleted_at=now, hard_delete_after=hard_delete_after)
        ),
    )
    return result.rowcount or 0


def alert_if_anomaly(deleted_count: int) -> None:
    """D6: Sentry alert when daily cron deletes > ANOMALY_THRESHOLD rows in one run."""
    if deleted_count <= ANOMALY_THRESHOLD:
        return
    # Sentry-SDK breadcrumb; worker bootstrap calls init_sentry() before run.
    try:
        import sentry_sdk

        sentry_sdk.capture_message(
            f"brk.retention.cleanup anomaly: {deleted_count} rows hard-deleted in one run "
            f"(threshold {ANOMALY_THRESHOLD})",
            level="warning",
        )
    except ImportError:
        logger.warning(
            "brk.retention.cleanup anomaly: %d rows hard-deleted (threshold %d); "
            "sentry_sdk not installed",
            deleted_count, ANOMALY_THRESHOLD,
        )


async def brk_retention_cleanup_job(ctx: dict[str, Any]) -> dict[str, int]:
    """Daily cron entry-point. Runs orphan-pickup first, then hard-delete.

    Returns {orphans_softdeleted, hard_deleted, total} for ARQ result inspection.
    Structured log event: brk.retention.cleanup
    """
    async with async_session_factory() as db:
        orphans = await soft_delete_orphans(db)
        deleted = await hard_delete_expired(db)
        await db.commit()

    logger.info(
        "brk.retention.cleanup orphans_softdeleted=%d hard_deleted=%d",
        orphans, deleted,
    )
    alert_if_anomaly(deleted)
    return {
        "orphans_softdeleted": orphans,
        "hard_deleted": deleted,
        "total": orphans + deleted,
    }
