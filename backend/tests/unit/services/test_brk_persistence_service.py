"""Unit tests for brk_persistence_service (M050/S01).

Closes Plan 01-03 GAPS:
- Service: strip_raw_brk_response — drops natuurlijk_persoon (D2), None passthrough,
  malformed input → None + WARN, preserves rechtspersoon, recurses into lists+dicts.
- Service: persist_record — D4 FeatureDisabled gate, D8 NULL-naam reject,
  happy path with FF enabled, D2 strip-at-write.
- Service: soft_delete_for_org_parcel — stamps timestamps with 60d offset, idempotent,
  no-op on missing parcel.
- Service: find_orphaned_records — picks up rows without favorite,
  excludes already-soft-deleted rows.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.brk_ownership_record import BrkOwnershipRecord
from app.models.parcel_favorite import ParcelFavorite
from app.schemas.brk_ownership_record import BRKOwnershipRecordCreate
from app.services.brk_persistence_service import (
    ANOMALY_THRESHOLD,
    HARD_DELETE_OFFSET_DAYS,
    SOFT_DELETE_RETENTION_DAYS,
    FeatureDisabled,
    ValidationError,
    find_orphaned_records,
    persist_record,
    soft_delete_for_org_parcel,
    strip_raw_brk_response,
)

# ──────────────────────────────────────────────────────────────────────────
# strip_raw_brk_response (D2)
# ──────────────────────────────────────────────────────────────────────────


def test_strip_raw_brk_response_drops_natuurlijk_persoon() -> None:
    raw = {
        "items": [
            {"eigenaar_type": "natuurlijk_persoon", "naam": "Geheim"},
            {"eigenaar_type": "rechtspersoon", "naam": "BV X"},
        ]
    }
    result = strip_raw_brk_response(raw)
    assert result == {"items": [{"eigenaar_type": "rechtspersoon", "naam": "BV X"}]}


def test_strip_raw_brk_response_none_input() -> None:
    assert strip_raw_brk_response(None) is None


def test_strip_raw_brk_response_malformed_input_returns_none(
    caplog: pytest.LogCaptureFixture,
) -> None:
    """Non-dict input → None + WARN log (defensive)."""
    with caplog.at_level(logging.WARNING):
        # mypy: deliberate wrong type to test runtime defensiveness
        result = strip_raw_brk_response(["list", "not", "dict"])  # type: ignore[arg-type]
    assert result is None
    assert any("strip_raw_brk_response" in r.message for r in caplog.records)


def test_strip_raw_brk_response_preserves_rechtspersoon() -> None:
    raw = {
        "items": [
            {"eigenaar_type": "rechtspersoon", "naam": "BV A"},
            {"eigenaar_type": "overheid", "naam": "Gemeente X"},
        ]
    }
    result = strip_raw_brk_response(raw)
    assert result == raw


def test_strip_raw_brk_response_recurses_into_nested_dicts() -> None:
    """Nested dicts also get scrubbed — defensive."""
    raw = {
        "outer": {
            "inner": [
                {"eigenaar_type": "natuurlijk_persoon", "naam": "X"},
                {"eigenaar_type": "rechtspersoon", "naam": "BV Y"},
            ]
        }
    }
    result = strip_raw_brk_response(raw)
    assert result == {
        "outer": {
            "inner": [{"eigenaar_type": "rechtspersoon", "naam": "BV Y"}]
        }
    }


# ──────────────────────────────────────────────────────────────────────────
# Retention constants — locked from ENG-PLAN Q7
# ──────────────────────────────────────────────────────────────────────────


def test_retention_constants_locked() -> None:
    assert SOFT_DELETE_RETENTION_DAYS == 30
    assert HARD_DELETE_OFFSET_DAYS == 60
    assert ANOMALY_THRESHOLD == 1000


# ──────────────────────────────────────────────────────────────────────────
# persist_record — D4 FeatureFlag + D8 NULL reject + happy path + D2 strip
# ──────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_persist_record_raises_feature_disabled(
    test_db: AsyncSession, create_test_user
) -> None:
    """D4: persist write-path gated by M050_BRK_PERSIST_ENABLED (default False)."""
    _, org = await create_test_user()
    data = BRKOwnershipRecordCreate(
        parcel_id="NL.IMKAD.Test.1",
        eigenaar_type="rechtspersoon",
        eigenaar_naam="BV X",
    )
    # Default settings.M050_BRK_PERSIST_ENABLED is False
    with pytest.raises(FeatureDisabled):
        await persist_record(test_db, org.id, data)


@pytest.mark.asyncio
async def test_persist_record_raises_validation_error_on_null_naam(
    test_db: AsyncSession,
    create_test_user,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """D8: rechtspersoon MUST have eigenaar_naam — None rejected by service layer."""
    monkeypatch.setattr(settings, "M050_BRK_PERSIST_ENABLED", True)
    _, org = await create_test_user()
    data = BRKOwnershipRecordCreate(
        parcel_id="NL.IMKAD.Test.2",
        eigenaar_type="rechtspersoon",
        eigenaar_naam=None,  # D8 violation
    )
    with pytest.raises(ValidationError):
        await persist_record(test_db, org.id, data)


@pytest.mark.asyncio
async def test_persist_record_happy_path_when_flag_enabled(
    test_db: AsyncSession,
    create_test_user,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """FF on + valid rechtspersoon → row persists, BRKOwnershipRecordRead returned."""
    monkeypatch.setattr(settings, "M050_BRK_PERSIST_ENABLED", True)
    _, org = await create_test_user()
    data = BRKOwnershipRecordCreate(
        parcel_id="NL.IMKAD.Happy.1",
        eigenaar_type="rechtspersoon",
        eigenaar_naam="BV Happy",
        kvk_nummer="87654321",
    )
    result = await persist_record(test_db, org.id, data)
    await test_db.commit()

    assert result.parcel_id == "NL.IMKAD.Happy.1"
    assert result.eigenaar_type == "rechtspersoon"
    assert result.eigenaar_naam == "BV Happy"
    assert result.organization_id == org.id

    # Row exists in DB
    row = await test_db.execute(
        select(BrkOwnershipRecord).where(BrkOwnershipRecord.id == result.id)
    )
    assert row.scalar_one_or_none() is not None


@pytest.mark.asyncio
async def test_persist_record_strips_raw_before_insert(
    test_db: AsyncSession,
    create_test_user,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """D2 + D4: persist with raw_brk_response containing natuurlijk_persoon —
    stored row's JSONB excludes natuurlijk_persoon entries."""
    monkeypatch.setattr(settings, "M050_BRK_PERSIST_ENABLED", True)
    _, org = await create_test_user()
    data = BRKOwnershipRecordCreate(
        parcel_id="NL.IMKAD.Strip.1",
        eigenaar_type="rechtspersoon",
        eigenaar_naam="BV Strip",
        raw_brk_response={
            "items": [
                {"eigenaar_type": "natuurlijk_persoon", "naam": "Geheim"},
                {"eigenaar_type": "rechtspersoon", "naam": "BV Strip"},
            ]
        },
    )
    result = await persist_record(test_db, org.id, data)
    await test_db.commit()

    stored = await test_db.execute(
        select(BrkOwnershipRecord).where(BrkOwnershipRecord.id == result.id)
    )
    record = stored.scalar_one()
    assert record.raw_brk_response is not None
    items = record.raw_brk_response.get("items", [])
    assert isinstance(items, list)
    assert len(items) == 1
    assert isinstance(items[0], dict)
    assert items[0]["eigenaar_type"] == "rechtspersoon"


