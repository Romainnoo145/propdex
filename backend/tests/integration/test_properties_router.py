"""Integration tests for properties router HTTP endpoints."""

from datetime import datetime
from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient

from app.main import app
from app.schemas.address import BAGAddressResponse
from app.schemas.property import DataSourceInfo, PropertyReportResponse

# Set mock app state before tests
app.state.http_client = AsyncMock()
app.state.arq_pool = None  # AI parsing not needed for router tests


async def _get_auth_token(client: AsyncClient, email: str, password: str = "TestPass123!") -> str:
    """Helper to login and get access token."""
    resp = await client.post("/auth/login", json={"email": email, "password": password})
    return resp.json()["access_token"]


def _make_mock_report() -> PropertyReportResponse:
    """Create a minimal valid PropertyReportResponse for mocking."""
    return PropertyReportResponse(
        address=BAGAddressResponse(
            nummeraanduiding_id="0363200000123456",
            straat="Keizersgracht",
            huisnummer=123,
            postcode="1015 CJ",
            woonplaats="Amsterdam",
        ),
        building=None,
        cadastral_parcels=[],
        zoning=None,
        monuments=None,
        map_data=None,
        section_sources=[],
        data_sources=[DataSourceInfo(source="BAG API v2", is_cached=False)],
        completeness_score=0.17,
        errors=[],
        resolved_at=datetime.utcnow().isoformat() + "Z",
        ai_parsing=None,
    )


@pytest.mark.asyncio
async def test_lookup_without_auth_returns_401(async_client: AsyncClient):
    """Test that lookup endpoint returns 401 without authentication."""
    response = await async_client.post(
        "/api/properties/lookup",
        json={
            "postcode": "1015 CJ",
            "huisnummer": 123,
        },
    )

    assert response.status_code == 401


@pytest.mark.asyncio
async def test_lookup_invalid_postcode_returns_422(async_client: AsyncClient, create_test_user):
    """Test that lookup endpoint validates postcode format."""
    # Create user and get token
    user, org = await create_test_user(email="lookup_invalid@example.com")
    token = await _get_auth_token(async_client, "lookup_invalid@example.com")

    # Send invalid postcode
    response = await async_client.post(
        "/api/properties/lookup",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "postcode": "invalid",
            "huisnummer": 123,
        },
    )

    assert response.status_code == 422
    data = response.json()
    # Pydantic validation error structure
    assert "detail" in data


@pytest.mark.asyncio
async def test_lookup_success_returns_property_report(async_client: AsyncClient, create_test_user):
    """Test successful property lookup returns PropertyReportResponse schema."""
    # Create user and get token
    user, org = await create_test_user(email="lookup_success@example.com")
    token = await _get_auth_token(async_client, "lookup_success@example.com")

    # Mock aggregate_property_data to return valid report
    mock_report = _make_mock_report()

    with patch("app.properties.router.aggregate_property_data", new_callable=AsyncMock) as mock_agg:
        mock_agg.return_value = mock_report

        response = await async_client.post(
            "/api/properties/lookup",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "postcode": "1015 CJ",
                "huisnummer": 123,
            },
        )

        assert response.status_code == 200
        data = response.json()

        # Verify response has PropertyReportResponse keys
        assert "address" in data
        assert "completeness_score" in data
        assert "data_sources" in data
        assert "resolved_at" in data
        assert data["address"]["straat"] == "Keizersgracht"
        assert data["completeness_score"] == 0.17


@pytest.mark.asyncio
async def test_lookup_address_not_found_returns_404(async_client: AsyncClient, create_test_user):
    """Test that address not found error propagates as 404."""
    # Create user and get token
    user, org = await create_test_user(email="lookup_404@example.com")
    token = await _get_auth_token(async_client, "lookup_404@example.com")

    # Mock aggregate_property_data to raise HTTPException 404
    from app.government_apis.base import APINotFoundError

    with patch("app.properties.router.aggregate_property_data", new_callable=AsyncMock) as mock_agg:
        mock_agg.side_effect = APINotFoundError("Address not found")

        response = await async_client.post(
            "/api/properties/lookup",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "postcode": "9999 ZZ",
                "huisnummer": 999,
            },
        )

        assert response.status_code == 404
        data = response.json()
        assert "not found" in data["detail"].lower()


@pytest.mark.asyncio
async def test_lookup_upstream_error_returns_502(async_client: AsyncClient, create_test_user):
    """Test that upstream API errors propagate as 502."""
    # Create user and get token
    user, org = await create_test_user(email="lookup_502@example.com")
    token = await _get_auth_token(async_client, "lookup_502@example.com")

    # Mock aggregate_property_data to raise GovernmentAPIError
    from app.government_apis.base import GovernmentAPIError

    with patch("app.properties.router.aggregate_property_data", new_callable=AsyncMock) as mock_agg:
        mock_agg.side_effect = GovernmentAPIError("BAG API", "Service unavailable")

        response = await async_client.post(
            "/api/properties/lookup",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "postcode": "1015 CJ",
                "huisnummer": 123,
            },
        )

        assert response.status_code == 502
        data = response.json()
        assert "upstream" in data["detail"].lower() or "api" in data["detail"].lower()


@pytest.mark.asyncio
async def test_suggest_without_auth_returns_401(async_client: AsyncClient):
    """Test that suggest endpoint returns 401 without authentication."""
    response = await async_client.get(
        "/api/properties/suggest?q=Amsterdam"
    )

    assert response.status_code == 401


@pytest.mark.asyncio
async def test_suggest_short_query_returns_400(async_client: AsyncClient, create_test_user):
    """Test that suggest endpoint validates query length."""
    # Create user and get token
    user, org = await create_test_user(email="suggest_short@example.com")
    token = await _get_auth_token(async_client, "suggest_short@example.com")

    # Query too short (< 2 characters)
    response = await async_client.get(
        "/api/properties/suggest?q=A",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 400
    data = response.json()
    assert "at least 2 characters" in data["detail"]


@pytest.mark.asyncio
async def test_suggest_success_returns_suggestions(async_client: AsyncClient, create_test_user):
    """Test successful address suggestion returns list of suggestions."""
    # Create user and get token
    user, org = await create_test_user(email="suggest_success@example.com")
    token = await _get_auth_token(async_client, "suggest_success@example.com")

    # Mock PDOK client suggest method
    mock_suggestions = [
        {
            "weergavenaam": "Keizersgracht 123, 1015CJ Amsterdam",
            "id": "adr-0363200000123456",
            "type": "adres",
        },
        {
            "weergavenaam": "Keizersgracht 124, 1015CJ Amsterdam",
            "id": "adr-0363200000123457",
            "type": "adres",
        },
    ]

    with patch("app.properties.router._pdok_client.suggest", new_callable=AsyncMock) as mock_suggest:
        mock_suggest.return_value = mock_suggestions

        response = await async_client.get(
            "/api/properties/suggest?q=Amsterdam",
            headers={"Authorization": f"Bearer {token}"},
        )

        assert response.status_code == 200
        data = response.json()

        # Verify response is a list
        assert isinstance(data, list)
        assert len(data) == 2
        assert data[0]["weergavenaam"] == "Keizersgracht 123, 1015CJ Amsterdam"
