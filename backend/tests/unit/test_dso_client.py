"""Tests for DSO Spatial Plans API client."""

from unittest.mock import AsyncMock

import httpx
import pytest

from app.government_apis.base import APITimeoutError, GovernmentAPIError
from app.government_apis.dso_spatial_plans import DSOSpatialPlansClient
from tests.api_mocks import make_mock_response


@pytest.fixture
def dso_client():
    return DSOSpatialPlansClient(api_key="test-key-123")


@pytest.fixture
def dso_client_no_key():
    return DSOSpatialPlansClient(api_key="")


def _make_plans_page(plans: list[dict], next_href: str | None = None) -> dict:
    """Build a HAL+JSON plans response page."""
    data: dict = {"_embedded": {"plannen": plans}}
    if next_href:
        data["_links"] = {"next": {"href": next_href}}
    else:
        data["_links"] = {}
    return data


def _make_vlakken_page(key: str, items: list[dict], next_href: str | None = None) -> dict:
    """Build a HAL+JSON vlakken response page."""
    data: dict = {"_embedded": {key: items}}
    if next_href:
        data["_links"] = {"next": {"href": next_href}}
    else:
        data["_links"] = {}
    return data


class TestFindPlansAtLocation:
    async def test_single_page_success(self, dso_client):
        plans = [{"id": "plan-1", "naam": "Bestemmingsplan Centrum"}]
        page_data = _make_plans_page(plans)
        response = make_mock_response(200, page_data)
        client = AsyncMock(spec=httpx.AsyncClient)
        client.post.return_value = response

        result = await dso_client.find_plans_at_location(121687.0, 487484.0, client)
        assert result == plans

    async def test_multi_page(self, dso_client):
        page1 = _make_plans_page([{"id": "p1"}], next_href="https://dso.nl/page2")
        page2 = _make_plans_page([{"id": "p2"}])
        resp1 = make_mock_response(200, page1)
        resp2 = make_mock_response(200, page2)

        client = AsyncMock(spec=httpx.AsyncClient)
        client.post.return_value = resp1
        client.get.return_value = resp2

        result = await dso_client.find_plans_at_location(121687.0, 487484.0, client)
        assert result == [{"id": "p1"}, {"id": "p2"}]
        client.get.assert_called_once()

    async def test_max_5_pages(self, dso_client):
        """Stops at 5 pages even if more are available."""
        pages = []
        for i in range(6):
            href = f"https://dso.nl/page{i+2}" if i < 5 else None
            pages.append(_make_plans_page([{"id": f"p{i+1}"}], next_href=href if i < 5 else None))

        # Page 1 via POST, pages 2-6 all have next links
        for i in range(1, 6):
            pages[i] = _make_plans_page([{"id": f"p{i+1}"}], next_href=f"https://dso.nl/page{i+2}")

        client = AsyncMock(spec=httpx.AsyncClient)
        client.post.return_value = make_mock_response(200, pages[0])
        # Pages 2-5 (4 GET calls max, since page_count starts at 1 and stops at < 5)
        client.get.side_effect = [make_mock_response(200, pages[i]) for i in range(1, 5)]

        result = await dso_client.find_plans_at_location(121687.0, 487484.0, client)
        assert len(result) == 5  # 5 pages, 1 plan each
        assert client.get.call_count == 4  # 4 GET calls (page 1 was POST)

    async def test_empty_plans(self, dso_client):
        page_data = _make_plans_page([])
        response = make_mock_response(200, page_data)
        client = AsyncMock(spec=httpx.AsyncClient)
        client.post.return_value = response

        result = await dso_client.find_plans_at_location(121687.0, 487484.0, client)
        assert result == []

    async def test_timeout_raises(self, dso_client):
        client = AsyncMock(spec=httpx.AsyncClient)
        client.post.side_effect = httpx.TimeoutException("timed out")

        with pytest.raises(APITimeoutError):
            await dso_client.find_plans_at_location(121687.0, 487484.0, client)

    async def test_http_error_raises(self, dso_client):
        client = AsyncMock(spec=httpx.AsyncClient)
        client.post.side_effect = httpx.HTTPError("connection failed")

        with pytest.raises(GovernmentAPIError):
            await dso_client.find_plans_at_location(121687.0, 487484.0, client)

    async def test_post_body_contains_geojson_point(self, dso_client):
        page_data = _make_plans_page([])
        response = make_mock_response(200, page_data)
        client = AsyncMock(spec=httpx.AsyncClient)
        client.post.return_value = response

        await dso_client.find_plans_at_location(121687.0, 487484.0, client)
        call_kwargs = client.post.call_args.kwargs
        assert call_kwargs["json"] == {"type": "Point", "coordinates": [121687.0, 487484.0]}


