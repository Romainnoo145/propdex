"""Unit tests for S02 dispatch fixes: forceResults bypass, param merging,
context_intent normalization, and Dutch error messages with recovery suggestions.

Covers all four fix categories from M018/S02/T01.
"""

import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.agents.chat_schemas import ChatRequest, ChatResponse
from app.agents.chat_service import dispatch_chat
from app.ai.claude_client import AIParsingError


# ── Helpers ──────────────────────────────────────────────────────────────

USER_ID = str(uuid.uuid4())


@pytest.fixture
def mock_db():
    return AsyncMock()


def _make_search_response(**kwargs) -> ChatResponse:
    """Build a minimal ChatResponse for PARCEL_SEARCH."""
    defaults = dict(
        intent="PARCEL_SEARCH",
        params={"municipality": "Venlo"},
        count=42,
    )
    defaults.update(kwargs)
    return ChatResponse(**defaults)


def _make_count_preview_response(**kwargs) -> ChatResponse:
    """Build a COUNT_PREVIEW ChatResponse."""
    defaults = dict(
        intent="COUNT_PREVIEW",
        params={"municipality": "Venlo"},
        count=5000,
        suggestions=["Filter op bouwjaar"],
    )
    defaults.update(kwargs)
    return ChatResponse(**defaults)


# ── forceResults bypass tests ────────────────────────────────────────────

class TestForceResultsBypass:

    @pytest.mark.asyncio
    async def test_force_results_skips_classifier(self, mock_db):
        """force_results + COUNT_PREVIEW + previous_params → skip classifier, call handler."""
        request = ChatRequest(
            message="Toon resultaten",
            force_results=True,
            previous_intent="COUNT_PREVIEW",
            previous_params={"municipality": "Venlo"},
        )

        with patch("app.agents.chat_service.classify_intent", new_callable=AsyncMock) as mock_cls, \
             patch("app.agents.chat_service.handle_parcel_search", new_callable=AsyncMock) as mock_handler:
            mock_handler.return_value = _make_search_response()

            response = await dispatch_chat(request, mock_db, USER_ID)

            mock_cls.assert_not_called()
            mock_handler.assert_called_once()
            # Verify handler was called with previous_params and force_results=True
            call_kwargs = mock_handler.call_args
            assert call_kwargs[0][0] == {"municipality": "Venlo"}
            assert call_kwargs[1]["force_results"] is True

    @pytest.mark.asyncio
    async def test_force_results_without_previous_context_classifies_normally(self, mock_db):
        """force_results=True but no previous_intent → classifier runs."""
        request = ChatRequest(
            message="Toon resultaten",
            force_results=True,
            previous_intent=None,
            previous_params=None,
        )

        with patch("app.agents.chat_service.classify_intent", new_callable=AsyncMock) as mock_cls, \
             patch("app.agents.chat_service.handle_parcel_search", new_callable=AsyncMock) as mock_handler:
            mock_cls.return_value = ("PARCEL_SEARCH", {"municipality": "Venlo"})
            mock_handler.return_value = _make_search_response()

            await dispatch_chat(request, mock_db, USER_ID)

            mock_cls.assert_called_once()

    @pytest.mark.asyncio
    async def test_force_results_without_count_preview_classifies_normally(self, mock_db):
        """force_results=True but previous_intent is not COUNT_PREVIEW → classifier runs."""
        request = ChatRequest(
            message="Toon resultaten",
            force_results=True,
            previous_intent="PARCEL_SEARCH",
            previous_params={"municipality": "Venlo"},
        )

        with patch("app.agents.chat_service.classify_intent", new_callable=AsyncMock) as mock_cls, \
             patch("app.agents.chat_service.handle_parcel_search", new_callable=AsyncMock) as mock_handler:
            mock_cls.return_value = ("PARCEL_SEARCH", {"municipality": "Venlo"})
            mock_handler.return_value = _make_search_response()

            await dispatch_chat(request, mock_db, USER_ID)

            mock_cls.assert_called_once()

    @pytest.mark.asyncio
    async def test_force_results_without_previous_params_classifies_normally(self, mock_db):
        """force_results + COUNT_PREVIEW but empty previous_params → classifier runs."""
        request = ChatRequest(
            message="Toon resultaten",
            force_results=True,
            previous_intent="COUNT_PREVIEW",
            previous_params=None,
        )

        with patch("app.agents.chat_service.classify_intent", new_callable=AsyncMock) as mock_cls, \
             patch("app.agents.chat_service.handle_parcel_search", new_callable=AsyncMock) as mock_handler:
            mock_cls.return_value = ("PARCEL_SEARCH", {"municipality": "Venlo"})
            mock_handler.return_value = _make_search_response()

            await dispatch_chat(request, mock_db, USER_ID)

            mock_cls.assert_called_once()


# ── Param merging tests ──────────────────────────────────────────────────

