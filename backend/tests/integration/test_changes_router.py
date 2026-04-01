"""Integration tests for monitoring/changes_router HTTP endpoints."""

import uuid
from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient

from app.main import app
from app.schemas.monitoring import (
    ChangeRecordListResponse,
    ChangeRecordResponse,
    MarkAllReadResponse,
    UnreadDetailResponse,
)

# Set mock app state before tests
app.state.http_client = AsyncMock()
app.state.arq_pool = None

_MOCK_ORG_ID = uuid.uuid4()
_MOCK_CHANGE_ID = uuid.uuid4()

_SVC = "app.monitoring.changes_router"


async def _get_auth_token(client: AsyncClient, email: str, password: str = "TestPass123!") -> str:
    resp = await client.post("/auth/login", json={"email": email, "password": password})
    return resp.json()["access_token"]


# ---------------------------------------------------------------------------
# GET /api/monitoring/changes
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_changes_unauthenticated(async_client: AsyncClient):
    response = await async_client.get("/api/monitoring/changes")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_get_changes_success(async_client: AsyncClient, create_test_user):
    user, org = await create_test_user(email="chg_list@example.com")
    token = await _get_auth_token(async_client, "chg_list@example.com")

    mock_result = ChangeRecordListResponse(changes=[], total=0, has_more=False)

    with patch(f"{_SVC}.get_changes_list", new_callable=AsyncMock, return_value=mock_result):
        response = await async_client.get(
            "/api/monitoring/changes",
            headers={"Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 0
    assert data["changes"] == []


@pytest.mark.asyncio
async def test_get_changes_project_not_found(async_client: AsyncClient, create_test_user):
    user, org = await create_test_user(email="chg_404@example.com")
    token = await _get_auth_token(async_client, "chg_404@example.com")

    with patch(f"{_SVC}.get_changes_list", new_callable=AsyncMock, return_value=None):
        response = await async_client.get(
            f"/api/monitoring/changes?project_id={uuid.uuid4()}",
            headers={"Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 404


# ---------------------------------------------------------------------------
# GET /api/monitoring/changes-for-parcel/{parcel_id}
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_changes_for_parcel_success(async_client: AsyncClient, create_test_user):
    user, org = await create_test_user(email="chg_parcel@example.com")
    token = await _get_auth_token(async_client, "chg_parcel@example.com")

    with patch(f"{_SVC}.get_parcel_changes", new_callable=AsyncMock, return_value=[]):
        response = await async_client.get(
            f"/api/monitoring/changes-for-parcel/{uuid.uuid4()}",
            headers={"Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 200
    assert response.json() == []


# ---------------------------------------------------------------------------
# GET /api/monitoring/unread
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_unread_unauthenticated(async_client: AsyncClient):
    response = await async_client.get("/api/monitoring/unread")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_get_unread_success(async_client: AsyncClient, create_test_user):
    user, org = await create_test_user(email="chg_unread@example.com")
    token = await _get_auth_token(async_client, "chg_unread@example.com")

    mock_result = UnreadDetailResponse(total_unread=3, projects_with_changes=1, per_project=[])

    with patch(f"{_SVC}.get_unread_counts", new_callable=AsyncMock, return_value=mock_result):
        response = await async_client.get(
            "/api/monitoring/unread",
            headers={"Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 200
    data = response.json()
    assert data["total_unread"] == 3


# ---------------------------------------------------------------------------
# POST /api/monitoring/changes/read-all
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_mark_all_read_unauthenticated(async_client: AsyncClient):
    response = await async_client.post("/api/monitoring/changes/read-all")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_mark_all_read_success(async_client: AsyncClient, create_test_user):
    user, org = await create_test_user(email="chg_readall@example.com")
    token = await _get_auth_token(async_client, "chg_readall@example.com")

    mock_result = MarkAllReadResponse(status="ok", marked_count=5)

    with patch(f"{_SVC}.mark_all_changes_read", new_callable=AsyncMock, return_value=mock_result):
        response = await async_client.post(
            "/api/monitoring/changes/read-all",
            headers={"Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 200
    data = response.json()
    assert data["marked_count"] == 5


# ---------------------------------------------------------------------------
# POST /api/monitoring/changes/{change_id}/read
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_mark_change_read_success(async_client: AsyncClient, create_test_user):
    user, org = await create_test_user(email="chg_read1@example.com")
    token = await _get_auth_token(async_client, "chg_read1@example.com")

    with patch(f"{_SVC}.mark_single_change_read", new_callable=AsyncMock, return_value=True):
        response = await async_client.post(
            f"/api/monitoring/changes/{_MOCK_CHANGE_ID}/read",
            headers={"Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 200
    assert response.json()["status"] == "ok"


@pytest.mark.asyncio
async def test_mark_change_read_not_found(async_client: AsyncClient, create_test_user):
    user, org = await create_test_user(email="chg_read404@example.com")
    token = await _get_auth_token(async_client, "chg_read404@example.com")

    with patch(f"{_SVC}.mark_single_change_read", new_callable=AsyncMock, return_value=False):
        response = await async_client.post(
            f"/api/monitoring/changes/{uuid.uuid4()}/read",
            headers={"Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 404


# ---------------------------------------------------------------------------
# DELETE /api/monitoring/changes/{change_id}/read
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_mark_change_unread_success(async_client: AsyncClient, create_test_user):
    user, org = await create_test_user(email="chg_unread1@example.com")
    token = await _get_auth_token(async_client, "chg_unread1@example.com")

    with patch(f"{_SVC}.mark_single_change_unread", new_callable=AsyncMock):
        response = await async_client.delete(
            f"/api/monitoring/changes/{_MOCK_CHANGE_ID}/read",
            headers={"Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 200
    assert response.json()["status"] == "ok"
