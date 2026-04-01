"""Integration tests for admin eval endpoints (auth gates + eval-results)."""

import uuid
from datetime import datetime, timezone

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


# ── Auth gate: POST /api/admin/eval-chats ────────────────────────────


async def test_eval_chats_returns_401_without_auth(async_client: AsyncClient):
    """POST /api/admin/eval-chats without token → 401."""
    resp = await async_client.post("/api/admin/eval-chats")
    assert resp.status_code == 401


async def test_eval_chats_returns_403_for_non_superuser(
    async_client: AsyncClient, create_test_user
):
    """Normal user gets 403 on eval-chats."""
    await create_test_user(email="normal_eval@example.com", password="NormalPass123!")
    token = await _get_auth_token(async_client, "normal_eval@example.com", "NormalPass123!")

    resp = await async_client.post(
        "/api/admin/eval-chats",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 403
    assert resp.json()["detail"] == "Superuser access required"


# ── Auth gate: GET /api/admin/eval-results ───────────────────────────


async def test_eval_results_returns_401_without_auth(async_client: AsyncClient):
    """GET /api/admin/eval-results without token → 401."""
    resp = await async_client.get("/api/admin/eval-results")
    assert resp.status_code == 401


async def test_eval_results_returns_403_for_non_superuser(
    async_client: AsyncClient, create_test_user
):
    """Normal user gets 403 on eval-results."""
    await create_test_user(email="normal_res@example.com", password="NormalPass123!")
    token = await _get_auth_token(async_client, "normal_res@example.com", "NormalPass123!")

    resp = await async_client.get(
        "/api/admin/eval-results",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 403
    assert resp.json()["detail"] == "Superuser access required"


# ── Happy path: GET /api/admin/eval-results ──────────────────────────


async def test_eval_results_returns_empty_list_when_no_evals(
    async_client: AsyncClient, create_test_user
):
    """Superuser gets empty list when no conversations have eval_scores."""
    await create_test_user(
        email="admin_noevals@example.com", password="AdminPass123!", is_superuser=True
    )
    token = await _get_auth_token(async_client, "admin_noevals@example.com", "AdminPass123!")

    resp = await async_client.get(
        "/api/admin/eval-results",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    assert resp.json() == []


async def test_eval_results_returns_conversations_with_eval_scores(
    async_client: AsyncClient, create_test_user, test_db
):
    """Conversations with eval_scores in metadata appear in results."""
    user, _ = await create_test_user(
        email="admin_witheval@example.com", password="AdminPass123!", is_superuser=True
    )
    token = await _get_auth_token(async_client, "admin_witheval@example.com", "AdminPass123!")

    # Conversation WITH eval scores
    conv_eval = ChatConversation(
        user_id=user.id,
        message_count=2,
        metadata_={
            "eval_scores": {
                "conversation_completeness": 0.9,
                "turn_relevancy": 0.8,
                "role_adherence": 0.7,
            },
            "eval_pass": True,
            "eval_at": "2025-01-01T00:00:00+00:00",
        },
    )
    # Conversation WITHOUT eval scores
    conv_no_eval = ChatConversation(
        user_id=user.id,
        message_count=1,
        metadata_={"some_other_key": "value"},
    )
    # Conversation with no metadata at all
    conv_null = ChatConversation(
        user_id=user.id,
        message_count=0,
    )
    test_db.add_all([conv_eval, conv_no_eval, conv_null])
    await test_db.commit()

    resp = await async_client.get(
        "/api/admin/eval-results",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    item = data[0]
    assert item["id"] == str(conv_eval.id)
    assert item["eval_pass"] is True
    assert item["eval_scores"]["conversation_completeness"] == 0.9
    assert item["eval_at"] == "2025-01-01T00:00:00+00:00"