class TestParamMerging:

    @pytest.mark.asyncio
    async def test_refinement_merges_params_when_intent_matches(self, mock_db):
        """Same intent on refinement → old params merged with new."""
        request = ChatRequest(
            message="Groter dan 200m2",
            previous_intent="PARCEL_SEARCH",
            previous_params={"municipality": "Venlo", "build_year_min": 1980},
        )

        with patch("app.agents.chat_service.classify_intent", new_callable=AsyncMock) as mock_cls, \
             patch("app.agents.chat_service.handle_parcel_search", new_callable=AsyncMock) as mock_handler:
            mock_cls.return_value = ("PARCEL_SEARCH", {"area_min": 200})
            mock_handler.return_value = _make_search_response()

            await dispatch_chat(request, mock_db, USER_ID)

            # Handler should receive merged params: all 3 fields
            called_params = mock_handler.call_args[0][0]
            assert called_params["municipality"] == "Venlo"
            assert called_params["build_year_min"] == 1980
            assert called_params["area_min"] == 200

    @pytest.mark.asyncio
    async def test_refinement_new_params_override_old(self, mock_db):
        """New classifier params override old ones, but non-overlapping old params preserved."""
        request = ChatRequest(
            message="In Amsterdam",
            previous_intent="PARCEL_SEARCH",
            previous_params={"municipality": "Venlo", "build_year_min": 1980},
        )

        with patch("app.agents.chat_service.classify_intent", new_callable=AsyncMock) as mock_cls, \
             patch("app.agents.chat_service.handle_parcel_search", new_callable=AsyncMock) as mock_handler:
            mock_cls.return_value = ("PARCEL_SEARCH", {"municipality": "Amsterdam"})
            mock_handler.return_value = _make_search_response()

            await dispatch_chat(request, mock_db, USER_ID)

            called_params = mock_handler.call_args[0][0]
            assert called_params["municipality"] == "Amsterdam"
            assert called_params["build_year_min"] == 1980

    @pytest.mark.asyncio
    async def test_no_merge_when_intent_changes(self, mock_db):
        """Different intent → no merging with previous params."""
        request = ChatRequest(
            message="Mijn opgeslagen percelen",
            previous_intent="PARCEL_SEARCH",
            previous_params={"municipality": "Venlo", "build_year_min": 1980},
        )

        with patch("app.agents.chat_service.classify_intent", new_callable=AsyncMock) as mock_cls, \
             patch("app.agents.chat_service.handle_my_favorites", new_callable=AsyncMock) as mock_handler:
            mock_cls.return_value = ("MY_FAVORITES", {})
            mock_handler.return_value = ChatResponse(
                intent="MY_FAVORITES", params={}, data=[], count=0,
            )

            await dispatch_chat(request, mock_db, USER_ID)

            # MY_FAVORITES handler should NOT receive the old PARCEL_SEARCH params
            called_params = mock_handler.call_args[0][0]
            assert "municipality" not in called_params
            assert "build_year_min" not in called_params

    @pytest.mark.asyncio
    async def test_no_merge_when_no_previous_params(self, mock_db):
        """No previous_params → no merging even if intent matches."""
        request = ChatRequest(
            message="Panden in Venlo",
            previous_intent="PARCEL_SEARCH",
            previous_params=None,
        )

        with patch("app.agents.chat_service.classify_intent", new_callable=AsyncMock) as mock_cls, \
             patch("app.agents.chat_service.handle_parcel_search", new_callable=AsyncMock) as mock_handler:
            mock_cls.return_value = ("PARCEL_SEARCH", {"municipality": "Venlo"})
            mock_handler.return_value = _make_search_response()

            await dispatch_chat(request, mock_db, USER_ID)

            called_params = mock_handler.call_args[0][0]
            assert called_params == {"municipality": "Venlo"}


# ── Context intent tests ─────────────────────────────────────────────────

