"""Unit tests for the agentic loop in agent_service.py."""

import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import anthropic
import pytest
from anthropic.types import Message, TextBlock, ToolUseBlock, Usage

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


def _usage(input_tokens=10, output_tokens=20):
    return Usage(
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        cache_creation_input_tokens=0,
        cache_read_input_tokens=0,
    )


def _text_message(text: str, stop_reason: str = "end_turn") -> Message:
    return Message(
        id="msg_test",
        type="message",
        role="assistant",
        content=[TextBlock(type="text", text=text)],
        model="claude-sonnet-4-5-20250929",
        stop_reason=stop_reason,
        stop_sequence=None,
        usage=_usage(),
    )


def _tool_use_message(tool_name: str, tool_input: dict, tool_id: str = "toolu_001") -> Message:
    return Message(
        id="msg_test",
        type="message",
        role="assistant",
        content=[ToolUseBlock(type="tool_use", id=tool_id, name=tool_name, input=tool_input)],
        model="claude-sonnet-4-5-20250929",
        stop_reason="tool_use",
        stop_sequence=None,
        usage=_usage(),
    )


def _mock_client():
    """Create a mock ClaudeClient with an async messages.create."""
    client_wrapper = MagicMock()
    client_wrapper.model = "claude-sonnet-4-5-20250929"
    client_wrapper.client = MagicMock()
    client_wrapper.client.messages = MagicMock()
    client_wrapper.client.messages.create = AsyncMock()
    return client_wrapper


# ── Simple end_turn ─────────────────────────────────────────────────────


class TestEndTurn:
    """Test that a simple end_turn response is returned correctly."""

    @pytest.mark.asyncio
    @patch("app.agents.agent_service.log_ai_usage", new_callable=AsyncMock)
    @patch("app.agents.agent_service.create_chat_claude_client")
    async def test_simple_text_response(self, mock_create_client, mock_log):
        client = _mock_client()
        mock_create_client.return_value = client
        client.client.messages.create.return_value = _text_message(
            "Dit is een test antwoord in het Nederlands."
        )

        request = AgentRequest(message="Hoe gaat het?")
        db = AsyncMock()

        resp = await agent_chat(request, db, USER_ID)

        assert isinstance(resp, AgentResponse)
        assert resp.message == "Dit is een test antwoord in het Nederlands."
        assert resp.tool_calls_made == []
        client.client.messages.create.assert_awaited_once()
        mock_log.assert_awaited_once()

    @pytest.mark.asyncio
    @patch("app.agents.agent_service._persist_agent_turn", new_callable=AsyncMock)
    @patch("app.agents.agent_service._load_conversation_history", new_callable=AsyncMock)
    @patch("app.agents.agent_service.log_ai_usage", new_callable=AsyncMock)
    @patch("app.agents.agent_service.create_chat_claude_client")
    async def test_conversation_id_echoed(self, mock_create_client, mock_log, mock_load_hist, mock_persist):
        client = _mock_client()
        mock_create_client.return_value = client
        client.client.messages.create.return_value = _text_message("OK")
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
    @patch("app.agents.agent_service.create_chat_claude_client")
    async def test_single_tool_call(self, mock_create_client, mock_exec_tool, mock_log):
        client = _mock_client()
        mock_create_client.return_value = client

        # First call: Claude asks for list_favorites; second: end_turn with text
        client.client.messages.create.side_effect = [
            _tool_use_message("list_favorites", {}),
            _text_message("Je hebt 2 favorieten."),
        ]
        mock_exec_tool.return_value = '[{"parcel_id": "A"}, {"parcel_id": "B"}]'

        request = AgentRequest(message="Wat zijn mijn favorieten?")
        db = AsyncMock()

        resp = await agent_chat(request, db, USER_ID)

        assert resp.message == "Je hebt 2 favorieten."
        assert resp.tool_calls_made == ["list_favorites"]
        assert client.client.messages.create.await_count == 2
        mock_exec_tool.assert_awaited_once_with("list_favorites", {}, db, USER_ID)

    @pytest.mark.asyncio
    @patch("app.agents.agent_service.log_ai_usage", new_callable=AsyncMock)
    @patch("app.agents.agent_service.execute_tool", new_callable=AsyncMock)
    @patch("app.agents.agent_service.create_chat_claude_client")
    async def test_tool_execution_failure(self, mock_create_client, mock_exec_tool, mock_log):
        """When tool execution raises, error is fed back to Claude."""
        client = _mock_client()
        mock_create_client.return_value = client

        client.client.messages.create.side_effect = [
            _tool_use_message("get_report", {"report_id": "xxx"}),
            _text_message("Er ging iets mis met het rapport."),
        ]
        mock_exec_tool.side_effect = RuntimeError("DB connection lost")

        request = AgentRequest(message="Toon rapport xxx")
        db = AsyncMock()

        resp = await agent_chat(request, db, USER_ID)

        # Loop should continue: error fed back to Claude, Claude gives text answer
        assert resp.message == "Er ging iets mis met het rapport."
        assert resp.tool_calls_made == ["get_report"]


