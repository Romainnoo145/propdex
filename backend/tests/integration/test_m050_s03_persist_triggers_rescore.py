"""M050/S03 — Integration tests for D7 persist → rescore hook.

Closes ENG-PLAN §Test coverage diagram — proves the BRK persist endpoint
enqueues a rescore_parcel job, and the job (when manually awaited) actually
populates ``scan_result.flags['m050_s03_factors_at']`` + 3 BRK factor keys.

Pattern mirrors S02 ``test_brk_persist_endpoint.py``:
- ``app.state.arq_pool`` mocked per-test (autouse fixture).
- ``brk_fetch_service.fetch_and_persist`` monkeypatched to bypass mTLS setup.
- Feature flags monkeypatched on ``app.core.config.settings``.
"""
from __future__ import annotations

import re
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

PARCEL_ID = "NL.IMKAD.TEST.0001"


# ---------------------------------------------------------------------------
# Fixtures + helpers
# ---------------------------------------------------------------------------


def _make_geometry():
    poly = Polygon(
        [(195000, 412000), (195100, 412000), (195100, 412100), (195000, 412100)]
    )
    return from_shape(MultiPolygon([poly]), srid=28992)


def _test_db_url() -> str:
    return settings.DATABASE_URL.replace("/propdex", "/propdex_test")


@pytest.fixture(autouse=True)
def _mock_arq_pool():
    """M050/S03 D7 — ``app.state.arq_pool`` mocked per-test (AsyncMock spec=ArqRedis).

    ``enqueue_job`` returns a truthy job object by default; individual tests
    override via ``app.state.arq_pool.enqueue_job.side_effect`` as needed.
    """
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


async def _seed_parcel_with_scan(test_db, gemeente_code: str = "0983") -> ParcelCache:
    parcel = ParcelCache(
        parcel_id=PARCEL_ID,
        gemeente_code=gemeente_code,
        geometry=_make_geometry(),
        has_pand=True,
    )
    test_db.add(parcel)
    await test_db.flush()

    scan = AreaScan(
        gemeente_code=gemeente_code,
        gemeente_naam="TestGemeente",
        bbox_minx=195000,
        bbox_miny=412000,
        bbox_maxx=196000,
        bbox_maxy=413000,
        status="completed",
    )
    test_db.add(scan)
    await test_db.flush()

    scan_result = ScanResult(
        scan_id=scan.id,
        parcel_id=parcel.id,
        score=42.0,
        flags={},
    )
    test_db.add(scan_result)
    await test_db.commit()
    return parcel


async def _seed_brk_record(
    test_db,
    org: Organization,
    *,
    heeft_hypotheek: bool = True,
    koopjaar: int | None = 2018,
) -> None:
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
        koopjaar=koopjaar,
        heeft_hypotheek=heeft_hypotheek,
        raw_brk_response=None,
        fetched_at=datetime.utcnow(),
    )
    test_db.add(record)
    await test_db.commit()


def _auth_headers(user: User, org: Organization) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_access_token(str(user.id), str(org.id))}"}


def _stub_fetch_and_persist(
    monkeypatch: pytest.MonkeyPatch, return_value: list[Any] | None = None
) -> dict[str, int]:
    from app.services import brk_fetch_service

    counter = {"n": 0}

    async def _fake(**kwargs):
        counter["n"] += 1
        return return_value if return_value is not None else []

    monkeypatch.setattr(brk_fetch_service, "fetch_and_persist", _fake)

    # brk_router imports symbol directly: also patch the router-side alias.
    from app.scans import brk_router

    monkeypatch.setattr(brk_router, "fetch_and_persist", _fake)
    return counter


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_persist_triggers_rescore_with_factor_keys(
    test_db,
    async_client,
    monkeypatch: pytest.MonkeyPatch,
    _mock_arq_pool: AsyncMock,
) -> None:
    """E2E: POST /persist → enqueue called → manually run job → flags populated."""
    monkeypatch.setattr(settings, "M050_BRK_PERSIST_ENABLED", True)
    monkeypatch.setattr(settings, "M050_S03_FACTORS_ENABLED", True)

    org, user = await _seed_org_and_user(test_db)
    await _seed_parcel_with_scan(test_db)
    await _seed_brk_record(test_db, org, heeft_hypotheek=True, koopjaar=2018)

    _stub_fetch_and_persist(monkeypatch, return_value=[])

    # POST persist
    response = await async_client.post(
        f"/api/parcels/{PARCEL_ID}/brk/persist",
        headers=_auth_headers(user, org),
    )
    assert response.status_code == 200, response.text

    # D7: enqueue called exactly once with deterministic _job_id
    assert _mock_arq_pool.enqueue_job.await_count == 1
    call_kwargs = _mock_arq_pool.enqueue_job.call_args.kwargs
    assert call_kwargs["_job_id"] == f"rescore:{org.id}:{PARCEL_ID}"
    assert call_kwargs["organization_id"] == str(org.id)
    assert call_kwargs["parcel_id"] == PARCEL_ID

    # Manually run the job to materialise the rescore effect
    from app.jobs.rescore_cascade_job import rescore_parcel

    monkeypatch.setattr(
        "app.jobs.rescore_cascade_job.settings.DATABASE_URL", _test_db_url()
    )
    job_result = await rescore_parcel(
        {}, organization_id=str(org.id), parcel_id=PARCEL_ID
    )
    assert job_result["updated"] is True
    assert {"hypotheek_risico", "eigendoms_complexiteit", "koopwaarde_trend"} <= set(
        job_result["breakdown_keys"]
    )

    # Reload ScanResult — verify flags carry m050_s03 sentinel + BRK factor keys
    test_db.expire_all()
    stmt = (
        select(ScanResult)
        .join(ParcelCache, ParcelCache.id == ScanResult.parcel_id)
        .where(ParcelCache.parcel_id == PARCEL_ID)
    )
    sr_result = await test_db.execute(stmt)
    sr = sr_result.scalar_one()
    assert sr.flags is not None
    factors_at = sr.flags.get("m050_s03_factors_at")
    assert isinstance(factors_at, str)
    assert re.match(r"^\d{4}-\d{2}-\d{2}T", factors_at), factors_at

    breakdown = sr.flags.get("score_breakdown") or {}
    assert "hypotheek_risico" in breakdown
    assert "eigendoms_complexiteit" in breakdown
    assert "koopwaarde_trend" in breakdown
    # Seeded BRK had heeft_hypotheek=True → hypotheek_risico must not be missing
    assert breakdown["hypotheek_risico"]["missing"] is False


