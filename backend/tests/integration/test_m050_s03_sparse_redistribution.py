"""M050/S03 — Integration tests for D3 sparse redistribution end-to-end.

Exercises the FULL pipeline rescore_parcel → enrich_parcel_data_with_brk →
compute_score_v3 D3 redistribution → write back into ``scan_result.flags``.

D3 happy path: 3 BRK missing → 13 existing risico factors rescale to ~100.
F8 mixed-sparse: 3 BRK missing + funderingsrisico missing → rescale over
non-missing only (rescale invariant: sum non-missing ≈ 100).
"""
from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal

import pytest
from geoalchemy2.shape import from_shape
from shapely.geometry import MultiPolygon, Polygon
from sqlalchemy import select

from app.core.config import settings
# M053/S12 reserves splitsingsrisico's weight (7) from the risico-100 pool, so the
# in-breakdown risico factors rescale to 93, not 100. The sibling unit test
# (test_compute_score_v3_redistribution.py) was updated to this constant in S12;
# this integration test was missed and is corrected here (M054/S01).
from app.services.score_v3 import _RISICO_REDISTRIBUTION_TARGET
from app.models.area_scan import AreaScan
from app.models.brk_ownership_record import BrkOwnershipRecord
from app.models.organization import Organization
from app.models.parcel_cache import ParcelCache
from app.models.scan_result import ScanResult

PARCEL_ID = "NL.IMKAD.TEST.0002"


def _make_geometry():
    poly = Polygon(
        [(195000, 412000), (195100, 412000), (195100, 412100), (195000, 412100)]
    )
    return from_shape(MultiPolygon([poly]), srid=28992)


def _test_db_url() -> str:
    return settings.DATABASE_URL.replace("/propdex", "/propdex_test")


async def _seed_org(test_db) -> Organization:
    org = Organization(name=f"TestOrg-{uuid.uuid4()}")
    test_db.add(org)
    await test_db.flush()
    return org


async def _seed_parcel_scan(test_db, gemeente_code: str = "0983") -> ParcelCache:
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

    sr = ScanResult(
        scan_id=scan.id,
        parcel_id=parcel.id,
        score=42.0,
        flags={},
    )
    test_db.add(sr)
    await test_db.commit()
    return parcel


async def _read_breakdown(test_db) -> dict:
    test_db.expire_all()
    stmt = (
        select(ScanResult)
        .join(ParcelCache, ParcelCache.id == ScanResult.parcel_id)
        .where(ParcelCache.parcel_id == PARCEL_ID)
    )
    result = await test_db.execute(stmt)
    sr = result.scalar_one()
    return sr.flags["score_breakdown"]


@pytest.mark.asyncio
async def test_all_3_brk_missing_rescales_13_existing(
    test_db,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """No BRK rows + flags={} → 3 BRK + ~all existing risico missing.

    `_apply_missing_data_strategy` redistributes the non-missing risico set to
    sum ≈ 100. D3 short-circuits (BRK weights already zeroed by missing-strategy).
    Invariant: sum of non-missing risico gewicht ≈ 100.
    """
    monkeypatch.setattr(settings, "M050_S03_FACTORS_ENABLED", True)
    monkeypatch.setattr(
        "app.jobs.rescore_cascade_job.settings.DATABASE_URL", _test_db_url()
    )

    org = await _seed_org(test_db)
    await _seed_parcel_scan(test_db)

    from app.jobs.rescore_cascade_job import rescore_parcel

    result = await rescore_parcel(
        {}, organization_id=str(org.id), parcel_id=PARCEL_ID
    )
    assert result["updated"] is True

    breakdown = await _read_breakdown(test_db)
    for key in ("hypotheek_risico", "eigendoms_complexiteit", "koopwaarde_trend"):
        assert breakdown[key]["missing"] is True, f"{key} should be missing"

    non_missing_risico = sum(
        v["gewicht"]
        for v in breakdown.values()
        if v["categorie"] == "risico" and not v["missing"]
    )
    assert abs(non_missing_risico - _RISICO_REDISTRIBUTION_TARGET) <= 1.0, (
        f"non-missing risico gewicht {non_missing_risico} not ≈{_RISICO_REDISTRIBUTION_TARGET}"
    )


@pytest.mark.asyncio
async def test_mixed_sparse_brk_plus_funderingsrisico_missing(
    test_db,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """F8: 3 BRK missing + funderingsrisico missing → rescale only over non-missing.

    With ``flags={}`` ALL risico factors are missing (no BAG / PDOK / DSO data).
    The rescale invariant — sum of non-missing risico ≈ 100 — holds either way:
    either via `_apply_missing_data_strategy` (>20% missing) or D3 (no-op when
    BRK weights already zeroed).
    """
    monkeypatch.setattr(settings, "M050_S03_FACTORS_ENABLED", True)
    monkeypatch.setattr(
        "app.jobs.rescore_cascade_job.settings.DATABASE_URL", _test_db_url()
    )

    org = await _seed_org(test_db)
    await _seed_parcel_scan(test_db)

    from app.jobs.rescore_cascade_job import rescore_parcel

    await rescore_parcel({}, organization_id=str(org.id), parcel_id=PARCEL_ID)

    breakdown = await _read_breakdown(test_db)
    assert breakdown["funderingsrisico"]["missing"] is True
    for key in ("hypotheek_risico", "eigendoms_complexiteit", "koopwaarde_trend"):
        assert breakdown[key]["missing"] is True

    non_missing_risico = sum(
        v["gewicht"]
        for v in breakdown.values()
        if v["categorie"] == "risico" and not v["missing"]
    )
    # Either ≈100 (if any non-missing risico survives the missing-data strategy)
    # or 0 (degenerate all-missing case — F8 falls back to no rescale).
    assert non_missing_risico == 0 or abs(non_missing_risico - _RISICO_REDISTRIBUTION_TARGET) <= 1.0


@pytest.mark.asyncio
async def test_brk_present_no_redistribution_existing_weights_unchanged(
    test_db,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """When BRK records are seeded + factor inputs valid, 3 BRK factors all
    non-missing — D3 short-circuits because no BRK missing in
    `_SPARSE_REDISTRIBUTABLE_RISICO`."""
    monkeypatch.setattr(settings, "M050_S03_FACTORS_ENABLED", True)
    monkeypatch.setattr(
        "app.jobs.rescore_cascade_job.settings.DATABASE_URL", _test_db_url()
    )

    org = await _seed_org(test_db)
    await _seed_parcel_scan(test_db)

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
        koopjaar=2018,
        heeft_hypotheek=True,
        raw_brk_response=None,
        fetched_at=datetime.utcnow(),
    )
    test_db.add(record)
    await test_db.commit()

    from app.jobs.rescore_cascade_job import rescore_parcel

    await rescore_parcel({}, organization_id=str(org.id), parcel_id=PARCEL_ID)

    breakdown = await _read_breakdown(test_db)
    assert breakdown["hypotheek_risico"]["missing"] is False
    assert breakdown["eigendoms_complexiteit"]["missing"] is False
    assert breakdown["koopwaarde_trend"]["missing"] is False

    # Sum of non-missing risico gewicht ≈ 93 (splitsingsrisico reserved; no D3 over-amplification).
    non_missing_risico = sum(
        v["gewicht"]
        for v in breakdown.values()
        if v["categorie"] == "risico" and not v["missing"]
    )
    assert abs(non_missing_risico - _RISICO_REDISTRIBUTION_TARGET) <= 1.0
