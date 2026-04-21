"""End-to-end tests for woonvisie_match POC factor (M047/S06).

Tests:
1. score_woonvisie_match — unit tests (geen DB, geen Claude)
2. cascade_enrichment_service — integration met test_db + mocked Claude
3. compute_score_v3 met cascade_payloads — woonvisie_match in score_breakdown
"""

import uuid

import pytest

from app.ai.factors.woonvisie_match import WOONVISIE_MATCH_FACTOR_DEF, WoonvisiePayload
from app.services.score_v3 import compute_score_v3
from app.services.score_v3_factors import score_woonvisie_match

# ─── Unit tests: score_woonvisie_match ───────────────────────────────────────


def test_woonvisie_match_missing_when_payload_none():
    result = score_woonvisie_match(None, wijk_naam="Blerick", project_type="onbepaald")
    assert result.missing is True
    assert result.gewicht == 0
    assert result.genormaliseerde_score == 0.0


def test_woonvisie_match_growth_wijk_boosts_score():
    payload = WoonvisiePayload(
        periode_start=2025,
        periode_einde=2030,
        prioritized_segment="midden",
        growth_wijken=["Blerick-Oost", "Q4"],
        confidence=0.9,
    )
    result = score_woonvisie_match(
        payload, wijk_naam="Blerick-Oost", project_type="nieuwbouw_wonen"
    )
    assert result.missing is False
    assert result.genormaliseerde_score >= 0.7, (
        f"Expected >= 0.7, got {result.genormaliseerde_score}"
    )
    assert "groei" in result.toelichting_kort.lower() or "Blerick-Oost" in result.toelichting_kort


def test_woonvisie_match_shrink_wijk_lowers_score():
    payload = WoonvisiePayload(
        periode_start=2025,
        periode_einde=2030,
        prioritized_segment="sociaal",
        growth_wijken=[],
        shrink_wijken=["Laarveld"],
        confidence=0.85,
    )
    result = score_woonvisie_match(
        payload, wijk_naam="Laarveld", project_type="nieuwbouw_wonen"
    )
    assert result.genormaliseerde_score <= 0.45


def test_woonvisie_match_excluded_project_type_penalizes():
    payload = WoonvisiePayload(
        periode_start=2025,
        periode_einde=2030,
        prioritized_segment="sociaal",
        growth_wijken=["Centrum"],
        excluded_project_types=["dure_koop"],
        confidence=0.9,
    )
    result_excluded = score_woonvisie_match(
        payload, wijk_naam="Centrum", project_type="dure_koop"
    )
    result_ok = score_woonvisie_match(
        payload, wijk_naam="Centrum", project_type="nieuwbouw_wonen"
    )
    assert result_excluded.genormaliseerde_score < result_ok.genormaliseerde_score


def test_woonvisie_match_no_wijk_returns_neutral():
    payload = WoonvisiePayload(
        periode_start=2025,
        periode_einde=2030,
        prioritized_segment="gemengd",
        growth_wijken=["Q4"],
        confidence=0.8,
    )
    result = score_woonvisie_match(payload, wijk_naam=None, project_type="onbepaald")
    assert result.missing is False
    assert 0.0 <= result.genormaliseerde_score <= 1.0


def test_woonvisie_match_factor_def_attributes():
    assert WOONVISIE_MATCH_FACTOR_DEF.factor_id == "woonvisie_match"
    assert WOONVISIE_MATCH_FACTOR_DEF.tool_name == "extract_woonvisie_match"
    assert WOONVISIE_MATCH_FACTOR_DEF.payload_model is WoonvisiePayload


# ─── Integration tests: cascade_payloads in compute_score_v3 ─────────────────


def _minimal_parcel_data(wijk_naam: str = "Blerick-Oost") -> dict:
    """Minimal parcel_data dict that compute_score_v3 accepts without crashing."""
    return {
        "parcel_id": "NL.IMBAG.Pand.0983100000000001",
        "wijk_naam": wijk_naam,
        "has_pand": True,
        "area_m2": 400,
        "bouwjaar": 1990,
        "bestemmingen": [],
        "flags": {},
    }


