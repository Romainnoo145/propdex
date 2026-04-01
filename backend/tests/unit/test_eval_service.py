"""Unit tests for eval_service with mocked DeepEval metrics."""

import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.admin.eval_service import evaluate_conversations
from app.models.chat_conversation import ChatConversation
from app.models.chat_message import ChatMessage


pytestmark = pytest.mark.anyio


def _make_conversation(
    user_id: uuid.UUID | None = None,
    messages: list[tuple[str, str]] | None = None,
    metadata_: dict | None = None,
) -> ChatConversation:
    """Build an in-memory ChatConversation with messages attached."""
    conv = ChatConversation(
        user_id=user_id,
        started_at=datetime.now(timezone.utc) - timedelta(hours=1),
        last_message_at=datetime.now(timezone.utc),
        message_count=len(messages) if messages else 0,
        metadata_=metadata_,
    )
    # Populate .messages relationship in-memory
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


def _mock_metric(score: float = 0.8):
    """Return a mock metric whose .measure() sets .score."""
    m = MagicMock()
    m.score = score

    def _measure(test_case):
        m.score = score
        return score

    m.measure = _measure
    return m


def _mock_metric_raising():
    """Return a mock metric whose .measure() raises ValueError."""
    m = MagicMock()
    m.score = None
    m.measure.side_effect = ValueError("API error")
    return m


# ── Happy path ──────────────────────────────────────────────────────


async def test_evaluate_two_conversations_both_pass(test_db: AsyncSession, create_test_user):
    """Two conversations with passing scores → both evaluated, summary correct."""
    user, _ = await create_test_user(email="eval_unit@example.com", password="Pass123!")

    # Create conversations with messages
    for i in range(2):
        conv = ChatConversation(
            user_id=user.id,
            message_count=2,
            last_message_at=datetime.now(timezone.utc),
        )
        test_db.add(conv)
        await test_db.flush()
        test_db.add_all([
            ChatMessage(conversation_id=conv.id, role="user", content=f"Hello {i}"),
            ChatMessage(conversation_id=conv.id, role="assistant", content=f"Hi there {i}!"),
        ])
    await test_db.commit()

    mock_completeness = _mock_metric(0.9)
    mock_relevancy = _mock_metric(0.8)
    mock_adherence = _mock_metric(0.7)

    with (
        patch(
            "app.admin.eval_service._run_metrics_sync",
            return_value={
                "conversation_completeness": 0.9,
                "turn_relevancy": 0.8,
                "role_adherence": 0.7,
            },
        ) as mock_run,
    ):
        result = await evaluate_conversations(test_db, days_back=7, limit=20)

    assert result["total"] == 2
    assert result["passed"] == 2
    assert result["failed"] == 0
    assert result["errors"] == 0
    assert len(result["results"]) == 2

    for r in result["results"]:
        assert r["status"] == "evaluated"
        assert r["eval_pass"] is True
        assert r["scores"]["conversation_completeness"] == 0.9


# ── Partial failure ─────────────────────────────────────────────────


async def test_evaluate_one_fails_other_succeeds(test_db: AsyncSession, create_test_user):
    """One conversation raises exception during eval, other succeeds."""
    user, _ = await create_test_user(email="eval_partial@example.com", password="Pass123!")

    for i in range(2):
        conv = ChatConversation(
            user_id=user.id,
            message_count=2,
            last_message_at=datetime.now(timezone.utc),
        )
        test_db.add(conv)
        await test_db.flush()
        test_db.add_all([
            ChatMessage(conversation_id=conv.id, role="user", content=f"Q{i}"),
            ChatMessage(conversation_id=conv.id, role="assistant", content=f"A{i}"),
        ])
    await test_db.commit()

    call_count = 0

    def _side_effect(messages):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            raise RuntimeError("DeepEval blew up")
        return {
            "conversation_completeness": 0.6,
            "turn_relevancy": 0.7,
            "role_adherence": 0.8,
        }

    with patch("app.admin.eval_service._run_metrics_sync", side_effect=_side_effect):
        result = await evaluate_conversations(test_db, days_back=7, limit=20)

    assert result["total"] == 2
    assert result["errors"] == 1
    assert result["passed"] == 1


# ── Empty conversations ─────────────────────────────────────────────


async def test_evaluate_no_conversations_in_range(test_db: AsyncSession, create_test_user):
    """No conversations in the date range → empty results."""
    user, _ = await create_test_user(email="eval_empty@example.com", password="Pass123!")

    # Create old conversation outside window
    conv = ChatConversation(
        user_id=user.id,
        message_count=2,
        last_message_at=datetime.now(timezone.utc) - timedelta(days=30),
    )
    test_db.add(conv)
    await test_db.commit()

    result = await evaluate_conversations(test_db, days_back=7, limit=20)
    assert result["total"] == 0
    assert result["results"] == []


# ── Conversation with no messages: skipped gracefully ────────────────


async def test_evaluate_conversation_no_messages_skipped(
    test_db: AsyncSession, create_test_user
):
    """Conversation with 0 messages is skipped."""
    user, _ = await create_test_user(email="eval_nomsg@example.com", password="Pass123!")

    conv = ChatConversation(
        user_id=user.id,
        message_count=0,
        last_message_at=datetime.now(timezone.utc),
    )
    test_db.add(conv)
    await test_db.commit()

    result = await evaluate_conversations(test_db, days_back=7, limit=20)
    assert result["total"] == 1
    assert result["results"][0]["status"] == "skipped"
    assert result["results"][0]["reason"] == "fewer than 2 messages"


# ── Conversation with only user messages: skipped ────────────────────


async def test_evaluate_conversation_only_user_messages_skipped(
    test_db: AsyncSession, create_test_user
):
    """Conversation with only user turns (no assistant) is skipped."""
    user, _ = await create_test_user(email="eval_onlyuser@example.com", password="Pass123!")

    conv = ChatConversation(
        user_id=user.id,
        message_count=2,
        last_message_at=datetime.now(timezone.utc),
    )
    test_db.add(conv)
    await test_db.flush()
    test_db.add_all([
        ChatMessage(conversation_id=conv.id, role="user", content="Hello"),
        ChatMessage(conversation_id=conv.id, role="user", content="Anyone there?"),
    ])
    await test_db.commit()

    result = await evaluate_conversations(test_db, days_back=7, limit=20)
    assert result["total"] == 1
    assert result["results"][0]["status"] == "skipped"
    assert result["results"][0]["reason"] == "no assistant turns"


# ── Boundary: days_back=0 and limit=0 ───────────────────────────────


async def test_evaluate_days_back_zero(test_db: AsyncSession, create_test_user):
    """days_back=0 returns empty results (guard clause)."""
    result = await evaluate_conversations(test_db, days_back=0, limit=20)
    assert result["total"] == 0


async def test_evaluate_limit_zero(test_db: AsyncSession, create_test_user):
    """limit=0 returns empty results (guard clause)."""
    result = await evaluate_conversations(test_db, days_back=7, limit=0)
    assert result["total"] == 0
