"""Unit tests for RCE Linked Data client (rijksmonumenten detail)."""

from unittest.mock import AsyncMock, MagicMock

import httpx
import pytest

from app.government_apis.base import GovernmentAPIError
from app.government_apis.rate_limiter import rce_detail_limiter
from app.government_apis.rce_linked_data import (
    CEO_NS,
    REGISTER_URL,
    SKOS_NS,
    RCELinkedDataClient,
    _resolve_uri_to_label,
)
from app.schemas.monument import RCEMonumentDetail
from tests.api_mocks import make_mock_response

# ---- Test Data ----

TEST_MONUMENT_NUMBER = "12340"
TEST_CHN = "29177"

# REST API response: list of JSON-LD nodes with Rijksmonument type
REST_API_RESPONSE = [
    {
        "@id": "https://linkeddata.cultureelerfgoed.nl/cho-kennis/id/rijksmonument/29177",
        "@type": [CEO_NS + "Rijksmonument"],
        CEO_NS + "rijksmonumentnummer": [
            {"@value": "https://monumentenregister.cultureelerfgoed.nl/monumenten/12340"}
        ],
        CEO_NS + "cultuurhistorischObjectnummer": [{"@value": TEST_CHN}],
        CEO_NS + "datumInschrijvingInMonumentenregister": [
            {"@value": "1972-09-05", "@type": "http://www.w3.org/2001/XMLSchema#date"}
        ],
    }
]

# Dereference response: monument node with links to omschrijving and functie nodes
OMSCHRIJVING_IRI = (
    "https://linkeddata.cultureelerfgoed.nl/cho-kennis/id/omschrijving/9999"
)
FUNCTIE_IRI = "https://linkeddata.cultureelerfgoed.nl/cho-kennis/id/functie/8888"
SKOS_TERM_IRI = "https://linkeddata.cultureelerfgoed.nl/def/ceo/thesaurus/functie/boerderij"

DEREF_RESPONSE = [
    {
        "@id": "https://linkeddata.cultureelerfgoed.nl/cho-kennis/id/rijksmonument/29177",
        "@type": [CEO_NS + "Rijksmonument"],
        CEO_NS + "heeftOmschrijving": [{"@id": OMSCHRIJVING_IRI}],
        CEO_NS + "heeftOorspronkelijkeFunctie": [{"@id": FUNCTIE_IRI}],
    }
]

# Omschrijving node response
OMSCHRIJVING_RESPONSE = [
    {
        "@id": OMSCHRIJVING_IRI,
        "@type": [CEO_NS + "Omschrijving"],
        CEO_NS + "omschrijving": [
            {"@value": "Een historische boerderij uit de 18e eeuw."}
        ],
    }
]

# Functie node response with SKOS term
FUNCTIE_RESPONSE = [
    {
        "@id": FUNCTIE_IRI,
        "@type": [CEO_NS + "Functie"],
        CEO_NS + "heeftFunctieNaam": [{"@id": SKOS_TERM_IRI}],
    },
    {
        "@id": SKOS_TERM_IRI,
        SKOS_NS + "prefLabel": [{"@value": "Boerderij", "@language": "nl"}],
    },
]


def _make_json_response(json_data: list | dict) -> MagicMock:
    """Create a mock httpx.Response returning specific JSON data."""
    response = MagicMock(spec=httpx.Response)
    response.status_code = 200
    response.url = httpx.URL("https://linkeddata.cultureelerfgoed.nl/test")
    response.json.return_value = json_data
    response.raise_for_status.return_value = None
    return response


def _make_http_client_with_url_dispatch(url_responses: dict) -> AsyncMock:
    """Create a mock client whose .get() dispatches responses by URL substring."""
    client = AsyncMock(spec=httpx.AsyncClient)

    async def dispatch(url, **kwargs):
        url_str = str(url)
        for key, response in url_responses.items():
            if key in url_str:
                return response
        # Default 404 if no URL matches
        resp = MagicMock(spec=httpx.Response)
        resp.status_code = 404
        resp.url = httpx.URL(url_str)
        resp.json.return_value = {}
        resp.raise_for_status.side_effect = httpx.HTTPStatusError(
            message="HTTP 404",
            request=MagicMock(spec=httpx.Request),
            response=resp,
        )
        return resp

    client.get.side_effect = dispatch
    return client


@pytest.fixture(autouse=True)
def disable_rate_limiting():
    """Disable rate limiter for all tests in this module."""
    original_enabled = rce_detail_limiter.enabled
    rce_detail_limiter.enabled = False
    yield
    rce_detail_limiter.enabled = original_enabled


