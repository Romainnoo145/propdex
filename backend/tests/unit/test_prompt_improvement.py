"""Unit tests for prompt improvement analysis in eval_service."""

import json
import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.admin.eval_service import analyze_failing_prompts
from app.models.chat_conversation import ChatConversation
from app.models.chat_message import ChatMessage


pytestmark = pytest.mark.anyio


def _make_failing_conversation(
    user_id: uuid.UUID | None = None,
    messages: list[tuple[str, str]] | None = None,
) -> ChatConversation:
    """Build an in-memory ChatConversation with eval_pass=false and messages."""
    conv = ChatConversation(
        user_id=user_id,
        started_at=datetime.now(timezone.utc) - timedelta(hours=1),
        last_message_at=datetime.now(timezone.utc),
        message_count=len(messages) if messages else 0,
        metadata_={
            "eval_scores": {
                "conversation_completeness": 0.3,
                "turn_relevancy": 0.2,
                "role_adherence": 0.4,
            },
            "eval_pass": False,
            "eval_at": datetime.now(timezone.utc).isoformat(),
        },
    )
    if messages:
        conv.messages = [
            ChatMessage(
                conversation_id=conv.id,
                role=role,
                content=content,
                created_at=datetime.now(timezone.utc) + timedelta(seconds=i),
            )
            for i, (role, content) in enumerate(messages)
        ]
    else:
        conv.messages = []
    return conv


def _mock_claude_response(suggestions_json: dict) -> MagicMock:
    """Build a mock Claude API response with given JSON payload."""
    text_block = MagicMock()
    text_block.type = "text"
    text_block.text = json.dumps(suggestions_json, ensure_ascii=False)

    response = MagicMock()
    response.content = [text_block]
    response.usage = MagicMock(input_tokens=100, output_tokens=200)
    return response


# ── Happy path: Claude returns valid suggestions ─────────────────────


async def test_happy_path_returns_structured_suggestions(
    test_db: AsyncSession, create_test_user
):
    """Mock Claude returning valid JSON suggestions → structured output with suggestions."""
    user, _ = await create_test_user(email="improve_happy@example.com", password="Pass123!")

    # Create a failing conversation with messages
    conv = ChatConversation(
        user_id=user.id,
        message_count=2,
        last_message_at=datetime.now(timezone.utc),
        metadata_={
            "eval_scores": {"conversation_completeness": 0.3},
            "eval_pass": False,
        },
    )
    test_db.add(conv)
    await test_db.flush()
    test_db.add_all([
        ChatMessage(conversation_id=conv.id, role="user", content="Wat kost een huis?"),
        ChatMessage(
            conversation_id=conv.id, role="assistant", content="Dat weet ik niet."
        ),
    ])
    await test_db.commit()

    suggestions_payload = {
        "suggestions": [
            {
                "category": "intent_classification",
                "description": "Prijs-gerelateerde vragen worden niet correct als UNSUPPORTED geclassificeerd",
                "current_weakness": "De prompt mist expliciete voorbeelden van prijsvragen",
                "suggested_improvement": "Voeg een voorbeeld toe: 'Wat kost een huis?' → UNSUPPORTED",
            }
        ]
    }

    mock_response = _mock_claude_response(suggestions_payload)
    mock_client = MagicMock()
    mock_client.client.messages.create = AsyncMock(return_value=mock_response)
    mock_client.model = "claude-test"

    with (
        patch("app.ai.claude_client.create_chat_claude_client", return_value=mock_client),
        patch("app.ai.usage_logger.log_ai_usage", new_callable=AsyncMock),
    ):
        result = await analyze_failing_prompts(test_db, limit=10)

    assert result["analyzed_count"] == 1
    assert result["prompt_analyzed"] == "CHAT_INTENT_CLASSIFIER_PROMPT"
    assert len(result["suggestions"]) == 1
    assert result["suggestions"][0]["category"] == "intent_classification"
    assert "error" not in result


# ── No failing conversations → empty suggestions ────────────────────


