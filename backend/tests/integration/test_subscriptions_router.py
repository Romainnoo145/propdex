"""Integration tests for monitoring/subscriptions_router HTTP endpoints."""

import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import AsyncClient

from app.main import app
from app.schemas.monitoring import (
    FundaSnapshotResponse,
    FundaSnapshotStatsResponse,
    MonitoringSubscriptionResponse,
    RefreshMonitoringResponse,
)

# Set mock app state before tests
app.state.http_client = AsyncMock()
app.state.arq_pool = MagicMock()

_SVC = "app.monitoring.subscriptions_router"


async def _get_auth_token(client: AsyncClient, email: str, password: str = "TestPass123!") -> str:
    resp = await client.post("/auth/login", json={"email": email, "password": password})
    return resp.json()["access_token"]


# ---------------------------------------------------------------------------
# POST /api/monitoring/subscriptions
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_create_subscription_unauthenticated(async_client: AsyncClient):
    response = await async_client.post(
        "/api/monitoring/subscriptions",
        json={"gemeente_code": "0363", "gemeente_naam": "Amsterdam"},
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_create_subscription_success(async_client: AsyncClient, create_test_user):
    user, org = await create_test_user(email="sub_create@example.com")
    token = await _get_auth_token(async_client, "sub_create@example.com")

    mock_result = MonitoringSubscriptionResponse(
        gemeente_code="0363",
        gemeente_naam="Amsterdam",
        enabled=True,
        affected_projects=1,
        monitored_projects=1,
        total_projects=1,
        has_root_project=True,
    )

    with patch(
        f"{_SVC}.set_gemeente_subscription_logic",
        new_callable=AsyncMock,
        return_value=mock_result,
    ):
        response = await async_client.post(
            "/api/monitoring/subscriptions",
            headers={"Authorization": f"Bearer {token}"},
            json={"gemeente_code": "0363", "gemeente_naam": "Amsterdam", "enabled": True},
        )

    assert response.status_code == 200
    data = response.json()
    assert data["gemeente_code"] == "0363"
    assert data["enabled"] is True


@pytest.mark.asyncio
async def test_create_subscription_invalid_gemeente(async_client: AsyncClient, create_test_user):
    user, org = await create_test_user(email="sub_invalid@example.com")
    token = await _get_auth_token(async_client, "sub_invalid@example.com")

    with patch(
        f"{_SVC}.set_gemeente_subscription_logic",
        new_callable=AsyncMock,
        return_value=None,
    ):
        response = await async_client.post(
            "/api/monitoring/subscriptions",
            headers={"Authorization": f"Bearer {token}"},
            json={"gemeente_code": "XXXX", "gemeente_naam": "Invalid"},
        )

    assert response.status_code == 400
    assert "invalid" in response.json()["detail"].lower()


# ---------------------------------------------------------------------------
# GET /api/monitoring/subscriptions/{gemeente_code}
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_subscription_success(async_client: AsyncClient, create_test_user):
    user, org = await create_test_user(email="sub_get@example.com")
    token = await _get_auth_token(async_client, "sub_get@example.com")

    mock_result = MonitoringSubscriptionResponse(
        gemeente_code="0363",
        gemeente_naam="Amsterdam",
        enabled=True,
    )

    with patch(
        f"{_SVC}.get_gemeente_subscription_logic",
        new_callable=AsyncMock,
        return_value=mock_result,
    ):
        response = await async_client.get(
            "/api/monitoring/subscriptions/0363",
            headers={"Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 200
    assert response.json()["gemeente_code"] == "0363"


@pytest.mark.asyncio
async def test_get_subscription_invalid_code(async_client: AsyncClient, create_test_user):
    user, org = await create_test_user(email="sub_get404@example.com")
    token = await _get_auth_token(async_client, "sub_get404@example.com")

    with patch(
        f"{_SVC}.get_gemeente_subscription_logic",
        new_callable=AsyncMock,
        return_value=None,
    ):
        response = await async_client.get(
            "/api/monitoring/subscriptions/XXXX",
            headers={"Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 400


# ---------------------------------------------------------------------------
# POST /api/monitoring/refresh/{project_id}
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_refresh_unauthenticated(async_client: AsyncClient):
    response = await async_client.post(f"/api/monitoring/refresh/{uuid.uuid4()}")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_refresh_success(async_client: AsyncClient, create_test_user):
    user, org = await create_test_user(email="sub_refresh@example.com")
    token = await _get_auth_token(async_client, "sub_refresh@example.com")

    mock_result = {"status": "ok", "new_changes": 2, "total_detected": 10}

    with patch(
        f"{_SVC}.refresh_monitoring_logic",
        new_callable=AsyncMock,
        return_value=mock_result,
    ):
        response = await async_client.post(
            f"/api/monitoring/refresh/{uuid.uuid4()}",
            headers={"Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 200
    data = response.json()
    assert data["new_changes"] == 2


@pytest.mark.asyncio
async def test_refresh_project_not_found(async_client: AsyncClient, create_test_user):
    user, org = await create_test_user(email="sub_ref404@example.com")
    token = await _get_auth_token(async_client, "sub_ref404@example.com")

    with patch(
        f"{_SVC}.refresh_monitoring_logic",
        new_callable=AsyncMock,
        return_value=None,
    ):
        response = await async_client.post(
            f"/api/monitoring/refresh/{uuid.uuid4()}",
            headers={"Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 404


# ---------------------------------------------------------------------------
# POST /api/monitoring/listings/funda/snapshot
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_funda_snapshot_unauthenticated(async_client: AsyncClient):
    response = await async_client.post(
        "/api/monitoring/listings/funda/snapshot",
        json={"area_names": ["arcen"], "max_listings": 60},
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_funda_snapshot_success(async_client: AsyncClient, create_test_user):
    user, org = await create_test_user(email="sub_funda@example.com")
    token = await _get_auth_token(async_client, "sub_funda@example.com")

    mock_result = FundaSnapshotResponse(
        status="queued",
        job_id="job-123",
        area_names=["arcen"],
        max_listings=60,
    )

    with patch(
        f"{_SVC}.trigger_funda_snapshot_logic",
        new_callable=AsyncMock,
        return_value=mock_result,
    ):
        response = await async_client.post(
            "/api/monitoring/listings/funda/snapshot",
            headers={"Authorization": f"Bearer {token}"},
            json={"area_names": ["arcen"], "max_listings": 60},
        )

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "queued"
    assert data["area_names"] == ["arcen"]


# ---------------------------------------------------------------------------
# GET /api/monitoring/listings/funda/stats
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_funda_stats_unauthenticated(async_client: AsyncClient):
    response = await async_client.get("/api/monitoring/listings/funda/stats")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_funda_stats_success(async_client: AsyncClient, create_test_user):
    user, org = await create_test_user(email="sub_stats@example.com")
    token = await _get_auth_token(async_client, "sub_stats@example.com")

    mock_result = FundaSnapshotStatsResponse(
        total_snapshots=10,
        unique_listings=42,
        matched_parcels=5,
        latest_snapshot_date="2026-03-01",
    )

    with patch(
        f"{_SVC}.get_funda_snapshot_stats_logic",
        new_callable=AsyncMock,
        return_value=mock_result,
    ):
        response = await async_client.get(
            "/api/monitoring/listings/funda/stats",
            headers={"Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 200
    data = response.json()
    assert data["total_snapshots"] == 10
    assert data["matched_parcels"] == 5