class TestRCELinkedDataClient:
    @pytest.mark.asyncio
    async def test_successful_fetch_returns_monument_detail(self):
        """Full three-step fetch returns RCEMonumentDetail with all available fields."""
        client = RCELinkedDataClient()

        url_responses = {
            "rest-api-rijksmonumenten": _make_json_response(REST_API_RESPONSE),
            "/id/rijksmonument/": _make_json_response(DEREF_RESPONSE),
            "/id/omschrijving/": _make_json_response(OMSCHRIJVING_RESPONSE),
            "/id/functie/": _make_json_response(FUNCTIE_RESPONSE),
        }
        mock_client = _make_http_client_with_url_dispatch(url_responses)

        result = await client.get_detail_by_monument_number(TEST_MONUMENT_NUMBER, mock_client)

        assert isinstance(result, RCEMonumentDetail)
        assert result.rijksmonumentnummer == TEST_MONUMENT_NUMBER
        assert result.redengevende_omschrijving == "Een historische boerderij uit de 18e eeuw."
        assert result.oorspronkelijke_functie == "Boerderij"
        assert result.monument_register_url == REGISTER_URL.format(nr=TEST_MONUMENT_NUMBER)

    @pytest.mark.asyncio
    async def test_parses_jsonld_namespace_keys(self):
        """JSON-LD namespace URI keys are parsed correctly (not treated as plain dict keys)."""
        client = RCELinkedDataClient()

        url_responses = {
            "rest-api-rijksmonumenten": _make_json_response(REST_API_RESPONSE),
            "/id/rijksmonument/": _make_json_response(DEREF_RESPONSE),
            "/id/omschrijving/": _make_json_response(OMSCHRIJVING_RESPONSE),
            "/id/functie/": _make_json_response(FUNCTIE_RESPONSE),
        }
        mock_client = _make_http_client_with_url_dispatch(url_responses)

        result = await client.get_detail_by_monument_number(TEST_MONUMENT_NUMBER, mock_client)

        # The cultuurhistorischObjectnummer must be extracted from the full namespace key
        # If namespace parsing fails, chn would be None and we'd only get basic fields
        assert result is not None
        assert result.rijksmonumentnummer == TEST_MONUMENT_NUMBER
        # omschrijving proves dereference step worked (depends on CHN extraction)
        assert result.redengevende_omschrijving is not None

    def test_uri_to_label_resolution(self):
        """_resolve_uri_to_label converts URI path segments to human-readable labels."""
        assert _resolve_uri_to_label(
            "https://linkeddata.cultureelerfgoed.nl/def/ceo/thesaurus/bouwstijl/neoclassicisme"
        ) == "Neoclassicisme"

        assert _resolve_uri_to_label(
            "https://linkeddata.cultureelerfgoed.nl/def/ceo/thesaurus/functie/woonhuis"
        ) == "Woonhuis"

        # Hyphenated labels are title-cased first word
        assert _resolve_uri_to_label(
            "https://example.com/some-style"
        ) == "Some style"

        # Local ID fallback (no path structure)
        assert _resolve_uri_to_label("116634") == "116634"

    @pytest.mark.asyncio
    async def test_not_found_returns_none(self):
        """When REST API returns 404 for the monument, result is None."""
        client = RCELinkedDataClient()

        not_found_response = MagicMock(spec=httpx.Response)
        not_found_response.status_code = 404
        not_found_response.url = httpx.URL("https://api.linkeddata.cultureelerfgoed.nl/test")
        not_found_response.json.return_value = {}
        not_found_response.raise_for_status.side_effect = httpx.HTTPStatusError(
            message="HTTP 404",
            request=MagicMock(spec=httpx.Request),
            response=not_found_response,
        )

        mock_client = AsyncMock(spec=httpx.AsyncClient)
        mock_client.get.return_value = not_found_response

        result = await client.get_detail_by_monument_number(TEST_MONUMENT_NUMBER, mock_client)

        assert result is None

    @pytest.mark.asyncio
    async def test_500_raises_government_api_error(self):
        """500 from REST API raises GovernmentAPIError."""
        client = RCELinkedDataClient()

        error_response = make_mock_response(500)
        mock_client = AsyncMock(spec=httpx.AsyncClient)
        mock_client.get.return_value = error_response

        with pytest.raises(GovernmentAPIError) as exc_info:
            await client.get_detail_by_monument_number(TEST_MONUMENT_NUMBER, mock_client)

        assert exc_info.value.source == "rce-linked-data"

    @pytest.mark.asyncio
    async def test_dereference_failure_graceful_degradation(self):
        """When dereference fails, returns RCEMonumentDetail with basic fields only."""
        client = RCELinkedDataClient()

        # REST API succeeds, dereference returns non-200 (handled gracefully)
        rest_response = _make_json_response(REST_API_RESPONSE)
        deref_response = MagicMock(spec=httpx.Response)
        deref_response.status_code = 503
        deref_response.url = httpx.URL(
            "https://linkeddata.cultureelerfgoed.nl/cho-kennis/id/rijksmonument/29177"
        )
        deref_response.json.return_value = {}
        deref_response.raise_for_status.return_value = None

        async def dispatch(url, **kwargs):
            url_str = str(url)
            if "rest-api-rijksmonumenten" in url_str:
                return rest_response
            return deref_response

        mock_client = AsyncMock(spec=httpx.AsyncClient)
        mock_client.get.side_effect = dispatch

        result = await client.get_detail_by_monument_number(TEST_MONUMENT_NUMBER, mock_client)

        assert isinstance(result, RCEMonumentDetail)
        assert result.rijksmonumentnummer == TEST_MONUMENT_NUMBER
        # Detail fields absent when dereference fails
        assert result.redengevende_omschrijving is None
        assert result.monument_register_url == REGISTER_URL.format(nr=TEST_MONUMENT_NUMBER)

    @pytest.mark.asyncio
    async def test_monument_register_url_constructed(self):
        """monument_register_url is always set to the official register URL."""
        client = RCELinkedDataClient()

        url_responses = {
            "rest-api-rijksmonumenten": _make_json_response(REST_API_RESPONSE),
            "/id/rijksmonument/": _make_json_response(DEREF_RESPONSE),
            "/id/omschrijving/": _make_json_response(OMSCHRIJVING_RESPONSE),
            "/id/functie/": _make_json_response(FUNCTIE_RESPONSE),
        }
        mock_client = _make_http_client_with_url_dispatch(url_responses)

        result = await client.get_detail_by_monument_number(TEST_MONUMENT_NUMBER, mock_client)

        assert result is not None
        expected_url = f"https://monumentenregister.cultureelerfgoed.nl/monumenten/{TEST_MONUMENT_NUMBER}"
        assert result.monument_register_url == expected_url

    @pytest.mark.asyncio
    async def test_bouwperiode_extracted_from_graph(self):
        """bouwjaar_van and bouwjaar_tot are extracted from Bouwperiode node if present."""
        client = RCELinkedDataClient()

        # Deref response including a Bouwperiode node
        deref_with_bouwperiode = DEREF_RESPONSE + [
            {
                "@id": "https://linkeddata.cultureelerfgoed.nl/cho-kennis/id/bouwperiode/5555",
                "@type": [CEO_NS + "Bouwperiode"],
                CEO_NS + "bouwjaarVan": [{"@value": "1780"}],
                CEO_NS + "bouwjaarTot": [{"@value": "1820"}],
            }
        ]

        url_responses = {
            "rest-api-rijksmonumenten": _make_json_response(REST_API_RESPONSE),
            "/id/rijksmonument/": _make_json_response(deref_with_bouwperiode),
            "/id/omschrijving/": _make_json_response(OMSCHRIJVING_RESPONSE),
            "/id/functie/": _make_json_response(FUNCTIE_RESPONSE),
        }
        mock_client = _make_http_client_with_url_dispatch(url_responses)

        result = await client.get_detail_by_monument_number(TEST_MONUMENT_NUMBER, mock_client)

        assert result is not None
        assert result.bouwjaar_van == 1780
        assert result.bouwjaar_tot == 1820

    @pytest.mark.asyncio
    async def test_no_monument_node_in_rest_response_returns_none(self):
        """REST API 200 response with no Rijksmonument node returns None."""
        client = RCELinkedDataClient()

        # Response with no matching type
        empty_graph_response = _make_json_response(
            [{"@id": "https://example.com/other", "@type": ["https://example.com/OtherType"]}]
        )

        mock_client = AsyncMock(spec=httpx.AsyncClient)
        mock_client.get.return_value = empty_graph_response

        result = await client.get_detail_by_monument_number(TEST_MONUMENT_NUMBER, mock_client)

        assert result is None
