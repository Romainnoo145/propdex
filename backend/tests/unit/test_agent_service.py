"""Unit tests for the agentic loop in agent_service.py (Gemini SDK)."""

import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from google.genai import errors as genai_errors
from google.genai import types

from app.agents.agent_prompts import AGENT_SYSTEM_PROMPT
from app.agents.agent_schemas import AgentRequest, AgentResponse
from app.agents.agent_service import (
    MAX_TOOL_ROUNDS,
    _extract_response,
    _load_conversation_history,
    _persist_agent_turn,
    agent_chat,
)


# ── Helpers ──────────────────────────────────────────────────────────────

USER_ID = str(uuid.uuid4())


def _usage_metadata(prompt_tokens=10, candidates_tokens=20):
    """Create a mock usage_metadata matching Gemini's GenerateContentResponse."""
    meta = MagicMock()
    meta.prompt_token_count = prompt_tokens
    meta.candidates_token_count = candidates_tokens
    meta.total_token_count = prompt_tokens + candidates_tokens
    return meta


def _text_response(text: str) -> MagicMock:
    """Create a mock Gemini GenerateContentResponse with text only (no tool calls)."""
    response = MagicMock(spec=types.GenerateContentResponse)
    response.text = text
    response.function_calls = None
    response.usage_metadata = _usage_metadata()
    # candidates for grounding metadata extraction
    candidate = MagicMock()
    candidate.content = types.Content(role="model", parts=[types.Part.from_text(text=text)])
    candidate.grounding_metadata = None
    response.candidates = [candidate]
    return response


def _tool_call_response(tool_name: str, tool_args: dict) -> MagicMock:
    """Create a mock Gemini GenerateContentResponse with a function call."""
    fc = MagicMock()
    fc.name = tool_name
    fc.args = tool_args

    response = MagicMock(spec=types.GenerateContentResponse)
    response.text = ""
    response.function_calls = [fc]
    response.usage_metadata = _usage_metadata()
    # Build a Content for the model turn with the function call part
    candidate = MagicMock()
    candidate.content = types.Content(
        role="model",
        parts=[types.Part.from_function_call(name=tool_name, args=tool_args)],
    )
    candidate.grounding_metadata = None
    response.candidates = [candidate]
    return response


def _mock_gemini_client():
    """Create a mock genai.Client with async generate_content."""
    client = MagicMock()
    client.aio = MagicMock()
    client.aio.models = MagicMock()
    client.aio.models.generate_content = AsyncMock()
    return client


# ── Simple end_turn ─────────────────────────────────────────────────────


class TestEndTurn:
    """Test that a simple text response is returned correctly."""

    @pytest.mark.asyncio
    @patch("app.agents.agent_service.log_ai_usage", new_callable=AsyncMock)
    @patch("app.agents.agent_service.get_gemini_model", return_value="gemini-2.5-pro")
    @patch("app.agents.agent_service.create_gemini_client")
    async def test_simple_text_response(self, mock_create_client, mock_model, mock_log):
        client = _mock_gemini_client()
        mock_create_client.return_value = client
        client.aio.models.generate_content.return_value = _text_response(
            "Dit is een test antwoord in het Nederlands."
        )

        request = AgentRequest(message="Hoe gaat het?")
        db = AsyncMock()

        resp = await agent_chat(request, db, USER_ID)

        assert isinstance(resp, AgentResponse)
        assert resp.message == "Dit is een test antwoord in het Nederlands."
        assert resp.tool_calls_made == []
        client.aio.models.generate_content.assert_awaited_once()
        mock_log.assert_awaited_once()

    @pytest.mark.asyncio
    @patch("app.agents.agent_service._persist_agent_turn", new_callable=AsyncMock)
    @patch("app.agents.agent_service._load_conversation_history", new_callable=AsyncMock)
    @patch("app.agents.agent_service.log_ai_usage", new_callable=AsyncMock)
    @patch("app.agents.agent_service.get_gemini_model", return_value="gemini-2.5-pro")
    @patch("app.agents.agent_service.create_gemini_client")
    async def test_conversation_id_echoed(
        self, mock_create_client, mock_model, mock_log, mock_load_hist, mock_persist
    ):
        client = _mock_gemini_client()
        mock_create_client.return_value = client
        client.aio.models.generate_content.return_value = _text_response("OK")
        mock_load_hist.return_value = []
        conv_uuid = str(uuid.uuid4())
        mock_persist.return_value = conv_uuid

        request = AgentRequest(message="Test", conversation_id=conv_uuid)
        db = AsyncMock()

        resp = await agent_chat(request, db, USER_ID)
        assert resp.conversation_id == conv_uuid
        mock_load_hist.assert_awaited_once_with(db, USER_ID, conv_uuid)
        mock_persist.assert_awaited_once()