class TestContextIntent:

    @pytest.mark.asyncio
    async def test_count_preview_response_has_parcel_search_context_intent(self, mock_db):
        """COUNT_PREVIEW response.context_intent should be PARCEL_SEARCH."""
        request = ChatRequest(
            message="Panden in Venlo",
        )

        with patch("app.agents.chat_service.classify_intent", new_callable=AsyncMock) as mock_cls, \
             patch("app.agents.chat_service.handle_parcel_search", new_callable=AsyncMock) as mock_handler:
            mock_cls.return_value = ("PARCEL_SEARCH", {"municipality": "Venlo"})
            mock_handler.return_value = _make_count_preview_response()

            response = await dispatch_chat(request, mock_db, USER_ID)

            assert response.intent == "COUNT_PREVIEW"
            assert response.context_intent == "PARCEL_SEARCH"

    @pytest.mark.asyncio
    async def test_normal_response_context_intent_matches(self, mock_db):
        """Normal PARCEL_SEARCH response.context_intent == PARCEL_SEARCH."""
        request = ChatRequest(
            message="Panden in Venlo",
        )

        with patch("app.agents.chat_service.classify_intent", new_callable=AsyncMock) as mock_cls, \
             patch("app.agents.chat_service.handle_parcel_search", new_callable=AsyncMock) as mock_handler:
            mock_cls.return_value = ("PARCEL_SEARCH", {"municipality": "Venlo"})
            mock_handler.return_value = _make_search_response()

            response = await dispatch_chat(request, mock_db, USER_ID)

            assert response.intent == "PARCEL_SEARCH"
            assert response.context_intent == "PARCEL_SEARCH"

    @pytest.mark.asyncio
    async def test_bypass_response_context_intent_is_parcel_search(self, mock_db):
        """forceResults bypass always sets context_intent = PARCEL_SEARCH."""
        request = ChatRequest(
            message="Toon resultaten",
            force_results=True,
            previous_intent="COUNT_PREVIEW",
            previous_params={"municipality": "Venlo"},
        )

        with patch("app.agents.chat_service.handle_parcel_search", new_callable=AsyncMock) as mock_handler:
            mock_handler.return_value = _make_search_response()

            response = await dispatch_chat(request, mock_db, USER_ID)

            assert response.context_intent == "PARCEL_SEARCH"


# ── Dutch error message tests ────────────────────────────────────────────

class TestDutchErrorMessages:

    @pytest.mark.asyncio
    async def test_classification_failure_returns_dutch_message(self, mock_db):
        """AIParsingError → Dutch message with 'Probeer', no raw English."""
        request = ChatRequest(message="Test")

        with patch("app.agents.chat_service.classify_intent", new_callable=AsyncMock) as mock_cls:
            mock_cls.side_effect = AIParsingError("timeout connecting to Claude", retriable=True)

            response = await dispatch_chat(request, mock_db, USER_ID)

        assert response.intent == "UNSUPPORTED"
        assert "Probeer" in response.message
        assert "timeout" not in response.message
        assert "JSON" not in response.message

    @pytest.mark.asyncio
    async def test_classification_failure_includes_suggestions(self, mock_db):
        """AIParsingError → response includes non-empty suggestions list."""
        request = ChatRequest(message="Test")

        with patch("app.agents.chat_service.classify_intent", new_callable=AsyncMock) as mock_cls:
            mock_cls.side_effect = AIParsingError("bad json", retriable=False)

            response = await dispatch_chat(request, mock_db, USER_ID)

        assert response.suggestions is not None
        assert len(response.suggestions) > 0

    @pytest.mark.asyncio
    async def test_handler_error_returns_dutch_message(self, mock_db):
        """Handler RuntimeError → Dutch message, not raw exception string."""
        request = ChatRequest(message="Mijn opgeslagen")

        with patch("app.agents.chat_service.classify_intent", new_callable=AsyncMock) as mock_cls, \
             patch("app.agents.chat_service.handle_my_favorites", new_callable=AsyncMock) as mock_handler:
            mock_cls.return_value = ("MY_FAVORITES", {})
            mock_handler.side_effect = RuntimeError("DB connection lost")

            response = await dispatch_chat(request, mock_db, USER_ID)

        assert response.intent == "UNSUPPORTED"
        assert "Probeer" in response.message
        assert "DB connection lost" not in response.message

    @pytest.mark.asyncio
    async def test_handler_error_includes_suggestions(self, mock_db):
        """Handler exception → response includes recovery suggestions."""
        request = ChatRequest(message="Mijn rapporten")

        with patch("app.agents.chat_service.classify_intent", new_callable=AsyncMock) as mock_cls, \
             patch("app.agents.chat_service.handle_my_reports", new_callable=AsyncMock) as mock_handler:
            mock_cls.return_value = ("MY_REPORTS", {})
            mock_handler.side_effect = RuntimeError("unexpected error")

            response = await dispatch_chat(request, mock_db, USER_ID)

        assert response.suggestions is not None
        assert len(response.suggestions) > 0

    @pytest.mark.asyncio
    async def test_bypass_handler_error_returns_dutch_message(self, mock_db):
        """forceResults bypass handler error → Dutch message with suggestions."""
        request = ChatRequest(
            message="Toon resultaten",
            force_results=True,
            previous_intent="COUNT_PREVIEW",
            previous_params={"municipality": "Venlo"},
        )

        with patch("app.agents.chat_service.handle_parcel_search", new_callable=AsyncMock) as mock_handler:
            mock_handler.side_effect = RuntimeError("DB timeout")

            response = await dispatch_chat(request, mock_db, USER_ID)

        assert response.intent == "UNSUPPORTED"
        assert "Probeer" in response.message
        assert "DB timeout" not in response.message
        assert response.suggestions is not None
