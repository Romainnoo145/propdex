"""Tests for PDOK Cadastral (BRK) API client."""

import httpx
import pytest

from app.government_apis.base import APITimeoutError, GovernmentAPIError
from app.government_apis.pdok_cadastral import PDOKCadastralClient
from tests.api_mocks import make_mock_client, make_mock_response


@pytest.fixture
def cadastral_client():
    return PDOKCadastralClient()


class TestGetParcelsByBbox:
    async def test_success(self, cadastral_client):
        features = [{"type": "Feature", "properties": {"perceelnummer": "1234"}}]
        response = make_mock_response(200, {"features": features})
        client = make_mock_client(get=response)

        result = await cadastral_client.get_parcels_by_bbox("120000,487000,121000,488000", client)
        assert result == features

    async def test_empty(self, cadastral_client):
        response = make_mock_response(200, {"features": []})
        client = make_mock_client(get=response)

        result = await cadastral_client.get_parcels_by_bbox("0,0,1,1", client)
        assert result == []

    async def test_timeout_raises(self, cadastral_client):
        client = make_mock_client()
        client.get.side_effect = httpx.TimeoutException("timed out")

        with pytest.raises(APITimeoutError):
            await cadastral_client.get_parcels_by_bbox("0,0,1,1", client)

    async def test_http_error_raises(self, cadastral_client):
        client = make_mock_client()
        client.get.side_effect = httpx.HTTPError("connection failed")

        with pytest.raises(GovernmentAPIError):
            await cadastral_client.get_parcels_by_bbox("0,0,1,1", client)

    async def test_500_raises_government_error(self, cadastral_client):
        """500 from handle_api_response raises GovernmentAPIError (not caught by outer except)."""
        response = make_mock_response(500)
        client = make_mock_client(get=response)

        with pytest.raises(GovernmentAPIError) as exc_info:
            await cadastral_client.get_parcels_by_bbox("0,0,1,1", client)
        assert exc_info.value.status_code == 500


class TestGetParcelsByPoint:
    async def test_success(self, cadastral_client):
        features = [{"type": "Feature", "properties": {"perceelnummer": "5678"}}]
        response = make_mock_response(200, {"features": features})
        client = make_mock_client(get=response)

        result = await cadastral_client.get_parcels_by_point(121000.0, 487000.0, client)
        assert result == features

    async def test_constructs_bbox_default_distance(self, cadastral_client):
        response = make_mock_response(200, {"features": []})
        client = make_mock_client(get=response)

        await cadastral_client.get_parcels_by_point(100.0, 200.0, client)
        call_kwargs = client.get.call_args
        assert call_kwargs.kwargs["params"]["bbox"] == "99.0,199.0,101.0,201.0"

    async def test_constructs_bbox_custom_distance(self, cadastral_client):
        response = make_mock_response(200, {"features": []})
        client = make_mock_client(get=response)

        await cadastral_client.get_parcels_by_point(100.0, 200.0, client, distance=5.0)
        call_kwargs = client.get.call_args
        assert call_kwargs.kwargs["params"]["bbox"] == "95.0,195.0,105.0,205.0"
