"""brk_read_service — M050/S06 read-path voor persisted BRK records.

Distinct van brk_fetch_service (persist channel): deze module doet alleen DB-reads,
geen Kadaster calls. Multi-tenant safety: alle queries filteren op organization_id.

Latest fetch-cycle semantics: anchor op MAX(fetched_at), return ALLE rows die
deze timestamp delen (multi-owner: rechtspersoon + overheid joint ownership).
Cross-org access returns [] — silent isolation prevents existence leak (AD2).
"""
from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.brk_ownership_record import BrkOwnershipRecord
from app.schemas.brk_ownership_record import BRKOwnershipRecordRead


async def read_for_parcel(
    *,
    db: AsyncSession,
    organization_id: uuid.UUID,
    parcel_id: str,
) -> list[BRKOwnershipRecordRead]:
    """Return latest fetch-cycle rows for (org, parcel), excluding soft-deleted.

    Filters on organization_id AND parcel_id AND soft_deleted_at IS NULL.
    Anchors on MAX(fetched_at) and returns ALL rows matching that timestamp
    (multi-owner support: rechtspersoon + overheid joint ownership).

    Cross-org access returns [] — silent isolation prevents existence leak.
    """
    stmt = (
        select(BrkOwnershipRecord)
        .where(
            BrkOwnershipRecord.organization_id == organization_id,
            BrkOwnershipRecord.parcel_id == parcel_id,
            BrkOwnershipRecord.soft_deleted_at.is_(None),
        )
        .order_by(BrkOwnershipRecord.fetched_at.desc())
    )
    result = await db.execute(stmt)
    rows = result.scalars().all()
    if not rows:
        return []
    latest_at = rows[0].fetched_at
    latest_rows = [r for r in rows if r.fetched_at == latest_at]
    return [BRKOwnershipRecordRead.model_validate(r) for r in latest_rows]
