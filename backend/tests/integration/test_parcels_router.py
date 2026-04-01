"""Integration tests for scans/parcels_router HTTP endpoints."""

import uuid
from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient

from app.main import app
from app.scans.schemas import (
    ParcelAtPointResponse,
    ParcelCentroidResponse,
    ParcelEnrichmentResponse,
    ParcelResolveResponse,
    ParcelRiskProfileResponse,
    ScanResultItem,
)

# Set mock app state before tests
app.state.http_client = AsyncMock()
app.state.arq_pool = None

_SVC = "app.scans.parcels_router"
_MOCK_PARCEL_ID = uuid.uuid4()


async def _get_auth_token(client: AsyncClient, email: str, password: str = "TestPass123!") -> str:
    resp = await client.post("/auth/login", json={"email": email, "password": password})
    return resp.json()["access_token"]


# ---------------------------------------------------------------------------
# GET /api/scans/wijken
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_wijken_unauthenticated(async_client: AsyncClient):
    response = await async_client.get("/api/scans/wijken?gemeente_code=0363")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_wijken_success(async_client: AsyncClient, create_test_user):
    user, org = await create_test_user(email="par_wijk@example.com")
    token = await _get_auth_token(async_client, "par_wijk@example.com")

    mock_geojson = {"type": "FeatureCollection", "features": []}

    with patch(f"{_SVC}.get_wijken_in_gemeente", new_callable=AsyncMock, return_value=mock_geojson):
        response = await async_client.get(
            "/api/scans/wijken?gemeente_code=0363",
            headers={"Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 200
    data = response.json()
    assert data["type"] == "FeatureCollection"


@pytest.mark.asyncio
async def test_wijken_not_found(async_client: AsyncClient, create_test_user):
    user, org = await create_test_user(email="par_wijk_nf@example.com")
    token = await _get_auth_token(async_client, "par_wijk_nf@example.com")

    with patch(f"{_SVC}.get_wijken_in_gemeente", new_callable=AsyncMock, side_effect=ValueError("No wijken")):
        response = await async_client.get(
            "/api/scans/wijken?gemeente_code=9999",
            headers={"Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 404


# ---------------------------------------------------------------------------
# GET /api/scans/parcels/{parcel_id}/enrich
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_enrich_unauthenticated(async_client: AsyncClient):
    response = await async_client.get(f"/api/scans/parcels/{_MOCK_PARCEL_ID}/enrich")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_enrich_success(async_client: AsyncClient, create_test_user):
    user, org = await create_test_user(email="par_enrich@example.com")
    token = await _get_auth_token(async_client, "par_enrich@example.com")

    mock_enrichment = ParcelEnrichmentResponse(
        parcel_id=_MOCK_PARCEL_ID,
    )

    with patch(f"{_SVC}.parcels_service.enrich_parcel", new_callable=AsyncMock, return_value=mock_enrichment):
        response = await async_client.get(
            f"/api/scans/parcels/{_MOCK_PARCEL_ID}/enrich",
            headers={"Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 200
    data = response.json()
    assert data["parcel_id"] == str(_MOCK_PARCEL_ID)


@pytest.mark.asyncio
async def test_enrich_invalid_uuid(async_client: AsyncClient, create_test_user):
    user, org = await create_test_user(email="par_enrich_bad@example.com")
    token = await _get_auth_token(async_client, "par_enrich_bad@example.com")

    response = await async_client.get(
        "/api/scans/parcels/not-a-uuid/enrich",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 422


# ---------------------------------------------------------------------------
# GET /api/scans/parcels/{parcel_id}/scan-data
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_scan_data_unauthenticated(async_client: AsyncClient):
    response = await async_client.get(f"/api/scans/parcels/{_MOCK_PARCEL_ID}/scan-data")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_scan_data_success(async_client: AsyncClient, create_test_user):
    user, org = await create_test_user(email="par_sdata@example.com")
    token = await _get_auth_token(async_client, "par_sdata@example.com")

    mock_item = ScanResultItem(
        parcel_id=_MOCK_PARCEL_ID,
        parcel_code="AMS01-A-1234",
        has_pand=True,
    )

    with patch(f"{_SVC}.parcels_service.get_parcel_scan_data", new_callable=AsyncMock, return_value=mock_item):
        response = await async_client.get(
            f"/api/scans/parcels/{_MOCK_PARCEL_ID}/scan-data",
            headers={"Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 200
    data = response.json()
    assert data["parcel_id"] == str(_MOCK_PARCEL_ID)


# ---------------------------------------------------------------------------
# GET /api/scans/parcels/{parcel_id}/risk-profile
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_risk_profile_unauthenticated(async_client: AsyncClient):
    response = await async_client.get(f"/api/scans/parcels/{_MOCK_PARCEL_ID}/risk-profile")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_risk_profile_success(async_client: AsyncClient, create_test_user):
    user, org = await create_test_user(email="par_risk@example.com")
    token = await _get_auth_token(async_client, "par_risk@example.com")

    mock_profile = ParcelRiskProfileResponse(
        parcel_id=_MOCK_PARCEL_ID,
    )

    with patch(f"{_SVC}.parcels_service.get_parcel_risk_profile", new_callable=AsyncMock, return_value=mock_profile):
        response = await async_client.get(
            f"/api/scans/parcels/{_MOCK_PARCEL_ID}/risk-profile",
            headers={"Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 200
    data = response.json()
    assert data["parcel_id"] == str(_MOCK_PARCEL_ID)


# ---------------------------------------------------------------------------
# GET /api/scans/parcels/{parcel_id}/centroid
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_centroid_unauthenticated(async_client: AsyncClient):
    response = await async_client.get(f"/api/scans/parcels/{_MOCK_PARCEL_ID}/centroid")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_centroid_success(async_client: AsyncClient, create_test_user):
    user, org = await create_test_user(email="par_centr@example.com")
    token = await _get_auth_token(async_client, "par_centr@example.com")

    mock_centroid = ParcelCentroidResponse(lat=52.3676, lng=4.9041)

    with patch(f"{_SVC}.parcels_service.get_parcel_centroid", new_callable=AsyncMock, return_value=mock_centroid):
        response = await async_client.get(
            f"/api/scans/parcels/{_MOCK_PARCEL_ID}/centroid",
            headers={"Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 200
    data = response.json()
    assert data["lat"] == 52.3676
    assert data["lng"] == 4.9041


# ---------------------------------------------------------------------------
# GET /api/scans/parcels/at-point
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_at_point_unauthenticated(async_client: AsyncClient):
    response = await async_client.get("/api/scans/parcels/at-point?lng=4.9&lat=52.3")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_at_point_success(async_client: AsyncClient, create_test_user):
    user, org = await create_test_user(email="par_atp@example.com")
    token = await _get_auth_token(async_client, "par_atp@example.com")

    mock_response = ParcelAtPointResponse(
        parcel_id=_MOCK_PARCEL_ID,
        lng=4.9041,
        lat=52.3676,
        has_pand=False,
        has_report=False,
    )

    with patch(f"{_SVC}.parcels_service.get_parcel_at_point", new_callable=AsyncMock, return_value=mock_response):
        response = await async_client.get(
            "/api/scans/parcels/at-point?lng=4.9041&lat=52.3676",
            headers={"Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 200
    data = response.json()
    assert data["parcel_id"] == str(_MOCK_PARCEL_ID)


# ---------------------------------------------------------------------------
# GET /api/scans/parcels/{parcel_id}/eigendom
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_eigendom_unauthenticated(async_client: AsyncClient):
    response = await async_client.get(f"/api/scans/parcels/{_MOCK_PARCEL_ID}/eigendom")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_eigendom_success(async_client: AsyncClient, create_test_user):
    user, org = await create_test_user(email="par_eig@example.com")
    token = await _get_auth_token(async_client, "par_eig@example.com")

    mock_ownership = {
        "status": "unavailable",
        "data": None,
        "reason": "BRK niet geconfigureerd",
    }

    with patch(f"{_SVC}.parcels_service.get_parcel_eigendom", new_callable=AsyncMock, return_value=mock_ownership):
        response = await async_client.get(
            f"/api/scans/parcels/{_MOCK_PARCEL_ID}/eigendom",
            headers={"Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 200


# ---------------------------------------------------------------------------
# GET /api/scans/parcels/resolve
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_resolve_unauthenticated(async_client: AsyncClient):
    response = await async_client.get("/api/scans/parcels/resolve?street=Keizersgracht&huisnummer=123")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_resolve_success(async_client: AsyncClient, create_test_user):
    user, org = await create_test_user(email="par_res@example.com")
    token = await _get_auth_token(async_client, "par_res@example.com")

    mock_result = {"parcel_id": str(_MOCK_PARCEL_ID), "lng": 4.9041, "lat": 52.3676}

    with patch(f"{_SVC}.parcels_service.resolve_parcel_by_address", new_callable=AsyncMock, return_value=mock_result):
        response = await async_client.get(
            "/api/scans/parcels/resolve?street=Keizersgracht&huisnummer=123",
            headers={"Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 200


@pytest.mark.asyncio
async def test_resolve_missing_params(async_client: AsyncClient, create_test_user):
    user, org = await create_test_user(email="par_res_bad@example.com")
    token = await _get_auth_token(async_client, "par_res_bad@example.com")

    response = await async_client.get(
        "/api/scans/parcels/resolve?street=A",
        headers={"Authorization": f"Bearer {token}"},
    )

    # Missing huisnummer should cause 422
    assert response.status_code == 422
