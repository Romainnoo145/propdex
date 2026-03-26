"""Unit tests for the Verkenner chat intent classifier.

Tests classify_intent() with mocked Claude responses to verify
intent routing across all 5 intents, refinement, and edge cases.
"""

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.agents.chat_service import _build_suggestions, _strip_code_fences, classify_intent
from app.agents.schemas import ParsedQuery

# ── Helpers ──────────────────────────────────────────────────────────────

def _mock_claude_response(data: dict) -> MagicMock:
    """Build a mock Anthropic response with a text block containing JSON."""
    block = MagicMock()
    block.type = "text"
    block.text = json.dumps(data, ensure_ascii=False)
    response = MagicMock()
    response.content = [block]
    return response


# ── _strip_code_fences ───────────────────────────────────────────────────

class TestStripCodeFences:
    def test_plain_json(self):
        assert _strip_code_fences('{"intent": "PARCEL_SEARCH"}') == '{"intent": "PARCEL_SEARCH"}'

    def test_json_fenced(self):
        assert _strip_code_fences('```json\n{"intent": "X"}\n```') == '{"intent": "X"}'

    def test_generic_fenced(self):
        assert _strip_code_fences('```\n{"a": 1}\n```') == '{"a": 1}'

    def test_whitespace(self):
        assert _strip_code_fences('  {"a": 1}  ') == '{"a": 1}'


# ── _build_suggestions ──────────────────────────────────────────────────

class TestBuildSuggestions:
    def test_no_filters(self):
        parsed = ParsedQuery()
        suggestions = _build_suggestions(parsed)
        assert len(suggestions) == 3  # capped at 3
        assert any("gemeente" in s for s in suggestions)

    def test_has_municipality(self):
        parsed = ParsedQuery(municipality="Venlo")
        suggestions = _build_suggestions(parsed)
        assert not any("gemeente" in s for s in suggestions)

    def test_all_filters_present(self):
        parsed = ParsedQuery(
            municipality="Venlo",
            build_year_max=1970,
            area_min=100,
            bestemming="wonen",
        )
        suggestions = _build_suggestions(parsed)
        assert any("toon resultaten" in s.lower() for s in suggestions)


# ── classify_intent ──────────────────────────────────────────────────────

@pytest.fixture
def mock_claude():
    """Patch create_claude_client so classify_intent uses a mock."""
    with patch("app.agents.chat_service.create_claude_client") as mock_factory:
        client = MagicMock()
        client.model = "test-model"
        client.client = MagicMock()
        client.client.messages = MagicMock()
        mock_factory.return_value = client
        yield client


# -- PARCEL_SEARCH intent --

@pytest.mark.asyncio
async def test_classify_parcel_search_venlo(mock_claude):
    mock_claude.client.messages.create = AsyncMock(
        return_value=_mock_claude_response({
            "intent": "PARCEL_SEARCH",
            "params": {"municipality": "Venlo", "build_year_max": 1970},
        })
    )
    intent, params = await classify_intent("Alle woningen in Venlo met bouwjaar voor 1970")
    assert intent == "PARCEL_SEARCH"
    assert params["municipality"] == "Venlo"
    assert params["build_year_max"] == 1970


@pytest.mark.asyncio
async def test_classify_parcel_search_amsterdam_bedrijf(mock_claude):
    mock_claude.client.messages.create = AsyncMock(
        return_value=_mock_claude_response({
            "intent": "PARCEL_SEARCH",
            "params": {"municipality": "Amsterdam", "area_min": 500.0, "bestemming": "bedrijf"},
        })
    )
    intent, params = await classify_intent("Bedrijfspanden groter dan 500m2 in Amsterdam")
    assert intent == "PARCEL_SEARCH"
    assert params["municipality"] == "Amsterdam"
    assert params["area_min"] == 500.0
    assert params["bestemming"] == "bedrijf"