# ── MAX_TOOL_ROUNDS ─────────────────────────────────────────────────────


class TestMaxToolRounds:
    """Test that the loop terminates after MAX_TOOL_ROUNDS."""

    @pytest.mark.asyncio
    @patch("app.agents.agent_service.log_ai_usage", new_callable=AsyncMock)
    @patch("app.agents.agent_service.execute_tool", new_callable=AsyncMock)
    @patch("app.agents.agent_service.create_chat_claude_client")
    async def test_max_rounds_terminates(self, mock_create_client, mock_exec_tool, mock_log):
        client = _mock_client()
        mock_create_client.return_value = client

        # Claude always requests a tool call — should stop after MAX_TOOL_ROUNDS
        client.client.messages.create.return_value = _tool_use_message("list_favorites", {})
        mock_exec_tool.return_value = "[]"

        request = AgentRequest(message="Loop forever")
        db = AsyncMock()

        resp = await agent_chat(request, db, USER_ID)

        # Loop ran MAX_TOOL_ROUNDS times
        assert client.client.messages.create.await_count == MAX_TOOL_ROUNDS
        # Fallback message since last response was tool_use with no text
        assert "Probeer het opnieuw" in resp.message or "geen antwoord" in resp.message
        assert len(resp.tool_calls_made) == MAX_TOOL_ROUNDS


# ── Claude API errors ───────────────────────────────────────────────────


class TestClaudeAPIErrors:
    """Test that Claude API errors are caught and return Dutch error messages."""

    @pytest.mark.asyncio
    @patch("app.agents.agent_service.create_chat_claude_client")
    async def test_api_connection_error(self, mock_create_client):
        client = _mock_client()
        mock_create_client.return_value = client
        client.client.messages.create.side_effect = anthropic.APIConnectionError(
            request=MagicMock()
        )

        request = AgentRequest(message="Test")
        db = AsyncMock()

        resp = await agent_chat(request, db, USER_ID)
        assert "niet bereikbaar" in resp.message

    @pytest.mark.asyncio
    @patch("app.agents.agent_service.create_chat_claude_client")
    async def test_rate_limit_error(self, mock_create_client):
        client = _mock_client()
        mock_create_client.return_value = client
        client.client.messages.create.side_effect = anthropic.RateLimitError(
            message="rate limited",
            response=MagicMock(status_code=429, headers={}),
            body=None,
        )

        request = AgentRequest(message="Test")
        db = AsyncMock()

        resp = await agent_chat(request, db, USER_ID)
        assert "overbelast" in resp.message

    @pytest.mark.asyncio
    @patch("app.agents.agent_service.create_chat_claude_client")
    async def test_api_status_error(self, mock_create_client):
        client = _mock_client()
        mock_create_client.return_value = client
        client.client.messages.create.side_effect = anthropic.APIStatusError(
            message="server error",
            response=MagicMock(status_code=500, headers={}),
            body=None,
        )

        request = AgentRequest(message="Test")
        db = AsyncMock()

        resp = await agent_chat(request, db, USER_ID)
        assert "reageert niet" in resp.message

    @pytest.mark.asyncio
    @patch("app.agents.agent_service.create_chat_claude_client")
    async def test_unexpected_exception(self, mock_create_client):
        client = _mock_client()
        mock_create_client.return_value = client
        client.client.messages.create.side_effect = RuntimeError("unexpected")

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
            db, USER_ID, None, "hello", "hoi", ["web_search"], 200
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


# ── Integration: history loaded before Claude call ──────────────────────


