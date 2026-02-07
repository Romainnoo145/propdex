"""Unit tests for ClaudeClient AI parsing with mocked Anthropic SDK."""

import json
from unittest.mock import AsyncMock, MagicMock

import anthropic
import pytest

from app.ai.claude_client import AIParsingError, ClaudeClient


@pytest.fixture
def mock_claude_client():
    """Mock AsyncAnthropic client with messages.create method."""
    client = MagicMock(spec=anthropic.AsyncAnthropic)
    client.messages = MagicMock()
    client.messages.create = AsyncMock()
    return client


@pytest.fixture
def valid_parsed_json():
    """Valid BestemmingsplanParsed JSON string for testing."""
    return json.dumps({
        "plan_naam": "Bestemmingsplan Centrum",
        "plan_idn": "NL.IMRO.0363.BP2024-VA01",
        "regels": [
            {
                "artikel": "Art 3.1",
                "bestemming": "Wonen",
                "toegestane_gebruiken": ["wonen"],
                "verboden_gebruiken": [],
                "bouwregels": None,
                "parkeereis": None,
                "milieu_restricties": [],
                "bijzondere_voorwaarden": [],
                "confidence": "HIGH",
                "disclaimer": None,
            }
        ],
        "overall_confidence": "HIGH",
        "disclaimers": [],
        "samenvatting": "Test samenvatting",
    })


def make_claude_response(text: str) -> MagicMock:
    """
    Helper to create mock Claude API response.

    Uses MagicMock instead of real Message object to avoid complex constructor requirements.
    """
    mock_response = MagicMock()

    # Create mock text block
    text_block = MagicMock()
    text_block.type = "text"
    text_block.text = text

    mock_response.content = [text_block]
    mock_response.id = "msg_test"
    mock_response.model = "claude-sonnet-4-5-20250929"
    mock_response.role = "assistant"
    mock_response.type = "message"

    return mock_response


