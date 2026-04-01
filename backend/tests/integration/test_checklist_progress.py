"""Integration tests for checklist_progress router HTTP endpoints."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import AsyncClient

from app.main import app

# Set mock app state before tests
app.state.http_client = AsyncMock()
app.state.arq_pool = None


async def _get_auth_token(client: AsyncClient, email: str, password: str = "TestPass123!") -> str:
    """Helper to login and get access token."""
    resp = await client.post("/auth/login", json={"email": email, "password": password})
    return resp.json()["access_token"]


# ---------------------------------------------------------------------------
# GET /{parcel_id}/{use_case} — checklist progress retrieval
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_progress_without_auth_returns_401(async_client: AsyncClient):
    """Unauthenticated GET returns 401."""
    response = await async_client.get("/api/checklist-progress/NL123/optoppen")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_get_progress_invalid_use_case_returns_empty(
    async_client: AsyncClient, create_test_user
):
    """GET with an unknown use_case returns empty checked_items."""
    user, _org = await create_test_user(email="chk_invalid@example.com")
    token = await _get_auth_token(async_client, "chk_invalid@example.com")

    response = await async_client.get(
        "/api/checklist-progress/NL123/nonexistent_use_case",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["checked_items"] == []


@pytest.mark.asyncio
async def test_get_progress_no_existing_record_returns_empty(
    async_client: AsyncClient, create_test_user
):
    """GET for a parcel with no saved progress returns empty defaults."""
    user, _org = await create_test_user(email="chk_empty@example.com")
    token = await _get_auth_token(async_client, "chk_empty@example.com")

    response = await async_client.get(
        "/api/checklist-progress/NL999/optoppen",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["checked_items"] == []
    assert data["uploaded_documents"] == {}


# ---------------------------------------------------------------------------
# PUT /{parcel_id}/{use_case} — checklist progress upsert
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_put_progress_without_auth_returns_401(async_client: AsyncClient):
    """Unauthenticated PUT returns 401."""
    response = await async_client.put(
        "/api/checklist-progress/NL123/optoppen",
        json={"checked_items": ["opt-01"]},
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_put_progress_success(async_client: AsyncClient, create_test_user):
    """PUT saves checked items and returns them."""
    user, _org = await create_test_user(email="chk_put@example.com")
    token = await _get_auth_token(async_client, "chk_put@example.com")

    response = await async_client.put(
        "/api/checklist-progress/NL123/optoppen",
        headers={"Authorization": f"Bearer {token}"},
        json={"checked_items": ["opt-01", "opt-02"], "uploaded_documents": {"opt-01": "file.pdf"}},
    )
    assert response.status_code == 200
    data = response.json()
    assert set(data["checked_items"]) == {"opt-01", "opt-02"}


@pytest.mark.asyncio
async def test_put_then_get_roundtrip(async_client: AsyncClient, create_test_user):
    """PUT then GET returns the same data — full round-trip."""
    user, _org = await create_test_user(email="chk_rt@example.com")
    token = await _get_auth_token(async_client, "chk_rt@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    # Save progress
    await async_client.put(
        "/api/checklist-progress/NL555/optoppen",
        headers=headers,
        json={"checked_items": ["opt-01"], "uploaded_documents": {"opt-01": "doc.pdf"}},
    )

    # Read it back
    response = await async_client.get(
        "/api/checklist-progress/NL555/optoppen",
        headers=headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["checked_items"] == ["opt-01"]
    assert data["uploaded_documents"] == {"opt-01": "doc.pdf"}


@pytest.mark.asyncio
async def test_put_invalid_use_case_returns_empty(async_client: AsyncClient, create_test_user):
    """PUT with unknown use_case returns empty (no save occurs)."""
    user, _org = await create_test_user(email="chk_bad_uc@example.com")
    token = await _get_auth_token(async_client, "chk_bad_uc@example.com")

    response = await async_client.put(
        "/api/checklist-progress/NL123/bogus_case",
        headers={"Authorization": f"Bearer {token}"},
        json={"checked_items": ["x"]},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["checked_items"] == []
