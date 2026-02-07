"""Tests for RCE Monument API client and coordinate transformers."""

from unittest.mock import AsyncMock, MagicMock

import httpx
import pytest

from app.government_apis.rce_monuments import (
    RCEMonumentClient,
    rd_to_wgs84,
    wgs84_to_rd,
)


@pytest.fixture
def rce_client():
    return RCEMonumentClient()


def _make_rce_response(docs: list[dict]) -> MagicMock:
    """Create a mock response for RCE Solr API."""
    response = MagicMock(spec=httpx.Response)
    response.json.return_value = {"response": {"docs": docs}}
    return response


class TestQueryByLocation:
    async def test_success(self, rce_client):
        docs = [{"rce_objrijksnr": "12345", "abc_naam": "Grachtenpand"}]
        response = _make_rce_response(docs)
        client = AsyncMock(spec=httpx.AsyncClient)
        client.get.return_value = response

        result = await rce_client.query_by_location(121687.0, 487484.0, client)
        assert result == docs

    async def test_empty(self, rce_client):
        response = _make_rce_response([])
        client = AsyncMock(spec=httpx.AsyncClient)
        client.get.return_value = response

        result = await rce_client.query_by_location(0.0, 0.0, client)
        assert result == []

    async def test_coordinate_transform(self, rce_client):
        """Verify params contain WGS84 lat/lon, NOT RD x/y."""
        response = _make_rce_response([])
        client = AsyncMock(spec=httpx.AsyncClient)
        client.get.return_value = response

        await rce_client.query_by_location(121687.0, 487484.0, client)
        call_kwargs = client.get.call_args.kwargs
        pt_value = call_kwargs["params"]["pt"]
        # pt should be "lat,lon" format — lat ~ 52.37, lon ~ 4.9 for Amsterdam
        lat_str, lon_str = pt_value.split(",")
        lat, lon = float(lat_str), float(lon_str)
        assert 52.0 < lat < 53.0, f"Expected latitude ~52.37, got {lat}"
        assert 4.5 < lon < 5.5, f"Expected longitude ~4.9, got {lon}"


class TestGetByMonumentNumber:
    async def test_found(self, rce_client):
        doc = {"rce_objrijksnr": "12345", "abc_naam": "Rijksmuseum"}
        response = _make_rce_response([doc])
        client = AsyncMock(spec=httpx.AsyncClient)
        client.get.return_value = response

        result = await rce_client.get_by_monument_number("12345", client)
        assert result == doc

    async def test_not_found(self, rce_client):
        response = _make_rce_response([])
        client = AsyncMock(spec=httpx.AsyncClient)
        client.get.return_value = response

        result = await rce_client.get_by_monument_number("99999", client)
        assert result is None

    async def test_malformed_response(self, rce_client):
        response = MagicMock(spec=httpx.Response)
        response.json.return_value = {}
        client = AsyncMock(spec=httpx.AsyncClient)
        client.get.return_value = response

        result = await rce_client.get_by_monument_number("12345", client)
        assert result is None


class TestCoordinateTransforms:
    def test_rd_to_wgs84_known_coords(self):
        """Amsterdam Centraal: RD (121687, 487484) -> approx WGS84 (4.9, 52.37)."""
        lon, lat = rd_to_wgs84(121687.0, 487484.0)
        assert abs(lon - 4.9) < 0.1, f"Expected lon ~4.9, got {lon}"
        assert abs(lat - 52.37) < 0.1, f"Expected lat ~52.37, got {lat}"

    def test_wgs84_to_rd_known_coords(self):
        """Reverse: WGS84 (4.9, 52.37) -> approx RD (121687, 487484)."""
        x, y = wgs84_to_rd(4.9, 52.37)
        assert abs(x - 121687) < 500, f"Expected x ~121687, got {x}"
        assert abs(y - 487484) < 500, f"Expected y ~487484, got {y}"

    def test_rd_wgs84_round_trip(self):
        """Convert RD -> WGS84 -> RD and verify within tolerance."""
        original_x, original_y = 121687.0, 487484.0
        lon, lat = rd_to_wgs84(original_x, original_y)
        x, y = wgs84_to_rd(lon, lat)
        assert abs(x - original_x) < 0.01, f"X round-trip error: {abs(x - original_x)}"
        assert abs(y - original_y) < 0.01, f"Y round-trip error: {abs(y - original_y)}"
