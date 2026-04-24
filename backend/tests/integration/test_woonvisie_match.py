"""Integration tests for woonvisie_match factor (M047/S06 + M048/Phase 6).

Tests after M048/Phase 6:
1. score_woonvisie_match — unit behaviour with WijkPolicy payload shape
2. compute_score_v3 — woonvisie_match appears in score_breakdown, differentiates by wijk
3. cascade_enrichment_service — DB-level cache (DOCUMENT_SENTINEL Phase 5 pattern) still works with new shape
"""

import uuid

import pytest

from app.ai.factors.woonvisie_match import (
    WOONVISIE_MATCH_FACTOR_DEF,
    WijkPolicy,
    WoonvisiePayload,
)
from app.services.score_v3 import compute_score_v3
from app.services.score_v3_factors import score_woonvisie_match

# ─── Unit tests: score_woonvisie_match ───────────────────────────────────────


def test_woonvisie_match_missing_when_payload_none():
    result = score_woonvisie_match(None, wijk_naam="Blerick", project_type="onbepaald")
    assert result.missing is True
    assert result.gewicht == 0
    assert result.genormaliseerde_score == 0.0


def test_woonvisie_match_groei_wijk_boosts_score():
    payload = WoonvisiePayload(
        periode_start=2025,
        periode_einde=2030,
        wijk_policies=[
            WijkPolicy(
                wijk_naam="Blerick-Oost",
                prioriteit="groei",
                gewenste_segmenten=["midden"],
                citaat="Blerick-Oost is expliciet groeigebied; 200 woningen middenhuur tot 2030.",
                pagina=12,
            ),
        ],
        algemeen_citaat="",
        confidence=0.9,
    )
    result = score_woonvisie_match(
        payload, wijk_naam="Blerick-Oost", project_type="nieuwbouw_wonen"
    )
    assert result.missing is False
    assert result.genormaliseerde_score >= 0.7, (
        f"Expected >= 0.7, got {result.genormaliseerde_score}"
    )
    assert "Blerick-Oost" in result.toelichting_lang
    assert "groei" in result.toelichting_kort.lower()


def test_woonvisie_match_krimp_wijk_lowers_score():
    payload = WoonvisiePayload(
        periode_start=2025,
        periode_einde=2030,
        wijk_policies=[
            WijkPolicy(
                wijk_naam="Laarveld",
                prioriteit="krimp",
                gewenste_segmenten=["sociaal"],
                citaat="Laarveld: geen uitbreiding, afname woningvoorraad.",
                pagina=18,
            ),
        ],
        algemeen_citaat="",
        confidence=0.85,
    )
    result = score_woonvisie_match(payload, wijk_naam="Laarveld", project_type="nieuwbouw_wonen")
    # krimp base = 5.0 - 2.5 = 2.5; sociaal overlaps with nieuwbouw_wonen → +2.0 → 4.5
    # confidence-pull at 0.85: 4.5 * 0.85 + 5.0 * 0.15 = 4.575 → 0.4575 normalized
    assert result.genormaliseerde_score <= 0.48, (
        f"Expected <= 0.48 for krimp, got {result.genormaliseerde_score}"
    )


def test_woonvisie_match_segment_mismatch_penalizes():
    """Same wijk, different projecttype → overlap bonus vs mismatch penalty."""
    payload = WoonvisiePayload(
        periode_start=2025,
        periode_einde=2030,
        wijk_policies=[
            WijkPolicy(
                wijk_naam="Centrum",
                prioriteit="groei",
                gewenste_segmenten=["sociaal"],  # gemeente wil sociaal
                citaat="Centrum groeigebied met focus op sociale huur.",
                pagina=24,
            ),
        ],
        algemeen_citaat="",
        confidence=0.9,
    )
    # nieuwbouw_wonen prefers [sociaal, midden] → overlap with [sociaal] → +2.0 bonus
    result_match = score_woonvisie_match(
        payload, wijk_naam="Centrum", project_type="nieuwbouw_wonen"
    )
    # optoppen prefers [midden, duur] → no overlap with [sociaal], wijk has segmenten → -1.0 penalty
    result_mismatch = score_woonvisie_match(
        payload, wijk_naam="Centrum", project_type="optoppen"
    )
    assert result_mismatch.genormaliseerde_score < result_match.genormaliseerde_score


