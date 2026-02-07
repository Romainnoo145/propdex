"""Tests for BAG API client."""

import pytest

from app.government_apis.bag_api import BAGAPIClient
from app.government_apis.base import APINotFoundError, APIRateLimitError, GovernmentAPIError
from tests.api_mocks import make_mock_client, make_mock_response


@pytest.fixture
def bag_client():
    return BAGAPIClient()


class TestGetAddress:
    async def test_success(self, bag_client):
        address_data = {"nummeraanduidingIdentificatie": "0363200000469854", "straat": "Keizersgracht"}
        response = make_mock_response(200, {
            "_embedded": {"adressen": [address_data]},
        })
        client = make_mock_client(get=response)

        result = await bag_client.get_address("1015 AA", 1, client)
        assert result == address_data

    async def test_strips_postcode_space(self, bag_client):
        response = make_mock_response(200, {
            "_embedded": {"adressen": [{"id": "1"}]},
        })
        client = make_mock_client(get=response)

        await bag_client.get_address("1234 AB", 42, client)
        call_kwargs = client.get.call_args
        assert call_kwargs.kwargs["params"]["postcode"] == "1234AB"

    async def test_with_huisletter_toevoeging(self, bag_client):
        response = make_mock_response(200, {
            "_embedded": {"adressen": [{"id": "1"}]},
        })
        client = make_mock_client(get=response)

        await bag_client.get_address("1234AB", 42, client, huisletter="A", toevoeging="bis")
        params = client.get.call_args.kwargs["params"]
        assert params["huisletter"] == "A"
        assert params["huisnummertoevoeging"] == "bis"

    async def test_empty_embedded_raises_not_found(self, bag_client):
        response = make_mock_response(200, {"_embedded": {"adressen": []}})
        client = make_mock_client(get=response)

        with pytest.raises(APINotFoundError):
            await bag_client.get_address("1234AB", 99, client)

    async def test_404_raises_not_found(self, bag_client):
        response = make_mock_response(404)
        client = make_mock_client(get=response)

        with pytest.raises(APINotFoundError):
            await bag_client.get_address("1234AB", 1, client)

    async def test_429_raises_rate_limit(self, bag_client):
        response = make_mock_response(429)
        client = make_mock_client(get=response)

        with pytest.raises(APIRateLimitError):
            await bag_client.get_address("1234AB", 1, client)


class TestGetNummeraanduiding:
    async def test_success(self, bag_client):
        data = {"identificatie": "0363200000469854", "status": "Naamgeving uitgegeven"}
        response = make_mock_response(200, data)
        client = make_mock_client(get=response)

        result = await bag_client.get_nummeraanduiding("0363200000469854", client)
        assert result == data

    async def test_404_raises_not_found(self, bag_client):
        response = make_mock_response(404)
        client = make_mock_client(get=response)

        with pytest.raises(APINotFoundError):
            await bag_client.get_nummeraanduiding("nonexistent", client)

    async def test_429_raises_rate_limit(self, bag_client):
        response = make_mock_response(429)
        client = make_mock_client(get=response)

        with pytest.raises(APIRateLimitError):
            await bag_client.get_nummeraanduiding("test", client)


class TestGetVerblijfsobject:
    async def test_success(self, bag_client):
        data = {"identificatie": "0363010000787980", "oppervlakte": 120}
        response = make_mock_response(200, data)
        client = make_mock_client(get=response)

        result = await bag_client.get_verblijfsobject("0363010000787980", client)
        assert result == data

    async def test_404_raises_not_found(self, bag_client):
        response = make_mock_response(404)
        client = make_mock_client(get=response)

        with pytest.raises(APINotFoundError):
            await bag_client.get_verblijfsobject("nonexistent", client)

    async def test_500_raises_government_error(self, bag_client):
        response = make_mock_response(500)
        client = make_mock_client(get=response)

        with pytest.raises(GovernmentAPIError):
            await bag_client.get_verblijfsobject("test", client)


class TestGetPand:
    async def test_success(self, bag_client):
        data = {"identificatie": "0363100012345678", "oorspronkelijkBouwjaar": "1920"}
        response = make_mock_response(200, data)
        client = make_mock_client(get=response)

        result = await bag_client.get_pand("0363100012345678", client)
        assert result == data

    async def test_404_raises_not_found(self, bag_client):
        response = make_mock_response(404)
        client = make_mock_client(get=response)

        with pytest.raises(APINotFoundError):
            await bag_client.get_pand("nonexistent", client)

    async def test_429_raises_rate_limit(self, bag_client):
        response = make_mock_response(429)
        client = make_mock_client(get=response)

        with pytest.raises(APIRateLimitError):
            await bag_client.get_pand("test", client)
