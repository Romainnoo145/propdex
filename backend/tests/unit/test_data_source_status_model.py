"""Unit tests for DataSourceStatus model (M049/S01).

Wave-0 RED: imports fail until Task 2 creates the model.
Project pattern: `test_db` fixture (NOT db_session) + `create_test_user`.
"""
import uuid
from datetime import datetime

import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.data_source_status import DataSourceStatus


@pytest.mark.asyncio
async def test_model_roundtrip(test_db: AsyncSession):
    """Create + flush + reload returns all fields with expected types."""
    row = DataSourceStatus(
        gemeente_code="GM0983",
        source_key="woonvisie",
        status="live",
        last_checked=datetime.utcnow(),
        error_message=None,
        configuratie={"refresh_interval_hours": 24},
        managed_by_user_id=None,
    )
    test_db.add(row)
    await test_db.commit()
    await test_db.refresh(row)
    assert isinstance(row.id, uuid.UUID)
    assert row.gemeente_code == "GM0983"
    assert row.source_key == "woonvisie"
    assert row.configuratie == {"refresh_interval_hours": 24}
    assert row.status == "live"
    assert row.created_at is not None
    assert row.updated_at is not None


@pytest.mark.asyncio
async def test_uq_duplicate_insert_raises(test_db: AsyncSession):
    """UQ (gemeente_code, source_key) blocks duplicates."""
    first = DataSourceStatus(
        gemeente_code="GM0983", source_key="bag-panden", status="live",
    )
    test_db.add(first)
    await test_db.commit()

    duplicate = DataSourceStatus(
        gemeente_code="GM0983", source_key="bag-panden", status="broken",
    )
    test_db.add(duplicate)
    with pytest.raises(IntegrityError):
        await test_db.commit()


@pytest.mark.asyncio
@pytest.mark.parametrize("valid_status", ["live", "broken", "missing", "not_applicable"])
async def test_status_enum_accepts_valid(test_db: AsyncSession, valid_status: str):
    """All 4 status values accepted at DB layer (no native enum constraint)."""
    row = DataSourceStatus(
        gemeente_code="GM0344",
        source_key=f"bag-panden-{valid_status}",
        status=valid_status,
    )
    test_db.add(row)
    await test_db.commit()
    await test_db.refresh(row)
    assert row.status == valid_status


def test_status_enum_rejects_invalid_via_pydantic():
    """Pydantic schema layer rejects invalid status — pure Python, no DB."""
    from pydantic import ValidationError

    from app.models.data_source_status import DataSourceStatusCreate

    with pytest.raises(ValidationError):
        DataSourceStatusCreate(
            gemeente_code="GM0983", source_key="woonvisie", status="bogus",
        )


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "config_value",
    [None, {}, {"refresh_interval_hours": 24, "last_synced_doc_id": "abc"}],
)
async def test_jsonb_configuratie_roundtrip(test_db: AsyncSession, config_value):
    """JSONB column round-trips None, empty dict, populated dict."""
    row = DataSourceStatus(
        gemeente_code="GM0344",
        source_key=f"test-{uuid.uuid4().hex[:8]}",
        status="missing",
        configuratie=config_value,
    )
    test_db.add(row)
    await test_db.commit()
    await test_db.refresh(row)
    assert row.configuratie == config_value


def test_no_tenant_columns():
    """Vendor-managed lock-in (eng-review 2026-05-14): NO organization_id column."""
    assert "organization_id" not in DataSourceStatus.__table__.columns, (
        "DataSourceStatus is vendor-managed — must NOT have organization_id "
        "(eng-review locked 2026-05-14)"
    )


def test_managed_by_user_id_fk_nullable():
    """managed_by_user_id is a nullable FK to users.id (audit trail)."""
    col = DataSourceStatus.__table__.columns["managed_by_user_id"]
    assert col.nullable is True
    fks = list(col.foreign_keys)
    assert len(fks) == 1
    assert fks[0].column.table.name == "users"
