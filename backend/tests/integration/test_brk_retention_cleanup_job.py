"""Integration tests — BRK retention cleanup ARQ cron (M050/S01).

Closes Job GAPS from ENG-PLAN §Test coverage diagram:
- hard-delete expired rows (fast-forward clock pattern)
- preserves non-expired rows
- preserves active rows (soft_deleted_at IS NULL)
- idempotency (second run = no-op)
- returns correct counts dict
- orphan pickup (D3 safety-net)
- structured-log emission (brk.retention.cleanup)
- D6 anomaly alert under threshold (no Sentry call)
- D6 anomaly alert over threshold (1 Sentry call with 'anomaly')

Mock-clock pattern: project does NOT use freezegun. Inject rows with
hard_delete_after = NOW() - 1d directly to simulate "expired" state.

The cron opens its own session via async_session_factory pointing at
production DB. We monkeypatch it to a test-engine-bound factory.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Any

import pytest
import sentry_sdk
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker

from app.jobs import brk_retention_cleanup_job as cron_module
from app.jobs.brk_retention_cleanup_job import (
    alert_if_anomaly,
    brk_retention_cleanup_job,
)
from app.models.brk_ownership_record import BrkOwnershipRecord
from app.models.parcel_favorite import ParcelFavorite


@pytest.fixture
def patched_cron_factory(
    test_engine: AsyncEngine, monkeypatch: pytest.MonkeyPatch
) -> async_sessionmaker[AsyncSession]:
    """Bind brk_retention_cleanup_job's async_session_factory to test engine."""
    factory = async_sessionmaker(
        test_engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autocommit=False,
        autoflush=False,
    )
    monkeypatch.setattr(cron_module, "async_session_factory", factory)
    return factory


# ──────────────────────────────────────────────────────────────────────────
# hard_delete_expired
# ──────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_hard_delete_cron_fast_forward(
    test_db: AsyncSession, create_test_user, patched_cron_factory
) -> None:
    """Row with hard_delete_after in the past → hard-deleted by cron."""
    _, org = await create_test_user()
    now = datetime.utcnow()
    record = BrkOwnershipRecord(
        organization_id=org.id,
        parcel_id="NL.IMKAD.Expired.1",
        eigenaar_type="rechtspersoon",
        eigenaar_naam="BV Expired",
        soft_deleted_at=now - timedelta(days=91),
        hard_delete_after=now - timedelta(days=1),
    )
    test_db.add(record)
    await test_db.commit()
    await test_db.refresh(record)
    record_id = record.id

    result = await brk_retention_cleanup_job(ctx={})
    assert result["hard_deleted"] >= 1

    # Row gone — confirm via a NEW session on same engine
    async with patched_cron_factory() as verify_session:
        gone = await verify_session.execute(
            select(BrkOwnershipRecord).where(BrkOwnershipRecord.id == record_id)
        )
        assert gone.scalar_one_or_none() is None


@pytest.mark.asyncio
async def test_cleanup_preserves_non_expired(
    test_db: AsyncSession, create_test_user, patched_cron_factory
) -> None:
    """Row with hard_delete_after in the future is preserved."""
    user, org = await create_test_user()
    now = datetime.utcnow()
    parcel_id = "NL.IMKAD.Future.1"
    # Add a favorite so this row is not treated as orphan
    fav = ParcelFavorite(user_id=user.id, parcel_id=parcel_id)
    record = BrkOwnershipRecord(
        organization_id=org.id,
        parcel_id=parcel_id,
        eigenaar_type="rechtspersoon",
        eigenaar_naam="BV Future",
        soft_deleted_at=now - timedelta(days=5),
        hard_delete_after=now + timedelta(days=30),
    )
    test_db.add_all([fav, record])
    await test_db.commit()
    await test_db.refresh(record)
    record_id = record.id

    await brk_retention_cleanup_job(ctx={})

    async with patched_cron_factory() as verify_session:
        still_there = await verify_session.execute(
            select(BrkOwnershipRecord).where(BrkOwnershipRecord.id == record_id)
        )
        assert still_there.scalar_one_or_none() is not None


@pytest.mark.asyncio
async def test_cleanup_preserves_active_rows_with_favorite(
    test_db: AsyncSession, create_test_user, patched_cron_factory
) -> None:
    """Active row (no stamps) with matching favorite — cron leaves it alone."""
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
    record_id = record.id

    result = await brk_retention_cleanup_job(ctx={})
    assert result["hard_deleted"] == 0
    assert result["orphans_softdeleted"] == 0

    async with patched_cron_factory() as verify_session:
        still_active = await verify_session.execute(
            select(BrkOwnershipRecord).where(BrkOwnershipRecord.id == record_id)
        )
        row = still_active.scalar_one()
        assert row.soft_deleted_at is None
        assert row.hard_delete_after is None