class TestParseSuccess:
    """Test successful parsing scenarios."""

    async def test_valid_json_response(self, mock_claude_client, valid_parsed_json):
        """Test parsing with valid JSON response."""
        # Setup mock
        mock_claude_client.messages.create.return_value = make_claude_response(valid_parsed_json)

        # Create client with mocked SDK
        client = ClaudeClient(api_key="test_key")
        client.client = mock_claude_client

        # Execute
        pdf_data = b"%PDF-1.4\ntest content"
        result = await client.parse_bestemmingsplan(pdf_data, "NL.IMRO.0363.BP2024-VA01")

        # Verify
        assert result.plan_idn == "NL.IMRO.0363.BP2024-VA01"
        assert result.plan_naam == "Bestemmingsplan Centrum"
        assert result.overall_confidence == "HIGH"
        assert len(result.regels) == 1
        assert result.regels[0].bestemming == "Wonen"

        # Verify API was called
        mock_claude_client.messages.create.assert_awaited_once()

    async def test_json_wrapped_in_markdown_code_block(self, mock_claude_client, valid_parsed_json):
        """Test parsing with JSON wrapped in ```json markdown block."""
        # Setup mock with markdown-wrapped JSON
        wrapped_json = f"```json\n{valid_parsed_json}\n```"
        mock_claude_client.messages.create.return_value = make_claude_response(wrapped_json)

        # Create client
        client = ClaudeClient(api_key="test_key")
        client.client = mock_claude_client

        # Execute
        result = await client.parse_bestemmingsplan(b"%PDF-1.4", "NL.IMRO.0363.BP2024-VA01")

        # Verify markdown was stripped
        assert result.plan_idn == "NL.IMRO.0363.BP2024-VA01"
        assert result.overall_confidence == "HIGH"

    async def test_json_wrapped_in_plain_code_block(self, mock_claude_client, valid_parsed_json):
        """Test parsing with JSON wrapped in ``` plain code block."""
        # Setup mock with plain code block
        wrapped_json = f"```\n{valid_parsed_json}\n```"
        mock_claude_client.messages.create.return_value = make_claude_response(wrapped_json)

        # Create client
        client = ClaudeClient(api_key="test_key")
        client.client = mock_claude_client

        # Execute
        result = await client.parse_bestemmingsplan(b"%PDF-1.4", "NL.IMRO.0363.BP2024-VA01")

        # Verify parsing succeeded
        assert result.plan_idn == "NL.IMRO.0363.BP2024-VA01"

    async def test_pdf_base64_encoded_in_request(self, mock_claude_client, valid_parsed_json):
        """Test that PDF is base64-encoded in API request."""
        # Setup mock
        mock_claude_client.messages.create.return_value = make_claude_response(valid_parsed_json)

        # Create client
        client = ClaudeClient(api_key="test_key")
        client.client = mock_claude_client

        # Execute with specific PDF data
        pdf_data = b"%PDF-1.4\ntest content"
        await client.parse_bestemmingsplan(pdf_data, "NL.IMRO.0363.BP2024-VA01")

        # Verify messages.create was called
        assert mock_claude_client.messages.create.await_count == 1

        # Inspect call args to verify base64 encoding
        call_args = mock_claude_client.messages.create.call_args
        messages = call_args.kwargs["messages"]

        # Check that message contains document type with base64 data
        user_message = messages[0]
        assert user_message["role"] == "user"

        # Find document content block
        document_block = None
        for block in user_message["content"]:
            if block["type"] == "document":
                document_block = block
                break

        assert document_block is not None
        assert document_block["source"]["type"] == "base64"
        assert document_block["source"]["media_type"] == "application/pdf"
        assert len(document_block["source"]["data"]) > 0

    async def test_multiple_rules_extracted(self, mock_claude_client):
        """Test parsing with multiple zoning rules."""
        # Setup mock with 3 rules
        multi_rule_json = json.dumps({
            "plan_naam": "Bestemmingsplan Multi",
            "plan_idn": "NL.IMRO.0363.BP2024-VA01",
            "regels": [
                {
                    "artikel": "Art 3.1",
                    "bestemming": "Wonen",
                    "toegestane_gebruiken": ["wonen"],
                    "verboden_gebruiken": [],
                    "confidence": "HIGH",
                },
                {
                    "artikel": "Art 3.2",
                    "bestemming": "Gemengd",
                    "toegestane_gebruiken": ["wonen", "kantoor"],
                    "verboden_gebruiken": [],
                    "confidence": "MEDIUM",
                },
                {
                    "artikel": "Art 3.3",
                    "bestemming": "Bedrijf",
                    "toegestane_gebruiken": ["bedrijf"],
                    "verboden_gebruiken": ["horeca"],
                    "confidence": "HIGH",
                },
            ],
            "overall_confidence": "HIGH",
            "disclaimers": [],
            "samenvatting": "Multi-rule test",
        })
        mock_claude_client.messages.create.return_value = make_claude_response(multi_rule_json)

        # Create client
        client = ClaudeClient(api_key="test_key")
        client.client = mock_claude_client

        # Execute
        result = await client.parse_bestemmingsplan(b"%PDF-1.4", "NL.IMRO.0363.BP2024-VA01")

        # Verify multiple rules extracted
        assert len(result.regels) == 3
        assert result.regels[0].bestemming == "Wonen"
        assert result.regels[1].bestemming == "Gemengd"
        assert result.regels[2].bestemming == "Bedrijf"