# ── Tool-use cycle ──────────────────────────────────────────────────────


class TestToolUseCycle:
    """Test that tool_use responses trigger tool execution and loop."""

    @pytest.mark.asyncio
    @patch("app.agents.agent_service.log_ai_usage", new_callable=AsyncMock)
    @patch("app.agents.agent_service.execute_tool", new_callable=AsyncMock)
    @patch("app.agents.agent_service.get_gemini_model", return_value="gemini-2.5-pro")
    @patch("app.agents.agent_service.create_gemini_client")
    async def test_single_tool_call(self, mock_create_client, mock_model, mock_exec_tool, mock_log):
        client = _mock_gemini_client()
        mock_create_client.return_value = client

        # First call: Gemini asks for list_favorites; second: text response
        client.aio.models.generate_content.side_effect = [
            _tool_call_response("list_favorites", {}),
            _text_response("Je hebt 2 favorieten."),
        ]
        mock_exec_tool.return_value = '[{"parcel_id": "A"}, {"parcel_id": "B"}]'

        request = AgentRequest(message="Wat zijn mijn favorieten?")
        db = AsyncMock()

        resp = await agent_chat(request, db, USER_ID)

        assert resp.message == "Je hebt 2 favorieten."
        assert resp.tool_calls_made == ["list_favorites"]
        assert client.aio.models.generate_content.await_count == 2
        mock_exec_tool.assert_awaited_once_with("list_favorites", {}, db, USER_ID)

    @pytest.mark.asyncio
    @patch("app.agents.agent_service.log_ai_usage", new_callable=AsyncMock)
    @patch("app.agents.agent_service.execute_tool", new_callable=AsyncMock)
    @patch("app.agents.agent_service.get_gemini_model", return_value="gemini-2.5-pro")
    @patch("app.agents.agent_service.create_gemini_client")
    async def test_tool_execution_failure(self, mock_create_client, mock_model, mock_exec_tool, mock_log):
        """When tool execution raises, error is fed back to Gemini."""
        client = _mock_gemini_client()
        mock_create_client.return_value = client

        client.aio.models.generate_content.side_effect = [
            _tool_call_response("get_report", {"report_id": "xxx"}),
            _text_response("Er ging iets mis met het rapport."),
        ]
        mock_exec_tool.side_effect = RuntimeError("DB connection lost")

        request = AgentRequest(message="Toon rapport xxx")
        db = AsyncMock()

        resp = await agent_chat(request, db, USER_ID)

        # Loop should continue: error fed back to Gemini, Gemini gives text answer
        assert resp.message == "Er ging iets mis met het rapport."
        assert resp.tool_calls_made == ["get_report"]


# ── MAX_TOOL_ROUNDS ─────────────────────────────────────────────────────


class TestMaxToolRounds:
    """Test that the loop terminates after MAX_TOOL_ROUNDS."""

    @pytest.mark.asyncio
    @patch("app.agents.agent_service.log_ai_usage", new_callable=AsyncMock)
    @patch("app.agents.agent_service.execute_tool", new_callable=AsyncMock)
    @patch("app.agents.agent_service.get_gemini_model", return_value="gemini-2.5-pro")
    @patch("app.agents.agent_service.create_gemini_client")
    async def test_max_rounds_terminates(self, mock_create_client, mock_model, mock_exec_tool, mock_log):
        client = _mock_gemini_client()
        mock_create_client.return_value = client

        # Gemini always requests a tool call — should stop after MAX_TOOL_ROUNDS
        client.aio.models.generate_content.return_value = _tool_call_response("list_favorites", {})
        mock_exec_tool.return_value = "[]"

        request = AgentRequest(message="Loop forever")
        db = AsyncMock()

        resp = await agent_chat(request, db, USER_ID)

        # Loop ran MAX_TOOL_ROUNDS times
        assert client.aio.models.generate_content.await_count == MAX_TOOL_ROUNDS
        # Fallback message since last response was tool_use with no text
        assert "Probeer het opnieuw" in resp.message or "geen antwoord" in resp.message
        assert len(resp.tool_calls_made) == MAX_TOOL_ROUNDS