class TestGetBestemmingsvlakken:
    async def test_success(self, dso_client):
        vlakken = [{"naam": "Wonen"}]
        page_data = _make_vlakken_page("bestemmingsvlakken", vlakken)
        response = make_mock_response(200, page_data)
        client = AsyncMock(spec=httpx.AsyncClient)
        client.get.return_value = response

        result = await dso_client.get_bestemmingsvlakken("NL.IMRO.0363.A1234", client)
        assert result == vlakken

    async def test_pagination(self, dso_client):
        page1 = _make_vlakken_page("bestemmingsvlakken", [{"naam": "Wonen"}], next_href="https://dso.nl/p2")
        page2 = _make_vlakken_page("bestemmingsvlakken", [{"naam": "Bedrijf"}])

        client = AsyncMock(spec=httpx.AsyncClient)
        client.get.side_effect = [
            make_mock_response(200, page1),
            make_mock_response(200, page2),
        ]

        result = await dso_client.get_bestemmingsvlakken("NL.IMRO.0363.A1234", client)
        assert len(result) == 2
        assert result[0]["naam"] == "Wonen"
        assert result[1]["naam"] == "Bedrijf"

    async def test_timeout_raises(self, dso_client):
        client = AsyncMock(spec=httpx.AsyncClient)
        client.get.side_effect = httpx.TimeoutException("timed out")

        with pytest.raises(APITimeoutError):
            await dso_client.get_bestemmingsvlakken("NL.IMRO.0363.A1234", client)


class TestGetBouwvlakken:
    async def test_success(self, dso_client):
        vlakken = [{"geometrie": {"type": "Polygon"}}]
        page_data = _make_vlakken_page("bouwvlakken", vlakken)
        response = make_mock_response(200, page_data)
        client = AsyncMock(spec=httpx.AsyncClient)
        client.get.return_value = response

        result = await dso_client.get_bouwvlakken("NL.IMRO.0363.A1234", client)
        assert result == vlakken

    async def test_pagination(self, dso_client):
        page1 = _make_vlakken_page("bouwvlakken", [{"id": "1"}], next_href="https://dso.nl/p2")
        page2 = _make_vlakken_page("bouwvlakken", [{"id": "2"}])

        client = AsyncMock(spec=httpx.AsyncClient)
        client.get.side_effect = [
            make_mock_response(200, page1),
            make_mock_response(200, page2),
        ]

        result = await dso_client.get_bouwvlakken("NL.IMRO.0363.A1234", client)
        assert len(result) == 2

    async def test_timeout_raises(self, dso_client):
        client = AsyncMock(spec=httpx.AsyncClient)
        client.get.side_effect = httpx.TimeoutException("timed out")

        with pytest.raises(APITimeoutError):
            await dso_client.get_bouwvlakken("NL.IMRO.0363.A1234", client)


class TestGetMaatvoeringen:
    async def test_success(self, dso_client):
        items = [{"naam": "maximum bouwhoogte", "waarde": "10m"}]
        page_data = _make_vlakken_page("maatvoeringen", items)
        response = make_mock_response(200, page_data)
        client = AsyncMock(spec=httpx.AsyncClient)
        client.get.return_value = response

        result = await dso_client.get_maatvoeringen("NL.IMRO.0363.A1234", client)
        assert result == items

    async def test_pagination(self, dso_client):
        page1 = _make_vlakken_page("maatvoeringen", [{"id": "1"}], next_href="https://dso.nl/p2")
        page2 = _make_vlakken_page("maatvoeringen", [{"id": "2"}])

        client = AsyncMock(spec=httpx.AsyncClient)
        client.get.side_effect = [
            make_mock_response(200, page1),
            make_mock_response(200, page2),
        ]

        result = await dso_client.get_maatvoeringen("NL.IMRO.0363.A1234", client)
        assert len(result) == 2

    async def test_timeout_raises(self, dso_client):
        client = AsyncMock(spec=httpx.AsyncClient)
        client.get.side_effect = httpx.TimeoutException("timed out")

        with pytest.raises(APITimeoutError):
            await dso_client.get_maatvoeringen("NL.IMRO.0363.A1234", client)


class TestHeaders:
    def test_api_key_included(self, dso_client):
        headers = dso_client._headers
        assert headers["X-Api-Key"] == "test-key-123"

    def test_api_key_omitted_when_empty(self, dso_client_no_key):
        headers = dso_client_no_key._headers
        assert "X-Api-Key" not in headers
