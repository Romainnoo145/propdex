"""Phase 8 — M048 convergence smoke tests.

Composes Phases 5/6/3/7 into 4 cross-phase integration assertions:
  1. test_two_parcels_one_claude_call_via_cascade_boundary — SC#1 cache-dedup
  2. test_two_parcels_different_woonvisie_scores_via_cache — SC#2 wijk-differentiation through cache layer
  3. test_cache_key_uses_document_sentinel_and_schema_v4 — cache-key shape regression guard
  4. test_second_cascade_call_is_idempotent — second-call hit-rate proof

Uses inline `_VENLO_BLERICK_CENTRUM_PAYLOAD` constant + inline `_seed_venlo_woonvisie` helper.
DOES NOT relocate helpers to tests/factories.py (out of scope).
DOES NOT call real Anthropic / OpenRouter — all Claude calls go through `monkeypatch.setattr(cascade_enrichment_service, "extract_factor", fake)`.
"""

from __future__ import annotations

import pytest

from app.ai.factor_extraction_schemas import DOCUMENT_SENTINEL, SCHEMA_VERSION
from app.ai.factors.woonvisie_match import WijkPolicy, WoonvisiePayload
from app.models.policy_document import PolicyDocument
from app.services import cascade_enrichment_service
from app.services.score_v3 import compute_score_v3
from tests.ai_mocks import make_mock_anthropic_client, make_tool_use_response
from tests.integration.test_woonvisie_match import _minimal_parcel_data  # REUSE — do not duplicate

_VENLO_BLERICK_CENTRUM_PAYLOAD = WoonvisiePayload(
    periode_start=2024,
    periode_einde=2030,
    wijk_policies=[
        WijkPolicy(
            wijk_naam="Blerick",
            prioriteit="groei",
            gewenste_segmenten=["sociaal", "midden"],
            citaat="Blerick blijft een van de drie groeikernen. 400 woningen tot 2030 in sociale en middensegment.",
            pagina=24,
        ),
        WijkPolicy(
            wijk_naam="Venlo-Centrum",
            prioriteit="neutraal",
            gewenste_segmenten=["duur", "gemengd"],
            citaat="Venlo-Centrum wordt niet als groei- of krimpgebied aangemerkt; focus op duur en gemengd.",
            pagina=18,
        ),
    ],
    algemeen_citaat="Gemeente Venlo streeft naar 2800 nieuwe woningen tot 2030.",
    confidence=0.9,
)


def _make_mock_claude_wrapper(mock_client):
    """Wrap an AsyncMock client into the wrapper-shape returned by create_claude_client().

    extract_factor_live() reads `wrapper.client` and `wrapper.model` (see
    app/ai/factor_extractor.py:79-81). Tests must monkeypatch
    `app.ai.factor_extractor.create_claude_client` to return this wrapper —
    NOT `app.services.factor_extraction_service.get_claude_client` (which does
    not exist; the plan referenced a path that was never implemented).
    """
    from types import SimpleNamespace
    return SimpleNamespace(client=mock_client, model="test-model")


async def _seed_venlo_woonvisie(test_db, org, user) -> PolicyDocument:
    """Seed an active Venlo woonvisie PolicyDocument and return it.

    Mirrors RESEARCH.md L364-379 verbatim — entity_type='gemeente', entity_code='0983',
    source_key='woonvisie', filename='venlo-woonvisie.pdf', content_type='application/pdf',
    file_data=b'%PDF-1.4\\n%fake\\n%%EOF', file_size=22, status='parsed', version_number=1,
    is_global=False.
    """
    doc = PolicyDocument(
        organization_id=org.id,
        entity_type="gemeente",
        entity_code="0983",
        source_key="woonvisie",
        filename="venlo-woonvisie.pdf",
        content_type="application/pdf",
        file_data=b"%PDF-1.4\n%fake\n%%EOF",
        file_size=22,
        status="parsed",
        version_number=1,
        is_global=False,
        uploaded_by_user_id=user.id,
    )
    test_db.add(doc)
    await test_db.commit()
    await test_db.refresh(doc)
    return doc


