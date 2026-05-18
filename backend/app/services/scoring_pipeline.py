"""Scoring pipeline — BRK → parcel_data materialization for Score v3 (M050/S03).

D1 (LOCKED via /plan-eng-review M050/S03):
    Single source of BRK data for scoring. Factor functions in
    `score_v3_factors.py` stay PURE — they consume
    `parcel_data["brk_records"]` produced here and never touch the DB.

D8 (LOCKED):
    `settings.M050_S03_FACTORS_ENABLED` gate. When False, this function
    returns `parcel_data` UNCHANGED — no query is executed, no key is
    inserted. The 3 new S03 factor functions then observe a missing
    `brk_records` key (via `parcel_data.get("brk_records")`) and degrade
    gracefully to `missing=True` through the existing P5 redistribution
    machinery in `compute_score_v3`.

D9 (LOCKED):
    READ-ONLY. This module NEVER imports `brk_fetch_service` and NEVER
    triggers an HTTP fetch — it only queries the persisted
    `brk_ownership_records` table. Fresh BRK data enters ONLY via the
    explicit S02 persist endpoint. Scoring never spends a Kadaster
    credit.

REGRESSION-CRITICAL F2:
    The `WHERE organization_id = :org_id` clause is pinned by
    `backend/tests/regression/test_m050_s03_multitenant.py`. Drift =
    silent cross-tenant BRK leak = AVG breach.
"""
from __future__ import annotations

import logging
from typing import TypedDict
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.brk_ownership_record import BrkOwnershipRecord

logger = logging.getLogger(__name__)


class BRKRecordDict(TypedDict, total=False):
    """Dict-shaped projection of `BrkOwnershipRecord` for scoring consumers.

    Mirrors `BRKOwnershipRecordRead` (S01 Pydantic schema) but as a TypedDict
    so `score_v3_factors` functions can type-hint
    `parcel_data["brk_records"]` entries without dragging a Pydantic
    dependency into the pure-function scoring layer.

    Notes on type coercions performed at the boundary (D1):
    - `koopsom` (Decimal in DB) → `float | None` (Decimal not JSON-friendly).
    - `fetched_at` (datetime in DB) → `str` (ISO-8601 — also JSON-friendly).
    """

    eigenaar_type: str
    eigenaar_naam: str | None
    kvk_nummer: str | None
    statutaire_zetel: str | None
    zakelijk_recht_type: str | None
    aandeel: str | None
    koopsom: float | None
    koopjaar: int | None
    heeft_hypotheek: bool
    fetched_at: str


async def enrich_parcel_data_with_brk(
    parcel_data: dict,
    org_id: UUID,
    db: AsyncSession,
) -> dict:
    """Materialize latest BRK rows for ``(org_id, parcel_id)`` into ``parcel_data``.

    D1 — single source of BRK data for scoring. Factor functions stay PURE
    (no DB calls inside `score_v3_factors.py`).

    D8 — when `settings.M050_S03_FACTORS_ENABLED` is False this function
    returns ``parcel_data`` UNCHANGED. The ``"brk_records"`` key is NOT
    inserted, so the 3 S03 factor functions see ``None`` via
    ``parcel_data.get("brk_records")`` and return ``missing=True`` via the
    ``_missing_brk`` helper.

    D9 — read-only; NEVER calls `brk_fetch_service.fetch_and_persist`,
    NEVER spends a Kadaster credit. Fresh BRK only enters via S02's
    explicit persist endpoint.

    REGRESSION-CRITICAL F2 — the query filters on
    ``BrkOwnershipRecord.organization_id == org_id``. This invariant is
    pinned by ``tests/regression/test_m050_s03_multitenant.py``.

    Args:
        parcel_data: scan-job / rescore-job parcel context dict. MUST contain
            ``"parcel_id"``. Mutated in place — the same dict identity is
            returned for caller-side ergonomics.
        org_id: caller organization (multi-tenant guard).
        db: async session bound to the scoring transaction.

    Returns:
        ``parcel_data`` with ``"brk_records": list[BRKRecordDict]`` populated
        (may be ``[]`` when no rows match). Returned UNCHANGED when the
        feature flag is off.
    """
    if not settings.M050_S03_FACTORS_ENABLED:
        return parcel_data

    parcel_id = parcel_data.get("parcel_id")
    if parcel_id is None:
        logger.debug(
            "enrich_parcel_data_with_brk skipped: parcel_data missing 'parcel_id'",
        )
        parcel_data["brk_records"] = []
        return parcel_data

    stmt = (
        select(BrkOwnershipRecord)
        .where(
            BrkOwnershipRecord.organization_id == org_id,
            BrkOwnershipRecord.parcel_id == parcel_id,
            BrkOwnershipRecord.soft_deleted_at.is_(None),
        )
        .order_by(BrkOwnershipRecord.fetched_at.desc())
    )
    result = await db.execute(stmt)
    rows = result.scalars().all()

    records: list[BRKRecordDict] = [
        BRKRecordDict(
            eigenaar_type=row.eigenaar_type,
            eigenaar_naam=row.eigenaar_naam,
            kvk_nummer=row.kvk_nummer,
            statutaire_zetel=row.statutaire_zetel,
            zakelijk_recht_type=row.zakelijk_recht_type,
            aandeel=row.aandeel,
            koopsom=float(row.koopsom) if row.koopsom is not None else None,
            koopjaar=row.koopjaar,
            heeft_hypotheek=bool(row.heeft_hypotheek),
            fetched_at=row.fetched_at.isoformat(),
        )
        for row in rows
    ]
    parcel_data["brk_records"] = records
    logger.debug(
        "enrich_parcel_data_with_brk org=%s parcel=%s rows=%d",
        org_id,
        parcel_id,
        len(records),
    )
    return parcel_data
