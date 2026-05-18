"""M050/S03 — F9 / D8: feature-flag short-circuit.

With ``M050_S03_FACTORS_ENABLED=False`` the enrich function returns
``parcel_data`` unchanged (no ``brk_records`` key inserted). The 3 BRK factor
functions then short-circuit via ``parcel_data.get("brk_records")`` returning
None → ``_missing_brk(...)`` → ``missing=True`` REGARDLESS of seeded BRK rows.

Also verifies endpoint still returns 200 + enqueues when only S03 flag is off
(S02 persist behaviour is independent of S03 scoring activation).
"""
from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest
from geoalchemy2.shape import from_shape
from shapely.geometry import MultiPolygon, Polygon
from sqlalchemy import select

from app.auth.jwt import create_access_token
from app.auth.password import hash_password
from app.core.config import settings
from app.main import app
from app.models.area_scan import AreaScan
from app.models.brk_ownership_record import BrkOwnershipRecord
from app.models.organization import Organization
from app.models.parcel_cache import ParcelCache
from app.models.scan_result import ScanResult
from app.models.user import User

PARCEL_ID = "NL.IMKAD.TEST.0004"


def _make_geometry():
    poly = Polygon(
        [(195000, 412000), (195100, 412000), (195100, 412100), (195000, 412100)]
    )
    return from_shape(MultiPolygon([poly]), srid=28992)


def _test_db_url() -> str:
    return settings.DATABASE_URL.replace("/propdex", "/propdex_test")


@pytest.fixture(autouse=True)
def _mock_arq_pool():
    previous = getattr(app.state, "arq_pool", None)
    mock_pool = AsyncMock()
    mock_pool.enqueue_job = AsyncMock(return_value=MagicMock())
    app.state.arq_pool = mock_pool
    yield mock_pool
    app.state.arq_pool = previous


async def _seed_org_and_user(test_db) -> tuple[Organization, User]:
    org = Organization(name=f"TestOrg-{uuid.uuid4()}")
    test_db.add(org)
    await test_db.flush()
    user = User(
        email=f"u{uuid.uuid4().hex[:8]}@test.com",
        hashed_password=hash_password("TestPass123!"),
        full_name="Test User",
        organization_id=org.id,
        email_verified=True,
        auth_provider="email",
        is_active=True,
        is_superuser=False,
    )
    test_db.add(user)
    await test_db.commit()
    return org, user


async def _seed_parcel_scan(test_db) -> ParcelCache:
    parcel = ParcelCache(
        parcel_id=PARCEL_ID,
        gemeente_code="0983",
        geometry=_make_geometry(),
        has_pand=True,
    )
    test_db.add(parcel)
    await test_db.flush()

    scan = AreaScan(
        gemeente_code="0983",
        gemeente_naam="TestGemeente",
        bbox_minx=195000,
        bbox_miny=412000,
        bbox_maxx=196000,
        bbox_maxy=413000,
        status="completed",
    )
    test_db.add(scan)
    await test_db.flush()

    sr = ScanResult(
        scan_id=scan.id,
        parcel_id=parcel.id,
        score=42.0,
        flags={},
    )
    test_db.add(sr)
    await test_db.commit()
    return parcel


async def _seed_brk_record(test_db, org: Organization) -> None:
    record = BrkOwnershipRecord(
        organization_id=org.id,
        parcel_id=PARCEL_ID,
        eigenaar_type="rechtspersoon",
        eigenaar_naam="Voorbeeld BV",
        kvk_nummer="12345678",
        statutaire_zetel="Amsterdam",
        zakelijk_recht_type="Eigendom",
        aandeel="1/1",
        koopsom=Decimal("250000.00"),
        koopjaar=2020,
        heeft_hypotheek=True,
        raw_brk_response=None,
        fetched_at=datetime.utcnow(),
    )
    test_db.add(record)
    await test_db.commit()


def _stub_fetch_and_persist(
    monkeypatch: pytest.MonkeyPatch, return_value: list[Any] | None = None
) -> None:
    async def _fake(**kwargs):
        return return_value if return_value is not None else []

    from app.scans import brk_router
    from app.services import brk_fetch_service

    monkeypatch.setattr(brk_fetch_service, "fetch_and_persist", _fake)
    monkeypatch.setattr(brk_router, "fetch_and_persist", _fake)


@pytest.mark.asyncio
async def test_flag_off_all_3_brk_factors_missing_regardless_of_records(
    test_db,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """F9 / D8: FF_S03=False + seeded BRK rows → 3 BRK factors still missing=True."""
    monkeypatch.setattr(settings, "M050_S03_FACTORS_ENABLED", False)
    monkeypatch.setattr(
        "app.jobs.rescore_cascade_job.settings.DATABASE_URL", _test_db_url()
    )

    org, _ = await _seed_org_and_user(test_db)
    await _seed_parcel_scan(test_db)
    await _seed_brk_record(test_db, org)

    from app.jobs.rescore_cascade_job import rescore_parcel

    job_result = await rescore_parcel(
        {}, organization_id=str(org.id), parcel_id=PARCEL_ID
    )
    assert job_result["updated"] is True

    test_db.expire_all()
    stmt = (
        select(ScanResult)
        .join(ParcelCache, ParcelCache.id == ScanResult.parcel_id)
        .where(ParcelCache.parcel_id == PARCEL_ID)
    )
    sr = (await test_db.execute(stmt)).scalar_one()
    breakdown = sr.flags["score_breakdown"]

    for key in ("hypotheek_risico", "eigendoms_complexiteit", "koopwaarde_trend"):
        assert breakdown[key]["missing"] is True, (
            f"{key} should be missing despite seeded BRK row when FF=False"
        )

    # Pipeline still ran (sentinel populated) — only factor outputs are deterministically missing.
    assert isinstance(sr.flags.get("m050_s03_factors_at"), str)


@pytest.mark.asyncio
async def test_flag_off_endpoint_still_returns_200_and_enqueues(
    test_db,
    async_client,
    monkeypatch: pytest.MonkeyPatch,
    _mock_arq_pool: AsyncMock,
) -> None:
    """FF_BRK=True + FF_S03=False: persist endpoint 200 + enqueue still fires (D7
    decoupled from scoring activation)."""
    monkeypatch.setattr(settings, "M050_BRK_PERSIST_ENABLED", True)
    monkeypatch.setattr(settings, "M050_S03_FACTORS_ENABLED", False)

    org, user = await _seed_org_and_user(test_db)
    _stub_fetch_and_persist(monkeypatch, return_value=[])

    headers = {"Authorization": f"Bearer {create_access_token(str(user.id), str(org.id))}"}

    response = await async_client.post(
        f"/api/parcels/{PARCEL_ID}/brk/persist", headers=headers
    )
    assert response.status_code == 200, response.text
    assert _mock_arq_pool.enqueue_job.await_count == 1
