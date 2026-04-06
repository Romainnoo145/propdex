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


class TestParseRdPoint:
    def test_parse_rd_point_valid(self, pdok_client):
        from app.government_apis.pdok_locatieserver import _parse_rd_point

        result = _parse_rd_point("POINT(121348.243 487347.752)")
        assert result == (121348.243, 487347.752)

    def test_parse_rd_point_invalid(self, pdok_client):
        from app.government_apis.pdok_locatieserver import _parse_rd_point

        result = _parse_rd_point("invalid")
        assert result is None

    def test_parse_rd_point_empty(self, pdok_client):
        from app.government_apis.pdok_locatieserver import _parse_rd_point

        result = _parse_rd_point("")
        assert result is None


class TestAddressesForParcel:
    """Tests for addresses_for_parcel method."""

    @pytest.fixture(autouse=True)
    def _patch_infra(self, monkeypatch):
        """Bypass rate limiter and retry wrapper so plain mock clients work."""
        import contextlib

        class _NoopLimiter:
            async def __aenter__(self):
                return self

            async def __aexit__(self, *a):
                pass

        monkeypatch.setattr(
            "app.government_apis.pdok_locatieserver.pdok_locatieserver_limiter",
            _NoopLimiter(),
        )

        async def _passthrough(fn, **_kw):
            return await fn()

        monkeypatch.setattr(
            "app.government_apis.pdok_locatieserver.retry_with_backoff",
            _passthrough,
        )

    async def test_success_returns_sorted_addresses(self, pdok_client):
        docs = [
            {"straatnaam": "Houtstraat", "huisnummer": 13, "huisletter": None, "toevoeging": None},
            {"straatnaam": "Houtstraat", "huisnummer": 11, "huisletter": "A", "toevoeging": None},
            {"straatnaam": "Houtstraat", "huisnummer": 11, "huisletter": None, "toevoeging": None},
        ]
        response = make_mock_response(200, {"response": {"docs": docs}})
        client = make_mock_client(get=response)

        result = await pdok_client.addresses_for_parcel("VLO00", "I", "5870", client)
        assert result == ["Houtstraat 11", "Houtstraat 11A", "Houtstraat 13"]

    async def test_empty_results(self, pdok_client):
        response = make_mock_response(200, {"response": {"docs": []}})
        client = make_mock_client(get=response)

        result = await pdok_client.addresses_for_parcel("VLO00", "I", "9999", client)
        assert result == []

    async def test_missing_straatnaam_skipped(self, pdok_client):
        docs = [
            {"straatnaam": "", "huisnummer": 1},
            {"straatnaam": "Kerkstraat", "huisnummer": 5},
        ]
        response = make_mock_response(200, {"response": {"docs": docs}})
        client = make_mock_client(get=response)

        result = await pdok_client.addresses_for_parcel("VLO00", "A", "100", client)
        assert result == ["Kerkstraat 5"]

    async def test_missing_huisnummer_skipped(self, pdok_client):
        docs = [
            {"straatnaam": "Kerkstraat", "huisnummer": None},
            {"straatnaam": "Kerkstraat", "huisnummer": 3},
        ]
        response = make_mock_response(200, {"response": {"docs": docs}})
        client = make_mock_client(get=response)

        result = await pdok_client.addresses_for_parcel("VLO00", "A", "100", client)
        assert result == ["Kerkstraat 3"]

    async def test_api_error_returns_empty(self, pdok_client):
        """Network / 5xx errors return [] gracefully."""
        from unittest.mock import AsyncMock

        client = AsyncMock()
        client.get.side_effect = Exception("Connection refused")

        result = await pdok_client.addresses_for_parcel("VLO00", "I", "5870", client)
        assert result == []

    async def test_constructs_correct_perceel_key(self, pdok_client):
        """Verify the fq parameter uses the correct perceel key format."""
        response = make_mock_response(200, {"response": {"docs": []}})
        client = make_mock_client(get=response)

        await pdok_client.addresses_for_parcel("ASD04", "S", "12345", client)

        call_kwargs = client.get.call_args
        params = call_kwargs[1].get("params") or call_kwargs[0][1]
        fq = params["fq"]
        assert "gekoppeld_perceel:ASD04-S-12345" in fq


class TestGeocodeAddress:
    async def test_geocode_address_success(self, pdok_client):
        """Mock PDOK /free response, assert returns RD coordinates."""
        doc = {"id": "adr-123", "centroide_rd": "POINT(121348.243 487347.752)"}
        response = make_mock_response(200, {"response": {"docs": [doc]}})
        client = make_mock_client(get=response)

        result = await pdok_client.geocode_address(
            street="Kerkstraat",
            huisnummer=42,
            client=client,
            postcode="5911AA",
        )
        assert result == (121348.243, 487347.752)

    async def test_geocode_address_no_results(self, pdok_client):
        """Empty docs returns None."""
        response = make_mock_response(200, {"response": {"docs": []}})
        client = make_mock_client(get=response)

        result = await pdok_client.geocode_address(
            street="Nonexistentstraat",
            huisnummer=999,
            client=client,
        )
        assert result is None

    async def test_geocode_address_no_centroide_rd(self, pdok_client):
        """Doc without centroide_rd field returns None."""
        doc = {"id": "adr-123", "centroide_ll": "POINT(5.9 51.4)"}
        response = make_mock_response(200, {"response": {"docs": [doc]}})
        client = make_mock_client(get=response)

        result = await pdok_client.geocode_address(
            street="Kerkstraat",
            huisnummer=42,
            client=client,
        )
        assert result is None

    async def test_geocode_address_with_postcode(self, pdok_client):
        """Verify query string includes postcode when provided."""
        doc = {"id": "adr-123", "centroide_rd": "POINT(100000.0 400000.0)"}
        response = make_mock_response(200, {"response": {"docs": [doc]}})
        client = make_mock_client(get=response)

        await pdok_client.geocode_address(
            street="Kerkstraat",
            huisnummer=42,
            client=client,
            postcode="5911AA",
        )

        call_kwargs = client.get.call_args
        params = call_kwargs[1]["params"] if "params" in call_kwargs[1] else call_kwargs[0][1]
        assert "5911AA" in params["q"]

    async def test_geocode_address_no_postcode_no_city_uses_gemeente(self, pdok_client):
        """When both postcode=None and city=None, gemeente_naam is used in query."""
        doc = {"id": "adr-123", "centroide_rd": "POINT(100000.0 400000.0)"}
        response = make_mock_response(200, {"response": {"docs": [doc]}})
        client = make_mock_client(get=response)

        await pdok_client.geocode_address(
            street="Kerkstraat",
            huisnummer=42,
            client=client,
            gemeente_naam="Venlo",
        )

        call_kwargs = client.get.call_args
        params = call_kwargs[1]["params"] if "params" in call_kwargs[1] else call_kwargs[0][1]
        assert "Venlo" in params["q"]

    async def test_geocode_address_api_error(self, pdok_client):
        """Mock exception returns None (graceful failure)."""
        from unittest.mock import AsyncMock

        client = AsyncMock()
        client.get.side_effect = Exception("Network error")

        result = await pdok_client.geocode_address(
            street="Kerkstraat",
            huisnummer=42,
            client=client,
        )
        assert result is None
