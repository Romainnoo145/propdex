"""Unit tests for EP-Online V5 API client (energy labels)."""

from unittest.mock import MagicMock, patch

import httpx
import pytest

from app.government_apis.base import GovernmentAPIError
from app.government_apis.ep_online import EPOnlineClient
from app.government_apis.rate_limiter import ep_online_limiter
from app.schemas.energy_label import EnergyLabel
from tests.api_mocks import make_mock_client, make_mock_response

TEST_VBO_ID = "0363010000000001"

SAMPLE_EP_RESPONSE = {
    "energieKlasse": "A",
    "registratieDatum": "2023-01-15",
    "geldigTot": "2033-01-15",
    "soortOpname": "Basisopname",
    "berekeningType": "NTA 8800",
    "opnameDatum": "2023-01-10",
}


@pytest.fixture(autouse=True)
def disable_rate_limiting():
    """Disable rate limiter for all tests in this module."""
    original_enabled = ep_online_limiter.enabled
    ep_online_limiter.enabled = False
    yield
    ep_online_limiter.enabled = original_enabled


class TestEPOnlineClient:
    def test_is_configured_checks_api_key(self):
        """_is_configured() returns True/False based on EP_ONLINE_API_KEY setting."""
        with patch("app.government_apis.ep_online.settings") as mock_settings:
            mock_settings.EP_ONLINE_API_KEY = "valid-key"
            client = EPOnlineClient()
            assert client._is_configured() is True

        with patch("app.government_apis.ep_online.settings") as mock_settings:
            mock_settings.EP_ONLINE_API_KEY = ""
            client = EPOnlineClient()
            assert client._is_configured() is False

    @pytest.mark.asyncio
    async def test_unconfigured_returns_none(self):
        """When EP_ONLINE_API_KEY is empty, get_by_vbo_id returns None."""
        with patch("app.government_apis.ep_online.settings") as mock_settings:
            mock_settings.EP_ONLINE_API_KEY = ""
            client = EPOnlineClient()

            mock_http_client = make_mock_client()

            result = await client.get_by_vbo_id(TEST_VBO_ID, mock_http_client)

            assert result is None
            # HTTP client should NOT have been called
            mock_http_client.get.assert_not_called()

    @pytest.mark.asyncio
    async def test_successful_fetch_returns_energy_label(self):
        """200 response with valid data returns EnergyLabel(is_geregistreerd=True)."""
        with patch("app.government_apis.ep_online.settings") as mock_settings:
            mock_settings.EP_ONLINE_API_KEY = "test-api-key"
            client = EPOnlineClient()

            response = make_mock_response(200, json_data=SAMPLE_EP_RESPONSE)
            mock_http_client = make_mock_client(get=response)

            result = await client.get_by_vbo_id(TEST_VBO_ID, mock_http_client)

            assert isinstance(result, EnergyLabel)
            assert result.is_geregistreerd is True
            assert result.energieklasse == "A"
            assert result.bag_vbo_id == TEST_VBO_ID
            assert result.registratie_datum == "2023-01-15"
            assert result.geldig_tot == "2033-01-15"

    @pytest.mark.asyncio
    async def test_404_returns_not_registered(self):
        """404 response returns EnergyLabel(is_geregistreerd=False) — normal for NRG-03."""
        with patch("app.government_apis.ep_online.settings") as mock_settings:
            mock_settings.EP_ONLINE_API_KEY = "test-api-key"
            client = EPOnlineClient()

            response = make_mock_response(404)
            mock_http_client = make_mock_client(get=response)

            result = await client.get_by_vbo_id(TEST_VBO_ID, mock_http_client)

            assert isinstance(result, EnergyLabel)
            assert result.is_geregistreerd is False
            assert result.niet_geregistreerd_reden == "Niet geregistreerd"
            assert result.bag_vbo_id == TEST_VBO_ID

    @pytest.mark.asyncio
    async def test_500_raises_government_api_error(self):
        """500 response raises GovernmentAPIError."""
        with patch("app.government_apis.ep_online.settings") as mock_settings:
            mock_settings.EP_ONLINE_API_KEY = "test-api-key"
            client = EPOnlineClient()

            response = make_mock_response(500)
            mock_http_client = make_mock_client(get=response)

            with pytest.raises(GovernmentAPIError) as exc_info:
                await client.get_by_vbo_id(TEST_VBO_ID, mock_http_client)

            assert exc_info.value.source == "ep-online"
            assert exc_info.value.status_code == 500

    @pytest.mark.asyncio
    async def test_parse_handles_list_response(self):
        """When EP-Online returns a list, the client takes the first item."""
        with patch("app.government_apis.ep_online.settings") as mock_settings:
            mock_settings.EP_ONLINE_API_KEY = "test-api-key"
            client = EPOnlineClient()

            # API returns a list of labels; client should take first
            response = make_mock_response(200, json_data=[SAMPLE_EP_RESPONSE])
            mock_http_client = make_mock_client(get=response)

            result = await client.get_by_vbo_id(TEST_VBO_ID, mock_http_client)

            assert isinstance(result, EnergyLabel)
            assert result.is_geregistreerd is True
            assert result.energieklasse == "A"

    @pytest.mark.asyncio
    async def test_parse_handles_empty_list_response(self):
        """When EP-Online returns an empty list, returns EnergyLabel(is_geregistreerd=False)."""
        with patch("app.government_apis.ep_online.settings") as mock_settings:
            mock_settings.EP_ONLINE_API_KEY = "test-api-key"
            client = EPOnlineClient()

            # Use a custom mock that returns an actual empty list (api_mocks.py uses
            # json_data or {} which would coerce [] -> {}, so build manually here)
            response = MagicMock(spec=httpx.Response)
            response.status_code = 200
            response.url = httpx.URL("https://public.ep-online.nl/api/v5/test")
            response.json.return_value = []
            response.raise_for_status.return_value = None

            mock_http_client = make_mock_client(get=response)

            result = await client.get_by_vbo_id(TEST_VBO_ID, mock_http_client)

            assert isinstance(result, EnergyLabel)
            assert result.is_geregistreerd is False
            assert result.niet_geregistreerd_reden == "Niet geregistreerd"