@pytest.mark.asyncio
async def test_rescore_parcel_stamps_cascade_rescored_at_for_frontend_poll(
    test_db,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """REGRESSION (SCOR-02 / UX-07): rescore_parcel MUST stamp ``cascade_rescored_at``.

    The frontend RescoreProgressBanner polls ``/scan-data`` and stops on
    ``cascade_rescored_at`` (useRescorePoll.shouldStopOnSuccess). The scan-data
    endpoint only exposes ``flags['cascade_rescored_at']``. If the BRK rescore
    job stamps only ``m050_s03_factors_at`` (its observability sentinel) and not
    ``cascade_rescored_at``, the banner can never reach its success state and
    always times out at 60s. This pins the freshness-signal contract so both
    the woonvisie cascade job and the BRK rescore job speak the same field.
    """
    monkeypatch.setattr(settings, "M050_BRK_PERSIST_ENABLED", True)
    monkeypatch.setattr(settings, "M050_S03_FACTORS_ENABLED", True)

    org, _user = await _seed_org_and_user(test_db)
    await _seed_parcel_with_scan(test_db)
    await _seed_brk_record(test_db, org, heeft_hypotheek=True, koopjaar=2018)

    from app.jobs.rescore_cascade_job import rescore_parcel

    monkeypatch.setattr(
        "app.jobs.rescore_cascade_job.settings.DATABASE_URL", _test_db_url()
    )
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
    assert sr.flags is not None

    cascade_at = sr.flags.get("cascade_rescored_at")
    assert isinstance(cascade_at, str), (
        "rescore_parcel must stamp cascade_rescored_at — the field the frontend "
        "poller reads to detect rescore completion"
    )
    assert re.match(r"^\d{4}-\d{2}-\d{2}T", cascade_at), cascade_at


@pytest.mark.asyncio
async def test_persist_endpoint_returns_200_even_if_enqueue_fails(
    test_db,
    async_client,
    monkeypatch: pytest.MonkeyPatch,
    _mock_arq_pool: AsyncMock,
    caplog: pytest.LogCaptureFixture,
) -> None:
    """D7 best-effort: enqueue_rescore_parcel raising does NOT break the 200 response."""
    import logging

    monkeypatch.setattr(settings, "M050_BRK_PERSIST_ENABLED", True)
    monkeypatch.setattr(settings, "M050_S03_FACTORS_ENABLED", True)

    org, user = await _seed_org_and_user(test_db)
    _stub_fetch_and_persist(monkeypatch, return_value=[])

    # enqueue raises a RuntimeError
    _mock_arq_pool.enqueue_job.side_effect = RuntimeError("redis down (test)")

    caplog.set_level(logging.WARNING, logger="app.scans.brk_router")

    response = await async_client.post(
        f"/api/parcels/{PARCEL_ID}/brk/persist",
        headers=_auth_headers(user, org),
    )
    assert response.status_code == 200, response.text
    assert response.json() == []

    # A WARN log was emitted (best-effort contract)
    assert any(
        "M050/S03 D7 enqueue_rescore_parcel failed" in rec.message
        for rec in caplog.records
    ), [rec.message for rec in caplog.records]
