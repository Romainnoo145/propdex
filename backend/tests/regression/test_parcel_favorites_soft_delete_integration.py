"""REGRESSION-CRITICAL: favorites_service.delete_favorite flow unaffected by D3 hook.

Iron rule (ENG-PLAN §REGRESSIONS): the BRK soft-delete hook in delete_favorite()
MUST NOT break the favorites flow. If soft_delete_for_org_parcel raises, the
favorite MUST still be deleted. Orphan-cron is the safety-net.

Three scenarios:
1. BRK soft-delete raises → favorite still deleted (resilience contract)
2. No BRK rows exist for parcel → favorite deleted, no exception
3. Happy path: BRK row + favorite both gone (overlap with Task 2 e2e — lives
   in regression suite for ongoing protection)
"""
from __future__ import annotations

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.favorites.favorites_service import delete_favorite
from app.models.brk_ownership_record import BrkOwnershipRecord
from app.models.parcel_favorite import ParcelFavorite


@pytest.mark.asyncio
async def test_delete_favorite_still_succeeds_when_brk_soft_delete_raises(
    test_db: AsyncSession,
    create_test_user,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """D3 hook wrapped in try/except — BRK failure does not block favorite delete."""
    from app.favorites import favorites_service

    async def boom(**kwargs: object) -> None:
        raise RuntimeError("simulated BRK soft-delete failure")

    monkeypatch.setattr(favorites_service, "soft_delete_for_org_parcel", boom)

    user, _org = await create_test_user()
    parcel_id = "NL.IMKAD.Regression.Boom"
    fav = ParcelFavorite(
        user_id=user.id, parcel_id=parcel_id, pipeline_stage="Gesignaleerd",
    )
    test_db.add(fav)
    await test_db.commit()

    # MUST NOT raise — D3 hook resilience per Plan 01-02 spec
    await delete_favorite(parcel_id=parcel_id, user_id=user.id, db=test_db)

    # Favorite IS gone
    check = await test_db.execute(
        select(ParcelFavorite).where(
            ParcelFavorite.user_id == user.id,
            ParcelFavorite.parcel_id == parcel_id,
        )
    )
    assert check.scalar_one_or_none() is None


@pytest.mark.asyncio
async def test_delete_favorite_with_no_brk_records_is_noop(
    test_db: AsyncSession, create_test_user
) -> None:
    """No matching BRK rows → favorite deletes cleanly, D3 hook no-ops."""
    user, _org = await create_test_user()
    parcel_id = "NL.IMKAD.Regression.NoBrk"
    fav = ParcelFavorite(
        user_id=user.id, parcel_id=parcel_id, pipeline_stage="Gesignaleerd",
    )
    test_db.add(fav)
    await test_db.commit()

    # No BRK rows for this parcel — D3 hook should no-op
    await delete_favorite(parcel_id=parcel_id, user_id=user.id, db=test_db)

    check = await test_db.execute(
        select(ParcelFavorite).where(ParcelFavorite.parcel_id == parcel_id)
    )
    assert check.scalar_one_or_none() is None


@pytest.mark.asyncio
async def test_delete_favorite_with_active_brk_record_soft_deletes_it(
    test_db: AsyncSession, create_test_user
) -> None:
    """End-to-end happy path — favorite deleted AND BRK row soft-deleted.

    Overlaps with state-machine integration test but lives in regression suite
    for long-term protection of the D3 primary trigger contract.
    """
    user, org = await create_test_user()
    parcel_id = "NL.IMKAD.Regression.Happy"
    fav = ParcelFavorite(
        user_id=user.id, parcel_id=parcel_id, pipeline_stage="Gesignaleerd",
    )
    record = BrkOwnershipRecord(
        organization_id=org.id,
        parcel_id=parcel_id,
        eigenaar_type="rechtspersoon",
        eigenaar_naam="BV Regression",
    )
    test_db.add_all([fav, record])
    await test_db.commit()
    await test_db.refresh(record)

    await delete_favorite(parcel_id=parcel_id, user_id=user.id, db=test_db)

    # Favorite gone
    check_fav = await test_db.execute(
        select(ParcelFavorite).where(ParcelFavorite.parcel_id == parcel_id)
    )
    assert check_fav.scalar_one_or_none() is None

    # BRK row soft-deleted
    refreshed = await test_db.execute(
        select(BrkOwnershipRecord).where(BrkOwnershipRecord.id == record.id)
    )
    brk = refreshed.scalar_one()
    assert brk.soft_deleted_at is not None
    assert brk.hard_delete_after is not None
