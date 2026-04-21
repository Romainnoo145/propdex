"""Mocks for Anthropic tool-use tests (M047/S04).

Pattern: build a MagicMock spec'd on anthropic.types.Message, with content=[
ToolUseBlock(type='tool_use', name=..., input={...})]. The unittest instantiates
an AsyncAnthropic-mock and configures messages.create.return_value.
"""

from typing import Any
from unittest.mock import AsyncMock, MagicMock


def make_tool_use_response(
    *,
    tool_name: str,
    tool_input: dict[str, Any],
    tool_use_id: str = "toolu_test_01",
    usage_input_tokens: int = 100,
    usage_output_tokens: int = 50,
    usage_cache_read_input_tokens: int = 0,
    usage_cache_creation_input_tokens: int = 0,
) -> MagicMock:
    """Build a mocked Claude response with 1 tool_use block."""
    tool_use_block = MagicMock()
    tool_use_block.type = "tool_use"
    tool_use_block.name = tool_name
    tool_use_block.input = tool_input
    tool_use_block.id = tool_use_id

    usage = MagicMock()
    usage.input_tokens = usage_input_tokens
    usage.output_tokens = usage_output_tokens
    usage.cache_read_input_tokens = usage_cache_read_input_tokens
    usage.cache_creation_input_tokens = usage_cache_creation_input_tokens

    response = MagicMock()
    response.content = [tool_use_block]
    response.usage = usage
    response.stop_reason = "tool_use"
    return response


def make_empty_response() -> MagicMock:
    """Response with content=[] — should trigger EMPTY_RESPONSE error."""
    response = MagicMock()
    response.content = []
    response.usage = MagicMock(
        input_tokens=50,
        output_tokens=0,
        cache_read_input_tokens=0,
        cache_creation_input_tokens=0,
    )
    response.stop_reason = "end_turn"
    return response


def make_text_only_response(text: str = "Ik kan dit niet analyseren.") -> MagicMock:
    """Response without tool_use block — should trigger NO_TOOL_USE_BLOCK error."""
    text_block = MagicMock()
    text_block.type = "text"
    text_block.text = text

    response = MagicMock()
    response.content = [text_block]
    response.usage = MagicMock(
        input_tokens=80,
        output_tokens=30,
        cache_read_input_tokens=0,
        cache_creation_input_tokens=0,
    )
    response.stop_reason = "end_turn"
    return response


def make_mock_anthropic_client(messages_create_return: Any) -> AsyncMock:
    """Factory: async-client with messages.create stubbed.

    Usage:
        client = make_mock_anthropic_client(make_tool_use_response(...))
        await extract_factor_live(..., claude_client=client)
        assert client.messages.create.call_count == 1
    """
    client = AsyncMock()
    client.messages = AsyncMock()
    client.messages.create = AsyncMock(return_value=messages_create_return)
    return client