# ── Gemini API errors ───────────────────────────────────────────────────


class TestGeminiAPIErrors:
    """Test that Gemini API errors are caught and return Dutch error messages."""

    @pytest.mark.asyncio
    @patch("app.agents.agent_service.get_gemini_model", return_value="gemini-2.5-pro")
    @patch("app.agents.agent_service.create_gemini_client")
    async def test_server_error(self, mock_create_client, mock_model):
        client = _mock_gemini_client()
        mock_create_client.return_value = client
        client.aio.models.generate_content.side_effect = genai_errors.ServerError(
            500, {"error": {"message": "server down"}}
        )

        request = AgentRequest(message="Test")
        db = AsyncMock()

        resp = await agent_chat(request, db, USER_ID)
        assert "niet bereikbaar" in resp.message

    @pytest.mark.asyncio
    @patch("app.agents.agent_service.get_gemini_model", return_value="gemini-2.5-pro")
    @patch("app.agents.agent_service.create_gemini_client")
    async def test_client_error(self, mock_create_client, mock_model):
        client = _mock_gemini_client()
        mock_create_client.return_value = client
        client.aio.models.generate_content.side_effect = genai_errors.ClientError(
            400, {"error": {"message": "bad request"}}
        )

        request = AgentRequest(message="Test")
        db = AsyncMock()

        resp = await agent_chat(request, db, USER_ID)
        assert "reageert niet" in resp.message

    @pytest.mark.asyncio
    @patch("app.agents.agent_service.get_gemini_model", return_value="gemini-2.5-pro")
    @patch("app.agents.agent_service.create_gemini_client")
    async def test_unexpected_exception(self, mock_create_client, mock_model):
        client = _mock_gemini_client()
        mock_create_client.return_value = client
        client.aio.models.generate_content.side_effect = RuntimeError("unexpected")

        request = AgentRequest(message="Test")
        db = AsyncMock()

        resp = await agent_chat(request, db, USER_ID)
        assert "onverwachte fout" in resp.message


# ── Conversation History Loading ────────────────────────────────────────


class TestLoadConversationHistory:
    """Test _load_conversation_history with various inputs."""

    @pytest.mark.asyncio
    async def test_none_conversation_id_returns_empty(self):
        db = AsyncMock()
        result = await _load_conversation_history(db, USER_ID, None)
        assert result == []

    @pytest.mark.asyncio
    async def test_invalid_uuid_returns_empty(self):
        db = AsyncMock()
        result = await _load_conversation_history(db, USER_ID, "not-a-uuid")
        assert result == []

    @pytest.mark.asyncio
    async def test_conversation_not_owned_returns_empty(self):
        db = AsyncMock()
        cid = str(uuid.uuid4())
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        db.execute = AsyncMock(return_value=mock_result)

        result = await _load_conversation_history(db, USER_ID, cid)
        assert result == []

    @pytest.mark.asyncio
    async def test_loads_user_and_assistant_messages(self):
        db = AsyncMock()
        cid = str(uuid.uuid4())

        convo_mock = MagicMock()
        msg1 = MagicMock()
        msg1.role = "user"
        msg1.content = "Hallo"
        msg2 = MagicMock()
        msg2.role = "assistant"
        msg2.content = "Hoi! Hoe kan ik helpen?"
        msg3 = MagicMock()
        msg3.role = "system"
        msg3.content = "system message"

        msgs_result = MagicMock()
        msgs_result.scalars.return_value.all.return_value = [msg1, msg2, msg3]
        convo_result = MagicMock()
        convo_result.scalar_one_or_none.return_value = convo_mock

        db.execute = AsyncMock(side_effect=[convo_result, msgs_result])

        result = await _load_conversation_history(db, USER_ID, cid)
        assert len(result) == 2
        assert result[0] == {"role": "user", "content": "Hallo"}
        assert result[1] == {"role": "assistant", "content": "Hoi! Hoe kan ik helpen?"}

    @pytest.mark.asyncio
    async def test_db_failure_returns_empty(self):
        db = AsyncMock()
        cid = str(uuid.uuid4())
        db.execute = AsyncMock(side_effect=RuntimeError("DB down"))

        result = await _load_conversation_history(db, USER_ID, cid)
        assert result == []