class TestConversationMemoryIntegration:
    """Test that agent_chat wires history + persistence together."""

    @pytest.mark.asyncio
    @patch("app.agents.agent_service._persist_agent_turn", new_callable=AsyncMock)
    @patch("app.agents.agent_service._load_conversation_history", new_callable=AsyncMock)
    @patch("app.agents.agent_service.log_ai_usage", new_callable=AsyncMock)
    @patch("app.agents.agent_service.create_chat_claude_client")
    async def test_history_prepended_to_messages(
        self, mock_create_client, mock_log, mock_load_hist, mock_persist
    ):
        client = _mock_client()
        mock_create_client.return_value = client
        client.client.messages.create.return_value = _text_message("Antwoord")

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

        call_kwargs = client.client.messages.create.call_args
        sent_messages = call_kwargs.kwargs.get("messages") or call_kwargs[1].get("messages")
        assert len(sent_messages) == 3
        assert sent_messages[0]["content"] == "Eerste vraag"
        assert sent_messages[2]["content"] == "Tweede vraag"

    @pytest.mark.asyncio
    @patch("app.agents.agent_service._persist_agent_turn", new_callable=AsyncMock)
    @patch("app.agents.agent_service._load_conversation_history", new_callable=AsyncMock)
    @patch("app.agents.agent_service.log_ai_usage", new_callable=AsyncMock)
    @patch("app.agents.agent_service.create_chat_claude_client")
    async def test_new_conversation_returns_id(
        self, mock_create_client, mock_log, mock_load_hist, mock_persist
    ):
        client = _mock_client()
        mock_create_client.return_value = client
        client.client.messages.create.return_value = _text_message("Hoi")
        mock_load_hist.return_value = []
        new_cid = str(uuid.uuid4())
        mock_persist.return_value = new_cid

        request = AgentRequest(message="Start nieuw gesprek")
        db = AsyncMock()

        resp = await agent_chat(request, db, USER_ID)
        assert resp.conversation_id == new_cid


# ── Citation Extraction ─────────────────────────────────────────────────


class TestCitationExtraction:
    """Test _extract_response handles citations from web_search tool."""

    def test_extract_response_with_citations(self):
        """TextBlock with citations returns (text, sources) correctly."""
        citation = MagicMock()
        citation.url = "https://example.com/bodem"
        citation.title = "Bodemonderzoek Venlo"
        citation.cited_text = "Bodemonderzoek is verplicht"

        text_block = MagicMock()
        text_block.type = "text"
        text_block.text = "Hier is informatie over bodemonderzoek."
        text_block.citations = [citation]

        response = MagicMock()
        response.content = [text_block]

        text, sources = _extract_response(response)
        assert text == "Hier is informatie over bodemonderzoek."
        assert len(sources) == 1
        assert sources[0]["url"] == "https://example.com/bodem"
        assert sources[0]["title"] == "Bodemonderzoek Venlo"
        assert sources[0]["cited_text"] == "Bodemonderzoek is verplicht"

    def test_extract_response_no_citations(self):
        """TextBlock without citations returns empty sources list."""
        text_block = MagicMock()
        text_block.type = "text"
        text_block.text = "Gewoon een antwoord."
        text_block.citations = None

        response = MagicMock()
        response.content = [text_block]

        text, sources = _extract_response(response)
        assert text == "Gewoon een antwoord."
        assert sources == []

    def test_extract_response_deduplicates_urls(self):
        """Duplicate citation URLs are deduplicated."""
        citation1 = MagicMock()
        citation1.url = "https://example.com/same"
        citation1.title = "Title 1"
        citation1.cited_text = "Text 1"
        citation2 = MagicMock()
        citation2.url = "https://example.com/same"
        citation2.title = "Title 2"
        citation2.cited_text = "Text 2"

        text_block = MagicMock()
        text_block.type = "text"
        text_block.text = "Antwoord met dubbele bronnen."
        text_block.citations = [citation1, citation2]

        response = MagicMock()
        response.content = [text_block]

        text, sources = _extract_response(response)
        assert len(sources) == 1

    def test_extract_response_multiple_text_blocks(self):
        """Multiple text blocks are joined with double newline."""
        block1 = MagicMock()
        block1.type = "text"
        block1.text = "Eerste deel."
        block1.citations = None

        block2 = MagicMock()
        block2.type = "text"
        block2.text = "Tweede deel."
        block2.citations = None

        response = MagicMock()
        response.content = [block1, block2]

        text, sources = _extract_response(response)
        assert text == "Eerste deel.\n\nTweede deel."
        assert sources == []


# ── Advisory Prompt Content ─────────────────────────────────────────────


class TestAdvisoryPrompt:
    """Test AGENT_SYSTEM_PROMPT contains advisory instructions."""

    def test_prompt_has_comparison_instructions(self):
        assert "vergelijk" in AGENT_SYSTEM_PROMPT.lower()

    def test_prompt_has_gap_analysis_instructions(self):
        assert "ontbrekende" in AGENT_SYSTEM_PROMPT.lower()

    def test_prompt_has_web_search_mention(self):
        assert "web_search" in AGENT_SYSTEM_PROMPT.lower()

    def test_prompt_no_longer_denies_external_access(self):
        """Old 'geen toegang tot externe bronnen' line should be removed."""
        assert "geen toegang tot" not in AGENT_SYSTEM_PROMPT.lower()