# ──────────────────────────────────────────────────────────────────────────
# Idempotency + return-counts
# ──────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_cleanup_idempotent(
    test_db: AsyncSession, create_test_user, patched_cron_factory
) -> None:
    """Second run with no new orphans/expirations → all-zero counts."""
    user, org = await create_test_user()
    # One favorited row (active, never orphaned)
    fav = ParcelFavorite(user_id=user.id, parcel_id="NL.IMKAD.Idem.1")
    record = BrkOwnershipRecord(
        organization_id=org.id,
        parcel_id="NL.IMKAD.Idem.1",
        eigenaar_type="rechtspersoon",
        eigenaar_naam="BV Idem",
    )
    test_db.add_all([fav, record])
    await test_db.commit()

    first = await brk_retention_cleanup_job(ctx={})
    second = await brk_retention_cleanup_job(ctx={})

    assert second["hard_deleted"] == 0
    assert second["orphans_softdeleted"] == 0
    # First may pick up zero orphans (row is favorited); confirm structural shape
    assert "total" in first and "total" in second


@pytest.mark.asyncio
async def test_cleanup_returns_counts_dict(
    test_db: AsyncSession, create_test_user, patched_cron_factory
) -> None:
    """Cron returns {orphans_softdeleted, hard_deleted, total} with total = sum."""
    _, _org = await create_test_user()
    result = await brk_retention_cleanup_job(ctx={})
    assert set(result.keys()) == {"orphans_softdeleted", "hard_deleted", "total"}
    assert result["total"] == result["orphans_softdeleted"] + result["hard_deleted"]


# ──────────────────────────────────────────────────────────────────────────
# Orphan pickup (D3 safety-net)
# ──────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_orphan_pickup(
    test_db: AsyncSession, create_test_user, patched_cron_factory
) -> None:
    """BRK row WITHOUT matching favorite → cron's soft_delete_orphans stamps it."""
    _, org = await create_test_user()
    record = BrkOwnershipRecord(
        organization_id=org.id,
        parcel_id="NL.IMKAD.OrphanCron.1",
        eigenaar_type="rechtspersoon",
        eigenaar_naam="BV Orphan",
    )
    test_db.add(record)
    await test_db.commit()
    await test_db.refresh(record)
    record_id = record.id

    result = await brk_retention_cleanup_job(ctx={})
    assert result["orphans_softdeleted"] >= 1

    async with patched_cron_factory() as verify_session:
        check = await verify_session.execute(
            select(BrkOwnershipRecord).where(BrkOwnershipRecord.id == record_id)
        )
        row = check.scalar_one()
        assert row.soft_deleted_at is not None
        assert row.hard_delete_after is not None


# ──────────────────────────────────────────────────────────────────────────
# Structured logging
# ──────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_cleanup_emits_structured_log(
    test_db: AsyncSession,
    create_test_user,
    patched_cron_factory,
    caplog: pytest.LogCaptureFixture,
) -> None:
    """brk.retention.cleanup is logged with structured key=value pairs."""
    _, _org = await create_test_user()
    with caplog.at_level(logging.INFO, logger="app.jobs.brk_retention_cleanup_job"):
        await brk_retention_cleanup_job(ctx={})

    assert any(
        "brk.retention.cleanup" in r.message for r in caplog.records
    ), f"Expected brk.retention.cleanup log; got: {[r.message for r in caplog.records]}"


# ──────────────────────────────────────────────────────────────────────────
# D6 anomaly alert
# ──────────────────────────────────────────────────────────────────────────


def test_alert_if_anomaly_under_threshold(monkeypatch: pytest.MonkeyPatch) -> None:
    """deleted_count <= 1000 → no Sentry call."""
    calls: list[Any] = []
    monkeypatch.setattr(
        sentry_sdk,
        "capture_message",
        lambda *args, **kwargs: calls.append((args, kwargs)),
    )
    alert_if_anomaly(999)
    alert_if_anomaly(1000)
    assert calls == []


def test_alert_if_anomaly_over_threshold(monkeypatch: pytest.MonkeyPatch) -> None:
    """deleted_count > 1000 → exactly 1 Sentry call with 'anomaly' in message."""
    calls: list[tuple[tuple[Any, ...], dict[str, Any]]] = []

    def fake_capture(*args: Any, **kwargs: Any) -> None:
        calls.append((args, kwargs))

    monkeypatch.setattr(sentry_sdk, "capture_message", fake_capture)

    alert_if_anomaly(1001)
    assert len(calls) == 1
    # message is first positional arg
    message = calls[0][0][0]
    assert "anomaly" in message.lower()
    assert "1001" in message