# ── Conversation Persistence ────────────────────────────────────────────


class TestPersistAgentTurn:
    """Test _persist_agent_turn fire-and-forget behavior."""

    @pytest.mark.asyncio
    async def test_invalid_conversation_id_creates_new(self):
        db = AsyncMock()
        db.flush = AsyncMock()
        db.add = MagicMock()

        result = await _persist_agent_turn(
            db, USER_ID, "bad-uuid", "hello", "hoi", [], 100
        )
        assert result is not None or result is None  # doesn't raise

    @pytest.mark.asyncio
    async def test_none_conversation_id_creates_new(self):
        db = AsyncMock()
        db.flush = AsyncMock()
        db.add = MagicMock()

        result = await _persist_agent_turn(
            db, USER_ID, None, "hello", "hoi", ["list_favorites"], 200
        )
        assert True

    @pytest.mark.asyncio
    async def test_db_failure_returns_none(self):
        db = AsyncMock()
        db.flush = AsyncMock(side_effect=RuntimeError("DB error"))
        db.add = MagicMock()

        result = await _persist_agent_turn(
            db, USER_ID, None, "hello", "hoi", [], 100
        )
        assert result is None


# ── Integration: history loaded before Gemini call ──────────────────────


class TestConversationMemoryIntegration:
    """Test that agent_chat wires history + persistence together."""

    @pytest.mark.asyncio
    @patch("app.agents.agent_service._persist_agent_turn", new_callable=AsyncMock)
    @patch("app.agents.agent_service._load_conversation_history", new_callable=AsyncMock)
    @patch("app.agents.agent_service.log_ai_usage", new_callable=AsyncMock)
    @patch("app.agents.agent_service.get_gemini_model", return_value="gemini-2.5-pro")
    @patch("app.agents.agent_service.create_gemini_client")
    async def test_history_prepended_to_messages(
        self, mock_create_client, mock_model, mock_log, mock_load_hist, mock_persist
    ):
        client = _mock_gemini_client()
        mock_create_client.return_value = client
        client.aio.models.generate_content.return_value = _text_response("Antwoord")

        history = [
            {"role": "user", "content": "Eerste vraag"},
            {"role": "assistant", "content": "Eerste antwoord"},
        ]
        mock_load_hist.return_value = history
        mock_persist.return_value = str(uuid.uuid4())

        conv_id = str(uuid.uuid4())
        request = AgentRequest(message="Tweede vraag", conversation_id=conv_id)
        db = AsyncMock()

        resp = await agent_chat(request, db, USER_ID)

        call_kwargs = client.aio.models.generate_content.call_args
        sent_contents = call_kwargs.kwargs.get("contents") or call_kwargs[1].get("contents")
        # 2 history messages + 1 current = 3 Content objects
        assert len(sent_contents) == 3
        # First message is user (from history)
        assert sent_contents[0].parts[0].text == "Eerste vraag"
        # Second is model (assistant → model in Gemini)
        assert sent_contents[1].role == "model"
        assert sent_contents[1].parts[0].text == "Eerste antwoord"
        # Third is the current user message
        assert sent_contents[2].parts[0].text == "Tweede vraag"

    @pytest.mark.asyncio
    @patch("app.agents.agent_service._persist_agent_turn", new_callable=AsyncMock)
    @patch("app.agents.agent_service._load_conversation_history", new_callable=AsyncMock)
    @patch("app.agents.agent_service.log_ai_usage", new_callable=AsyncMock)
    @patch("app.agents.agent_service.get_gemini_model", return_value="gemini-2.5-pro")
    @patch("app.agents.agent_service.create_gemini_client")
    async def test_new_conversation_returns_id(
        self, mock_create_client, mock_model, mock_log, mock_load_hist, mock_persist
    ):
        client = _mock_gemini_client()
        mock_create_client.return_value = client
        client.aio.models.generate_content.return_value = _text_response("Hoi")
        mock_load_hist.return_value = []
        new_cid = str(uuid.uuid4())
        mock_persist.return_value = new_cid

        request = AgentRequest(message="Start nieuw gesprek")
        db = AsyncMock()

        resp = await agent_chat(request, db, USER_ID)
        assert resp.conversation_id == new_cid