def test_compute_score_v3_woonvisie_in_breakdown():
    """woonvisie_match appears in score_breakdown with non-zero gewicht."""
    payload = WoonvisiePayload(
        periode_start=2025,
        periode_einde=2030,
        prioritized_segment="midden",
        growth_wijken=["Blerick-Oost"],
        confidence=0.9,
    )
    result = compute_score_v3(
        _minimal_parcel_data("Blerick-Oost"),
        project_type="nieuwbouw_wonen",
        cascade_payloads={"woonvisie_match": payload},
    )
    assert "woonvisie_match" in result.score_breakdown
    wv = result.score_breakdown["woonvisie_match"]
    assert wv.missing is False
    assert wv.gewicht > 0
    assert wv.genormaliseerde_score >= 0.0


def test_compute_score_v3_woonvisie_missing_when_no_cascade():
    """Without cascade_payloads, woonvisie_match is missing=True."""
    result = compute_score_v3(
        _minimal_parcel_data(),
        project_type="onbepaald",
        cascade_payloads=None,
    )
    assert "woonvisie_match" in result.score_breakdown
    assert result.score_breakdown["woonvisie_match"].missing is True
    assert result.score_breakdown["woonvisie_match"].gewicht == 0


# ─── Integration tests: cascade_enrichment_service ───────────────────────────


@pytest.mark.asyncio
async def test_get_woonvisie_document_returns_none_for_unknown_gemeente(test_db, create_test_user):
    from app.services.cascade_enrichment_service import get_woonvisie_document

    _user, org = await create_test_user()
    doc = await get_woonvisie_document(
        test_db, gemeente_code="9999", organization_id=org.id
    )
    assert doc is None


@pytest.mark.asyncio
async def test_get_cascade_payloads_empty_when_no_doc(test_db, create_test_user):
    from app.services.cascade_enrichment_service import get_cascade_payloads

    _user, org = await create_test_user()
    payloads = await get_cascade_payloads(
        test_db,
        parcel_id="NL.IMBAG.Pand.0983100000000001",
        gemeente_code="9999",
        organization_id=org.id,
    )
    assert payloads == {}


@pytest.mark.asyncio
async def test_extract_factor_woonvisie_cache_hit(test_db, create_test_user):
    """Seeded PolicyDocument + mocked Claude: 1e call raakt Claude, 2e is cache-hit.

    Gebruik extract_factor direct met mock_client voor volledige test-isolatie
    (get_cascade_payloads gebruikt create_claude_client() intern — niet mock-baar
    zonder dependency injection; dit pad test de cache-laag die S06 gebruikt).
    """
    from app.models.policy_document import PolicyDocument
    from app.services.factor_extraction_service import extract_factor
    from tests.ai_mocks import make_mock_anthropic_client, make_tool_use_response

    user, org = await create_test_user()

    doc = PolicyDocument(
        id=uuid.uuid4(),
        organization_id=org.id,
        entity_type="gemeente",
        entity_code="0983",
        source_key="woonvisie",
        filename="venlo_woonvisie_2030.pdf",
        content_type="application/pdf",
        file_data=b"%PDF-1.4\n%test-venlo-woonvisie\n%%EOF",
        file_size=30,
        uploaded_by_user_id=user.id,
    )
    test_db.add(doc)
    await test_db.commit()
    await test_db.refresh(doc)

    fixed_payload = {
        "periode_start": 2025,
        "periode_einde": 2030,
        "prioritized_segment": "midden",
        "growth_wijken": ["Blerick-Oost", "Q4"],
        "shrink_wijken": [],
        "confidence": 0.87,
    }
    mock_client = make_mock_anthropic_client(
        make_tool_use_response(
            tool_name="extract_woonvisie_match",
            tool_input=fixed_payload,
        )
    )

    parcel_id = "NL.IMBAG.Pand.0983100000000001"

    # Eerste call: Claude wordt aangeroepen
    r1 = await extract_factor(
        test_db,
        factor_def=WOONVISIE_MATCH_FACTOR_DEF,
        parcel_id=parcel_id,
        policy_document=doc,
        claude_client=mock_client,
    )
    assert r1.from_cache is False
    assert mock_client.messages.create.call_count == 1
    assert r1.payload.prioritized_segment == "midden"

    # Tweede call: cache hit — geen 2e Claude-call
    r2 = await extract_factor(
        test_db,
        factor_def=WOONVISIE_MATCH_FACTOR_DEF,
        parcel_id=parcel_id,
        policy_document=doc,
        claude_client=mock_client,
    )
    assert r2.from_cache is True
    assert mock_client.messages.create.call_count == 1  # nog steeds 1
    assert r2.payload.growth_wijken == ["Blerick-Oost", "Q4"]