# ─── Stubs (Wave 0 — fail loud) ──────────────────────────────────────────────


@pytest.mark.asyncio
async def test_two_parcels_one_claude_call_via_cascade_boundary(test_db, create_test_user, monkeypatch):
    """SC#1: two real parcel_ids → cascade boundary collapses to 1 mock Claude call via DOCUMENT_SENTINEL."""
    user, org = await create_test_user()
    await _seed_venlo_woonvisie(test_db, org, user)

    # Mock Anthropic client at the call-site binding. extract_factor_live() in
    # app.ai.factor_extractor calls create_claude_client() — patch that import,
    # NOT the (non-existent) app.services.factor_extraction_service.get_claude_client.
    response = make_tool_use_response(
        tool_name="extract_woonvisie_match",
        tool_input=_VENLO_BLERICK_CENTRUM_PAYLOAD.model_dump(mode="json"),
    )
    mock_client = make_mock_anthropic_client(response)
    monkeypatch.setattr(
        "app.ai.factor_extractor.create_claude_client",
        lambda: _make_mock_claude_wrapper(mock_client),
    )

    # Two different real parcel_ids — same gemeente, same doc.
    payloads_1 = await cascade_enrichment_service.get_cascade_payloads(
        test_db,
        parcel_id="NL.IMBAG.Pand.0983-BLERICK-001",
        gemeente_code="0983",
        organization_id=org.id,
    )
    payloads_2 = await cascade_enrichment_service.get_cascade_payloads(
        test_db,
        parcel_id="NL.IMBAG.Pand.0983-CENTRUM-002",
        gemeente_code="0983",
        organization_id=org.id,
    )

    # The proof: cascade-boundary collapsed two parcel-paths into one Claude call via DOCUMENT_SENTINEL.
    assert mock_client.messages.create.call_count == 1, (
        f"Expected 1 Claude call (cache-dedup); got {mock_client.messages.create.call_count}"
    )
    assert "woonvisie_match" in payloads_1, "First parcel should have woonvisie_match payload"
    assert "woonvisie_match" in payloads_2, "Second parcel should have woonvisie_match payload"


@pytest.mark.asyncio
async def test_two_parcels_different_woonvisie_scores_via_cache(test_db, create_test_user, monkeypatch):
    """SC#2: same payload from cache → Blerick vs Venlo-Centrum diff >= 0.2 for project_type=nieuwbouw_wonen."""
    pytest.fail("Wave 0 stub — Wave 1 Task 3 implementation required")


@pytest.mark.asyncio
async def test_cache_key_uses_document_sentinel_and_schema_v4(test_db, create_test_user, monkeypatch):
    """Regression: written cache row has parcel_id=='__document__' AND schema_version==4."""
    pytest.fail("Wave 0 stub — Wave 1 Task 4 implementation required")


@pytest.mark.asyncio
async def test_second_cascade_call_is_idempotent(test_db, create_test_user, monkeypatch):
    """Second sequential call returns cached result → mock_client.messages.create.call_count stays 1."""
    pytest.fail("Wave 0 stub — Wave 1 Task 5 implementation required")


# Re-export for static-analysis tools that scan symbols.
__all__ = [
    "test_two_parcels_one_claude_call_via_cascade_boundary",
    "test_two_parcels_different_woonvisie_scores_via_cache",
    "test_cache_key_uses_document_sentinel_and_schema_v4",
    "test_second_cascade_call_is_idempotent",
]


# Suppress unused-import lints — these are the cross-phase contract surface that
# Wave 1 (Tasks 2-5) will start using.
_ = (
    DOCUMENT_SENTINEL,
    SCHEMA_VERSION,
    cascade_enrichment_service,
    compute_score_v3,
    make_mock_anthropic_client,
    make_tool_use_response,
    _minimal_parcel_data,
)