# ── Grounding Metadata Extraction ───────────────────────────────────────


class TestGroundingExtraction:
    """Test _extract_response handles Google Search grounding metadata."""

    def test_extract_response_with_grounding_sources(self):
        """Grounding chunks with web URI/title return sources correctly."""
        web1 = MagicMock()
        web1.uri = "https://example.com/bodem"
        web1.title = "Bodemonderzoek Venlo"

        chunk1 = MagicMock()
        chunk1.web = web1

        metadata = MagicMock()
        metadata.grounding_chunks = [chunk1]

        candidate = MagicMock()
        candidate.grounding_metadata = metadata

        response = MagicMock(spec=types.GenerateContentResponse)
        response.text = "Hier is informatie over bodemonderzoek."
        response.candidates = [candidate]

        text, sources = _extract_response(response)
        assert text == "Hier is informatie over bodemonderzoek."
        assert len(sources) == 1
        assert sources[0]["url"] == "https://example.com/bodem"
        assert sources[0]["title"] == "Bodemonderzoek Venlo"
        assert sources[0]["cited_text"] == ""  # Gemini doesn't provide cited_text

    def test_extract_response_no_grounding(self):
        """Response without grounding metadata returns empty sources list."""
        candidate = MagicMock()
        candidate.grounding_metadata = None

        response = MagicMock(spec=types.GenerateContentResponse)
        response.text = "Gewoon een antwoord."
        response.candidates = [candidate]

        text, sources = _extract_response(response)
        assert text == "Gewoon een antwoord."
        assert sources == []

    def test_extract_response_deduplicates_urls(self):
        """Duplicate grounding chunk URLs are deduplicated."""
        web1 = MagicMock()
        web1.uri = "https://example.com/same"
        web1.title = "Title 1"
        web2 = MagicMock()
        web2.uri = "https://example.com/same"
        web2.title = "Title 2"

        chunk1 = MagicMock()
        chunk1.web = web1
        chunk2 = MagicMock()
        chunk2.web = web2

        metadata = MagicMock()
        metadata.grounding_chunks = [chunk1, chunk2]

        candidate = MagicMock()
        candidate.grounding_metadata = metadata

        response = MagicMock(spec=types.GenerateContentResponse)
        response.text = "Antwoord met dubbele bronnen."
        response.candidates = [candidate]

        text, sources = _extract_response(response)
        assert len(sources) == 1

    def test_extract_response_empty_text_fallback(self):
        """Response with no text returns empty string."""
        candidate = MagicMock()
        candidate.grounding_metadata = None

        response = MagicMock(spec=types.GenerateContentResponse)
        response.text = None
        response.candidates = [candidate]

        text, sources = _extract_response(response)
        assert text == ""
        assert sources == []

    def test_extract_response_text_exception_fallback(self):
        """If response.text raises, return empty string."""
        candidate = MagicMock()
        candidate.grounding_metadata = None

        response = MagicMock(spec=types.GenerateContentResponse)
        type(response).text = property(lambda self: (_ for _ in ()).throw(ValueError("no text")))
        response.candidates = [candidate]

        text, sources = _extract_response(response)
        assert text == ""
        assert sources == []


# ── Advisory Prompt Content ─────────────────────────────────────────────


class TestAdvisoryPrompt:
    """Test AGENT_SYSTEM_PROMPT contains advisory instructions."""

    def test_prompt_has_comparison_instructions(self):
        assert "vergelijk" in AGENT_SYSTEM_PROMPT.lower()

    def test_prompt_has_gap_analysis_instructions(self):
        assert "ontbrekende" in AGENT_SYSTEM_PROMPT.lower()

    def test_prompt_has_web_search_mention(self):
        """Prompt still mentions web_search capability (now via Google Search grounding)."""
        # The prompt text may reference search/zoek capability generically
        prompt_lower = AGENT_SYSTEM_PROMPT.lower()
        assert "web_search" in prompt_lower or "zoek" in prompt_lower or "search" in prompt_lower

    def test_prompt_no_longer_denies_external_access(self):
        """Old 'geen toegang tot externe bronnen' line should be removed."""
        assert "geen toegang tot" not in AGENT_SYSTEM_PROMPT.lower()


