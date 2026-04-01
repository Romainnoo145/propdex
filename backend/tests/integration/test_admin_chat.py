"""Integration tests for admin chat conversation endpoints."""

import uuid

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


# ── Auth gate tests ──────────────────────────────────────────────────


async def test_chat_conversations_returns_401_without_auth(async_client: AsyncClient):
    """GET /api/admin/chat-conversations without token → 401."""
    resp = await async_client.get("/api/admin/chat-conversations")
    assert resp.status_code == 401


async def test_chat_messages_returns_401_without_auth(async_client: AsyncClient):
    """GET /api/admin/chat-conversations/{id}/messages without token → 401."""
    fake_id = str(uuid.uuid4())
    resp = await async_client.get(f"/api/admin/chat-conversations/{fake_id}/messages")
    assert resp.status_code == 401


async def test_chat_conversations_returns_403_for_non_superuser(
    async_client: AsyncClient, create_test_user
):
    """Normal user gets 403 on chat-conversations endpoint."""
    await create_test_user(email="normal_chat@example.com", password="NormalPass123!")
    token = await _get_auth_token(async_client, "normal_chat@example.com", "NormalPass123!")

    resp = await async_client.get(
        "/api/admin/chat-conversations",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 403
    assert resp.json()["detail"] == "Superuser access required"


async def test_chat_messages_returns_403_for_non_superuser(
    async_client: AsyncClient, create_test_user
):
    """Normal user gets 403 on chat messages endpoint."""
    await create_test_user(email="normal_msg@example.com", password="NormalPass123!")
    token = await _get_auth_token(async_client, "normal_msg@example.com", "NormalPass123!")

    fake_id = str(uuid.uuid4())
    resp = await async_client.get(
        f"/api/admin/chat-conversations/{fake_id}/messages",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 403
    assert resp.json()["detail"] == "Superuser access required"


# ── Happy path tests ─────────────────────────────────────────────────


async def test_chat_conversations_returns_200_empty(
    async_client: AsyncClient, create_test_user
):
    """Superuser gets 200 with empty list when no conversations exist."""
    await create_test_user(
        email="admin_chat@example.com", password="AdminPass123!", is_superuser=True
    )
    token = await _get_auth_token(async_client, "admin_chat@example.com", "AdminPass123!")

    resp = await async_client.get(
        "/api/admin/chat-conversations",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    assert resp.json() == []


async def test_chat_conversations_with_data(
    async_client: AsyncClient, create_test_user, test_db
):
    """Superuser sees conversations with correct structure."""
    user, _ = await create_test_user(
        email="admin_data@example.com", password="AdminPass123!", is_superuser=True
    )
    token = await _get_auth_token(async_client, "admin_data@example.com", "AdminPass123!")

    # Create a conversation with messages
    conv = ChatConversation(user_id=user.id, message_count=2)
    test_db.add(conv)
    await test_db.flush()

    msg1 = ChatMessage(
        conversation_id=conv.id,
        role="user",
        content="Hello",
        tokens_used=10,
    )
    msg2 = ChatMessage(
        conversation_id=conv.id,
        role="assistant",
        content="Hi there!",
        intent="greeting",
        tokens_used=15,
        duration_ms=200,
    )
    test_db.add_all([msg1, msg2])
    await test_db.commit()

    resp = await async_client.get(
        "/api/admin/chat-conversations",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    item = data[0]
    assert item["id"] == str(conv.id)
    assert item["user_id"] == str(user.id)
    assert item["message_count"] == 2
    assert "started_at" in item
    assert "last_message_at" in item
    assert "metadata" in item


async def test_chat_messages_returns_ordered_messages(
    async_client: AsyncClient, create_test_user, test_db
):
    """Messages endpoint returns messages in chronological order with correct fields."""
    user, _ = await create_test_user(
        email="admin_msgs@example.com", password="AdminPass123!", is_superuser=True
    )
    token = await _get_auth_token(async_client, "admin_msgs@example.com", "AdminPass123!")

    conv = ChatConversation(user_id=user.id, message_count=2)
    test_db.add(conv)
    await test_db.flush()

    msg1 = ChatMessage(
        conversation_id=conv.id,
        role="user",
        content="What properties are available?",
        intent="search",
        params={"city": "Amsterdam"},
        tokens_used=20,
    )
    msg2 = ChatMessage(
        conversation_id=conv.id,
        role="assistant",
        content="Here are some properties...",
        intent="search",
        response_data={"results": []},
        tokens_used=50,
        duration_ms=350,
    )
    test_db.add_all([msg1, msg2])
    await test_db.commit()

    resp = await async_client.get(
        f"/api/admin/chat-conversations/{conv.id}/messages",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 2

    # First message is user
    assert data[0]["role"] == "user"
    assert data[0]["content"] == "What properties are available?"
    assert data[0]["intent"] == "search"
    assert data[0]["params"] == {"city": "Amsterdam"}
    assert data[0]["conversation_id"] == str(conv.id)

    # Second message is assistant
    assert data[1]["role"] == "assistant"
    assert data[1]["content"] == "Here are some properties..."
    assert data[1]["tokens_used"] == 50
    assert data[1]["duration_ms"] == 350
    assert data[1]["response_data"] == {"results": []}


# ── 404 test ─────────────────────────────────────────────────────────


async def test_chat_messages_returns_404_for_missing_conversation(
    async_client: AsyncClient, create_test_user
):
    """Non-existent conversation_id returns 404."""
    await create_test_user(
        email="admin_404@example.com", password="AdminPass123!", is_superuser=True
    )
    token = await _get_auth_token(async_client, "admin_404@example.com", "AdminPass123!")

    fake_id = str(uuid.uuid4())
    resp = await async_client.get(
        f"/api/admin/chat-conversations/{fake_id}/messages",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 404
    assert resp.json()["detail"] == "Conversation not found"


# ── Filter / pagination tests ────────────────────────────────────────


async def test_chat_conversations_filters_by_user_id(
    async_client: AsyncClient, create_test_user, test_db
):
    """user_id filter returns only conversations for that user."""
    user1, _ = await create_test_user(
        email="admin_filter@example.com", password="AdminPass123!", is_superuser=True
    )
    token = await _get_auth_token(async_client, "admin_filter@example.com", "AdminPass123!")

    # Create a second user manually (non-superuser, same org)
    from app.auth.password import hash_password
    from app.models.user import User

    user2 = User(
        email="other_user@example.com",
        hashed_password=hash_password("OtherPass123!"),
        full_name="Other User",
        organization_id=user1.organization_id,
        email_verified=True,
        auth_provider="email",
        is_active=True,
        is_superuser=False,
    )
    test_db.add(user2)
    await test_db.flush()

    # Conversations for user1 and user2
    conv1 = ChatConversation(user_id=user1.id, message_count=1)
    conv2 = ChatConversation(user_id=user2.id, message_count=1)
    test_db.add_all([conv1, conv2])
    await test_db.commit()

    # Filter by user2
    resp = await async_client.get(
        "/api/admin/chat-conversations",
        params={"user_id": str(user2.id)},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["user_id"] == str(user2.id)

    # No filter — both returned
    resp_all = await async_client.get(
        "/api/admin/chat-conversations",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp_all.status_code == 200
    assert len(resp_all.json()) == 2


async def test_chat_conversations_pagination(
    async_client: AsyncClient, create_test_user, test_db
):
    """skip/limit pagination works correctly."""
    user, _ = await create_test_user(
        email="admin_page@example.com", password="AdminPass123!", is_superuser=True
    )
    token = await _get_auth_token(async_client, "admin_page@example.com", "AdminPass123!")

    # Create 3 conversations
    for _ in range(3):
        test_db.add(ChatConversation(user_id=user.id, message_count=0))
    await test_db.commit()

    # limit=2 → 2 results
    resp = await async_client.get(
        "/api/admin/chat-conversations",
        params={"limit": 2},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    assert len(resp.json()) == 2

    # skip=2, limit=2 → 1 result
    resp2 = await async_client.get(
        "/api/admin/chat-conversations",
        params={"skip": 2, "limit": 2},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp2.status_code == 200
    assert len(resp2.json()) == 1
