"""Unit tests for brk_read_service.read_for_parcel (M050/S06 — Plan 08-01).

Covers the must-have truths from 08-01-PLAN frontmatter:
- Filters on organization_id AND parcel_id AND soft_deleted_at IS NULL (D-AD2)
- Latest fetch-cycle semantics: anchor on MAX(fetched_at), return ALL matching rows
- Cross-org isolation returns [] (silent — no existence leak)

End-to-end multi-tenant + endpoint-layer regression lives in
``tests/regression/test_multi_tenant_brk_isolation.py``.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.brk_ownership_record import BrkOwnershipRecord
from app.services.brk_read_service import read_for_parcel


def _make_record(
    *,
    org_id,
    parcel_id: str,
    eigenaar_naam: str,
    fetched_at: datetime | None = None,
    soft_deleted_at: datetime | None = None,
) -> BrkOwnershipRecord:
    return BrkOwnershipRecord(
        organization_id=org_id,
        parcel_id=parcel_id,
        eigenaar_type="rechtspersoon",
        eigenaar_naam=eigenaar_naam,
        fetched_at=fetched_at or datetime.utcnow(),
        soft_deleted_at=soft_deleted_at,
    )


@pytest.mark.asyncio
async def test_returns_empty_when_no_rows(
    test_db: AsyncSession, create_test_user
) -> None:
    """No rows for (org, parcel) → [] (cache miss / never persisted)."""
    _, org = await create_test_user()
    result = await read_for_parcel(
        db=test_db,
        organization_id=org.id,
        parcel_id="NL.IMKAD.Empty.1",
    )
    assert result == []


@pytest.mark.asyncio
async def test_returns_multi_owner_when_same_fetched_at(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Two rows sharing MAX(fetched_at) — joint ownership (rechtspersoon + overheid).

    The DB UNIQUE constraint ``uq_brk_org_parcel_fetched`` (org, parcel, fetched_at)
    prevents inserting two rows at identical timestamps via the ORM. The
    persistence layer relies on microsecond-distinct ``datetime.utcnow()`` per
    row. Read-service code path "MAX anchor returns ALL matching" is still
    required (must-have truth from 08-01-PLAN) for defensive correctness when
    rows happen to converge to the same timestamp (clock granularity, raw SQL
    backfills, future constraint relaxation). We mock the DB layer to exercise
    that branch directly.
    """
    from unittest.mock import AsyncMock, MagicMock

    org_id = uuid.uuid4()
    t = datetime.utcnow()

    def _hydrated(naam: str, eigenaar_type: str = "rechtspersoon") -> BrkOwnershipRecord:
        row = _make_record(
            org_id=org_id,
            parcel_id="NL.IMKAD.Joint.1",
            eigenaar_naam=naam,
            fetched_at=t,
        )
        row.id = uuid.uuid4()
        row.eigenaar_type = eigenaar_type
        row.heeft_hypotheek = False
        row.created_at = t
        row.updated_at = t
        return row

    row_a = _hydrated("BV X")
    row_b = _hydrated("Gemeente Y", "overheid")

    scalars_mock = MagicMock()
    scalars_mock.all.return_value = [row_a, row_b]
    result_mock = MagicMock()
    result_mock.scalars.return_value = scalars_mock

    fake_db = MagicMock(spec=AsyncSession)
    fake_db.execute = AsyncMock(return_value=result_mock)

    result = await read_for_parcel(
        db=fake_db, organization_id=org_id, parcel_id="NL.IMKAD.Joint.1"
    )
    assert len(result) == 2, (
        "Latest fetch-cycle semantics: MAX(fetched_at) anchor MUST surface "
        "all rows sharing that timestamp (multi-owner joint ownership)."
    )
    eigenaren = {r.eigenaar_naam for r in result}
    assert eigenaren == {"BV X", "Gemeente Y"}


@pytest.mark.asyncio
async def test_excludes_soft_deleted(
    test_db: AsyncSession, create_test_user
) -> None:
    """Rows with soft_deleted_at IS NOT NULL MUST NOT appear (retention safety)."""
    _, org = await create_test_user()
    parcel_id = "NL.IMKAD.Soft.1"
    now = datetime.utcnow()
    deleted = _make_record(
        org_id=org.id,
        parcel_id=parcel_id,
        eigenaar_naam="BV Deleted",
        soft_deleted_at=now,
    )
    test_db.add(deleted)
    await test_db.commit()

    result = await read_for_parcel(
        db=test_db, organization_id=org.id, parcel_id=parcel_id
    )
    assert result == []


@pytest.mark.asyncio
async def test_returns_only_latest_fetch_cycle(
    test_db: AsyncSession, create_test_user
) -> None:
    """Two fetch_at timestamps exist — older cycle excluded; newer row returned."""
    _, org = await create_test_user()
    parcel_id = "NL.IMKAD.Cycle.1"
    t_old = datetime.utcnow() - timedelta(days=40)
    t_new = datetime.utcnow()
    older = _make_record(
        org_id=org.id,
        parcel_id=parcel_id,
        eigenaar_naam="BV Old",
        fetched_at=t_old,
    )
    newer = _make_record(
        org_id=org.id,
        parcel_id=parcel_id,
        eigenaar_naam="BV New",
        fetched_at=t_new,
    )
    test_db.add_all([older, newer])
    await test_db.commit()

    result = await read_for_parcel(
        db=test_db, organization_id=org.id, parcel_id=parcel_id
    )
    assert len(result) == 1
    assert result[0].eigenaar_naam == "BV New"
    assert result[0].fetched_at == t_new


@pytest.mark.asyncio
async def test_filters_by_org_id(
    test_db: AsyncSession, create_test_user
) -> None:
    """Same parcel under two orgs — caller sees only their own org's record."""
    _, org_a = await create_test_user(email="a@example.com", org_name="Org A")
    _, org_b = await create_test_user(email="b@example.com", org_name="Org B")
    parcel_id = "NL.IMKAD.Shared.1"

    test_db.add_all(
        [
            _make_record(
                org_id=org_a.id, parcel_id=parcel_id, eigenaar_naam="BV A"
            ),
            _make_record(
                org_id=org_b.id, parcel_id=parcel_id, eigenaar_naam="BV B"
            ),
        ]
    )
    await test_db.commit()

    result_a = await read_for_parcel(
        db=test_db, organization_id=org_a.id, parcel_id=parcel_id
    )
    assert len(result_a) == 1
    assert result_a[0].eigenaar_naam == "BV A"

    result_b = await read_for_parcel(
        db=test_db, organization_id=org_b.id, parcel_id=parcel_id
    )
    assert len(result_b) == 1
    assert result_b[0].eigenaar_naam == "BV B"