class TestParseErrors:
    """Test error handling scenarios."""

    async def test_rate_limit_error(self, mock_claude_client):
        """Test rate limit error handling (retriable)."""
        # Mock rate limit error
        mock_response = MagicMock()
        mock_response.status_code = 429

        mock_claude_client.messages.create.side_effect = anthropic.RateLimitError(
            "Rate limit exceeded",
            response=mock_response,
            body={},
        )

        # Create client
        client = ClaudeClient(api_key="test_key")
        client.client = mock_claude_client

        # Execute and verify error
        with pytest.raises(AIParsingError) as exc_info:
            await client.parse_bestemmingsplan(b"%PDF-1.4", "NL.IMRO.0363.BP2024-VA01")

        assert exc_info.value.retriable is True
        assert "rate limit" in exc_info.value.message.lower()

    async def test_connection_error(self, mock_claude_client):
        """Test connection error handling (retriable)."""
        # Mock connection error
        mock_request = MagicMock()
        mock_claude_client.messages.create.side_effect = anthropic.APIConnectionError(
            request=mock_request,
        )

        # Create client
        client = ClaudeClient(api_key="test_key")
        client.client = mock_claude_client

        # Execute and verify error
        with pytest.raises(AIParsingError) as exc_info:
            await client.parse_bestemmingsplan(b"%PDF-1.4", "NL.IMRO.0363.BP2024-VA01")

        assert exc_info.value.retriable is True
        assert "connect" in exc_info.value.message.lower()

    async def test_generic_api_error(self, mock_claude_client):
        """Test generic API error handling (non-retriable)."""
        # Mock generic API error
        mock_request = MagicMock()
        mock_claude_client.messages.create.side_effect = anthropic.APIError(
            "Server error",
            request=mock_request,
            body={},
        )

        # Create client
        client = ClaudeClient(api_key="test_key")
        client.client = mock_claude_client

        # Execute and verify error
        with pytest.raises(AIParsingError) as exc_info:
            await client.parse_bestemmingsplan(b"%PDF-1.4", "NL.IMRO.0363.BP2024-VA01")

        assert exc_info.value.retriable is False
        assert "service error" in exc_info.value.message.lower()

    async def test_empty_response_content(self, mock_claude_client):
        """Test handling of empty response content."""
        # Mock empty response
        mock_response = MagicMock()
        mock_response.content = []
        mock_claude_client.messages.create.return_value = mock_response

        # Create client
        client = ClaudeClient(api_key="test_key")
        client.client = mock_claude_client

        # Execute and verify error
        with pytest.raises(AIParsingError) as exc_info:
            await client.parse_bestemmingsplan(b"%PDF-1.4", "NL.IMRO.0363.BP2024-VA01")

        assert "empty response" in exc_info.value.message.lower()

    async def test_no_text_block(self, mock_claude_client):
        """Test handling of response without text block."""
        # Mock response with non-text block
        mock_response = MagicMock()
        image_block = MagicMock()
        image_block.type = "image"
        mock_response.content = [image_block]
        mock_claude_client.messages.create.return_value = mock_response

        # Create client
        client = ClaudeClient(api_key="test_key")
        client.client = mock_claude_client

        # Execute and verify error
        with pytest.raises(AIParsingError) as exc_info:
            await client.parse_bestemmingsplan(b"%PDF-1.4", "NL.IMRO.0363.BP2024-VA01")

        assert "no text content" in exc_info.value.message.lower()

    async def test_malformed_json(self, mock_claude_client):
        """Test handling of malformed JSON (non-retriable)."""
        # Mock response with invalid JSON
        mock_claude_client.messages.create.return_value = make_claude_response(
            "This is not valid JSON at all"
        )

        # Create client
        client = ClaudeClient(api_key="test_key")
        client.client = mock_claude_client

        # Execute and verify error
        with pytest.raises(AIParsingError) as exc_info:
            await client.parse_bestemmingsplan(b"%PDF-1.4", "NL.IMRO.0363.BP2024-VA01")

        assert exc_info.value.retriable is False
        assert "invalid json" in exc_info.value.message.lower()

    async def test_invalid_schema_json(self, mock_claude_client):
        """Test handling of JSON with invalid schema (non-retriable)."""
        # Mock response with JSON missing required fields
        invalid_json = json.dumps({"plan_naam": "x"})  # Missing required fields
        mock_claude_client.messages.create.return_value = make_claude_response(invalid_json)

        # Create client
        client = ClaudeClient(api_key="test_key")
        client.client = mock_claude_client

        # Execute and verify error
        with pytest.raises(AIParsingError) as exc_info:
            await client.parse_bestemmingsplan(b"%PDF-1.4", "NL.IMRO.0363.BP2024-VA01")

        assert exc_info.value.retriable is False
        assert "invalid json" in exc_info.value.message.lower()