@pytest.mark.asyncio
async def test_classify_parcel_search_bare_gemeente(mock_claude):
    mock_claude.client.messages.create = AsyncMock(
        return_value=_mock_claude_response({
            "intent": "PARCEL_SEARCH",
            "params": {"municipality": "Utrecht"},
        })
    )
    intent, params = await classify_intent("Utrecht")
    assert intent == "PARCEL_SEARCH"
    assert params["municipality"] == "Utrecht"


@pytest.mark.asyncio
async def test_classify_parcel_search_exclude_wonen(mock_claude):
    mock_claude.client.messages.create = AsyncMock(
        return_value=_mock_claude_response({
            "intent": "PARCEL_SEARCH",
            "params": {"municipality": "Venlo", "bestemming_exclude": "wonen"},
        })
    )
    intent, params = await classify_intent("Panden in Venlo die geen woningen zijn")
    assert intent == "PARCEL_SEARCH"
    assert params["bestemming_exclude"] == "wonen"


# -- PARCEL_DETAIL intent --

@pytest.mark.asyncio
async def test_classify_parcel_detail_address(mock_claude):
    mock_claude.client.messages.create = AsyncMock(
        return_value=_mock_claude_response({
            "intent": "PARCEL_DETAIL",
            "params": {"address": "Leutherweg 139, Venlo"},
        })
    )
    intent, params = await classify_intent("Vertel me alles over Leutherweg 139 Venlo")
    assert intent == "PARCEL_DETAIL"
    assert "Leutherweg" in params["address"]


@pytest.mark.asyncio
async def test_classify_parcel_detail_wat_weet_je(mock_claude):
    mock_claude.client.messages.create = AsyncMock(
        return_value=_mock_claude_response({
            "intent": "PARCEL_DETAIL",
            "params": {"address": "Keizersgracht 420, Amsterdam"},
        })
    )
    intent, params = await classify_intent("Wat weet je over Keizersgracht 420 Amsterdam?")
    assert intent == "PARCEL_DETAIL"
    assert "Keizersgracht" in params["address"]


# -- MY_FAVORITES intent --

@pytest.mark.asyncio
async def test_classify_my_favorites_all(mock_claude):
    mock_claude.client.messages.create = AsyncMock(
        return_value=_mock_claude_response({
            "intent": "MY_FAVORITES",
            "params": {},
        })
    )
    intent, params = await classify_intent("Welke percelen heb ik opgeslagen?")
    assert intent == "MY_FAVORITES"


@pytest.mark.asyncio
async def test_classify_my_favorites_stage(mock_claude):
    mock_claude.client.messages.create = AsyncMock(
        return_value=_mock_claude_response({
            "intent": "MY_FAVORITES",
            "params": {"stage": "Onderzoek"},
        })
    )
    intent, params = await classify_intent("Welke percelen staan op Onderzoek?")
    assert intent == "MY_FAVORITES"
    assert params["stage"] == "Onderzoek"


@pytest.mark.asyncio
async def test_classify_my_favorites_gemeente(mock_claude):
    mock_claude.client.messages.create = AsyncMock(
        return_value=_mock_claude_response({
            "intent": "MY_FAVORITES",
            "params": {"gemeente": "Venlo"},
        })
    )
    intent, params = await classify_intent("Mijn opgeslagen in Venlo")
    assert intent == "MY_FAVORITES"
    assert params["gemeente"] == "Venlo"


# -- MY_REPORTS intent --

@pytest.mark.asyncio
async def test_classify_my_reports_all(mock_claude):
    mock_claude.client.messages.create = AsyncMock(
        return_value=_mock_claude_response({
            "intent": "MY_REPORTS",
            "params": {},
        })
    )
    intent, params = await classify_intent("Laat mijn rapporten zien")
    assert intent == "MY_REPORTS"


@pytest.mark.asyncio
async def test_classify_my_reports_city(mock_claude):
    mock_claude.client.messages.create = AsyncMock(
        return_value=_mock_claude_response({
            "intent": "MY_REPORTS",
            "params": {"city": "Amsterdam"},
        })
    )
    intent, params = await classify_intent("Hoeveel rapporten heb ik voor Amsterdam?")
    assert intent == "MY_REPORTS"
    assert params["city"] == "Amsterdam"


