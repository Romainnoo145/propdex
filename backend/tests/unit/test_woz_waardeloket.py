"""Unit tests for WOZ Waardeloket API client (property valuations)."""

import pytest

from app.government_apis.base import GovernmentAPIError
from app.government_apis.rate_limiter import woz_waardeloket_limiter
from app.government_apis.woz_waardeloket import WOZWaardeloketClient
from app.schemas.woz import WOZData
from tests.api_mocks import make_mock_client, make_mock_response

TEST_NUMMERAANDUIDING_ID = "0363200000218908"

SAMPLE_WOZ_RESPONSE = {
    "wozObjectnummer": "059300000001234",
    "wozWaarden": [
        {
            "vastgesteldeWaarde": 450000,
            "peildatum": "2024-01-01",
            "toestandspeildatum": "2023-01-01",
        },
        {
            "vastgesteldeWaarde": 420000,
            "peildatum": "2023-01-01",
            "toestandspeildatum": "2022-01-01",
        },
    ],
    "grondoppervlakte": 85,
}


@pytest.fixture(autouse=True)
def disable_rate_limiting():
    """Disable rate limiter for all tests in this module."""
    original_enabled = woz_waardeloket_limiter.enabled
    woz_waardeloket_limiter.enabled = False
    yield
    woz_waardeloket_limiter.enabled = original_enabled


class TestWOZWaardeloketClient:
    @pytest.mark.asyncio
    async def test_successful_fetch_returns_woz_data(self):
        """200 response returns WOZData with correct field mapping."""
        client = WOZWaardeloketClient()

        response = make_mock_response(200, json_data=SAMPLE_WOZ_RESPONSE)
        mock_http_client = make_mock_client(get=response)

        result = await client.get_by_nummeraanduiding_id(
            TEST_NUMMERAANDUIDING_ID, mock_http_client
        )

        assert isinstance(result, WOZData)
        assert result.woz_objectnummer == "059300000001234"
        assert result.meest_recente_waarde == 450000
        assert result.meest_recente_peildatum == "2024-01-01"
        assert len(result.waarden) == 2
        assert result.grondoppervlakte == 85

    @pytest.mark.asyncio
    async def test_low_confidence_always_set(self):
        """WOZ data always has low_confidence=True and the expected reden (WOZ-04)."""
        client = WOZWaardeloketClient()

        response = make_mock_response(200, json_data=SAMPLE_WOZ_RESPONSE)
        mock_http_client = make_mock_client(get=response)

        result = await client.get_by_nummeraanduiding_id(
            TEST_NUMMERAANDUIDING_ID, mock_http_client
        )

        assert result is not None
        assert result.low_confidence is True
        assert result.low_confidence_reden == "Bron: WOZ Waardeloket (indicatief)"

    @pytest.mark.asyncio
    async def test_404_returns_none(self):
        """404 response returns None — no WOZ object for this address (normal)."""
        client = WOZWaardeloketClient()

        response = make_mock_response(404)
        mock_http_client = make_mock_client(get=response)

        result = await client.get_by_nummeraanduiding_id(
            TEST_NUMMERAANDUIDING_ID, mock_http_client
        )

        assert result is None

    @pytest.mark.asyncio
    async def test_unexpected_format_raises_error(self):
        """200 with unexpected format (empty dict, no required fields) raises GovernmentAPIError."""
        client = WOZWaardeloketClient()

        # Empty dict has neither wozWaarden nor wozObjectnummer
        response = make_mock_response(200, json_data={})
        mock_http_client = make_mock_client(get=response)

        with pytest.raises(GovernmentAPIError) as exc_info:
            await client.get_by_nummeraanduiding_id(
                TEST_NUMMERAANDUIDING_ID, mock_http_client
            )

        assert exc_info.value.source == "woz-waardeloket"
        assert "unexpected" in exc_info.value.message.lower()

    @pytest.mark.asyncio
    async def test_500_raises_government_api_error(self):
        """500 response raises GovernmentAPIError."""
        client = WOZWaardeloketClient()

        response = make_mock_response(500)
        mock_http_client = make_mock_client(get=response)

        with pytest.raises(GovernmentAPIError) as exc_info:
            await client.get_by_nummeraanduiding_id(
                TEST_NUMMERAANDUIDING_ID, mock_http_client
            )

        assert exc_info.value.source == "woz-waardeloket"
        assert exc_info.value.status_code == 500

    @pytest.mark.asyncio
    async def test_most_recent_value_is_highest_peildatum(self):
        """meest_recente_waarde corresponds to the highest peildatum."""
        client = WOZWaardeloketClient()

        # Response with values out of chronological order
        unordered_response = {
            "wozObjectnummer": "059300000001234",
            "wozWaarden": [
                {"vastgesteldeWaarde": 300000, "peildatum": "2021-01-01"},
                {"vastgesteldeWaarde": 500000, "peildatum": "2025-01-01"},
                {"vastgesteldeWaarde": 420000, "peildatum": "2023-01-01"},
            ],
        }
        response = make_mock_response(200, json_data=unordered_response)
        mock_http_client = make_mock_client(get=response)

        result = await client.get_by_nummeraanduiding_id(
            TEST_NUMMERAANDUIDING_ID, mock_http_client
        )

        assert result is not None
        assert result.meest_recente_waarde == 500000
        assert result.meest_recente_peildatum == "2025-01-01"
