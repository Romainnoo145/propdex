"""BRK persistence service (M050/S01).

Per ENG-PLAN locked 2026-05-18:
- D1: Feature flag M050_BRK_PERSIST_ENABLED + DB CHECK defense-in-depth
- D2: strip_raw_brk_response() redacts natuurlijk_persoon before JSONB persist
- D3: soft_delete_for_org_parcel() = primary trigger (called from delete_favorite);
      find_orphaned_records() = safety-net for bypassed paths
- D4: persist_record() is the ONLY function gated by FF; read + retention unaffected
- D5: soft_delete updates ALL rows for (org, parcel) — UQ allows historical rows
- D7: service-file name matches milestone-plan
- D8: persist_record raises ValidationError if rechtspersoon has naam=None

Persist-write happy path (S02 will complete fetch_and_persist + get_latest_for_parcel).
S01 ships persist_record stub gated by FF + full retention + strip helper.
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timedelta
from typing import Any, cast

from sqlalchemy import CursorResult, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.brk_ownership_record import BrkOwnershipRecord
from app.schemas.brk_ownership_record import (
    BRKOwnershipRecordCreate,
    BRKOwnershipRecordRead,
)

logger = logging.getLogger(__name__)

# Retention math (Q7 LOCKED + ENG-PLAN §Retention)
SOFT_DELETE_RETENTION_DAYS = 30  # informational; recoverable window
HARD_DELETE_OFFSET_DAYS = 60     # hard_delete_after = soft_deleted_at + 60d
ANOMALY_THRESHOLD = 1000         # D6: Sentry alert if cron deletes more than this in one run

# Eigenaar types AVG-safe to persist
PERSISTENT_EIGENAAR_TYPES = {"rechtspersoon", "overheid"}


class FeatureDisabled(Exception):
    """Raised by persist_record() when M050_BRK_PERSIST_ENABLED is False (D4)."""


class ValidationError(Exception):
    """Raised by persist_record() when rechtspersoon has eigenaar_naam=None (D8)."""


def strip_raw_brk_response(
    raw: dict[str, Any] | None,
) -> dict[str, Any] | None:
    """Redact natuurlijk_persoon entries from raw BRK response before JSONB persist (D2).

    Defensive: malformed input returns None + warn log.
    Preserves rechtspersoon/overheid/onbekend entries verbatim for debugging value.
    """
    if raw is None:
        return None
    if not isinstance(raw, dict):
        logger.warning("strip_raw_brk_response: non-dict input, returning None")
        return None

    result: dict[str, Any] = {}
    for key, value in raw.items():
        if isinstance(value, list):
            # Filter list entries: drop any dict with eigenaar_type == "natuurlijk_persoon",
            # recurse into nested dicts inside the list to scrub deeper structures.
            cleaned_list: list[Any] = []
            for item in value:
                if isinstance(item, dict):
                    if item.get("eigenaar_type") == "natuurlijk_persoon":
                        continue
                    cleaned_list.append(strip_raw_brk_response(item))
                else:
                    cleaned_list.append(item)
            result[key] = cleaned_list
        elif isinstance(value, dict):
            # Recursive strip on nested dicts
            result[key] = strip_raw_brk_response(value)
        else:
            result[key] = value
    return result


async def persist_record(
    db: AsyncSession,
    organization_id: uuid.UUID,
    data: BRKOwnershipRecordCreate,
) -> BRKOwnershipRecordRead:
    """Persist one BRK ownership record. STUB — full implementation in S02.

    S01 ships:
    - D4 feature-flag gate (raises FeatureDisabled when M050_BRK_PERSIST_ENABLED=False)
    - D8 NULL-naam reject for rechtspersoon (raises ValidationError)
    - D2 strip raw_brk_response before insert

    S02 will add: BRK Bevragen client call + transaction wiring + retention-window reuse.
    """
    if not settings.M050_BRK_PERSIST_ENABLED:
        raise FeatureDisabled(
            "BRK persist niet beschikbaar (DPA pending — M050_BRK_PERSIST_ENABLED=False)"
        )

    if data.eigenaar_type == "rechtspersoon" and not data.eigenaar_naam:
        raise ValidationError(
            "eigenaar_naam mag niet None zijn voor eigenaar_type='rechtspersoon' (D8)"
        )

    # D2 strip-at-write
    stripped_raw = strip_raw_brk_response(data.raw_brk_response)

    record = BrkOwnershipRecord(
        organization_id=organization_id,
        parcel_id=data.parcel_id,
        eigenaar_type=data.eigenaar_type,
        eigenaar_naam=data.eigenaar_naam,
        kvk_nummer=data.kvk_nummer,
        statutaire_zetel=data.statutaire_zetel,
        zakelijk_recht_type=data.zakelijk_recht_type,
        aandeel=data.aandeel,
        koopsom=data.koopsom,
        koopjaar=data.koopjaar,
        heeft_hypotheek=data.heeft_hypotheek,
        raw_brk_response=stripped_raw,
        fetched_at=datetime.utcnow(),
    )
    db.add(record)
    await db.flush()
    await db.refresh(record)
    return BRKOwnershipRecordRead.model_validate(record)


async def soft_delete_for_org_parcel(
    db: AsyncSession,
    organization_id: uuid.UUID,
    parcel_id: str,
) -> int:
    """Mark ALL active rows for (org, parcel) as soft-deleted (D3 primary trigger, D5 historie).

    Per ENG-PLAN: when ALL parcel_favorites for (org, parcel) are deleted, ALL historical
    BRK rows for (org, parcel) get the same soft_deleted_at + hard_delete_after stamps.
    Idempotent: rows already soft-deleted are NOT re-stamped.

    Returns number of rows newly soft-deleted (0 if parcel had no BRK rows yet — no-op).
    """
    now = datetime.utcnow()
    hard_delete_after = now + timedelta(days=HARD_DELETE_OFFSET_DAYS)

    result = cast(
        "CursorResult[Any]",
        await db.execute(
            update(BrkOwnershipRecord)
            .where(
                BrkOwnershipRecord.organization_id == organization_id,
                BrkOwnershipRecord.parcel_id == parcel_id,
                BrkOwnershipRecord.soft_deleted_at.is_(None),
            )
            .values(soft_deleted_at=now, hard_delete_after=hard_delete_after)
        ),
    )
    affected = result.rowcount or 0
    if affected:
        logger.info(
            "brk.retention.soft_delete org=%s parcel=%s rows=%d hard_delete_after=%s",
            organization_id, parcel_id, affected, hard_delete_after.isoformat(),
        )
    else:
        logger.debug(
            "brk.retention.soft_delete no-op org=%s parcel=%s (no active rows)",
            organization_id, parcel_id,
        )
    return affected


async def find_orphaned_records(
    db: AsyncSession,
) -> list[uuid.UUID]:
    """D3 safety-net: brk_ownership_records WITHOUT a matching parcel_favorites row,
    and NOT yet soft-deleted.

    Returns list of BrkOwnershipRecord.id values. The retention cron passes these to
    soft_delete_for_org_parcel-equivalent batch update (see brk_retention_cleanup_job).

    Implementation note: ParcelFavorite is user-scoped (no organization_id column),
    so org-membership is resolved via the User table. A BRK record is orphaned when
    NO user in the same organization has favorited the same parcel.
    """
    from app.models.parcel_favorite import ParcelFavorite
    from app.models.user import User

    # Subquery: every (organization_id, parcel_id) currently favorited by at least
    # one user in that organization.
    active_org_parcels = (
        select(User.organization_id, ParcelFavorite.parcel_id)
        .join(ParcelFavorite, ParcelFavorite.user_id == User.id)
        .distinct()
        .subquery()
    )

    query = (
        select(BrkOwnershipRecord.id)
        .outerjoin(
            active_org_parcels,
            (active_org_parcels.c.organization_id == BrkOwnershipRecord.organization_id)
            & (active_org_parcels.c.parcel_id == BrkOwnershipRecord.parcel_id),
        )
        .where(
            active_org_parcels.c.parcel_id.is_(None),
            BrkOwnershipRecord.soft_deleted_at.is_(None),
        )
    )
    result = await db.execute(query)
    return [row[0] for row in result.all()]
