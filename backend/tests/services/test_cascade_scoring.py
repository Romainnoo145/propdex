"""Unit tests for the shared cascade-scoring service (M053/S10)."""
from __future__ import annotations

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.factor_extraction_schemas import DOCUMENT_SENTINEL, SCHEMA_VERSION
from app.models.factor_extraction_cache import FactorExtractionCache
from app.models.policy_document import PolicyDocument
from app.services.cascade_scoring import (
    apply_cascade_score,
    build_parcel_data,
    load_gemeente_cascade_payloads,
    recompute_gemeente_cascade,
)


@pytest.mark.asyncio
async def test_load_payloads_returns_woonvisie_when_cached(
    create_test_user,
    test_db: AsyncSession,
):
    """A cached woonvisie_match extraction must be returned in the payloads dict."""
    from app.ai.factors.woonvisie_match import WoonvisiePayload

    user, org = await create_test_user()

    doc = PolicyDocument(
        organization_id=org.id,
        entity_type="gemeente",
        entity_code="GM0983",
        source_key="woonvisie",
        filename="venlo-woonvisie.pdf",
        content_type="application/pdf",
        file_data=b"%PDF-1.4\n%fake\n%%EOF",
        file_size=22,
        uploaded_by_user_id=user.id,
    )
    test_db.add(doc)
    await test_db.flush()

    payload_obj = WoonvisiePayload(
        periode_start=2025,
        periode_einde=2030,
        confidence=0.9,
    )

    test_db.add(
        FactorExtractionCache(
            policy_document_id=doc.id,
            parcel_id=DOCUMENT_SENTINEL,
            factor_id="woonvisie_match",
            schema_version=SCHEMA_VERSION,
            extracted_payload=payload_obj.model_dump(),
        )
    )
    await test_db.commit()

    payloads = await load_gemeente_cascade_payloads(
        test_db, gemeente_code="GM0983", organization_id=org.id
    )
    assert "woonvisie_match" in payloads
    assert isinstance(payloads["woonvisie_match"], WoonvisiePayload)
    assert payloads["woonvisie_match"].periode_start == 2025


@pytest.mark.asyncio
async def test_load_payloads_excludes_stale_schema_version(
    create_test_user,
    test_db: AsyncSession,
):
    """A cache row at SCHEMA_VERSION - 1 must NOT be returned.

    This preserves the invariant originally tested in
    test_backfill_cascade_scores.py: after a schema bump, stale extractions
    are silently skipped so the caller re-runs the extraction rather than
    feeding an outdated payload into compute_score_v3.
    """
    import uuid as _uuid

    from app.ai.factors.woonvisie_match import WoonvisiePayload

    user, org = await create_test_user(
        email=f"stale-{_uuid.uuid4()}@example.com", org_name=f"StaleOrg-{_uuid.uuid4()}"
    )

    doc = PolicyDocument(
        organization_id=org.id,
        entity_type="gemeente",
        entity_code="GM0983",
        source_key="woonvisie",
        filename="venlo-woonvisie-stale.pdf",
        content_type="application/pdf",
        file_data=b"%PDF-1.4\n%fake\n%%EOF",
        file_size=22,
        uploaded_by_user_id=user.id,
    )
    test_db.add(doc)
    await test_db.flush()

    stale_payload = WoonvisiePayload(
        periode_start=2025,
        periode_einde=2030,
        confidence=0.9,
    )
    test_db.add(
        FactorExtractionCache(
            policy_document_id=doc.id,
            parcel_id=DOCUMENT_SENTINEL,
            factor_id="woonvisie_match",
            schema_version=SCHEMA_VERSION - 1,  # deliberately OLD version
            extracted_payload=stale_payload.model_dump(),
        )
    )
    await test_db.commit()

    payloads = await load_gemeente_cascade_payloads(
        test_db, gemeente_code="GM0983", organization_id=org.id
    )
    assert "woonvisie_match" not in payloads, (
        f"Stale schema_version={SCHEMA_VERSION - 1} row must be excluded; "
        f"current SCHEMA_VERSION={SCHEMA_VERSION}"
    )


@pytest.mark.asyncio
async def test_load_payloads_empty_when_no_document(
    create_test_user,
    test_db: AsyncSession,
):
    """When no policy document exists for the gemeente, return empty dict."""
    _user, org = await create_test_user(
        email="other@example.com", org_name="Other Org"
    )

    payloads = await load_gemeente_cascade_payloads(
        test_db, gemeente_code="GM9999", organization_id=org.id
    )
    assert payloads == {}


# ---------------------------------------------------------------------------
# Task 2 — build_parcel_data + apply_cascade_score (plain unit tests, no DB)
# ---------------------------------------------------------------------------