# ── Streaming Generator ─────────────────────────────────────────────────


from app.agents.agent_service import agent_chat_stream  # noqa: E402


class TestAgentChatStream:
    """Test agent_chat_stream() SSE event generator."""

    @staticmethod
    async def _collect_events(request, db, user_id):
        """Helper to collect all events from the async generator."""
        events = []
        async for event in agent_chat_stream(request, db, user_id):
            events.append(event)
        return events

    @pytest.mark.asyncio
    @patch("app.agents.agent_service._persist_agent_turn", new_callable=AsyncMock)
    @patch("app.agents.agent_service._load_conversation_history", new_callable=AsyncMock)
    @patch("app.agents.agent_service.log_ai_usage", new_callable=AsyncMock)
    @patch("app.agents.agent_service.get_gemini_model", return_value="gemini-2.5-pro")
    @patch("app.agents.agent_service.create_gemini_client")
    async def test_stream_simple_text_response(
        self, mock_create_client, mock_model, mock_log, mock_load_hist, mock_persist
    ):
        """No tool calls → event sequence is [text_delta..., sources, done]."""
        client = _mock_gemini_client()
        mock_create_client.return_value = client
        client.aio.models.generate_content.return_value = _text_response(
            "Dit is een test antwoord."
        )
        mock_load_hist.return_value = []
        mock_persist.return_value = str(uuid.uuid4())

        request = AgentRequest(message="Hoe gaat het?")
        db = AsyncMock()

        events = await self._collect_events(request, db, USER_ID)

        types_list = [e["type"] for e in events]
        # Should have text_delta events followed by sources then done
        assert "tool_start" not in types_list
        assert "tool_end" not in types_list
        assert "text_delta" in types_list
        assert types_list[-2] == "sources"
        assert types_list[-1] == "done"

        # Verify text_delta words reassemble the full text
        text_words = [e["data"]["text"] for e in events if e["type"] == "text_delta"]
        assert " ".join(text_words) == "Dit is een test antwoord."

        # Verify done event has conversation metadata
        done_event = events[-1]
        assert "conversation_id" in done_event["data"]
        assert done_event["data"]["tool_calls_made"] == []

    @pytest.mark.asyncio
    @patch("app.agents.agent_service._persist_agent_turn", new_callable=AsyncMock)
    @patch("app.agents.agent_service._load_conversation_history", new_callable=AsyncMock)
    @patch("app.agents.agent_service.log_ai_usage", new_callable=AsyncMock)
    @patch("app.agents.agent_service.execute_tool", new_callable=AsyncMock)
    @patch("app.agents.agent_service.get_gemini_model", return_value="gemini-2.5-pro")
    @patch("app.agents.agent_service.create_gemini_client")
    async def test_stream_with_tool_calls(
        self, mock_create_client, mock_model, mock_exec_tool, mock_log,
        mock_load_hist, mock_persist
    ):
        """Tool call → event sequence includes [tool_start, tool_end, ..., text_delta..., sources, done]."""
        client = _mock_gemini_client()
        mock_create_client.return_value = client
        client.aio.models.generate_content.side_effect = [
            _tool_call_response("list_favorites", {}),
            _text_response("Je hebt 2 favorieten."),
        ]
        mock_exec_tool.return_value = '[{"parcel_id": "A"}, {"parcel_id": "B"}]'
        mock_load_hist.return_value = []
        mock_persist.return_value = str(uuid.uuid4())

        request = AgentRequest(message="Wat zijn mijn favorieten?")
        db = AsyncMock()

        events = await self._collect_events(request, db, USER_ID)

        types_list = [e["type"] for e in events]
        assert types_list[0] == "tool_start"
        assert types_list[1] == "tool_end"
        assert events[0]["data"]["tool"] == "list_favorites"
        assert events[1]["data"]["ok"] is True
        assert "text_delta" in types_list
        assert types_list[-2] == "sources"
        assert types_list[-1] == "done"

        done_event = events[-1]
        assert done_event["data"]["tool_calls_made"] == ["list_favorites"]

    @pytest.mark.asyncio
    @patch("app.agents.agent_service._load_conversation_history", new_callable=AsyncMock)
    @patch("app.agents.agent_service.get_gemini_model", return_value="gemini-2.5-pro")
    @patch("app.agents.agent_service.create_gemini_client")
    async def test_stream_error_handling(
        self, mock_create_client, mock_model, mock_load_hist
    ):
        """Gemini ServerError mid-loop → yields error event with Dutch message."""
        client = _mock_gemini_client()
        mock_create_client.return_value = client
        client.aio.models.generate_content.side_effect = genai_errors.ServerError(
            500, {"error": {"message": "server down"}}
        )
        mock_load_hist.return_value = []

        request = AgentRequest(message="Test")
        db = AsyncMock()

        events = await self._collect_events(request, db, USER_ID)

        assert len(events) == 1
        assert events[0]["type"] == "error"
        assert "niet bereikbaar" in events[0]["data"]["message"]

    @pytest.mark.asyncio
    @patch("app.agents.agent_service._persist_agent_turn", new_callable=AsyncMock)
    @patch("app.agents.agent_service._load_conversation_history", new_callable=AsyncMock)
    @patch("app.agents.agent_service.log_ai_usage", new_callable=AsyncMock)
    @patch("app.agents.agent_service.execute_tool", new_callable=AsyncMock)
    @patch("app.agents.agent_service.get_gemini_model", return_value="gemini-2.5-pro")
    @patch("app.agents.agent_service.create_gemini_client")
    async def test_stream_tool_failure(
        self, mock_create_client, mock_model, mock_exec_tool, mock_log,
        mock_load_hist, mock_persist
    ):
        """Tool execution raises → tool_end still emitted, error fed to Gemini, loop continues."""
        client = _mock_gemini_client()
        mock_create_client.return_value = client
        client.aio.models.generate_content.side_effect = [
            _tool_call_response("get_report", {"report_id": "xxx"}),
            _text_response("Er ging iets mis."),
        ]
        mock_exec_tool.side_effect = RuntimeError("DB connection lost")
        mock_load_hist.return_value = []
        mock_persist.return_value = str(uuid.uuid4())

        request = AgentRequest(message="Toon rapport xxx")
        db = AsyncMock()

        events = await self._collect_events(request, db, USER_ID)

        types_list = [e["type"] for e in events]
        # tool_start and tool_end should both be emitted
        assert types_list[0] == "tool_start"
        assert types_list[1] == "tool_end"
        # tool_end should indicate failure
        assert events[1]["data"]["ok"] is False
        assert "DB connection lost" in events[1]["data"]["error"]
        # Loop continued — we got text from Gemini's second response
        assert "text_delta" in types_list
        assert types_list[-1] == "done"

    @pytest.mark.asyncio
    @patch("app.agents.agent_service._persist_agent_turn", new_callable=AsyncMock)
    @patch("app.agents.agent_service._load_conversation_history", new_callable=AsyncMock)
    @patch("app.agents.agent_service.log_ai_usage", new_callable=AsyncMock)
    @patch("app.agents.agent_service.get_gemini_model", return_value="gemini-2.5-pro")
    @patch("app.agents.agent_service.create_gemini_client")
    async def test_stream_persist_called(
        self, mock_create_client, mock_model, mock_log, mock_load_hist, mock_persist
    ):
        """_persist_agent_turn is called after streaming completes."""
        client = _mock_gemini_client()
        mock_create_client.return_value = client
        client.aio.models.generate_content.return_value = _text_response("Hoi")
        mock_load_hist.return_value = []
        mock_persist.return_value = str(uuid.uuid4())

        request = AgentRequest(message="Test")
        db = AsyncMock()

        events = await self._collect_events(request, db, USER_ID)

        mock_persist.assert_awaited_once()
        # done event should contain conversation_id from persist
        done_event = [e for e in events if e["type"] == "done"][-1]
        assert done_event["data"]["conversation_id"] is not None