# ──────────────────────────────────────────────────────────────────────────
# soft_delete_for_org_parcel — D3 primary trigger semantics
# ──────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_soft_delete_for_org_parcel_stamps_timestamps(
    test_db: AsyncSession, create_test_user
) -> None:
    """soft_deleted_at = now; hard_delete_after = soft_deleted_at + 60d (Q7 LOCKED)."""
    _, org = await create_test_user()
    record = BrkOwnershipRecord(
        organization_id=org.id,
        parcel_id="NL.IMKAD.Soft.1",
        eigenaar_type="rechtspersoon",
        eigenaar_naam="BV X",
    )
    test_db.add(record)
    await test_db.commit()

    count = await soft_delete_for_org_parcel(test_db, org.id, "NL.IMKAD.Soft.1")
    await test_db.commit()
    assert count == 1

    await test_db.refresh(record)
    assert record.soft_deleted_at is not None
    assert record.hard_delete_after is not None
    delta = (record.hard_delete_after - record.soft_deleted_at).total_seconds()
    # 60d ±2s tolerance
    assert abs(delta - HARD_DELETE_OFFSET_DAYS * 86400) < 2


@pytest.mark.asyncio
async def test_soft_delete_for_org_parcel_idempotent(
    test_db: AsyncSession, create_test_user
) -> None:
    """Second call leaves stamps untouched and returns rows_affected=0."""
    _, org = await create_test_user()
    record = BrkOwnershipRecord(
        organization_id=org.id,
        parcel_id="NL.IMKAD.Soft.2",
        eigenaar_type="rechtspersoon",
        eigenaar_naam="BV X",
    )
    test_db.add(record)
    await test_db.commit()

    first = await soft_delete_for_org_parcel(test_db, org.id, "NL.IMKAD.Soft.2")
    await test_db.commit()
    assert first == 1
    await test_db.refresh(record)
    original_soft = record.soft_deleted_at
    original_hard = record.hard_delete_after

    second = await soft_delete_for_org_parcel(test_db, org.id, "NL.IMKAD.Soft.2")
    await test_db.commit()
    assert second == 0

    await test_db.refresh(record)
    assert record.soft_deleted_at == original_soft
    assert record.hard_delete_after == original_hard


