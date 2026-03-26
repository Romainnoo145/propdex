"""Integration tests for POST /api/agents/chat endpoint.

Uses mocked Claude responses to verify the full endpoint pipeline:
request → auth → classify → dispatch → handler → response.
"""

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import AsyncClient


def _mock_claude_classify(intent: str, params: dict):
    """Create a mock Claude response returning the given intent classification."""
    block = MagicMock()
    block.type = "text"
    block.text = json.dumps({"intent": intent, "params": params}, ensure_ascii=False)
    response = MagicMock()
    response.content = [block]
    return response


async def _get_auth_token(
    client: AsyncClient,
    email: str = "test@example.com",
    password: str = "TestPass123!",
) -> str:
    resp = await client.post("/auth/login", json={"email": email, "password": password})
    assert resp.status_code == 200
    return resp.json()["access_token"]


@pytest.mark.asyncio
async def test_chat_requires_auth(async_client: AsyncClient):
    """POST /api/agents/chat returns 401 without auth."""
    response = await async_client.post(
        "/api/agents/chat",
        json={"message": "Alle woningen in Venlo"},
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_chat_unsupported_intent(async_client: AsyncClient, create_test_user):
    """Unsupported query returns intent=UNSUPPORTED with reason."""
    user, org = await create_test_user()
    token = await _get_auth_token(async_client, user.email)

    with patch("app.agents.chat_service.create_claude_client") as mock_factory:
        mock_client = MagicMock()
        mock_client.model = "test"
        mock_client.client.messages.create = AsyncMock(
            return_value=_mock_claude_classify(
                "UNSUPPORTED",
                {"reason": "Huurprijzen niet beschikbaar"},
            )
        )
        mock_factory.return_value = mock_client

        response = await async_client.post(
            "/api/agents/chat",
            json={"message": "Wat is de huurprijs in Amsterdam?"},
            headers={"Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 200
    data = response.json()
    assert data["intent"] == "UNSUPPORTED"
    assert "Huurprijzen" in data["message"]


@pytest.mark.asyncio
async def test_chat_my_favorites_empty(async_client: AsyncClient, create_test_user):
    """MY_FAVORITES returns empty list for user with no favorites."""
    user, org = await create_test_user()
    token = await _get_auth_token(async_client, user.email)

    with patch("app.agents.chat_service.create_claude_client") as mock_factory:
        mock_client = MagicMock()
        mock_client.model = "test"
        mock_client.client.messages.create = AsyncMock(
            return_value=_mock_claude_classify("MY_FAVORITES", {})
        )
        mock_factory.return_value = mock_client

        response = await async_client.post(
            "/api/agents/chat",
            json={"message": "Mijn opgeslagen percelen"},
            headers={"Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 200
    data = response.json()
    assert data["intent"] == "MY_FAVORITES"
    assert data["data"] == []
    assert data["count"] == 0


@pytest.mark.asyncio
async def test_chat_my_reports_empty(async_client: AsyncClient, create_test_user):
    """MY_REPORTS returns empty list for user with no reports."""
    user, org = await create_test_user()
    token = await _get_auth_token(async_client, user.email)

    with patch("app.agents.chat_service.create_claude_client") as mock_factory:
        mock_client = MagicMock()
        mock_client.model = "test"
        mock_client.client.messages.create = AsyncMock(
            return_value=_mock_claude_classify("MY_REPORTS", {})
        )
        mock_factory.return_value = mock_client

        response = await async_client.post(
            "/api/agents/chat",
            json={"message": "Laat mijn rapporten zien"},
            headers={"Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 200
    data = response.json()
    assert data["intent"] == "MY_REPORTS"
    assert data["data"] == []


@pytest.mark.asyncio
async def test_chat_validation_error(async_client: AsyncClient, create_test_user):
    """Empty message returns 422."""
    user, org = await create_test_user()
    token = await _get_auth_token(async_client, user.email)

    response = await async_client.post(
        "/api/agents/chat",
        json={"message": ""},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 422