async def test_no_failing_conversations_returns_empty(
    test_db: AsyncSession, create_test_user
):
    """No conversations with eval_pass=false → empty suggestions, no Claude call."""
    user, _ = await create_test_user(email="improve_empty@example.com", password="Pass123!")

    # Create a passing conversation
    conv = ChatConversation(
        user_id=user.id,
        message_count=2,
        last_message_at=datetime.now(timezone.utc),
        metadata_={
            "eval_scores": {"conversation_completeness": 0.9},
            "eval_pass": True,
        },
    )
    test_db.add(conv)
    await test_db.commit()

    result = await analyze_failing_prompts(test_db, limit=10)

    assert result["analyzed_count"] == 0
    assert result["suggestions"] == []
    assert result["prompt_analyzed"] == "CHAT_INTENT_CLASSIFIER_PROMPT"


# ── Claude API error → graceful error return ─────────────────────────


async def test_claude_api_error_returns_error_gracefully(
    test_db: AsyncSession, create_test_user
):
    """Claude API failure → returns error dict, doesn't crash."""
    user, _ = await create_test_user(email="improve_err@example.com", password="Pass123!")

    conv = ChatConversation(
        user_id=user.id,
        message_count=2,
        last_message_at=datetime.now(timezone.utc),
        metadata_={
            "eval_scores": {"conversation_completeness": 0.2},
            "eval_pass": False,
        },
    )
    test_db.add(conv)
    await test_db.flush()
    test_db.add_all([
        ChatMessage(conversation_id=conv.id, role="user", content="Hallo"),
        ChatMessage(conversation_id=conv.id, role="assistant", content="Hoi"),
    ])
    await test_db.commit()

    mock_client = MagicMock()
    mock_client.client.messages.create = AsyncMock(
        side_effect=Exception("API connection failed")
    )
    mock_client.model = "claude-test"

    with patch(
        "app.ai.claude_client.create_chat_claude_client", return_value=mock_client
    ):
        result = await analyze_failing_prompts(test_db, limit=10)

    assert "error" in result
    assert result["suggestions"] == []
    assert result["analyzed_count"] == 1


# ── Conversation with missing/empty messages → handled gracefully ────


async def test_conversation_with_no_messages_handled(
    test_db: AsyncSession, create_test_user
):
    """Failing conversation with zero messages → skipped, no crash."""
    user, _ = await create_test_user(email="improve_nomsg@example.com", password="Pass123!")

    conv = ChatConversation(
        user_id=user.id,
        message_count=0,
        last_message_at=datetime.now(timezone.utc),
        metadata_={
            "eval_scores": {"conversation_completeness": 0.1},
            "eval_pass": False,
        },
    )
    test_db.add(conv)
    await test_db.commit()

    result = await analyze_failing_prompts(test_db, limit=10)

    # Conversation has no messages, so transcript is empty → returns empty
    assert result["analyzed_count"] == 0
    assert result["suggestions"] == []


# ── Malformed Claude JSON response → error returned ──────────────────


async def test_malformed_claude_json_returns_error(
    test_db: AsyncSession, create_test_user
):
    """Claude returns invalid JSON → returns error dict gracefully."""
    user, _ = await create_test_user(email="improve_bad@example.com", password="Pass123!")

    conv = ChatConversation(
        user_id=user.id,
        message_count=2,
        last_message_at=datetime.now(timezone.utc),
        metadata_={
            "eval_scores": {"conversation_completeness": 0.2},
            "eval_pass": False,
        },
    )
    test_db.add(conv)
    await test_db.flush()
    test_db.add_all([
        ChatMessage(conversation_id=conv.id, role="user", content="Test"),
        ChatMessage(conversation_id=conv.id, role="assistant", content="Reply"),
    ])
    await test_db.commit()

    # Return invalid JSON from Claude
    text_block = MagicMock()
    text_block.type = "text"
    text_block.text = "This is not valid JSON {{{}"

    mock_response = MagicMock()
    mock_response.content = [text_block]
    mock_response.usage = MagicMock(input_tokens=50, output_tokens=10)

    mock_client = MagicMock()
    mock_client.client.messages.create = AsyncMock(return_value=mock_response)
    mock_client.model = "claude-test"

    with (
        patch("app.ai.claude_client.create_chat_claude_client", return_value=mock_client),
        patch("app.ai.usage_logger.log_ai_usage", new_callable=AsyncMock),
    ):
        result = await analyze_failing_prompts(test_db, limit=10)

    assert "error" in result
    assert "parse" in result["error"].lower() or "json" in result["error"].lower()
    assert result["suggestions"] == []
