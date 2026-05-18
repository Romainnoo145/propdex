"""Unit tests for BrkOwnershipRecord model (M050/S01).

Closes Plan 01-03 GAPS:
- Model: rechtspersoon+overheid create (2 GAPS)
- Model: natuurlijk_persoon CHECK fail (D1 defense-in-depth at DB layer)
- Model: UQ (org, parcel, fetched_at) — historical rows allowed (D5)
- Model: cascade delete on Organization removal
"""
from __future__ import annotations

from datetime import datetime, timedelta

import pytest
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.brk_ownership_record import BrkOwnershipRecord
from app.models.organization import Organization


@pytest.mark.asyncio
async def test_create_record_with_rechtspersoon(
    test_db: AsyncSession, create_test_user
) -> None:
    """Insert eigenaar_type='rechtspersoon' + eigenaar_naam='BV X' → succeeds."""
    _, org = await create_test_user()
    record = BrkOwnershipRecord(
        organization_id=org.id,
        parcel_id="NL.IMKAD.KadastraalObject.12345678",
        eigenaar_type="rechtspersoon",
        eigenaar_naam="BV Voorbeeld",
        kvk_nummer="12345678",
        heeft_hypotheek=False,
    )
    test_db.add(record)
    await test_db.commit()
    await test_db.refresh(record)
    assert record.id is not None
    assert record.created_at is not None
    assert record.updated_at is not None
    assert record.fetched_at is not None  # server_default CURRENT_TIMESTAMP


@pytest.mark.asyncio
async def test_create_record_with_overheid(
    test_db: AsyncSession, create_test_user
) -> None:
    """Insert eigenaar_type='overheid' → succeeds (D1 allowlist)."""
    _, org = await create_test_user()
    record = BrkOwnershipRecord(
        organization_id=org.id,
        parcel_id="NL.IMKAD.KadastraalObject.99999999",
        eigenaar_type="overheid",
        eigenaar_naam="Gemeente Venlo",
    )
    test_db.add(record)
    await test_db.commit()
    await test_db.refresh(record)
    assert record.eigenaar_type == "overheid"


@pytest.mark.asyncio
async def test_check_constraint_rejects_natuurlijk_persoon(
    test_db: AsyncSession, create_test_user
) -> None:
    """D1 defense-in-depth: DB CHECK rejects natuurlijk_persoon even if it bypasses service."""
    _, org = await create_test_user()
    record = BrkOwnershipRecord(
        organization_id=org.id,
        parcel_id="NL.IMKAD.KadastraalObject.55555555",
        eigenaar_type="natuurlijk_persoon",
        eigenaar_naam=None,
    )
    test_db.add(record)
    with pytest.raises(IntegrityError) as exc_info:
        await test_db.commit()
    # Constraint name is "eigenaar_type_check" — pg surfaces it in the error message
    assert "eigenaar_type_check" in str(exc_info.value).lower()


@pytest.mark.asyncio
async def test_unique_constraint_allows_historical_rows(
    test_db: AsyncSession, create_test_user
) -> None:
    """D5: same (org, parcel) with DIFFERENT fetched_at → both succeed (historical rows)."""
    _, org = await create_test_user()
    parcel_id = "NL.IMKAD.History.1"
    t1 = datetime.utcnow() - timedelta(days=30)
    t2 = datetime.utcnow()

    row1 = BrkOwnershipRecord(
        organization_id=org.id,
        parcel_id=parcel_id,
        eigenaar_type="rechtspersoon",
        eigenaar_naam="BV Oud",
        fetched_at=t1,
    )
    row2 = BrkOwnershipRecord(
        organization_id=org.id,
        parcel_id=parcel_id,
        eigenaar_type="rechtspersoon",
        eigenaar_naam="BV Nieuw",
        fetched_at=t2,
    )
    test_db.add_all([row1, row2])
    await test_db.commit()

    result = await test_db.execute(
        select(BrkOwnershipRecord).where(
            BrkOwnershipRecord.organization_id == org.id,
            BrkOwnershipRecord.parcel_id == parcel_id,
        )
    )
    rows = result.scalars().all()
    assert len(rows) == 2


@pytest.mark.asyncio
async def test_unique_constraint_rejects_same_fetched_at(
    test_db: AsyncSession, create_test_user
) -> None:
    """UQ enforced: same (org, parcel, fetched_at) tuple → IntegrityError."""
    _, org = await create_test_user()
    parcel_id = "NL.IMKAD.UQ.1"
    same_ts = datetime.utcnow()

    row1 = BrkOwnershipRecord(
        organization_id=org.id,
        parcel_id=parcel_id,
        eigenaar_type="rechtspersoon",
        eigenaar_naam="BV A",
        fetched_at=same_ts,
    )
    test_db.add(row1)
    await test_db.commit()

    row2 = BrkOwnershipRecord(
        organization_id=org.id,
        parcel_id=parcel_id,
        eigenaar_type="rechtspersoon",
        eigenaar_naam="BV B",
        fetched_at=same_ts,
    )
    test_db.add(row2)
    with pytest.raises(IntegrityError) as exc_info:
        await test_db.commit()
    assert "uq_brk_org_parcel_fetched" in str(exc_info.value).lower()


@pytest.mark.asyncio
async def test_cascade_delete_on_org_removal(
    test_db: AsyncSession,
) -> None:
    """ON DELETE CASCADE: deleting Organization purges its BRK rows."""
    org = Organization(name="Org Doomed")
    test_db.add(org)
    await test_db.commit()
    await test_db.refresh(org)
    org_id = org.id

    record = BrkOwnershipRecord(
        organization_id=org_id,
        parcel_id="NL.IMKAD.Doomed.1",
        eigenaar_type="overheid",
        eigenaar_naam="Gemeente Doomed",
    )
    test_db.add(record)
    await test_db.commit()
    await test_db.refresh(record)
    record_id = record.id

    await test_db.delete(org)
    await test_db.commit()

    result = await test_db.execute(
        select(BrkOwnershipRecord).where(BrkOwnershipRecord.id == record_id)
    )
    assert result.scalar_one_or_none() is None
