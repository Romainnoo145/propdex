"""Tests for PDOK Locatieserver API client."""

import pytest

from app.government_apis.base import APINotFoundError, GovernmentAPIError
from app.government_apis.pdok_locatieserver import PDOKLocatieserver
from tests.api_mocks import make_mock_client, make_mock_response


@pytest.fixture
def pdok_client():
    return PDOKLocatieserver()


class TestSuggest:
    async def test_success(self, pdok_client):
        docs = [{"weergavenaam": "Keizersgracht 1, Amsterdam"}, {"weergavenaam": "Keizersgracht 2"}]
        response = make_mock_response(200, {"response": {"docs": docs}})
        client = make_mock_client(get=response)

        result = await pdok_client.suggest("Keizersgracht", client)
        assert result == docs

    async def test_empty_results(self, pdok_client):
        response = make_mock_response(200, {"response": {"docs": []}})
        client = make_mock_client(get=response)

        result = await pdok_client.suggest("zzzznonexistent", client)
        assert result == []

    async def test_malformed_response(self, pdok_client):
        response = make_mock_response(200, {})
        client = make_mock_client(get=response)

        result = await pdok_client.suggest("test", client)
        assert result == []

    async def test_500_raises(self, pdok_client):
        response = make_mock_response(500)
        client = make_mock_client(get=response)

        with pytest.raises(GovernmentAPIError):
            await pdok_client.suggest("test", client)


class TestLookup:
    async def test_success(self, pdok_client):
        doc = {"id": "adr-123", "centroide_ll": "POINT(4.9 52.37)"}
        response = make_mock_response(200, {"response": {"docs": [doc]}})
        client = make_mock_client(get=response)

        result = await pdok_client.lookup("adr-123", client)
        assert result == doc

    async def test_empty_raises_not_found(self, pdok_client):
        response = make_mock_response(200, {"response": {"docs": []}})
        client = make_mock_client(get=response)

        with pytest.raises(APINotFoundError):
            await pdok_client.lookup("nonexistent", client)

    async def test_404_raises(self, pdok_client):
        response = make_mock_response(404)
        client = make_mock_client(get=response)

        with pytest.raises(APINotFoundError):
            await pdok_client.lookup("nonexistent", client)