def test_woonvisie_match_no_wijk_returns_neutral():
    payload = WoonvisiePayload(
        periode_start=2025,
        periode_einde=2030,
        wijk_policies=[],
        algemeen_citaat="",
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
        wijk_policies=[
            WijkPolicy(
                wijk_naam="Blerick-Oost",
                prioriteit="groei",
                gewenste_segmenten=["midden"],
                citaat="Blerick-Oost groeigebied.",
                pagina=12,
            ),
        ],
        algemeen_citaat="",
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


def test_venlo_smoke_wijk_differentiation():
    """TEST-06: two parcels in different Venlo wijken, same projecttype → different scores.

    Same payload, same project_type, only parcel.wijk_naam differs → differentiation is the whole point of Phase 6.
    """
    payload = WoonvisiePayload(
        periode_start=2024,
        periode_einde=2030,
        wijk_policies=[
            WijkPolicy(
                wijk_naam="Blerick",
                prioriteit="groei",
                gewenste_segmenten=["sociaal", "midden"],
                citaat="Blerick blijft groeigebied. 400 woningen tot 2030, 35% sociaal.",
                pagina=24,
            ),
            WijkPolicy(
                wijk_naam="Venlo-Centrum",
                prioriteit="neutraal",
                gewenste_segmenten=["duur", "gemengd"],
                citaat="Venlo-Centrum wordt niet als groei- of krimpgebied aangemerkt.",
                pagina=18,
            ),
        ],
        algemeen_citaat="Gemeente Venlo streeft naar 2800 nieuwe woningen tot 2030.",
        confidence=0.9,
    )

    blerick_result = compute_score_v3(
        _minimal_parcel_data("Blerick"),
        project_type="nieuwbouw_wonen",
        cascade_payloads={"woonvisie_match": payload},
    )
    centrum_result = compute_score_v3(
        _minimal_parcel_data("Venlo-Centrum"),
        project_type="nieuwbouw_wonen",
        cascade_payloads={"woonvisie_match": payload},
    )

    blerick_score = blerick_result.score_breakdown["woonvisie_match"].genormaliseerde_score
    centrum_score = centrum_result.score_breakdown["woonvisie_match"].genormaliseerde_score

    assert blerick_score > centrum_score, (
        f"Expected Blerick ({blerick_score}) > Venlo-Centrum ({centrum_score})"
    )
    assert abs(blerick_score - centrum_score) >= 0.2, (
        f"Expected differentiation >= 0.2, got {abs(blerick_score - centrum_score):.3f}"
    )


# ─── Integration tests: cascade_enrichment_service ───────────────────────────


@pytest.mark.asyncio
async def test_get_woonvisie_document_returns_none_for_unknown_gemeente(test_db, create_test_user):
    from app.services.cascade_enrichment_service import get_woonvisie_document

    _user, org = await create_test_user()
    doc = await get_woonvisie_document(test_db, gemeente_code="9999", organization_id=org.id)
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
    """Seeded PolicyDocument + mocked Claude: 1st call hits Claude, 2nd is cache-hit.

    Post-Phase 6 fixed_payload uses the new wijk_policies shape (deprecated fields dropped).
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
        "wijk_policies": [
            {
                "wijk_naam": "Blerick-Oost",
                "prioriteit": "groei",
                "gewenste_segmenten": ["midden"],
                "citaat": "Blerick-Oost groeigebied, 200 woningen middenhuur.",
                "pagina": 12,
            },
        ],
        "algemeen_citaat": "Gemeente Venlo bouwt 2800 woningen tot 2030.",
        "confidence": 0.87,
    }
    mock_client = make_mock_anthropic_client(
        make_tool_use_response(
            tool_name="extract_woonvisie_match",
            tool_input=fixed_payload,
        )
    )

    parcel_id = "NL.IMBAG.Pand.0983100000000001"

    # First call: Claude is invoked
    r1 = await extract_factor(
        test_db,
        factor_def=WOONVISIE_MATCH_FACTOR_DEF,
        parcel_id=parcel_id,
        policy_document=doc,
        claude_client=mock_client,
    )
    assert r1.from_cache is False
    assert mock_client.messages.create.call_count == 1
    assert len(r1.payload.wijk_policies) == 1
    assert r1.payload.wijk_policies[0].wijk_naam == "Blerick-Oost"
    assert r1.payload.wijk_policies[0].prioriteit == "groei"

    # Second call: cache hit — no 2nd Claude call
    r2 = await extract_factor(
        test_db,
        factor_def=WOONVISIE_MATCH_FACTOR_DEF,
        parcel_id=parcel_id,
        policy_document=doc,
        claude_client=mock_client,
    )
    assert r2.from_cache is True
    assert mock_client.messages.create.call_count == 1  # still 1
    assert r2.payload.wijk_policies[0].wijk_naam == "Blerick-Oost"
