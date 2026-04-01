"""Integration tests for scans/results_router HTTP endpoints."""

import io
import uuid
from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient

from app.main import app
from app.scans.schemas import FundaSummaryResponse, ScanResultsResponse

# Set mock app state before tests
app.state.http_client = AsyncMock()
app.state.arq_pool = None

_SVC = "app.scans.results_router"
_MOCK_SCAN_ID = uuid.uuid4()


async def _get_auth_token(client: AsyncClient, email: str, password: str = "TestPass123!") -> str:
    resp = await client.post("/auth/login", json={"email": email, "password": password})
    return resp.json()["access_token"]


# ---------------------------------------------------------------------------
# GET /api/scans/{scan_id}/funda-summary
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_funda_summary_unauthenticated(async_client: AsyncClient):
    response = await async_client.get(f"/api/scans/{_MOCK_SCAN_ID}/funda-summary")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_funda_summary_success(async_client: AsyncClient, create_test_user):
    user, org = await create_test_user(email="res_funda@example.com")
    token = await _get_auth_token(async_client, "res_funda@example.com")

    mock_summary = FundaSummaryResponse(
        scan_id=_MOCK_SCAN_ID,
        listings_with_data=12,
    )

    with patch(f"{_SVC}.results_service.get_funda_summary", new_callable=AsyncMock, return_value=mock_summary):
        response = await async_client.get(
            f"/api/scans/{_MOCK_SCAN_ID}/funda-summary",
            headers={"Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 200
    data = response.json()
    assert data["scan_id"] == str(_MOCK_SCAN_ID)
    assert data["listings_with_data"] == 12


@pytest.mark.asyncio
async def test_funda_summary_not_found(async_client: AsyncClient, create_test_user):
    from fastapi import HTTPException

    user, org = await create_test_user(email="res_funda_nf@example.com")
    token = await _get_auth_token(async_client, "res_funda_nf@example.com")

    with patch(
        f"{_SVC}.results_service.get_funda_summary",
        new_callable=AsyncMock,
        side_effect=HTTPException(status_code=404, detail="Scan not found"),
    ):
        response = await async_client.get(
            f"/api/scans/{uuid.uuid4()}/funda-summary",
            headers={"Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 404


# ---------------------------------------------------------------------------
# GET /api/scans/{scan_id}/results
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_results_unauthenticated(async_client: AsyncClient):
    response = await async_client.get(f"/api/scans/{_MOCK_SCAN_ID}/results")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_results_success(async_client: AsyncClient, create_test_user):
    user, org = await create_test_user(email="res_list@example.com")
    token = await _get_auth_token(async_client, "res_list@example.com")

    mock_results = ScanResultsResponse(
        scan_id=_MOCK_SCAN_ID,
        gemeente_naam="Amsterdam",
        scan_date="2024-01-01T00:00:00",
        parcels_total=0,
        total=0,
        total_unfiltered=0,
        offset=0,
        limit=50,
        results=[],
    )

    with patch(f"{_SVC}.results_service.list_results", new_callable=AsyncMock, return_value=mock_results):
        response = await async_client.get(
            f"/api/scans/{_MOCK_SCAN_ID}/results",
            headers={"Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 0
    assert data["results"] == []


# ---------------------------------------------------------------------------
# GET /api/scans/{scan_id}/export
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_export_unauthenticated(async_client: AsyncClient):
    response = await async_client.get(f"/api/scans/{_MOCK_SCAN_ID}/export")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_export_success(async_client: AsyncClient, create_test_user):
    user, org = await create_test_user(email="res_exp@example.com")
    token = await _get_auth_token(async_client, "res_exp@example.com")

    mock_buffer = io.BytesIO(b"fake-excel-content")
    mock_filename = "scan_export.xlsx"

    with patch(f"{_SVC}.results_service.export_results", new_callable=AsyncMock, return_value=(mock_buffer, mock_filename)):
        response = await async_client.get(
            f"/api/scans/{_MOCK_SCAN_ID}/export",
            headers={"Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 200
    assert "spreadsheetml" in response.headers.get("content-type", "")


# ---------------------------------------------------------------------------
# GET /api/scans/{scan_id}/export/selection
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_export_selection_unauthenticated(async_client: AsyncClient):
    pid = str(uuid.uuid4())
    response = await async_client.get(f"/api/scans/{_MOCK_SCAN_ID}/export/selection?parcel_ids={pid}")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_export_selection_success(async_client: AsyncClient, create_test_user):
    user, org = await create_test_user(email="res_expsel@example.com")
    token = await _get_auth_token(async_client, "res_expsel@example.com")

    pid1 = str(uuid.uuid4())
    pid2 = str(uuid.uuid4())
    mock_buffer = io.BytesIO(b"fake-excel-content")
    mock_filename = "selection_export.xlsx"

    with patch(f"{_SVC}.results_service.export_selection", new_callable=AsyncMock, return_value=(mock_buffer, mock_filename)):
        response = await async_client.get(
            f"/api/scans/{_MOCK_SCAN_ID}/export/selection?parcel_ids={pid1},{pid2}",
            headers={"Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 200
    assert "spreadsheetml" in response.headers.get("content-type", "")


@pytest.mark.asyncio
async def test_export_selection_invalid_uuid(async_client: AsyncClient, create_test_user):
    user, org = await create_test_user(email="res_expsel_bad@example.com")
    token = await _get_auth_token(async_client, "res_expsel_bad@example.com")

    response = await async_client.get(
        f"/api/scans/{_MOCK_SCAN_ID}/export/selection?parcel_ids=not-a-uuid",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 400


@pytest.mark.asyncio
async def test_export_selection_empty_parcel_ids(async_client: AsyncClient, create_test_user):
    user, org = await create_test_user(email="res_expsel_emp@example.com")
    token = await _get_auth_token(async_client, "res_expsel_emp@example.com")

    response = await async_client.get(
        f"/api/scans/{_MOCK_SCAN_ID}/export/selection?parcel_ids=",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 400