def test_build_parcel_data_includes_parcel_id_and_flag_overlay():
    class _PC:
        parcel_id = "kad-123"
        area_m2 = 500.0
        has_pand = True
        bouwjaar = 1975
        pand_status = "in_gebruik"
        bestemmingen = None

    flags = {"vacancy_signal": "leeg", "building_metrics": {"x": 1}}
    pd = build_parcel_data(_PC(), flags, perimeter_m=90.0, wijk_naam="Centrum")
    assert pd["parcel_id"] == "kad-123"
    assert pd["area_m2"] == 500.0
    assert pd["perimeter_m"] == 90.0
    assert pd["wijk_naam"] == "Centrum"
    assert pd["vacancy_signal"] == "leeg"
    assert pd["building_metrics"] == {"x": 1}


def test_apply_cascade_score_writes_breakdown_and_score():
    class _SR:
        def __init__(self):
            self.score = 0.0
            self.flags = {"score_model_version": "score-v3.0"}

    sr = _SR()
    changed = apply_cascade_score(
        sr,
        parcel_data={"area_m2": 500.0, "has_pand": True},
        nbhd_metrics=None,
        cascade_payloads={},
    )
    assert changed is True
    assert "score_breakdown" in sr.flags
    assert sr.flags["score_model_version"] == "score-v3.0"
    assert 0.0 <= sr.score <= 100.0


# ---------------------------------------------------------------------------
# Task 3 — recompute_gemeente_cascade integration test (PostGIS-backed DB)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_recompute_gemeente_adds_woonvisie_factor(
    create_test_user,
    test_db: AsyncSession,
):
    """recompute_gemeente_cascade must write woonvisie_match into score_breakdown."""
    from geoalchemy2.shape import from_shape
    from shapely.geometry import MultiPolygon, Polygon
    from sqlalchemy import select

    from app.ai.factors.woonvisie_match import WoonvisiePayload
    from app.models.area_scan import AreaScan
    from app.models.parcel_cache import ParcelCache
    from app.models.scan_result import ScanResult

    user, org = await create_test_user(
        email="recompute@example.com", org_name="Recompute Org"
    )

    # --- woonvisie PolicyDocument + extraction cache ---
    doc = PolicyDocument(
        organization_id=org.id,
        entity_type="gemeente",
        entity_code="GM0983",
        source_key="woonvisie",
        filename="venlo-woonvisie-rc.pdf",
        content_type="application/pdf",
        file_data=b"%PDF-1.4\n%fake\n%%EOF",
        file_size=22,
        uploaded_by_user_id=user.id,
    )
    test_db.add(doc)
    await test_db.flush()

    payload_obj = WoonvisiePayload(
        periode_start=2025,
        periode_einde=2035,
        confidence=0.85,
    )
    test_db.add(
        FactorExtractionCache(
            policy_document_id=doc.id,
            parcel_id=DOCUMENT_SENTINEL,
            factor_id="woonvisie_match",
            schema_version=SCHEMA_VERSION,
            extracted_payload=payload_obj.model_dump(),
        )
    )
    await test_db.flush()

    # --- AreaScan ---
    scan = AreaScan(
        gemeente_code="GM0983",
        gemeente_naam="Venlo",
        bbox_minx=195000,
        bbox_miny=412000,
        bbox_maxx=196000,
        bbox_maxy=413000,
        status="completed",
        job_id="j-recompute-test",
        neighborhood_metrics={"gem_woz": 200000},
    )
    test_db.add(scan)
    await test_db.flush()

    # --- ParcelCache with valid EPSG:28992 geometry ---
    poly = Polygon(
        [(195000, 412000), (195100, 412000), (195100, 412100), (195000, 412100)]
    )
    geom = from_shape(MultiPolygon([poly]), srid=28992)
    pc = ParcelCache(
        parcel_id="RC-TEST-A-0001",
        gemeente_code="GM0983",
        geometry=geom,
        area_m2=10000.0,
        has_pand=True,
    )
    test_db.add(pc)
    await test_db.flush()

    # --- ScanResult with score-v3.0 model version ---
    sr = ScanResult(
        scan_id=scan.id,
        parcel_id=pc.id,
        score=10.0,
        flags={"score_model_version": "score-v3.0", "score_breakdown": {}},
    )
    test_db.add(sr)
    await test_db.commit()

    # --- Call the function under test ---
    processed, updated = await recompute_gemeente_cascade(
        test_db,
        gemeente_code="GM0983",
        organization_id=org.id,
        batch_size=100,
        dry_run=False,
    )
    await test_db.commit()

    assert processed >= 1
    assert updated >= 1

    # Verify score_breakdown now contains woonvisie_match
    refreshed = (
        await test_db.execute(select(ScanResult).where(ScanResult.id == sr.id))
    ).scalar_one()
    assert "woonvisie_match" in refreshed.flags["score_breakdown"]
