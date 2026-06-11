"""Unit tests for the shared cascade-scoring service (M053/S10)."""
from __future__ import annotations

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.factor_extraction_schemas import DOCUMENT_SENTINEL, SCHEMA_VERSION
from app.models.factor_extraction_cache import FactorExtractionCache
from app.models.policy_document import PolicyDocument
from app.services.cascade_scoring import load_gemeente_cascade_payloads


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
from app.services.cascade_scoring import apply_cascade_score, build_parcel_data  # noqa: E402


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