# -- UNSUPPORTED intent --

@pytest.mark.asyncio
async def test_classify_unsupported_huurprijs(mock_claude):
    mock_claude.client.messages.create = AsyncMock(
        return_value=_mock_claude_response({
            "intent": "UNSUPPORTED",
            "params": {"reason": "Huurprijzen zijn niet beschikbaar in Propdex."},
        })
    )
    intent, params = await classify_intent("Wat is de gemiddelde huurprijs in Rotterdam?")
    assert intent == "UNSUPPORTED"
    assert "reason" in params


@pytest.mark.asyncio
async def test_classify_unsupported_hypotheek(mock_claude):
    mock_claude.client.messages.create = AsyncMock(
        return_value=_mock_claude_response({
            "intent": "UNSUPPORTED",
            "params": {"reason": "Hypotheekberekeningen zijn niet beschikbaar."},
        })
    )
    intent, params = await classify_intent("Bereken mijn hypotheek")
    assert intent == "UNSUPPORTED"


# -- Refinement --

@pytest.mark.asyncio
async def test_classify_refinement_preserves_previous(mock_claude):
    mock_claude.client.messages.create = AsyncMock(
        return_value=_mock_claude_response({
            "intent": "PARCEL_SEARCH",
            "params": {"municipality": "Venlo", "build_year_max": 1980},
        })
    )
    intent, params = await classify_intent(
        "Alleen bouwjaar voor 1980",
        previous_intent="PARCEL_SEARCH",
        previous_params={"municipality": "Venlo"},
    )
    assert intent == "PARCEL_SEARCH"
    assert params["municipality"] == "Venlo"
    assert params["build_year_max"] == 1980


@pytest.mark.asyncio
async def test_classify_refinement_new_topic_ignores_previous(mock_claude):
    mock_claude.client.messages.create = AsyncMock(
        return_value=_mock_claude_response({
            "intent": "MY_REPORTS",
            "params": {},
        })
    )
    intent, params = await classify_intent(
        "Laat mijn rapporten zien",
        previous_intent="PARCEL_SEARCH",
        previous_params={"municipality": "Venlo"},
    )
    assert intent == "MY_REPORTS"


# -- Edge cases --

@pytest.mark.asyncio
async def test_classify_unknown_intent_falls_back(mock_claude):
    mock_claude.client.messages.create = AsyncMock(
        return_value=_mock_claude_response({
            "intent": "BOGUS_INTENT",
            "params": {},
        })
    )
    intent, params = await classify_intent("Doe iets raars")
    assert intent == "UNSUPPORTED"


@pytest.mark.asyncio
async def test_classify_code_fences_handled(mock_claude):
    block = MagicMock()
    block.type = "text"
    block.text = '```json\n{"intent": "MY_REPORTS", "params": {}}\n```'
    response = MagicMock()
    response.content = [block]
    mock_claude.client.messages.create = AsyncMock(return_value=response)

    intent, params = await classify_intent("Mijn rapporten")
    assert intent == "MY_REPORTS"


@pytest.mark.asyncio
async def test_classify_empty_response_raises(mock_claude):
    from app.ai.claude_client import AIParsingError

    response = MagicMock()
    response.content = []
    mock_claude.client.messages.create = AsyncMock(return_value=response)

    with pytest.raises(AIParsingError):
        await classify_intent("Test")


@pytest.mark.asyncio
async def test_classify_invalid_json_raises(mock_claude):
    from app.ai.claude_client import AIParsingError

    block = MagicMock()
    block.type = "text"
    block.text = "not json at all"
    response = MagicMock()
    response.content = [block]
    mock_claude.client.messages.create = AsyncMock(return_value=response)

    with pytest.raises(AIParsingError):
        await classify_intent("Test")


# -- Total: 21 test cases covering all 5 intents + refinement + edges --