@pytest.mark.asyncio
async def test_soft_delete_for_org_parcel_no_op_on_missing_parcel(
    test_db: AsyncSession, create_test_user
) -> None:
    """Unknown parcel → returns 0, no exception."""
    _, org = await create_test_user()
    count = await soft_delete_for_org_parcel(test_db, org.id, "NL.IMKAD.Missing.1")
    assert count == 0


@pytest.mark.asyncio
async def test_soft_delete_stamps_all_historical_rows_for_org_parcel(
    test_db: AsyncSession, create_test_user
) -> None:
    """D5: two historical rows for same (org, parcel) → both stamped in one call."""
    _, org = await create_test_user()
    parcel_id = "NL.IMKAD.Soft.3"
    t1 = datetime.utcnow() - timedelta(days=30)
    t2 = datetime.utcnow()
    row1 = BrkOwnershipRecord(
        organization_id=org.id, parcel_id=parcel_id,
        eigenaar_type="rechtspersoon", eigenaar_naam="BV Oud", fetched_at=t1,
    )
    row2 = BrkOwnershipRecord(
        organization_id=org.id, parcel_id=parcel_id,
        eigenaar_type="rechtspersoon", eigenaar_naam="BV Nieuw", fetched_at=t2,
    )
    test_db.add_all([row1, row2])
    await test_db.commit()

    count = await soft_delete_for_org_parcel(test_db, org.id, parcel_id)
    await test_db.commit()
    assert count == 2


# ──────────────────────────────────────────────────────────────────────────
# find_orphaned_records — D3 safety-net
# ──────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_find_orphaned_records_returns_brk_without_favorite(
    test_db: AsyncSession, create_test_user
) -> None:
    """BRK row without matching parcel_favorite (in same org) → present in orphan list."""
    _, org = await create_test_user()
    record = BrkOwnershipRecord(
        organization_id=org.id,
        parcel_id="NL.IMKAD.Orphan.1",
        eigenaar_type="rechtspersoon",
        eigenaar_naam="BV Orphan",
    )
    test_db.add(record)
    await test_db.commit()
    await test_db.refresh(record)

    orphans = await find_orphaned_records(test_db)
    assert record.id in orphans


@pytest.mark.asyncio
async def test_find_orphaned_records_excludes_softdeleted(
    test_db: AsyncSession, create_test_user
) -> None:
    """Already soft-deleted rows NEVER appear in orphan list (would re-stamp pointlessly)."""
    _, org = await create_test_user()
    now = datetime.utcnow()
    record = BrkOwnershipRecord(
        organization_id=org.id,
        parcel_id="NL.IMKAD.Orphan.2",
        eigenaar_type="rechtspersoon",
        eigenaar_naam="BV Already",
        soft_deleted_at=now - timedelta(days=10),
        hard_delete_after=now + timedelta(days=50),
    )
    test_db.add(record)
    await test_db.commit()
    await test_db.refresh(record)

    orphans = await find_orphaned_records(test_db)
    assert record.id not in orphans


@pytest.mark.asyncio
async def test_find_orphaned_records_excludes_favorited_rows(
    test_db: AsyncSession, create_test_user
) -> None:
    """BRK row WITH a matching parcel_favorite in same org → NOT orphaned."""
    user, org = await create_test_user()
    parcel_id = "NL.IMKAD.Active.1"
    fav = ParcelFavorite(user_id=user.id, parcel_id=parcel_id)
    record = BrkOwnershipRecord(
        organization_id=org.id,
        parcel_id=parcel_id,
        eigenaar_type="rechtspersoon",
        eigenaar_naam="BV Active",
    )
    test_db.add_all([fav, record])
    await test_db.commit()
    await test_db.refresh(record)

    orphans = await find_orphaned_records(test_db)
    assert record.id not in orphans
