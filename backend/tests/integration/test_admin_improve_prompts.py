"""Integration tests for POST /api/admin/improve-prompts endpoint (auth gates + happy path)."""

import json
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import AsyncClient

from app.models.chat_conversation import ChatConversation
from app.models.chat_message import ChatMessage


pytestmark = pytest.mark.anyio


async def _get_auth_token(client: AsyncClient, email: str, password: str) -> str:
    """Log in and return the access_token."""
    resp = await client.post("/auth/login", json={"email": email, "password": password})
    assert resp.status_code == 200, f"Login failed: {resp.text}"
    return resp.json()["access_token"]


# ── Auth gate: 401 without token ─────────────────────────────────────


async def test_improve_prompts_returns_401_without_auth(async_client: AsyncClient):
    """POST /api/admin/improve-prompts without token → 401."""
    resp = await async_client.post("/api/admin/improve-prompts")
    assert resp.status_code == 401


# ── Auth gate: 403 for non-superuser ─────────────────────────────────


async def test_improve_prompts_returns_403_for_non_superuser(
    async_client: AsyncClient, create_test_user
):
    """Normal user gets 403 on improve-prompts."""
    await create_test_user(email="normal_improve@example.com", password="NormalPass123!")
    token = await _get_auth_token(
        async_client, "normal_improve@example.com", "NormalPass123!"
    )

    resp = await async_client.post(
        "/api/admin/improve-prompts",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 403
    assert resp.json()["detail"] == "Superuser access required"


# ── 200 with empty results (no failing conversations) ────────────────


async def test_improve_prompts_returns_empty_when_no_failures(
    async_client: AsyncClient, create_test_user
):
    """Superuser gets 200 with empty suggestions when no failing conversations exist."""
    await create_test_user(
        email="admin_nofail@example.com", password="AdminPass123!", is_superuser=True
    )
    token = await _get_auth_token(
        async_client, "admin_nofail@example.com", "AdminPass123!"
    )

    resp = await async_client.post(
        "/api/admin/improve-prompts",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["suggestions"] == []
    assert data["analyzed_count"] == 0
    assert data["prompt_analyzed"] == "CHAT_INTENT_CLASSIFIER_PROMPT"


# ── 200 with failing conversations (mock Claude at service level) ────


async def test_improve_prompts_returns_suggestions_with_failing_convs(
    async_client: AsyncClient, create_test_user, test_db
):
    """Superuser gets suggestions when failing conversations exist (Claude mocked)."""
    user, _ = await create_test_user(
        email="admin_improve@example.com", password="AdminPass123!", is_superuser=True
    )
    token = await _get_auth_token(
        async_client, "admin_improve@example.com", "AdminPass123!"
    )

    # Create a failing conversation
    conv = ChatConversation(
        user_id=user.id,
        message_count=2,
        last_message_at=datetime.now(timezone.utc),
        metadata_={
            "eval_scores": {"conversation_completeness": 0.2, "turn_relevancy": 0.3},
            "eval_pass": False,
        },
    )
    test_db.add(conv)
    await test_db.flush()
    test_db.add_all([
        ChatMessage(
            conversation_id=conv.id, role="user", content="Wat kost een huis in Utrecht?"
        ),
        ChatMessage(
            conversation_id=conv.id,
            role="assistant",
            content="Ik kan helaas geen prijsinformatie geven.",
        ),
    ])
    await test_db.commit()

    # Mock Claude response at service level
    suggestions_payload = {
        "suggestions": [
            {
                "category": "edge_case",
                "description": "Prijsvragen worden niet goed afgehandeld",
                "current_weakness": "Geen expliciet voorbeeld voor prijsvragen",
                "suggested_improvement": "Voeg voorbeeld toe voor prijsgerelateerde vragen",
            }
        ]
    }

    text_block = MagicMock()
    text_block.type = "text"
    text_block.text = json.dumps(suggestions_payload, ensure_ascii=False)

    mock_response = MagicMock()
    mock_response.content = [text_block]
    mock_response.usage = MagicMock(input_tokens=500, output_tokens=300)

    mock_client = MagicMock()
    mock_client.client.messages.create = AsyncMock(return_value=mock_response)
    mock_client.model = "claude-test"

    with (
        patch(
            "app.ai.claude_client.create_chat_claude_client",
            return_value=mock_client,
        ),
        patch("app.ai.usage_logger.log_ai_usage", new_callable=AsyncMock),
    ):
        resp = await async_client.post(
            "/api/admin/improve-prompts",
            headers={"Authorization": f"Bearer {token}"},
        )

    assert resp.status_code == 200
    data = resp.json()
    assert data["analyzed_count"] == 1
    assert len(data["suggestions"]) == 1
    assert data["suggestions"][0]["category"] == "edge_case"
    assert data["prompt_analyzed"] == "CHAT_INTENT_CLASSIFIER_PROMPT"
